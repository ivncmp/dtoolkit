<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/dcouncil</h1>
<p align="center">Multi-agent debate for architecture decisions</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dcouncil"><img src="https://img.shields.io/npm/v/@dtoolkit/dcouncil.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

> **Status:** not yet implemented

## What it does

Launches 3 agents with distinct perspectives — security, performance, simplicity — and produces a structured comparison. Get a second (and third) opinion without biasing the first agent.

```bash
dcouncil "should we use Redis or SQLite for session storage?"
dcouncil --perspectives "cost,latency,ops" "migrate to microservices?"
```

## License

[MIT](../../LICENSE)
