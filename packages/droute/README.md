<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/droute</h1>
<p align="center">Model router with cost tracking and per-project policies</p>

<p align="center">
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-coming%20soon-yellow" alt="Coming Soon">
</p>

> This package is part of the dtoolkit roadmap and is not yet functional.

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
