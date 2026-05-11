<p align="center">
  <img src="https://raw.githubusercontent.com/ivncmp/dtoolkit/main/logo.png" alt="dtoolkit" />
</p>

<h1 align="center">@dtoolkit/dpolicy</h1>
<p align="center">Policy-as-code for the team harness</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dpolicy"><img src="https://img.shields.io/npm/v/@dtoolkit/dpolicy.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

> **Status:** not yet implemented

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
