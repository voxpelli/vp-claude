## Shared Patterns

- **Reciprocal Rank Fusion for hybrid lexical+dense search** (2026-07-02) — `@voxpelli/md-wiki-vec` fuses its BM25 (lexical) and cosine-similarity (dense) arms via RRF, a rank-based fusion needing no score normalization or per-arm weight tuning. This is the same technique already documented in Basic Memory as a general engineering pattern (`Reciprocal Rank Fusion — Combining Lexical and Dense Retrievers`) — a case of the pattern being independently applied in a tool this project's ecosystem now touches.
  Status: aligned · Last verified: 2026-07-02

## Divergences

_No entries yet._

## Extraction Candidates

_No entries yet._

## They Have / We Don't

- **A precomputed, git-committable vector index that mostly sidesteps the per-process embedding-load cost** (2026-07-02) — `@voxpelli/md-wiki-vec` is an independent, clean-room companion tool (v0.1 pre-release, MIT, "contains no source code from any third-party knowledge-management project" per its own README) built by the same maintainer, living as the `.md-wiki-vec` subpackage of the `voxpelli/my-basic-memory` fork on branch `claude/basic-memory-embed-js-EWxfO`. It is explicitly designed to be data-compatible with basic-memory's Markdown conventions (frontmatter, `## Observations`/`## Relations`, `[[wikilinks]]`) without sharing code. Its architecture is a genuinely different answer to the 2026-07-02 finding that each concurrent Claude Code session spawns its own `basic-memory` MCP server, each loading a live Python/`fastembed` embedding model (see `SYNERGY-liggare-mcp.md` and Basic Memory notes `pypi-fastembed` / `MCP stdio Server Lifecycle and Orphaning`): md-wiki-vec embeds the vault ONCE, commits the resulting NDJSON sidecars to git as plain, reproducible, byte-identical text, and at query time only re-embeds the query itself — its own bench data (`bench/README.md`, 2026-06-16, Apple M1) shows `loadIndex` at ~92.5% of search latency (790ms) vs. embedding the query at <1% (6.7ms). If this precomputed-index model were ever relevant to basic-memory's own live semantic-search path, it would eliminate the per-session live-model-residency cost rather than just relocating or pooling it — worth treating as a genuinely distinct architecture option, not assuming it's "the JS port of the same approach." Not yet a concrete proposal: whether/how this connects to basic-memory's own production search path is unconfirmed.
  Priority: consider · Effort: significant
