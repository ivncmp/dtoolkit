<p align="center">
  <img src="../../logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/droute</h1>
<p align="center">Model router with cost tracking and per-project policies</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/droute"><img src="https://img.shields.io/npm/v/@dtoolkit/droute.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

> **Status:** not yet implemented

## What it does

Decides at runtime which model to use based on the task:

- Trivial questions → Haiku (fast, cheap)
- Code search / exploration → Sonnet (balanced)
- Complex codegen → Opus (maximum quality)

Configurable policies per project. Estimated 50–70% token savings with the right model for each task.

```bash
droute status               # show current routing config
droute cost --week          # cost report by model
```

## License

[MIT](../../LICENSE)
