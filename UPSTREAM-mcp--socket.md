# Upstream: socket-mcp

Friction and observations about Socket.dev's `socket-mcp` MCP server (HTTP
transport at `https://mcp.socket.dev/`, source at `SocketDev/socket-mcp`) —
integrated into `/package-intel` as the 7th enrichment source in v0.27.0.

Findings below are validated against the socket-mcp source (`lib/purl.ts`,
`lib/artifacts.ts`, `purl.test.ts`), Socket's public docs
(`docs.socket.dev/docs/language-support`, `docs.socket.dev/docs/guide-to-socket-mcp`),
and the MCP launch blog (`socket.dev/blog/socket-mcp`).

## Feature Requests

- **Add `mode: "advisory" | "halt"` parameter to `depscore`, or split into advisory vs. gate tools** (2026-04-19) — The tool description bakes in `"Stop generating code and ask the user how to proceed when any of the scores are low."` This is intentional product design — Socket's launch framing is explicitly about interrupting AI-generated code before risky deps land. For non-codegen consumers (research, documentation, advisory pipelines) the directive is wrong by default. Socket's own docs acknowledge the gap by inviting rule customization (`"you can guide the AI assistant on how to handle low scores"`), but the structural fix is a parameter or a tool split: `depscore_check` (advisory) vs `depscore_gate` (halt). \[upstream: [socket.dev/blog/socket-mcp](https://socket.dev/blog/socket-mcp)\]
  Ownership: upstream · Workaround: full — include an explicit "do not halt on low scores" override in consuming skill/agent prose. The directive is advisory text, not enforced behavior.

- **Add `listecosystems` discovery tool, or enumerate supported tokens in `depscore` description** (2026-04-19) — `socket-mcp`'s manifest declares only `depscore`. There is no programmatic way to discover which ecosystem tokens are supported. The MCP README says `"npm, pypi, cargo, etc."` without enumerating, and the source's `purl.test.ts` tests seven ecosystems of which only six actually return data from the backend (see Maven/Java bug below). Consumers must probe experimentally per release. A `listecosystems` tool returning the authoritative working set (with canonical tokens and accepted aliases) would let downstream agents auto-gate calls. Simpler alternative: include the list inline in `depscore`'s description so schema introspection surfaces it.
  Ownership: upstream · Workaround: partial — maintain a locally-verified working-set list and re-probe periodically.

## Bugs

- **MCP ecosystem surface is a proper subset of Socket's product surface** (2026-04-19) \[degraded\] — Socket.dev's public docs list 11 supported ecosystems with varying maturity. The MCP `depscore` tool returns scored rows for only six empirically: `npm`, `pypi`, `cargo`, `gem`, `golang`, `nuget`. Ecosystems with Socket product support that silently return nothing via MCP include Java/Maven (`maven`, `mvn`, `java` all empty), Composer (`composer` returns `"No score found"`, `packagist` empty), GitHub Actions, Swift, Scala, and Kotlin. The root cause is the `/v0/purl` backend silently rejecting these PURLs rather than the MCP wrapper — but the friction surfaces at the MCP boundary.
  Severity: degraded · Ownership: upstream · Workaround: full — branch on presence of score data in the response per-package; maintain an empirically-verified working set (as of 2026-04-19: `npm, pypi, cargo, gem, golang, nuget`) and re-probe on socket-mcp version bumps.

- **Ecosystem tokens silently aliased or silently dropped with no validation signal** (2026-04-19) \[minor\] — Source review of `lib/purl.ts` shows only `ecosystem.toLowerCase()` — no alias table, no validation. Normalization and acceptance happen entirely in Socket's backend API (`/v0/purl`). Undocumented consequences: passing `"crate"` returns data scoped as `pkg:cargo/...` (silent rename); passing `"go"` returns no row at all (the correct token is `golang`, confirmed by `purl.test.ts`); passing `"rubygems"` dedupes with `"gem"`. Users have no programmatic signal that their input was coerced or dropped — detection requires inspecting the returned `pkg:<eco>/...` URL and comparing it to what was requested.
  Severity: minor · Ownership: upstream · Workaround: full — use canonical tokens (`npm, pypi, cargo, gem, golang, nuget`) and inspect response pkg URLs for silent server-side normalization.

- **Version `"1.0.0"` silently treated as sentinel — real v1.0.0 packages never get version-pinned scores** (2026-04-19) \[minor\] — `lib/purl.ts` in `SocketDev/socket-mcp` contains: `const purlVersion = (version === 'unknown' || version === '1.0.0' || !version) ? undefined : version`. The literal string `"1.0.0"` is hardcoded as a sentinel alongside `"unknown"` and empty string — likely because a default value was leaking through from some upstream caller. Consequence: any real-world package at version 1.0.0 never gets a version-specific score; Socket returns the latest-version score instead. Affects a non-trivial slice of early-stable packages across all ecosystems. Detectable only by inspecting the returned `pkg:<eco>/<name>@<version>` where `<version>` differs from what was requested.
  Severity: minor · Ownership: upstream · Workaround: partial — pass `"unknown"` explicitly when version-pinning matters; verify returned pkg URL version matches requested.

- **Maven/Java codepath is tested and shipped, but backend returns empty** (2026-04-19) \[minor\] — `lib/purl.ts` contains dedicated Maven namespace-splitting logic (`groupId:artifactId` → `pkg:maven/groupId/artifactId`) and `purl.test.ts` explicitly exercises it with test cases. Socket's product docs list Java/Maven as supported. Empirical MCP probing returns no scored rows for `maven`, `mvn`, or `java` tokens. This is a tested-but-dead codepath: the MCP wrapper is prepared to encode Maven PURLs, but the `/v0/purl` backend silently rejects them. Either the backend needs Maven enablement, or the codepath should be removed until parity is reached.
  Severity: minor · Ownership: upstream · Workaround: none — Maven/Java users cannot use socket-mcp for dependency scoring. Use Socket's REST API or web UI directly until backend parity is reached.

## Upstream Opportunities

- **Typo fix (`monifest` → `manifest`) in `depscore` tool description, paired with a softened halt directive** (2026-04-19) — The `depscore` tool description contains the typo `"monifest files"` alongside the halt-on-low-scores directive. A PR that fixes the typo is low-friction and trivially mergeable. Adjacent prose could be softened in the same PR — for example, replacing `"Stop generating code and ask the user how to proceed when any of the scores are low"` with `"If scores are low, surface them to the user; in code-generation contexts, consider pausing to confirm."` The typo fix carries the behavioral wording change as cover, increasing the probability of acceptance vs. a standalone "please remove this directive" PR.
  Source: draft PR against `SocketDev/socket-mcp` tool description in `index.ts` · Merge readiness: direct
  Ownership: us · Workaround: full — consumers already override in skill prose. This is about reducing the override burden for future integrators.
