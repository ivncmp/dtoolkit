---
"@dtoolkit/dbrain": patch
---

fix: republish with resolved workspace:\* dependencies

dbrain@1.0.0 was published to npm with unresolved `workspace:*` in its dependencies
(`@dtoolkit/core` and `@dtoolkit/sdk`), causing `npm i -g @dtoolkit/dbrain` to fail
with EUNSUPPORTEDPROTOCOL. This patch triggers a republish with properly resolved versions.
