---
'@dtoolkit/codegraph-sdk': minor
'@dtoolkit/dwork': minor
'@dtoolkit/sdk': minor
'@dtoolkit/dcontext': minor
---

Code graph integration across the dtoolkit suite:

- **codegraph-sdk**: New package — semantic code intelligence SDK forked from @colbymchenry/codegraph (library-only, no CLI/MCP)
- **dwork**: Codegraph integration — multi-graph service, REST API, MCP graph tools (search, stats, trace, impact, context), Cytoscape.js interactive visualization with minimap/LOD/context menus, project-graph cross-links in dashboard, inline edit project name/description, update_project and update_doc MCP tools, move task between projects
- **sdk**: DWorkClient graph methods — upload, query, CRUD, subgraph, dead code, circular deps
- **dcontext**: `dcontext sync` command to index codebase and upload graph to dwork, enrich session briefing with code graph insights
