# Upstream: context7

Friction against the Context7 MCP server, which powers `resolve-library-id` and
`query-docs` as an enrichment source in `/package-intel`. Two Context7 server
instances are wired into this environment — `claude_ai_Context7` and
`plugin_context7_context7` — so a defect here is plausibly a shared upstream
parameter-schema issue rather than a config issue local to one install, though
the bug below has only been confirmed reproduced on one instance; it has not
been independently verified against the second. **Which upstream repo owns the
fix is not confirmed** — likely `upstash/context7` (the widely-known
open-source Context7 MCP server) or possibly an Anthropic-side wrapper/fork;
this file does not assert a specific repo.

## Feature Requests

_No entries yet._

## Bugs

- **`resolve-library-id` parameter schema is unsatisfiable — rejects both `libraryName` and `query`** (2026-07-02) \[degraded\] — There is no valid way to call `resolve-library-id`. Passing `libraryName="X"` errors `Invalid input: expected string, received undefined` at path `query`; passing `query="X"` instead errors the same at path `libraryName`. The tool appears to require both parameters simultaneously, while the skill-facing documentation and canonical example prose only describe passing `libraryName`. Triggered three times in Sprint 26 during `/package-intel` runs, on `umzeption`, `npm-run-all2`, and the `@rjsf` trio.
  Repro: (1) call `resolve-library-id` with `libraryName="npm-run-all2"` → error complaining `query` is missing; (2) retry with `query="npm-run-all2"` instead → error complaining `libraryName` is missing.
  Severity: degraded · Ownership: upstream · Workaround: full — `/package-intel` and `/tool-intel` both already treat Context7 as an optional enrichment source with an explicit "skip Source B if it returns no useful result" fallback branch, so a failed `resolve-library-id` call degrades gracefully to the other sources rather than blocking either skill. No skill-file changes needed; this entry exists so the defect gets filed upstream at the user's discretion rather than staying silently worked around.

## Upstream Opportunities

_No entries yet._
