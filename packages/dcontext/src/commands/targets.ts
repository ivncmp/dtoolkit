import { createClaudeTarget } from '@dtoolkit/adapter-claude';
import { createGeminiTarget } from '@dtoolkit/adapter-gemini';
import { createOpenCodeTarget } from '@dtoolkit/adapter-opencode';
import type { Target } from '@dtoolkit/core';

import type { TargetName } from '../core/config.js';

const targets: Record<TargetName, () => Target> = {
  claude: createClaudeTarget,
  gemini: createGeminiTarget,
  opencode: createOpenCodeTarget,
};

export function resolveTarget(name: TargetName): Target | null {
  const factory = targets[name];
  return factory ? factory() : null;
}

export function targetNames(): TargetName[] {
  return Object.keys(targets) as TargetName[];
}
