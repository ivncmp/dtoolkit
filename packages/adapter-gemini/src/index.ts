import { spawn } from "node:child_process";

import type { Adapter, AdapterRequest, AdapterResult, AdapterUsage } from "@dtoolkit/core";

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
              `${this.bin} CLI not found. Make sure Gemini CLI is installed and on your PATH.`,
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

        try {
          const parsed = JSON.parse(stdout);

          // Extract usage from stats.models.*.tokens (first model found)
          let usage: AdapterUsage | undefined;
          let modelName: string | undefined;
          const stats = parsed.stats as Record<string, unknown> | undefined;
          if (stats) {
            const models = stats["models"] as Record<string, Record<string, unknown>> | undefined;
            if (models) {
              const firstModelKey = Object.keys(models)[0];
              if (firstModelKey) {
                modelName = firstModelKey;
                const tokens = models[firstModelKey]["tokens"] as Record<string, number> | undefined;
                if (tokens) {
                  usage = {
                    inputTokens: tokens["input"] ?? 0,
                    outputTokens: tokens["candidates"] ?? 0,
                    totalTokens: tokens["total"] ?? 0,
                  };
                }
              }
            }
          }

          resolve({
            text: parsed.response ?? parsed.result ?? parsed.content ?? stdout.trim(),
            sessionId: parsed.session_id ?? undefined,
            durationMs,
            isError: parsed.is_error ?? false,
            usage,
            model: modelName,
            raw: parsed,
          });
        } catch {
          resolve({
            text: stdout.trim(),
            durationMs,
            isError: code !== 0,
          });
        }
      });
    });
  }

  private buildArgs(request: AdapterRequest): string[] {
    const args = ["-p", request.prompt, "--output-format", "json", "--skip-trust"];

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
