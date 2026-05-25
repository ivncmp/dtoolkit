<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/dstream</h1>
<p align="center">Daily digest — what each agent learned, decided, or blocked today</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dstream"><img src="https://img.shields.io/npm/v/@dtoolkit/dstream.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

> **Status:** not yet implemented

## What it does

Auto-generates a daily stream of what the team's agents did — not commits, but **what they learned, what they decided, and where they got blocked**. Extracted from conversation logs and dbrain facts.

Replaces standups with real information.

```bash
dstream                    # today's digest
dstream --since yesterday  # last 24h
dstream --team             # all team members
```

## License

[MIT](../../LICENSE)
