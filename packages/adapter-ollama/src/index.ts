import { spawn } from "node:child_process";

import type { Adapter, AdapterRequest, AdapterResult } from "@dtoolkit/core";

export interface OllamaAdapterConfig {
  bin?: string;
  defaultModel?: string;
}

export class OllamaAdapter implements Adapter {
  readonly provider = "ollama";
  private readonly bin: string;
  private readonly defaultModel: string;

  constructor(config: OllamaAdapterConfig = {}) {
    this.bin = config.bin ?? "ollama";
    this.defaultModel = config.defaultModel ?? "llama3";
  }

  async execute(request: AdapterRequest): Promise<AdapterResult> {
    const model = request.model ?? this.defaultModel;
    const args = this.buildArgs(model, request);
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

      proc.stdin.end();

      proc.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          reject(
            new Error(
              `${this.bin} CLI not found. Make sure Ollama is installed and on your PATH.`,
            ),
          );
        } else {
          reject(err);
        }
      });

      proc.on("close", (code: number | null) => {
        const durationMs = Date.now() - startTime;

        // eslint-disable-next-line no-control-regex
        const clean = stdout.replace(/\x1B\[[0-9;]*[A-Za-z]|\x1B\[\?[0-9;]*[A-Za-z]|\r/g, "").trim();

        if (code !== 0 && !clean) {
          reject(new Error(stderr || `${this.bin} exited with code ${code}`));
          return;
        }

        resolve({
          text: clean,
          durationMs,
          isError: code !== 0,
          model,
        });
      });
    });
  }

  private buildArgs(model: string, request: AdapterRequest): string[] {
    const args = ["run", model, "--hidethinking", "--nowordwrap"];

    if (request.options?.["verbose"]) {
      args.push("--verbose");
    }

    args.push(request.prompt);
    return args;
  }
}

export function createOllamaAdapter(config?: OllamaAdapterConfig): OllamaAdapter {
  return new OllamaAdapter(config);
}
