<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/dguard</h1>
<p align="center">Pre-commit for agents — validate LLM output before applying</p>

<p align="center">
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-coming%20soon-yellow" alt="Coming Soon">
</p>

> This package is part of the dtoolkit roadmap and is not yet functional.

## What it does

Deterministic validation layer that runs **before** the agent's output is applied:

- Does the diff touch forbidden files?
- Does the command match a suspicious pattern?
- Did the LLM invent an import that doesn't exist?
- Does the change violate team policies (via `@dtoolkit/dpolicy`)?

No LLM involved — pure deterministic checks for speed and reliability.

```bash
dguard check                # validate staged changes
dguard install              # install as pre-commit hook
```

## License

[MIT](../../LICENSE)
