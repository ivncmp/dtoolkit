import { spawn } from "node:child_process";

import type { Adapter, AdapterRequest, AdapterResult, AdapterUsage } from "@dtoolkit/core";

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
              `${this.bin} CLI not found. Make sure OpenCode is installed and on your PATH.`,
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
        let sessionId: string | undefined;
        let usage: AdapterUsage | undefined;
        let costUsd: number | undefined;
        let raw: unknown;

        if (jsonLines.length > 0) {
          try {
            const events = jsonLines.map((line) => JSON.parse(line));
            raw = events;

            const texts: string[] = [];
            for (const event of events) {
              const ev = event as Record<string, unknown>;
              if (!sessionId && typeof ev["sessionID"] === "string") {
                sessionId = ev["sessionID"] as string;
              }

              // Extract text from "text" events
              if (ev["type"] === "text") {
                const part = ev["part"] as Record<string, unknown> | undefined;
                if (part && typeof part["text"] === "string") {
                  texts.push(part["text"] as string);
                }
              }

              // Extract usage and cost from step_finish
              if (ev["type"] === "step_finish") {
                const part = ev["part"] as Record<string, unknown> | undefined;
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
            }
            text = texts.length > 0 ? texts.join("") : stdout.trim();
          } catch {
            text = stdout.trim();
          }
        } else {
          text = stdout.trim();
        }

        resolve({
          text,
          sessionId,
          costUsd,
          durationMs,
          isError: code !== 0,
          usage,
          raw,
        });
      });
    });
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
