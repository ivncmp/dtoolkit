import { spawn } from "node:child_process";

import type {
  Adapter,
  AdapterRequest,
  AdapterResult,
  AdapterStreamEvent,
  AdapterUsage,
} from "@dtoolkit/core";
import { LineBuffer } from "@dtoolkit/core";

export interface ClaudeAdapterConfig {
  bin?: string;
  skipPermissions?: boolean;
}

export class ClaudeAdapter implements Adapter {
  readonly provider = "claude";
  private readonly bin: string;
  private readonly skipPermissions: boolean;

  constructor(config: ClaudeAdapterConfig = {}) {
    this.bin = config.bin ?? "claude";
    this.skipPermissions = config.skipPermissions ?? false;
  }

  async execute(request: AdapterRequest): Promise<AdapterResult> {
    let finalResult: AdapterResult | undefined;
    for await (const event of this.stream(request)) {
      if (event.type === "result") finalResult = event.result;
    }
    if (!finalResult) throw new Error("No result event received from Claude CLI");
    return finalResult;
  }

  async *stream(request: AdapterRequest): AsyncGenerator<AdapterStreamEvent> {
    const args = this.buildArgs(request);
    const startTime = Date.now();
    const lineBuffer = new LineBuffer();

    const { stdout, done } = spawnProcess(this.bin, args, request.stdinContent);

    let fullText = "";
    let sessionId: string | undefined;
    let costUsd: number | undefined;
    let usage: AdapterUsage | undefined;
    let model: string | undefined;
    let isError = false;
    let raw: unknown;

    for await (const chunk of stdout) {
      const lines = lineBuffer.push(chunk);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>;
          const type = parsed["type"] as string;

          if (type === "stream_event") {
            const event = parsed["event"] as Record<string, unknown> | undefined;
            if (event?.["type"] === "content_block_delta") {
              const delta = event["delta"] as Record<string, unknown> | undefined;
              if (delta?.["type"] === "text_delta" && typeof delta["text"] === "string") {
                const text = delta["text"] as string;
                fullText += text;
                yield { type: "text", text, raw: parsed };
              }
            }
          }

          if (type === "assistant") {
            if (!sessionId) sessionId = parsed["session_id"] as string | undefined;
          }

          if (type === "result") {
            raw = parsed;
            const resultText = parsed["result"] as string | undefined;
            if (resultText && !fullText) {
              fullText = resultText;
            }
            sessionId = parsed["session_id"] as string | undefined;
            costUsd = (parsed["cost_usd"] ?? parsed["total_cost_usd"]) as number | undefined;
            isError = (parsed["is_error"] as boolean) ?? false;
            model = parsed["model"] as string | undefined;
            const u = parsed["usage"] as Record<string, number> | undefined;
            if (u) {
              usage = {
                inputTokens: u["input_tokens"] ?? 0,
                outputTokens: u["output_tokens"] ?? 0,
                totalTokens:
                  (u["input_tokens"] ?? 0) +
                  (u["output_tokens"] ?? 0) +
                  (u["cache_creation_input_tokens"] ?? 0) +
                  (u["cache_read_input_tokens"] ?? 0),
              };
            }
          }
        } catch {
          // non-JSON line, skip
        }
      }
    }

    const { code, stderrText } = await done;
    const durationMs = Date.now() - startTime;

    if (code !== 0 && !fullText) {
      throw new Error(stderrText || `${this.bin} exited with code ${code}`);
    }

    yield {
      type: "result",
      result: {
        text: fullText,
        sessionId,
        costUsd,
        durationMs,
        isError,
        usage,
        model,
        raw,
      },
    };
  }

  private buildArgs(request: AdapterRequest): string[] {
    const args = ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages"];

    if (this.skipPermissions) {
      args.push("--dangerously-skip-permissions");
    }

    if (request.model) {
      args.push("--model", request.model);
    }

    if (request.maxTurns !== undefined) {
      args.push("--max-turns", String(request.maxTurns));
    }

    if (request.systemPrompt) {
      args.push("--system-prompt", request.systemPrompt);
    }

    const appendSystemPrompt = request.options?.["appendSystemPrompt"] as string | undefined;
    if (appendSystemPrompt) {
      args.push("--append-system-prompt", appendSystemPrompt);
    }

    if (request.sessionId) {
      args.push("--resume", request.sessionId);
    }

    if (request.continueSession) {
      args.push("--continue");
    }

    const allowedTools = request.options?.["allowedTools"] as string[] | undefined;
    if (allowedTools) {
      for (const tool of allowedTools) {
        args.push("--allowedTools", tool);
      }
    }

    const maxBudgetUsd = request.options?.["maxBudgetUsd"] as number | undefined;
    if (maxBudgetUsd !== undefined) {
      args.push("--max-budget-usd", String(maxBudgetUsd));
    }

    const additionalArgs = request.options?.["additionalArgs"] as string[] | undefined;
    if (additionalArgs) {
      args.push(...additionalArgs);
    }

    args.push(request.prompt);
    return args;
  }
}

export function createClaudeAdapter(config?: ClaudeAdapterConfig): ClaudeAdapter {
  return new ClaudeAdapter(config);
}

function spawnProcess(
  bin: string,
  args: string[],
  stdinContent?: string,
): {
  proc: ReturnType<typeof spawn>;
  stdout: AsyncIterable<string>;
  stderr: AsyncIterable<string>;
  done: Promise<{ code: number | null; stderrText: string }>;
} {
  const proc = spawn(bin, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  if (stdinContent) {
    proc.stdin.write(stdinContent);
  }
  proc.stdin.end();

  let stderrText = "";
  proc.stderr.on("data", (data: Buffer) => {
    stderrText += data.toString();
  });

  const stdout = (async function* () {
    for await (const chunk of proc.stdout) {
      yield (chunk as Buffer).toString();
    }
  })();

  const stderr = (async function* () {
    for await (const chunk of proc.stderr) {
      yield (chunk as Buffer).toString();
    }
  })();

  const done = new Promise<{ code: number | null; stderrText: string }>((resolve, reject) => {
    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(`${bin} CLI not found. Make sure it is installed and on your PATH.`),
        );
      } else {
        reject(err);
      }
    });
    proc.on("close", (code) => {
      resolve({ code, stderrText });
    });
  });

  return { proc, stdout, stderr, done };
}
