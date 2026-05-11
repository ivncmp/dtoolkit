# dtoolkit

Open-source harness engineering toolkit for AI coding agents.

## Monorepo structure

```
packages/       # publishable packages (@dtoolkit/*)
tools/          # internal tooling (tsconfig, etc.)
apps/           # applications (future)
```

## CLI conventions

All CLI packages in this monorepo must use the same libraries and style:

| Concern | Library | Notes |
| --- | --- | --- |
| Colors | `picocolors` | Never chalk, kleur, or others |
| Interactive prompts | `@clack/prompts` | Never raw readline or enquirer |
| CLI framework | `commander` | For argument parsing and command routing |
| YAML | `yaml` | When needed |

Style rules:
- Errors in red (`pc.red()`), success in green (`pc.green()`), secondary info in dim (`pc.dim()`), highlights in blue (`pc.blue()`)
- Interactive wizards use @clack/prompts (intro, text, select, confirm, outro)
- All commands must check initialization with a preAction guard where applicable

## Build & dev

```bash
pnpm install
pnpm build        # turbo run build (all packages)
pnpm test         # turbo run test
pnpm lint         # eslint
pnpm format       # prettier
```

## Release flow

Uses changesets for versioning and publishing:

```bash
pnpm changeset          # create a changeset
git push                # triggers release workflow
                        # → creates "chore: version packages" PR
                        # → merge PR → publishes to npm + creates GitHub Releases
```

## Code conventions

- Strict TypeScript
- Commits in English
- Tests with vitest
- ESM only (`"type": "module"`)
- All local imports use `.js` extensions
