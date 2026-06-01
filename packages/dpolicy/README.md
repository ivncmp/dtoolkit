<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/dpolicy</h1>
<p align="center">Policy-as-code for the team harness</p>

<p align="center">
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-coming%20soon-yellow" alt="Coming Soon">
</p>

> This package is part of the dtoolkit roadmap and is not yet functional.

## What it does

Centralized rules that apply to all agents on the team — synced via repo, versioned, deterministic. Replaces scattered `settings.json` files on individual machines.

Example policies:

- "never commit directly to main"
- "`rm -rf` always requires confirmation"
- "`bq` commands only from allow-list"
- "max $5 per session budget"

dpolicy is a **library** (no CLI) — consumed by `@dtoolkit/dguard` and other enforcement tools.

## License

[MIT](../../LICENSE)
