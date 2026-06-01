---
"@dtoolkit/dbrain": patch
---

fix: resolve workspace:\* dependencies on npm publish

Changed release script from `changeset publish` to `pnpm changeset publish` so pnpm resolves `workspace:*` to real version numbers before uploading to the registry. Previous versions (0.6.1, 0.6.2) were published with unresolved `workspace:*` deps, causing `EUNSUPPORTEDPROTOCOL` on `npm install`.
