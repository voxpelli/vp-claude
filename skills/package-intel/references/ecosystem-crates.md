# Crates.io Ecosystem — Registry Resolution

Use this reference file during Step 2 (Resolve repository) when the detected
ecosystem is `crate`.

## Resolve Crate Metadata

crates.io provides a free JSON API. **A `User-Agent` header is required** — the
API will reject requests without it. The rate limit is 1 request/second.

Prefer `tavily_extract` over `Bash curl` because tavily handles headers
automatically. Use `Bash curl` only if tavily is unavailable:

**Option A — tavily_extract (preferred):**
```
tavily_extract(
  urls=["https://crates.io/api/v1/crates/<name>"],
  query="repository version license downloads"
)
```

**Option B — Bash curl (fallback, includes required User-Agent):**
```bash
curl -s -H "User-Agent: package-intel/vp-knowledge" \
  "https://crates.io/api/v1/crates/<name>"
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

If making multiple crates.io API calls in sequence, add a 1-second delay between
`curl` requests. `tavily_extract` batches are handled server-side and do not
require manual rate limiting.
