## Shared Patterns

_No entries yet._

## Divergences

_No entries yet._

## Extraction Candidates

_No entries yet._

## They Have / We Don't

- **A working local hybrid FTS5+vector-search stack in Node/TS** (2026-07-02) — vp-knowledge's cross-project knowledge graph (via Basic Memory) has the underlying need for fast, light local semantic search, but currently depends on Basic Memory's Python/`fastembed`(ONNX) implementation, which carries a real per-process embedding-model-load cost under concurrent MCP sessions (see `SYNERGY-basic-memory.md`). `liggare-mcp` already has a proven, shipped local hybrid FTS5 + vector-search implementation using `@huggingface/transformers` + `sqlite-vec` — a different stack solving a structurally similar problem, for a different corpus (short TODO/FIXME comments vs. long-form notes). Not yet a reuse proposal: the corpora differ enough that its specific model/chunking choices may not transfer wholesale. Next step (not yet done): read `liggare-mcp`'s embedding module and diff it against the in-progress `basic-memory-embed-js` port's plan before assuming portability.
  Priority: consider · Effort: moderate
