import { createClaudeAdapter } from '@dtoolkit/adapter-claude';
import { createCodexAdapter } from '@dtoolkit/adapter-codex';
import { createGeminiAdapter } from '@dtoolkit/adapter-gemini';
import { createOpenCodeAdapter } from '@dtoolkit/adapter-opencode';

import type { Adapter, AppConfig, ProviderName } from './types.js';

export function resolveAdapter(provider: ProviderName, config: AppConfig): Adapter {
  switch (provider) {
    case 'claude':
      return createClaudeAdapter(config.provider.claude);
    case 'codex':
      return createCodexAdapter(config.provider.codex);
    case 'gemini':
      return createGeminiAdapter(config.provider.gemini);
    case 'opencode':
      return createOpenCodeAdapter(config.provider.opencode);
    default:
      throw new Error(`Unknown provider: ${provider as string}`);
  }
}
