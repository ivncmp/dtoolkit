import { spawn } from "node:child_process";

import type { Adapter, AdapterRequest, AdapterResult, AdapterUsage } from "@dtoolkit/core";

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
              `${this.bin} CLI not found. Make sure Claude Code is installed and on your PATH.`,
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
          const u = parsed.usage ?? {};
          const usage: AdapterUsage = {
            inputTokens: u.input_tokens ?? 0,
            outputTokens: u.output_tokens ?? 0,
            totalTokens:
              (u.input_tokens ?? 0) +
              (u.output_tokens ?? 0) +
              (u.cache_creation_input_tokens ?? 0) +
              (u.cache_read_input_tokens ?? 0),
          };
          resolve({
            text: parsed.result ?? parsed.content ?? stdout,
            sessionId: parsed.session_id ?? undefined,
            costUsd: parsed.cost_usd ?? parsed.total_cost_usd ?? undefined,
            durationMs,
            isError: parsed.is_error ?? false,
            usage,
            model: parsed.model ?? undefined,
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
    const args = ["-p", "--output-format", "json"];

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
