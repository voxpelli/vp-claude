# Upstream: socket-mcp

Friction and observations about Socket.dev's `socket-mcp` MCP server (HTTP
transport at `https://mcp.socket.dev/`) — integrated into `/package-intel`
as the 7th enrichment source in v0.27.0.

## Feature Requests

_No entries yet._

## Bugs

- **`depscore` tool description prescribes halt-on-low-scores behavior** (2026-04-19) \[degraded\] — The MCP tool description includes: "Stop generating code and ask the user how to proceed when any of the scores are low." This bakes a specific use-case assumption (code generation) into the tool's public contract. For research, documentation, or advisory use cases — e.g., writing a package intel note that _records_ low scores as a `[security]` observation — the directive is wrong: halting mid-research aborts the enrichment pipeline on any legacy package with low maintenance scores. Consumers must explicitly override this in prose every time they integrate depscore.
  Severity: degraded · Ownership: shared · Workaround: full — include an explicit "do not halt on low scores" instruction in the consuming skill/agent prose; the directive is advisory text, not enforced behavior.

- **MCP `ecosystem` token accepts arbitrary strings with silent normalization and silent no-data failures** (2026-04-19) \[degraded\] — Three related issues on the `ecosystem` parameter:
  1. **Silent normalization.** `ecosystem: "crate"` returns data scoped as `pkg:cargo/...` — the input token is silently coerced to `cargo`. Only detectable by inspecting the returned pkg URL. A consumer using `"crate"` as their canonical Rust token would have no programmatic signal that Socket renamed it.
  2. **MCP surface is a subset of Socket's public product surface.** Socket.dev publicly supports JavaScript/TypeScript, Python, **Go**, Ruby, Java, and Rust (per `socket.dev` and Series B materials). Empirical MCP probing returns data for npm, pypi, cargo, and gem, but `ecosystem: "go"` with `github.com/gin-gonic/gin` returns no row at all (not "No score found" — just absent from the response). Either Go uses a different token not documented in the MCP schema, or the MCP interface genuinely lacks Go coverage that the main product has. No discovery endpoint exists to resolve this.
  3. **Silent dropping on unsupported ecosystems.** `ecosystem: "composer"` returns `"No score found"` — at least this is an explicit signal — but the absence of any documented list of supported tokens means consumers must probe experimentally for every ecosystem they want to support.
  Severity: degraded · Ownership: upstream · Workaround: full — branch on presence of score data in response per-package, never pre-gate by ecosystem. Document the empirically-verified working set (npm/pypi/cargo/gem as of 2026-04-19) in consuming code and re-probe periodically.

## Upstream Opportunities

_No entries yet._
