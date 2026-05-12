# @dtoolkit/dproxy

## 2.0.0

### Major Changes

- 3852021: Implement 5 CLI adapters (claude, codex, gemini, ollama, opencode) and refactor dproxy to multi-provider architecture with --provider flag.

### Patch Changes

- a05b65b: fix: read version dynamically instead of hardcoding, fix LineBuffer lint warning
- Updated dependencies [a05b65b]
- Updated dependencies [3852021]
  - @dtoolkit/core@0.2.1
  - @dtoolkit/adapter-claude@2.0.0
  - @dtoolkit/adapter-codex@2.0.0
  - @dtoolkit/adapter-gemini@2.0.0
  - @dtoolkit/adapter-ollama@2.0.0
  - @dtoolkit/adapter-opencode@2.0.0

## 0.2.0

### Minor Changes

- 1dea7ae: Migrate chalk to picocolors, unify CLI library conventions
