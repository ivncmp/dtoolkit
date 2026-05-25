<p align="center">
  <img src="../../logo.png" alt="dtoolkit" width="420"/>
</p>

<h1 align="center">@dtoolkit/dforge</h1>
<p align="center">Internal marketplace for skills, hooks, and slash commands</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dtoolkit/dforge"><img src="https://img.shields.io/npm/v/@dtoolkit/dforge.svg" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

> **Status:** not yet implemented

## What it does

Central repo for the team's slash commands, skills, and hooks. Auto-installs when you `cd` into a project (via hook). Versioned, tested, documented.

Stop copying `.claude/` between machines.

```bash
dforge search auth          # find skills related to auth
dforge install review-pr    # install a skill
dforge publish my-skill     # publish to the team registry
dforge sync                 # sync all installed skills to latest
```

## License

[MIT](../../LICENSE)
