<p align="center">
  <img src="../../logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/dprime</h1>
<p align="center">Auto-briefing before touching a module</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dprime"><img src="https://img.shields.io/npm/v/@dtoolkit/dprime.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

> **Status:** not yet implemented

## What it does

`dprime <path>` produces the perfect briefing before you start working on a module:

- Relevant facts from dbrain (team + personal)
- Git blame context — who touched what and when
- Past architectural decisions and their rationale
- Known gotchas and broken tests
- Injected as a temporary `CLAUDE.md` in the session

Kills the 20-minute "explore until you understand the module" phase.

## Design

dprime **only produces text** — it doesn't persist anything (that's dbrain) and doesn't invoke models (that's dproxy). Pure read-only briefing builder.

```bash
dprime ./src/billing                        # standalone briefing to stdout
dproxy ask "refactor billing" --prime ./src/billing  # injected into session
```

## License

[MIT](../../LICENSE)
