import { spawn } from "node:child_process";

import type {
  Adapter,
  AdapterRequest,
  AdapterResult,
  AdapterStreamEvent,
  AdapterUsage,
} from "@dtoolkit/core";
import { LineBuffer, embedTextFiles } from "@dtoolkit/core";

export interface CodexAdapterConfig {
  bin?: string;
  approval?: "suggest" | "auto-edit" | "full-auto";
}

export class CodexAdapter implements Adapter {
  readonly provider = "codex";
  private readonly bin: string;
  private readonly approval: string;

  constructor(config: CodexAdapterConfig = {}) {
    this.bin = config.bin ?? "codex";
    this.approval = config.approval ?? "suggest";
  }

  async execute(request: AdapterRequest): Promise<AdapterResult> {
    let finalResult: AdapterResult | undefined;
    for await (const event of this.stream(request)) {
      if (event.type === "result") finalResult = event.result;
    }
    if (!finalResult) throw new Error("No result event received from Codex CLI");
    return finalResult;
  }

  async *stream(request: AdapterRequest): AsyncGenerator<AdapterStreamEvent> {
    let effectiveRequest = request;
    if (request.files?.length) {
      const { prompt, remaining } = embedTextFiles(request.prompt, request.files);
      if (remaining.length > 0) {
        throw new Error("codex adapter does not yet support binary file attachments");
      }
      effectiveRequest = { ...request, prompt, files: undefined };
    }

    const args = this.buildArgs(effectiveRequest);
    const startTime = Date.now();
    const lineBuffer = new LineBuffer();

    const proc = spawn(this.bin, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    if (effectiveRequest.stdinContent) {
      proc.stdin.write(effectiveRequest.stdinContent);
    }
    proc.stdin.end();

    let stderrText = "";
    proc.stderr.on("data", (data: Buffer) => {
      stderrText += data.toString();
    });

    const messages: string[] = [];
    let usage: AdapterUsage | undefined;
    const raw: unknown[] = [];

    const errorPromise = new Promise<never>((_, reject) => {
      proc.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          reject(
            new Error(`${this.bin} CLI not found. Make sure Codex is installed and on your PATH.`),
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

          if (type === "item.completed") {
            const item = parsed["item"] as Record<string, unknown> | undefined;
            if (item && typeof item["text"] === "string") {
              const text = item["text"] as string;
              messages.push(text);
              yield { type: "text" as const, text, raw: parsed };
            }
          }

          if (type === "turn.completed") {
            const u = parsed["usage"] as Record<string, number> | undefined;
            if (u) {
              usage = {
                inputTokens: u["input_tokens"] ?? 0,
                outputTokens: u["output_tokens"] ?? 0,
                totalTokens: (u["input_tokens"] ?? 0) + (u["output_tokens"] ?? 0),
              };
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

    if (code !== 0 && messages.length === 0) {
      throw new Error(stderrText || `${this.bin} exited with code ${code}`);
    }

    yield {
      type: "result",
      result: {
        text: messages.join("\n"),
        durationMs,
        isError: code !== 0,
        usage,
        raw,
      },
    };
  }

  private buildArgs(request: AdapterRequest): string[] {
    const args = ["exec", "--json"];

    if (request.model) {
      args.push("-m", request.model);
    }

    if (this.approval === "full-auto") {
      args.push("--dangerously-bypass-approvals-and-sandbox");
    } else if (this.approval === "auto-edit") {
      args.push("-s", "workspace-write");
    }

    args.push(request.prompt);
    return args;
  }
}

export function createCodexAdapter(config?: CodexAdapterConfig): CodexAdapter {
  return new CodexAdapter(config);
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
