---
'@dtoolkit/dbrain': patch
'@dtoolkit/dcontext': patch
---

fix: deduplicate dcontext log extraction to dbrain

POST /conversations is now idempotent — returns existing conversation when called with a known ID. dcontext tracks the last saved message offset per session and only sends new messages on each pre-compact, avoiding duplicate conversation entries in dbrain.
