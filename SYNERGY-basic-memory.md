## Shared Patterns

_No entries yet._

## Divergences

- **Per-process embedding cost vs. an in-progress JS embedding port** (2026-07-02) — Production experience running the current Python/`fastembed` (ONNX) semantic-search implementation surfaced a real per-process cost: each concurrent Claude Code session spawns its own `basic-memory` MCP server over stdio, and each independently loads its own embedding model instance. Observed: ~10 concurrent sessions correlated with the `mcp:basic-memory` fleet footprint growing from ~3.0 to ~5.25 GiB. The `claude/basic-memory-embed-js` worktree is porting/adding a JS embedding path — this operational finding is a design input for that work, not (yet) a verdict: it's unconfirmed whether the true marginal cost is that high, since the ONNX model's read-only weight pages may already be shared across processes via the OS's unified buffer cache (check `vmmap -summary`'s Shared-Clean vs Private split before assuming naive N× summation is real waste). Full findings + a verified `semantic_search_enabled: false` mitigation and the existing `bm mcp --transport streamable-http` shared-daemon mode are documented in Basic Memory notes `pypi-fastembed` and `MCP stdio Server Lifecycle and Orphaning`.
  Convergence path: propose-shared

## Extraction Candidates

_No entries yet._

## They Have / We Don't

_No entries yet._
