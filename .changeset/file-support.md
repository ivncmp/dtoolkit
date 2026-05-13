---
"@dtoolkit/core": minor
"@dtoolkit/adapter-claude": minor
"@dtoolkit/adapter-codex": minor
"@dtoolkit/adapter-gemini": minor
"@dtoolkit/adapter-ollama": minor
"@dtoolkit/adapter-opencode": minor
"@dtoolkit/dproxy": minor
"@dtoolkit/sdk": minor
---

feat: add file support across the stack (text, images, PDFs)

New `InputFile` type and `files` field in `AdapterRequest` allow passing files alongside prompts.
Text files are embedded directly in the prompt; binary files (images, PDFs) are embedded as base64 blocks.

- **core**: `InputFile`, `embedTextFiles()`, `detectMimeType()`, `isTextFile()`
- **adapters**: all 5 adapters call `embedTextFiles()` to handle attached files
- **dproxy CLI**: `--file <path>` flag (repeatable) reads files from disk
- **dproxy HTTP**: `files` field in `POST /v1/ask` request body
- **SDK**: `files` in `AskOptions`, `InputFile` re-exported
