import { spawn } from "node:child_process";

import type {
  Adapter,
  AdapterRequest,
  AdapterResult,
  AdapterStreamEvent,
  AdapterUsage,
} from "@dtoolkit/core";
import { LineBuffer } from "@dtoolkit/core";

export interface GeminiAdapterConfig {
  bin?: string;
  yolo?: boolean;
}

export class GeminiAdapter implements Adapter {
  readonly provider = "gemini";
  private readonly bin: string;
  private readonly yolo: boolean;

  constructor(config: GeminiAdapterConfig = {}) {
    this.bin = config.bin ?? "gemini";
    this.yolo = config.yolo ?? false;
  }

  async execute(request: AdapterRequest): Promise<AdapterResult> {
    let finalResult: AdapterResult | undefined;
    for await (const event of this.stream(request)) {
      if (event.type === "result") finalResult = event.result;
    }
    if (!finalResult) throw new Error("No result event received from Gemini CLI");
    return finalResult;
  }

  async *stream(request: AdapterRequest): AsyncGenerator<AdapterStreamEvent> {
    const args = this.buildArgs(request);
    const startTime = Date.now();
    const lineBuffer = new LineBuffer();

    const proc = spawn(this.bin, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    if (request.stdinContent) {
      proc.stdin.write(request.stdinContent);
    }
    proc.stdin.end();

    let stderrText = "";
    proc.stderr.on("data", (data: Buffer) => {
      stderrText += data.toString();
    });

    const texts: string[] = [];
    let sessionId: string | undefined;
    let usage: AdapterUsage | undefined;
    let modelName: string | undefined;
    let isError = false;
    const raw: unknown[] = [];

    const errorPromise = new Promise<never>((_, reject) => {
      proc.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          reject(
            new Error(
              `${this.bin} CLI not found. Make sure Gemini CLI is installed and on your PATH.`,
            ),
          );
        } else {
          reject(err);
        }
      });
    });

    const stdoutIter = (async function* () {
      for await (const chunk of proc.stdout) {
        yield (chunk as Buffer).toString();
      }
    })();

    for await (const chunk of race(stdoutIter, errorPromise)) {
      const lines = lineBuffer.push(chunk);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>;
          raw.push(parsed);
          const type = parsed["type"] as string;

          if (type === "init") {
            sessionId = parsed["session_id"] as string | undefined;
            modelName = parsed["model"] as string | undefined;
          }

          if (type === "message") {
            const role = parsed["role"] as string | undefined;
            if (role === "assistant" && typeof parsed["content"] === "string") {
              const text = parsed["content"] as string;
              texts.push(text);
              yield { type: "text" as const, text, raw: parsed };
            }
          }

          if (type === "result") {
            const status = parsed["status"] as string | undefined;
            isError = status !== "success";
            const stats = parsed["stats"] as Record<string, number> | undefined;
            if (stats) {
              usage = {
                inputTokens: stats["input_tokens"] ?? 0,
                outputTokens: stats["output_tokens"] ?? 0,
                totalTokens: stats["total_tokens"] ?? 0,
              };
            }
          }

          if (type === "error") {
            isError = true;
          }
        } catch {
          // non-JSON line
        }
      }
    }

    const code = await new Promise<number | null>((resolve) => {
      proc.on("close", resolve);
    });
    const durationMs = Date.now() - startTime;

    if (code !== 0 && texts.length === 0) {
      throw new Error(stderrText || `${this.bin} exited with code ${code}`);
    }

    yield {
      type: "result",
      result: {
        text: texts.join(""),
        sessionId,
        durationMs,
        isError,
        usage,
        model: modelName,
        raw,
      },
    };
  }

  private buildArgs(request: AdapterRequest): string[] {
    const args = ["-p", request.prompt, "--output-format", "stream-json", "--skip-trust"];

    if (request.model) {
      args.push("-m", request.model);
    }

    if (this.yolo) {
      args.push("-y");
    }

    if (request.sessionId) {
      args.push("--resume", request.sessionId);
    }

    return args;
  }
}

export function createGeminiAdapter(config?: GeminiAdapterConfig): GeminiAdapter {
  return new GeminiAdapter(config);
}

async function* race<T>(
  iter: AsyncIterable<T>,
  errorPromise: Promise<never>,
): AsyncIterable<T> {
  const iterator = iter[Symbol.asyncIterator]();
  try {
    while (true) {
      const next = await Promise.race([iterator.next(), errorPromise]);
      if (next.done) break;
      yield next.value;
    }
  } finally {
    await iterator.return?.(undefined);
  }
}
