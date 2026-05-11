import { spawn } from "node:child_process";

import type { Adapter, AdapterRequest, AdapterResult, AdapterUsage } from "@dtoolkit/core";

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
    const args = this.buildArgs(request);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const proc = spawn(this.bin, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      if (request.stdinContent) {
        proc.stdin.write(request.stdinContent);
      }
      proc.stdin.end();

      proc.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          reject(
            new Error(
              `${this.bin} CLI not found. Make sure Codex is installed and on your PATH.`,
            ),
          );
        } else {
          reject(err);
        }
      });

      proc.on("close", (code: number | null) => {
        const durationMs = Date.now() - startTime;

        if (code !== 0 && !stdout.trim()) {
          reject(new Error(stderr || `${this.bin} exited with code ${code}`));
          return;
        }

        const jsonLines = stdout
          .trim()
          .split("\n")
          .filter((line) => line.trim());

        let text = "";
        let raw: unknown;
        let usage: AdapterUsage | undefined;

        if (jsonLines.length > 0) {
          try {
            const events = jsonLines.map((line) => JSON.parse(line));
            raw = events;
            // Extract text from item.completed events (agent_message)
            const messages: string[] = [];
            for (const event of events) {
              const ev = event as Record<string, unknown>;
              if (ev["type"] === "item.completed") {
                const item = ev["item"] as Record<string, unknown> | undefined;
                if (item && typeof item["text"] === "string") {
                  messages.push(item["text"] as string);
                }
              }
              // Extract usage from turn.completed
              if (ev["type"] === "turn.completed") {
                const u = ev["usage"] as Record<string, number> | undefined;
                if (u) {
                  usage = {
                    inputTokens: u["input_tokens"] ?? 0,
                    outputTokens: u["output_tokens"] ?? 0,
                    totalTokens: (u["input_tokens"] ?? 0) + (u["output_tokens"] ?? 0),
                  };
                }
              }
            }
            text = messages.length > 0 ? messages.join("\n") : stdout.trim();
          } catch {
            text = stdout.trim();
          }
        } else {
          text = stdout.trim();
        }

        resolve({
          text,
          durationMs,
          isError: code !== 0,
          usage,
          raw,
        });
      });
    });
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
