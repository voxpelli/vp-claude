## Shared Patterns

_No entries yet._

## Divergences

_No entries yet._

## Extraction Candidates

_No entries yet._

## They Have / We Don't

- **A working local hybrid FTS5+vector-search stack in Node/TS, and now a second one exists too** (2026-07-02, corrected) — vp-knowledge's cross-project knowledge graph (via Basic Memory) has the underlying need for fast, light local semantic search, but currently depends on Basic Memory's Python/`fastembed`(ONNX) implementation, which carries a real per-process embedding-model-load cost under concurrent MCP sessions (see Basic Memory notes `pypi-fastembed` / `MCP stdio Server Lifecycle and Orphaning`). `liggare-mcp` already has a proven, shipped local hybrid FTS5 + vector-search implementation using `@huggingface/transformers` + `sqlite-vec`. **Correction:** an earlier version of this entry speculated about an "in-progress basic-memory embed-js port" reusing liggare-mcp's stack — that was based on an incomplete read of the actual sibling; the real artifact is `@voxpelli/md-wiki-vec` (tracked separately in `SYNERGY-md-wiki-vec.md`), an independent, clean-room tool with its own precomputed/git-committed index architecture, not a from-scratch reimplementation needing liggare-mcp's guidance. It's still notable that both `md-wiki-vec` and `liggare-mcp` — two separate tools by the same maintainer — already converged on `@huggingface/transformers` independently; that's a real signal worth a reading-pass comparison (model choice, chunking, quantization) between the two existing implementations, not a "should X learn from Y" question, since both already exist and made their own choices for their own corpora (short TODO/FIXME comments vs. long-form wiki notes).
  Priority: consider · Effort: moderate
