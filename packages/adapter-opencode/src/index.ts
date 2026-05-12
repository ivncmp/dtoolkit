import { spawn } from "node:child_process";

import type {
  Adapter,
  AdapterRequest,
  AdapterResult,
  AdapterStreamEvent,
  AdapterUsage,
} from "@dtoolkit/core";
import { LineBuffer } from "@dtoolkit/core";

export interface OpenCodeAdapterConfig {
  bin?: string;
  skipPermissions?: boolean;
}

export class OpenCodeAdapter implements Adapter {
  readonly provider = "opencode";
  private readonly bin: string;
  private readonly skipPermissions: boolean;

  constructor(config: OpenCodeAdapterConfig = {}) {
    this.bin = config.bin ?? "opencode";
    this.skipPermissions = config.skipPermissions ?? false;
  }

  async execute(request: AdapterRequest): Promise<AdapterResult> {
    let finalResult: AdapterResult | undefined;
    for await (const event of this.stream(request)) {
      if (event.type === "result") finalResult = event.result;
    }
    if (!finalResult) throw new Error("No result event received from OpenCode CLI");
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
    let costUsd: number | undefined;
    const raw: unknown[] = [];

    const errorPromise = new Promise<never>((_, reject) => {
      proc.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          reject(
            new Error(
              `${this.bin} CLI not found. Make sure OpenCode is installed and on your PATH.`,
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

          if (!sessionId && typeof parsed["sessionID"] === "string") {
            sessionId = parsed["sessionID"] as string;
          }

          const type = parsed["type"] as string;

          if (type === "text") {
            const part = parsed["part"] as Record<string, unknown> | undefined;
            if (part && typeof part["text"] === "string") {
              const text = part["text"] as string;
              texts.push(text);
              yield { type: "text" as const, text, raw: parsed };
            }
          }

          if (type === "step_finish") {
            const part = parsed["part"] as Record<string, unknown> | undefined;
            if (part) {
              const tokens = part["tokens"] as Record<string, number> | undefined;
              if (tokens) {
                usage = {
                  inputTokens: tokens["input"] ?? 0,
                  outputTokens: tokens["output"] ?? 0,
                  totalTokens: tokens["total"] ?? 0,
                };
              }
              if (typeof part["cost"] === "number") {
                costUsd = part["cost"] as number;
              }
            }
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
        costUsd,
        durationMs,
        isError: code !== 0,
        usage,
        raw,
      },
    };
  }

  private buildArgs(request: AdapterRequest): string[] {
    const args = ["run", "--format", "json"];

    if (request.model) {
      args.push("-m", request.model);
    }

    if (this.skipPermissions) {
      args.push("--dangerously-skip-permissions");
    }

    if (request.sessionId) {
      args.push("-s", request.sessionId);
    }

    if (request.continueSession) {
      args.push("-c");
    }

    args.push(request.prompt);
    return args;
  }
}

export function createOpenCodeAdapter(config?: OpenCodeAdapterConfig): OpenCodeAdapter {
  return new OpenCodeAdapter(config);
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
