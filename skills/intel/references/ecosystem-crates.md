# Crates.io Ecosystem — Registry Resolution

Use this reference file during Step 2 (Resolve repository) when the detected
ecosystem is `crate`.

> **Canonical version for staleness (`--stale`):** record
> `.crate.max_stable_version` (prerelease-safe) as this note's version.
> `scripts/fetch-crate-upstream.sh` compares against the same field, so
> `/knowledge-gaps --stale` and a subsequent `/intel` refresh converge
> on the same value.

## Resolve Crate Metadata

crates.io provides a free JSON API. **A `User-Agent` header is required** — the
API will reject requests without it, and the crates.io crawler policy (RFC 3463)
asks that it identify the application **and carry contact info** (a repo URL or
email in parentheses) rather than just an HTTP-client string like `reqwest/0.9.1`,
which risks being blocked. The rate limit is 1 request/second.

This is a raw JSON registry endpoint, not HTML — fetch it directly via `Bash`
with `curl`+`jq` rather than `tavily_extract`: cheaper (no MCP round-trip) and
shape-exact (no HTML-extraction lossiness). The required `User-Agent` header
must be set explicitly on the `curl` call (tavily would have handled headers
automatically, but curl does not):

```bash
curl -fsSL --max-time 30 -H "User-Agent: vp-knowledge (https://github.com/voxpelli/vp-claude)" \
  "https://crates.io/api/v1/crates/<name>" | jq .
```

## Key Response Fields

From `https://crates.io/api/v1/crates/<name>`:

| JSON path | Meaning |
|-----------|---------|
| `crate.repository` | GitHub URL (e.g., `https://github.com/owner/repo`) |
| `crate.newest_version` | Latest stable version |
| `crate.license` | SPDX license string |
| `crate.downloads` | All-time download count |
| `crate.description` | Short crate description |
| `crate.categories` | Category slugs (e.g. `command-line-utilities`, `development-tools`) — the CLI-distribution signal the agent-leverage check gates on |
| `crate.keywords` | Keyword strings (e.g. `cli`, `command-line`) — secondary CLI signal (OR-combined) |

Extract `owner/repo` from `crate.repository` for DeepWiki calls.

Extract `crate.downloads` (all-time integer) for the `[popularity]` observation.
Format as `XM total downloads (crates.io, YYYY-MM)`.

## Security Advisories

Rust uses RUSTSEC advisory IDs (format: `RUSTSEC-YYYY-NNNN`). For security
research in Step 3c, use:
```
tavily_search(query="<crate-name> RUSTSEC vulnerability <current-year>")
```

The RustSec advisory database at `rustsec.org/advisories` is the authoritative
source — include it in your Tavily search terms.

## Rate Limit Note

If making multiple crates.io API calls in sequence, add a 1-second delay
between `curl` requests to stay within the 1 request/second limit.
