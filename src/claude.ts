import { spawn } from 'node:child_process';

import { loadConfig } from './lib/config.js';
import type { ClaudeOptions, ClaudeResult, ClaudeUsage } from './lib/types.js';

/**
 * Execute a prompt via the Claude CLI (`claude --print`).
 * Spawns the configured binary, passes all options as flags, and parses
 * the JSON response into a structured {@link ClaudeResult}.
 */
export async function execClaude(options: ClaudeOptions): Promise<ClaudeResult> {
  const config = await loadConfig();
  const args = buildArgs(options, config.claude?.skipPermissions ?? false);
  const bin = config.claude?.bin || 'claude';
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    if (options.stdinContent) {
      proc.stdin.write(options.stdinContent);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error('claude CLI not found. Make sure Claude Code is installed and on your PATH.'),
        );
      } else {
        reject(err);
      }
    });

    proc.on('close', (code) => {
      const durationMs = Date.now() - startTime;

      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr || `claude exited with code ${code}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        const u = parsed.usage ?? {};
        const usage: ClaudeUsage = {
          input: u.input_tokens ?? 0,
          output: u.output_tokens ?? 0,
          cacheWrite: u.cache_creation_input_tokens ?? 0,
          cacheRead: u.cache_read_input_tokens ?? 0,
          total:
            (u.input_tokens ?? 0) +
            (u.output_tokens ?? 0) +
            (u.cache_creation_input_tokens ?? 0) +
            (u.cache_read_input_tokens ?? 0),
        };
        resolve({
          result: parsed.result ?? parsed.content ?? stdout,
          sessionId: parsed.session_id ?? '',
          costUsd: parsed.cost_usd ?? parsed.total_cost_usd ?? 0,
          durationMs,
          isError: parsed.is_error ?? false,
          usage,
          raw: parsed,
        });
      } catch {
        // If JSON parsing fails, return raw text
        resolve({
          result: stdout.trim(),
          sessionId: '',
          costUsd: 0,
          durationMs,
          isError: code !== 0,
        });
      }
    });
  });
}

/** Translate {@link ClaudeOptions} into CLI argument array for `claude --print`. */
function buildArgs(options: ClaudeOptions, skipPermissions: boolean): string[] {
  const args = ['--print', '--output-format', 'json'];

  if (skipPermissions) {
    args.push('--dangerously-skip-permissions');
  }

  if (options.model) {
    args.push('--model', options.model);
  }

  if (options.maxTurns !== undefined) {
    args.push('--max-turns', String(options.maxTurns));
  }

  if (options.maxBudgetUsd !== undefined) {
    args.push('--max-budget-usd', String(options.maxBudgetUsd));
  }

  if (options.systemPrompt) {
    args.push('--system-prompt', options.systemPrompt);
  }

  if (options.appendSystemPrompt) {
    args.push('--append-system-prompt', options.appendSystemPrompt);
  }

  if (options.resumeSessionId) {
    args.push('--resume', options.resumeSessionId);
  }

  if (options.continueSession) {
    args.push('--continue');
  }

  if (options.allowedTools) {
    for (const tool of options.allowedTools) {
      args.push('--allowedTools', tool);
    }
  }

  if (options.additionalArgs) {
    args.push(...options.additionalArgs);
  }

  // Prompt goes last
  args.push(options.prompt);

  return args;
}

/**
 * Read piped stdin content, if available.
 * Returns an empty string when stdin is a TTY (interactive terminal).
 * Times out after 5 seconds to prevent hanging on broken pipes.
 */
export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return '';
  }

  return new Promise((resolve) => {
    let data = '';
    const timeout = setTimeout(() => resolve(data), 5000);
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}
