<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/dops</h1>
<p align="center">Agent observability — tokens, cost, tools, success rate, errors</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dops"><img src="https://img.shields.io/npm/v/@dtoolkit/dops.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

> **Status:** not yet implemented

## What it does

Datadog for AI coding agents. Team dashboard with:

- Tokens and cost per dev / project
- Most used tools and longest sessions
- Success ratio and error rate per hook
- Antipattern detection (e.g. excessive compactions, repeated tool failures)

```bash
dops                       # open dashboard
dops report --week         # weekly summary to stdout
dops cost --project api    # cost breakdown for a project
```

## License

[MIT](../../LICENSE)
