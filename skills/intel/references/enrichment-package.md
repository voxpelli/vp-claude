# Package Enrichment — Seven Sources

**Read this file IN FULL** before running package-family enrichment. Loaded by
`/intel` Step 3 when `FAMILY=package`. Run the seven sources below (in parallel
where possible). Each ecosystem's skip/run gates are explicit and MUST stay
explicit — never collapse them into a generic "run these N sources" loop.


**Multi-query strategy:** For DeepWiki and Context7, ask 2-3 targeted questions
rather than one broad query. Example angles: API design, gotchas/pitfalls,
configuration. Varied queries yield richer results than a single comprehensive
question.

Launch these research queries simultaneously:

**a) DeepWiki — architecture and design (GitHub-only):**

**Skip this source when `repo_forge != github`** (from Step 2) — DeepWiki
indexes only GitHub repositories. Note the skip in Step 6 synthesis; it is
expected behavior for non-GitHub forges, not an error.
```
ask_question(repo="owner/repo", question="What are the key APIs, design patterns, gotchas, and configuration options?")
```

**Hallucination caveat** — DeepWiki can return information about a *different* repo with a similar name (e.g., Sprint 19 observed `noctx`/`go-critic` info returned for a query about `timakin/bodyclose`). If answers look wrong-repo or cite unrelated APIs, fall back to `gh api` against the actual source repo per [`gh-api-fallback.md`](gh-api-fallback.md).

**Indexing lag** — DeepWiki re-indexes periodically, so for actively developed packages, recently added APIs may not appear yet. When the changelog step (3e) surfaces a version newer than what DeepWiki describes, treat its API coverage as incomplete for that version range and supplement from the changelog or commit log.

**b) Context7 — API reference:**
```
resolve-library-id(libraryName="<package-name>")
query-docs(libraryId="<resolved-id>", topic="API usage examples")
```

Context7 is npm-biased. Attempt `resolve-library-id` for all ecosystems. If it
returns no useful result or an unrelated library, skip source b and proceed with
the remaining four sources. Note "source b unavailable" in your synthesis.

**c) Tavily — security and recent changes:**
```
tavily_search(query="<package-name> <ecosystem> CVE vulnerability <current-year-minus-1> <current-year>", max_results=5)
```

Adjust the search term for each ecosystem's advisory format:
- npm: `CVE` / GitHub Security Advisories
- crate: `RUSTSEC` (see `ecosystem-crates.md`)
- pypi: PyPA advisories are in the API response — check `vulnerabilities` field
- gem: RubySec advisories
- go/composer: CVE format

**d) Raindrop — bookmarked articles:**
```
find_bookmarks(search="<package-name>")
```

If bookmarks are found, fetch content from the top 2-3 most relevant results
(judge relevance by title and tags matching the package):
```
fetch_bookmark_content(bookmark_id=<id>)
```

These are articles the user deliberately saved — high relevance signal.

**e) Changelog — version history and breaking changes:**

**Forge branch:** if `repo_forge != github` (from Step 2), follow the
forge-specific changelog procedure in
[`forge-fallback.md`](forge-fallback.md) instead of the
`gh` commands below (Codeberg/Forgejo REST is shape-isomorphic to these; other
forges fall back to Tavily), then continue to Step 3f. The GitHub path below
applies when `repo_forge == github`.
```bash
# GitHub releases first (structured, usually has migration notes)
gh release list --repo owner/repo --limit 10 2>/dev/null
# For a specific release with full notes:
gh release view vX.Y.Z --repo owner/repo 2>/dev/null
```

<!-- Staleness-detection logic is mirrored in the tool-family enrichment (enrichment-tool.md) — update both. Recording target differs by ecosystem: ## Release Highlights here, a [version] observation there. -->
**Release-list staleness** — compare the newest GitHub Release against the `latest`/`version` from the registry API (Step 2). If the registry version is *newer* than the newest Release, or `gh release list` is empty for an otherwise active repo, the release list lags reality (a tag was pushed without a Release). Recover the latest tag:
```bash
gh api repos/owner/repo/tags --jq '.[].name' 2>/dev/null | head -20
```
The `/tags` and `gh release list` outputs are *not* semver-sorted, and an error reads the same as an empty result — re-run without `2>/dev/null` to confirm the command exited 0, then apply the sorting, pre-release, and error≠empty rules in [`gh-api-fallback.md`](gh-api-fallback.md) ("Recovering a Version/Changelog from Tags"). Then derive the changelog. With a prior Release, diff against it:
```bash
gh api repos/owner/repo/compare/<last-release-tag>...<newest-tag> \
  --jq '.commits[].commit.message | split("\n")[0]' 2>/dev/null
```
With no prior Release to compare from, list recent commits via `gh api "repos/owner/repo/commits?sha=<newest-tag>"`. Record the recovered version in `## Release Highlights` with explicit provenance, e.g. `vX.Y.Z (git tag <tag-name>, no GitHub Release as of YYYY-MM-DD)` — and curate the commit subjects (skip merges and internal refactors) rather than dumping them.

If `gh` is not installed or both the release list and tags return nothing, fall back to:
```
tavily_extract(urls=["https://github.com/owner/repo/blob/main/CHANGELOG.md"], query="breaking changes migration")
```

When sources a (DeepWiki) and b (Context7) underperform on niche repos, [`gh-api-fallback.md`](gh-api-fallback.md) lists `gh api` endpoints (contents, commits, issues, PRs, contributors) plus a verification rule for cited issue/PR numbers — closed-years-ago issues read as live concerns when search snippets cite them.

**f) Readwise — curated personal insights:**
```
readwise_search_highlights(vector_search_term="<package-name>")
reader_search_documents(query="<package-name> <ecosystem>")
```

Highlights contain expert-selected passages from the user's reading (books,
articles, documentation). These have high signal-to-noise ratio and may surface
insights not found in any other source. Reader documents may contain in-depth
articles about the package.

If results found, extract patterns, gotchas, and best practices for observations.
If both return empty, note "source f: no Readwise content found" and proceed.

**g) Socket — supply-chain risk scoring:**

```
depscore(packages=[{"depname": "<package-name>", "ecosystem": "<socket-ecosystem>", "version": "unknown"}])
```

Map our prefix to Socket's ecosystem token:

| Our prefix | Socket `ecosystem` |
|-----------|-------------------|
| `npm` | `npm` |
| `pypi` | `pypi` |
| `crate` | `cargo` (note the rename) |
| `gem` | `gem` |
| `go` | `go` |
| `composer` | `composer` |

If the response contains a score line for the package (format
`pkg:<eco>/<name>@<version>: license: N, maintenance: N, quality: N, supplyChain: N, vulnerability: N`),
emit one `[security]` observation in Step 4:

```
- [security] Socket depscore: license <n>, maintenance <n>, quality <n>, supply-chain <n>, vulnerability <n> (as of YYYY-MM-DD)
```

If the response says "No score found" or omits the package, skip silently —
Socket does not yet cover this ecosystem. Empirically, npm, pypi, cargo, and
gem return data; go and composer currently return nothing (2026-04).

**Do NOT halt research on low scores.** Socket's MCP description instructs the
caller to stop generating code when scores are low — this is a research skill,
not a code-generation gate. Record the scores as observations and continue.

**Curate aggressively** — only track changes relevant to the user's projects.
Judge relevance from two sources:
1. **Codebase context** — how the package is imported/used, which APIs are called,
   platform targets, language version range
2. **Knowledge graph** — `build_context` or `search_notes` for existing notes
   referencing this package

Skip internal refactors, unused new features, and fixes for untargeted platforms.
The goal is a short, high-signal list — not a changelog mirror.

**Always include links** to the release page or PR for each notable change.

## Agent-leverage surface check (`npm:`, `crate:`, `pypi:` only — optional addendum beyond the seven sources above; not counted in the headline seven)

*How would a coding agent best use this package's CLI?* Mirrors the tool family's
Agent-leverage surface check (`references/enrichment-tool.md`) — same bifurcation
(an **MCP-native** path only if the package ships an MCP server; a
**machine-readable CLI** path `--json`/`--format`/`--reporter`/`-o json` usable by
any bash agent, e.g. Claude Code's Bash tool, pi.dev, CI), same `[agent-leverage]`
category, same honesty gate, same `Agent-Tool Leverage — MCP Server or
Machine-Readable CLI, Assessed Per Tool` hub-note cross-link. **Runs only for
`npm:`/`crate:`/`pypi:`** — `go:`, `composer:`, and `gem:` skip this addendum
entirely (no cheap CLI signal in their already-fetched Step-2 metadata; revive if
that changes).

**CLI-distribution pre-filter (per prefix; a library-only package is skipped
silently — Step 6: intentionally-skipped).** The pre-filter is deliberately
*permissive* (a false-positive just runs a doc-search that records nothing; a
false-negative silently loses coverage), read from the already-fetched Step-2
registry metadata — no new fetch:

- **`npm:`** — the packument `bin` field is present (object `name→path`, or a bare
  string). Structural signal; the `bin` name(s) are the literal binary name(s),
  which can differ from the package name (`typescript` ships `tsc`/`tsserver`).
- **`crate:`** — the crates.io `categories` array contains `command-line-utilities`
  OR `development-tools`, OR a `keywords`/`description` mention of `cli`/`command-line`
  (`[[bin]]` is not in the fetched JSON, so this is heuristic — hence the OR).
- **`pypi:`** — `info.classifiers` contains `Environment :: Console`, OR the
  `summary`/`description` mentions a CLI/command-line (classifiers are noisy — OR, not AND).

**Binary resolution — a package CLI is usually NOT installed locally** (notes are
built from registries + DeepWiki, not an install). Resolve WITHOUT ever installing
anything, then route on the outcome — this is the package family's **three-way
split**, which REINTERPRETS `attempted-but-failed` versus the tool family (read
carefully):

1. Resolve the actual binary name (npm `bin` key; crate/pypi from README/registry
   text, defaulting to the package/crate name).
2. Try to locate it along a ladder: `command -v <bin>` → `./node_modules/.bin/<bin>`
   (npm) → `~/.cargo/bin/<bin>` (crate) → `$VIRTUAL_ENV/bin/<bin>` (pypi, if a venv is active).
3. Route:
   - **(1) Live-verifiable** — the binary resolves. Run the identical live probe:
     MCP (`<bin> --help 2>&1 | grep -i mcp`, `<bin> serve --help`, plus a companion
     `<bin>-mcp`/`mcp-server-<bin>` check) + CLI (`<bin> --help 2>&1 | head -100` for
     `--json`/`--format`/exit codes). Step 6: **used** — or **attempted-but-failed**
     ONLY if the resolved binary's own `--help` errors (genuinely rare).
   - **(2) Doc-sourced fallback (expected majority)** — the binary does NOT resolve
     locally. This is the **normal** package case and is **never** attempted-but-failed
     (nothing ran to fail). Search only already-fetched Step-3 **primary** text —
     registry description / README body / homepage — for an **explicit, quoted**
     `--json`/`--format`/MCP flag. Do **NOT** treat a DeepWiki/Context7 AI-summary
     assertion as a confirmed surface (they are summaries, not primary text — the
     durable-write primary-source rule applies). A positive here records with
     provenance `(documented in <source>, not live-verified as of YYYY-MM-DD)` —
     bare text, no markdown link (a link + trailing parenthetical silently drops the
     observation). No explicit primary-source flag found → **ordinary default,
     record nothing**; Step 6: **used** (searched, found nothing). NEVER infer a flag
     from the implementation language; NEVER install the package to enable a probe.
   - **(3) Pre-filter negative** — no CLI signal at all → Step 6: intentionally-skipped.

**Honesty gate + bloat cap — identical to the tool family:** record only a genuine
positive (≤1 `[agent-leverage]` + ≤1 `[pattern]`; a caveat → `[gotcha]`) or a
narrowly-scoped surprising negative (exactly 1 `[agent-leverage]`); an ordinary CLI
with no surface records nothing; a bounded MCP negative uses bounded language ("no
MCP surface in `--help`/`serve --help`/an obvious companion-binary name; a
non-`serve` subcommand or config/env registration not exhaustively checked"), never
an unqualified "best path". There is **no man-page source** in the package family —
do not grep a man-page excerpt; the doc corpus is registry description/README/homepage.
When a finding is recorded, cross-link
`relates_to [[Agent-Tool Leverage — MCP Server or Machine-Readable CLI, Assessed Per Tool]]`
in `## Relations`. On refresh, `find_replace` the existing `[agent-leverage]` line
in place, never append.

