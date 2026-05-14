import { spawn } from "node:child_process";

import type {
  Adapter,
  AdapterRequest,
  AdapterResult,
  AdapterStreamEvent,
} from "@dtoolkit/core";
import { embedTextFiles } from "@dtoolkit/core";

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
    let finalResult: AdapterResult | undefined;
    for await (const event of this.stream(request)) {
      if (event.type === "result") finalResult = event.result;
    }
    if (!finalResult) throw new Error("No result event received from Ollama CLI");
    return finalResult;
  }

  async *stream(request: AdapterRequest): AsyncGenerator<AdapterStreamEvent> {
    let effectiveRequest = request;
    if (request.files?.length) {
      const { prompt, remaining } = embedTextFiles(request.prompt, request.files);
      if (remaining.length > 0) {
        throw new Error("ollama adapter does not yet support binary file attachments");
      }
      effectiveRequest = { ...request, prompt, files: undefined };
    }

    const model = effectiveRequest.model ?? this.defaultModel;
    const args = this.buildArgs(model, effectiveRequest);
    const startTime = Date.now();

    const proc = spawn(this.bin, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    proc.stdin.end();

    let stderrText = "";
    proc.stderr.on("data", (data: Buffer) => {
      stderrText += data.toString();
    });

    // eslint-disable-next-line no-control-regex
    const ansiRegex = /\x1B\[[0-9;]*[A-Za-z]|\x1B\[\?[0-9;]*[A-Za-z]|\r/g;
    const chunks: string[] = [];

    const errorPromise = new Promise<never>((_, reject) => {
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
    });

    const stdoutIter = (async function* () {
      for await (const chunk of proc.stdout) {
        yield (chunk as Buffer).toString();
      }
    })();

    for await (const raw of race(stdoutIter, errorPromise)) {
      const clean = raw.replace(ansiRegex, "");
      if (clean) {
        chunks.push(clean);
        yield { type: "text", text: clean, raw: clean };
      }
    }

    const code = await new Promise<number | null>((resolve) => {
      proc.on("close", resolve);
    });
    const durationMs = Date.now() - startTime;
    const fullText = chunks.join("").trim();

    if (code !== 0 && !fullText) {
      throw new Error(stderrText || `${this.bin} exited with code ${code}`);
    }

    yield {
      type: "result",
      result: {
        text: fullText,
        durationMs,
        isError: code !== 0,
        model,
      },
    };
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
