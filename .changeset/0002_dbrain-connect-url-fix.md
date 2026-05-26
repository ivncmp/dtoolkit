---
"@dtoolkit/dbrain": patch
---

Fix `configureClaude` in connect command to use the user-provided URL instead of the server's Host header, so the recorded MCP URL matches what the user typed.
