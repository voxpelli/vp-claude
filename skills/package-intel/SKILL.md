---
name: package-intel
description: "This skill should be used when the user asks to 'research package', 'package intel', 'what does [npm-pkg] do', 'add package to knowledge graph', 'enrich [pkg]', when adding depends_on [[npm-*]] relations, 'research crate', 'what does [crate] do', 'crate intel', 'rust package', 'pypi package', 'python package', 'go module', 'golang package', 'composer package', 'php package', 'ruby gem', 'gem intel', 'npm outdated', 'upgrade haul', pasted npm/crate/go/composer/pypi/gem upgrade output. Researches a package and creates/updates a structured Basic Memory note with post-write cross-linking. Supports npm, Rust crates, Go modules, PHP Composer packages, Python PyPI packages, and Ruby gems."
user-invocable: true
argument-hint: "<ecosystem>:<package>"
allowed-tools:
  - Bash
  - Read
  - mcp__basic-memory__search_notes
  - mcp__basic-memory__read_note
  - mcp__basic-memory__write_note
  - mcp__basic-memory__edit_note
  - mcp__basic-memory__build_context
  - mcp__basic-memory__list_directory
  - mcp__deepwiki__ask_question
  - mcp__plugin_context7_context7__resolve-library-id
  - mcp__plugin_context7_context7__query-docs
  - mcp__tavily__tavily_search
  - mcp__tavily__tavily_extract
  - mcp__raindrop__find_bookmarks
  - mcp__raindrop__fetch_bookmark_content
  - mcp__readwise__readwise_search_highlights
  - mcp__readwise__reader_search_documents
  - mcp__socket-mcp__depscore
---

# Package Intelligence

Research a package and synthesize a structured Basic Memory note using seven
enrichment sources, then cross-link existing notes. Supports npm, Rust crates,
Go modules, PHP Composer packages, Python PyPI packages, and Ruby gems.

## Arguments

One argument: the package identifier with an optional ecosystem prefix.

| Form | Ecosystem | Example |
|------|-----------|---------|
| `<name>` (no prefix) | npm (default) | `fastify` |
| `npm:<name>` | npm | `npm:fastify` |
| `npm:@scope/<name>` | npm (scoped) | `npm:@fastify/postgres` |
| `crate:<name>` | Rust / crates.io | `crate:serde` |
| `go:<module/path>` | Go modules | `go:github.com/gin-gonic/gin` |
| `composer:<vendor>/<pkg>` | PHP / Packagist | `composer:laravel/framework` |
| `pypi:<name>` | Python / PyPI | `pypi:requests` |
| `gem:<name>` | Ruby / RubyGems | `gem:rails` |

**Backward compatibility:** No prefix always resolves to npm. Scoped npm packages
(`@scope/pkg`) are always npm regardless of the `/` in the name.

## Batch mode: upgrade haul

**Detection hook.** If the input is not a single prefixed identifier but a
**batch** — multiple bare or prefixed package names, OR a pasted upgrade/outdated
command line — treat it as an *upgrade haul* (a batch refresh of already-documented
notes against a version delta) rather than a from-scratch research call. Triggers:

- `npm outdated`, `npm update`, `npm -g outdated`, `npm i a@latest b@latest`
- analogous package-manager upgrade signals from the other five ecosystems:
  `cargo install-update -l` (crate), `go list -u -m all` (go),
  `composer outdated` (composer), `pip list --outdated` (pypi),
  `bundle outdated` (gem)
- two or more bare identifiers pasted together (`fastify pino`, `crate:serde tokio`)

The single prefixed-identifier path (`/package-intel npm:fastify`, or a bare
`fastify`) is **unchanged** — it runs Steps 0–7 exactly as above. The hook only
fires on a batch.

**Load the shared core.** The ecosystem-agnostic mechanics — input parsing /
de-qualification, highlights-reel synthesis across the version delta, the two
recording axes, stale-cache arbitration, batch orchestration, and the `--stale`
relationship — live in
`${CLAUDE_PLUGIN_ROOT}/skills/package-intel/references/upgrade-haul.md`.
Read it now and follow it; this section only encodes the package-intel adapter
contract (input dialect, ecosystem routing, Axis-B target) it delegates back here.

### Adapter contract

This section is the per-skill adapter the shared reference's *Per-skill adapter
contract* requires. It owns three things; everything else (Axis A, orchestration,
arbitration) is shared and lives in the reference. Per-item outcomes and the
batch-close summary follow the shared reference's *Batch-outcome contract* — no
adapter-specific extension needed.

1. **Input dialect.** Strip the command word and flags per the shared core: drop
   `npm` / `npm outdated` / `npm update` / `cargo install-update -l` /
   `go list -u -m all` / `composer outdated` / `pip list --outdated` /
   `bundle outdated`, leading `-`/`--` flags, and any trailing redirect — the
   operands are the identifiers. De-qualify each operand (`pkg@latest`,
   `pkg@^1.2.0` → `pkg`). For an `npm outdated` / `npm -g outdated` table, the
   first column of each row is the identifier; ignore the wanted/latest columns.

2. **Ecosystem routing.** Resolve each de-qualified operand to a canonical note
   the way a single call would — via **Step 0: Detect ecosystem**. Honour an
   explicit per-operand prefix (`crate:serde`); for bare operands, the command
   line's tool fixes the ecosystem (an `npm outdated` paste is all `npm`,
   `bundle outdated` all `gem`, etc.), otherwise fall back to the Step-0
   project-context inference. Scoped npm names (`@scope/pkg`) stay npm. Run the
   Step-1 existence check per operand, globbing the operand's ecosystem directory
   (`npm/`, `crates/`, `go/`, `composer/`, `pypi/`, `gems/`).

3. **Axis-B narrative target — `## Release Highlights`.** Write the curated
   changelog reel for each note's delta into its **`## Release Highlights`**
   section (the prose target the note templates already define). This is the
   package-intel-specific recording target the shared core delegates here.

Per-item freshness fast-pathing (Step 1) and the Axis-A version-slot refresh
(the inline header pipe `GitHub: … | v<version> | <license>`, S2 **Pattern 1**)
are shared orchestration/Axis-A concerns, not adapter-specific — see the shared
core's *Batch orchestration* and *Two recording axes* sections; they apply here
unchanged.

## Ecosystem Dispatch

### Step 0: Detect ecosystem

1. **Explicit prefix** — if the argument contains `:`, the part before `:` is
   the ecosystem. Strip the prefix for the package name.

2. **No prefix** — check project context to infer ecosystem:
   - `Cargo.toml` exists in cwd → **crate** (prompt user to confirm or use `crate:` prefix)
   - `go.mod` exists in cwd → **go** (prompt user to confirm or use `go:` prefix)
   - `composer.json` exists in cwd, no `package.json` → **composer**
   - `pyproject.toml` or `requirements.txt` exists, no `package.json` → **pypi**
   - `Gemfile` exists, no `package.json` → **gem**
   - Otherwise (or `package.json` found) → **npm**

   When inferring, state: "No prefix detected — treating as `<ecosystem>:<name>`
   based on project context. Use an explicit prefix to override."

3. **Ecosystem → BM mapping:**

| Ecosystem | BM Directory | Note type | Reference file |
|-----------|-------------|-----------|----------------|
| `npm` | `npm/` | `npm_package` | `references/ecosystem-npm.md` |
| `crate` | `crates/` | `crate_package` | `references/ecosystem-crates.md` |
| `go` | `go/` | `go_module` | `references/ecosystem-go.md` |
| `composer` | `composer/` | `composer_package` | `references/ecosystem-composer.md` |
| `pypi` | `pypi/` | `pypi_package` | `references/ecosystem-pypi.md` |
| `gem` | `gems/` | `ruby_gem` | `references/ecosystem-gems.md` |

**Title convention:** The user command uses a colon delimiter (`npm:fastify`),
but the BM note title replaces all `:` and `/` with `-` (preserving `@` and
`.`). This matches the filename BM generates and enables native Obsidian
wiki-link resolution. Examples: `npm:fastify` → `npm-fastify`,
`npm:@fastify/postgres` → `npm-@fastify-postgres`,
`go:github.com/gin-gonic/gin` → `go-github.com-gin-gonic-gin`.

### Step 1: Check for existing note

<!-- This pattern is mirrored in tool-intel — update both when changing -->

Fast existence check first (no content loaded):
```
list_directory(dir_name="<ecosystem-dir>", file_name_glob="*<sanitized-pkg-name>*")
```

If found, read the existing note to understand what's already documented:
```
read_note(identifier="<prefix>-<package-name>", include_frontmatter=true, output_format="json")
```

**Freshness check:** Scope research based on note age (check `updated_at`):

| Note age | Sources to run | Sources to skip |
|----------|---------------|-----------------|
| Missing or >180 days | All 7 (full pipeline) | None |
| 60–180 days | All except Raindrop | Raindrop |
| <60 days | DeepWiki + Context7 + changelog + Socket only | Tavily, Raindrop, Readwise |

Always run the changelog step — version history moves fast.
Always fetch download counts — they change weekly and stale numbers mislead.

Note any previous `[gotcha]` or `[limitation]` observations — these should guide
which sources to prioritize and what edge cases to look for in new research.

Append new observations rather than overwriting.

### Step 2: Resolve repository

Read the ecosystem reference file for registry-specific instructions:
`${CLAUDE_PLUGIN_ROOT}/skills/package-intel/references/ecosystem-<ecosystem>.md`

Each reference file explains the registry API, required headers, and how to
extract `owner/repo` for use in the DeepWiki and changelog steps.

**Forge detection:** parse the **host** of the resolved repository URL and hold
it as `repo_forge` for Steps 3a/3e:

| Host | `repo_forge` |
|------|--------------|
| `github.com` | `github` — existing path (gh api, DeepWiki), unchanged |
| `codeberg.org` (or a Forgejo instance) | `codeberg` |
| `*.sr.ht` | `sourcehut` |
| anything else (or no repo URL) | `unknown` |

When `repo_forge != github`, follow
`${CLAUDE_PLUGIN_ROOT}/skills/package-intel/references/forge-fallback.md` for
the DeepWiki-skip rule and the changelog procedure.

If the reference file documents a download stats section, fetch the count now
(in parallel with or immediately after the repository resolution call) and hold
it as `popularity_count` for Step 4.

### Step 3: Seven-source enrichment (run in parallel)

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

**Hallucination caveat** — DeepWiki can return information about a *different* repo with a similar name (e.g., Sprint 19 observed `noctx`/`go-critic` info returned for a query about `timakin/bodyclose`). If answers look wrong-repo or cite unrelated APIs, fall back to `gh api` against the actual source repo per [`references/gh-api-fallback.md`](references/gh-api-fallback.md).

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
- crate: `RUSTSEC` (see `references/ecosystem-crates.md`)
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
[`references/forge-fallback.md`](references/forge-fallback.md) instead of the
`gh` commands below (Codeberg/Forgejo REST is shape-isomorphic to these; other
forges fall back to Tavily), then continue to Step 3f. The GitHub path below
applies when `repo_forge == github`.
```bash
# GitHub releases first (structured, usually has migration notes)
gh release list --repo owner/repo --limit 10 2>/dev/null
# For a specific release with full notes:
gh release view vX.Y.Z --repo owner/repo 2>/dev/null
```

<!-- Staleness-detection logic is mirrored in tool-intel Step 3d — update both. Recording target differs by ecosystem: ## Release Highlights here, a [version] observation there. -->
**Release-list staleness** — compare the newest GitHub Release against the `latest`/`version` from the registry API (Step 2). If the registry version is *newer* than the newest Release, or `gh release list` is empty for an otherwise active repo, the release list lags reality (a tag was pushed without a Release). Recover the latest tag:
```bash
gh api repos/owner/repo/tags --jq '.[].name' 2>/dev/null | head -20
```
The `/tags` and `gh release list` outputs are *not* semver-sorted, and an error reads the same as an empty result — re-run without `2>/dev/null` to confirm the command exited 0, then apply the sorting, pre-release, and error≠empty rules in [`references/gh-api-fallback.md`](references/gh-api-fallback.md) ("Recovering a Version/Changelog from Tags"). Then derive the changelog. With a prior Release, diff against it:
```bash
gh api repos/owner/repo/compare/<last-release-tag>...<newest-tag> \
  --jq '.commits[].commit.message | split("\n")[0]' 2>/dev/null
```
With no prior Release to compare from, list recent commits via `gh api "repos/owner/repo/commits?sha=<newest-tag>"`. Record the recovered version in `## Release Highlights` with explicit provenance, e.g. `vX.Y.Z (git tag <tag-name>, no GitHub Release as of YYYY-MM-DD)` — and curate the commit subjects (skip merges and internal refactors) rather than dumping them.

If `gh` is not installed or both the release list and tags return nothing, fall back to:
```
tavily_extract(urls=["https://github.com/owner/repo/blob/main/CHANGELOG.md"], query="breaking changes migration")
```

When sources a (DeepWiki) and b (Context7) underperform on niche repos, [`references/gh-api-fallback.md`](references/gh-api-fallback.md) lists `gh api` endpoints (contents, commits, issues, PRs, contributors) plus a verification rule for cited issue/PR numbers — closed-years-ago issues read as live concerns when search snippets cite them.

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

### Step 4: Synthesize into note

Read the note template for the target ecosystem:
`${CLAUDE_PLUGIN_ROOT}/skills/package-intel/references/note-template-<ecosystem>.md`

Key conventions per ecosystem:

| Ecosystem | Title format | Directory | Type |
|-----------|-------------|-----------|------|
| npm | `npm-<name>` | `npm/` | `npm_package` |
| crate | `crate-<name>` | `crates/` | `crate_package` |
| go | `go-<module-path>` | `go/` | `go_module` |
| composer | `composer-<vendor>-<pkg>` | `composer/` | `composer_package` |
| pypi | `pypi-<name>` | `pypi/` | `pypi_package` |
| gem | `gem-<name>` | `gems/` | `ruby_gem` |

All notes use three enrichment layers:
- **Frontmatter** with `packages` array, `type`, and `tags`
- **`## Observations`** with `[category]` tagged items
- **`## Relations`** with `[[wiki-links]]`

If `popularity_count` was obtained in Step 2, add a `[popularity]` observation.
Include the metric window (weekly vs total) and registry name — e.g.,
`- [popularity] 2.1M downloads/week (npm, 2026-04)` or
`- [popularity] 850M total downloads (crates.io, 2026-04)`. Omit for PyPI and Go.

**For all six package cohorts (npm, crate, go, composer, pypi, gem), add a
`[version]` observation** recording the documented latest version as a clean
leading token — e.g. `- [version] 5.8.5`. This is the machine-stable slot
intended to shield notes whose subject involves version strings (e.g. `yaml`,
`semver`) from misparse. The same value goes in the header line
(`| v<version> |`); **keep them consistent.** (Note: which slot `--stale`
reads first is cohort-dependent. For `npm_package` notes, the `[version]`
observation (Pattern 3) now wins — `lib/bm-version-extract.mjs` tries it
*before* the header pipe (Pattern 1) for npm specifically, bead
`vp-claude-9q7e`, shipped — so for npm the observation is the effective read
target and must be kept accurate. For the other five cohorts
(crate/go/composer/pypi/gem), the header pipe (Pattern 1) still outranks the
observation under first-hit-wins — extending the override to those cohorts is
tracked separately as bead `vp-claude-xux8`, not yet done. Refresh both slots
on every note regardless of cohort — the non-authoritative one still ships
and stays load-bearing for older/heterogeneous notes.) All six package
schemas now define this slot (bd `vp-claude-f3zx`, shipped) — no cohort is
exempt.

**No wiki-links in observations.** Never use `[[Target]]` syntax in observation
lines. BM's parser treats any `[[` as a relation boundary — the text before it
becomes the `relation_type` field (max 200 chars), causing validation failures.
Put all wiki-links in `## Relations` only.

<!-- This verify-before-capture block is byte-identical with tool-intel — update both when changing. -->
**Verify before capture (mandatory self-check — not CI-enforced).** This step is
required for the conditions below — not enforced by CI, but the same class of
obligation as the LLM-judgment fourth-wall rules. Unlike the Step 1 freshness
table (enforced by *which sources actually run*), no mechanical gate checks it;
treat that as a reason to self-enforce, not permission to skip. For any note
Step 1 did not put on the fast path — missing,
60+ days old, or a security-sensitive or thin-evidence subject — confirm
load-bearing claims (version, maintainer/owner, license, security posture, and
any "does X" capability claim) against the sources already fetched in this run
before writing. Do NOT make new source calls — Step 1's
freshness tiers deliberately pruned sources; verify against what was fetched. A
wrong note compounds via citation and cross-project reciprocation, so a persisted
claim carries a higher bar than a passing remark. If a claim cannot be confirmed
from this run's sources, weaken it to a capability statement ("designed for X"
rather than "does X") and date-qualify uncertain facts (e.g. "as of the 2026-05
release") — never fabricate; if a fact is unknown, say so or omit it. Routine
refreshes (note under 60 days) skip this step.

**Record contradictions, do not resolve them silently.** When two sources
disagree on a load-bearing fact (version, maintainer, license, behavior), record
both values with their provenance as a `[gotcha]` observation — prefer the more
recent or authoritative source and name which — rather than silently picking
one.

**Confidence scales with source count.** A load-bearing claim backed by only
one source in this run carries lower confidence than the same claim
independently confirmed by 2+ sources. Apply the hedging rule above (capability
phrasing, date-qualified) to single-source claims even when nothing in this
run's sources contradicts them — the absence of a second source is not
confirmation, and a persisted note should not read as more certain than its
evidence supports.

**Genuinely unresolved contradictions.** The "prefer the more recent or
authoritative source and name which" guidance above assumes one source can be
judged more trustworthy. When neither can be — both current, both plausible,
no canonical/official source among them — do not force a pick. Record the
contradiction as still-open in the same `[gotcha]` observation, e.g.
`- [gotcha] Contested: registry says v5.8.5 (fetched 2026-07-03), README badge
says v5.9.0 (undated) — unresolved, neither source clearly more authoritative`.
This flags the fact for a future refresh instead of quietly asserting a
resolution the evidence doesn't support.
### Step 5: Write or update the note

<!-- This pattern is mirrored in tool-intel — update both when changing -->

**New package:** Use `write_note` with the full template. Set
`note_type="<ecosystem-type>"` (e.g., `note_type="crate_package"`).

**Relocated stub (a note about this package already exists, but at a
different directory or title than the target ecosystem location — e.g. an
old `indieweb/history/` stub for what is now a documented npm package):**
This is **not** a fresh create, and it is **not** a physical relocation
either — verified via a live dry-run (2026-07-02, current BM version 0.22.1):
`write_note(overwrite=True, directory=<new>, ...)` targeting a *different*
directory than the existing stub does NOT find or overwrite the stub by
title. It creates a genuinely new, separate note at the new location (with
its own freshly-correct `permalink` — no stale-permalink re-key needed) and
leaves the old stub completely untouched at its old path. Left alone, this
produces a silent duplicate: two notes for one package, only one of them
current. `move_note` was not independently verified in this dry-run; don't
assume it behaves differently without checking. Handle it explicitly:

1. If Step 1's existence check didn't surface the stub (it globs only the
   target ecosystem directory), run a broader
   `search_notes(query="<package-name>")` before concluding the note is new
   — a stub in an unrelated directory won't match the directory-scoped glob.
2. Read the stub (reuse the "Step 1: Check for existing note" read above if you
   already have it) and record its `## Relations` entries and current
   `permalink`.
3. Write the new note with `write_note(overwrite=True, ...)`, targeting the
   correct ecosystem `directory` and title, and fold the stub's genuine
   relations (ones that still apply to the package's new identity, not
   history-specific cruft) into the new content's `## Relations` section. If
   a relation's continued relevance is unclear, don't merge it blind — carry
   it forward and flag it for review in Step 6 rather than dropping it
   silently.
4. Once the new note is confirmed to carry everything needed (re-read it and
   check `## Relations`), delete the old stub with
   `delete_note(identifier=<old permalink>)` — the write in step 3 did not
   remove it, and leaving it behind is exactly the duplicate this procedure
   exists to prevent. Only delete after confirming the new note is complete;
   never delete before the replacement is verified.
5. In Step 6, report which relations were carried forward, which were
   dropped or need review, and that the old stub was deleted — never drop
   relations silently, and never leave an unreported duplicate.

**Existing package:** Pick the operation based on the note's current state:

| Note state | Use |
|------------|-----|
| `## Observations` has at least one `- [category]` line | `find_replace` anchored on the last observation line |
| `## Observations` exists but is empty | `find_replace` anchored on `## Observations\n` |
| `## Observations` is absent entirely | `find_replace` anchored on the next section header (typically `## Relations\n`); prepend a new `## Observations` section before it |
| Last observation wraps across multiple lines | Include all continuation lines in both `find_text` and the prefix of `content`, then append the new observation after |
| Note exceeds ~40KB (`read_note` truncates to a persisted file with no byte-exact anchor to match) | `operation="append"` a clearly-headed new section (e.g. `## <Date> Update`) instead of a blind `find_replace` — appending after `## Relations` still registers as observations on re-parse |

Canonical call (populated section):

````
edit_note(
  identifier="<prefix>-<package-name>",
  operation="find_replace",
  find_text="- [<last-category>] <last observation text>",
  content="- [<last-category>] <last observation text>\n- [<new-category>] <new observation text>"
)
````

Empty-section fallback (anchor on header):

````
edit_note(
  identifier="<prefix>-<package-name>",
  operation="find_replace",
  find_text="## Observations\n",
  content="## Observations\n- [<new-category>] <new observation text>\n"
)
````

Do NOT use `operation="append"` with `section="Observations"` when the section
already exists — it appends to end of file, not end of section. The substring
match in `find_replace` is byte-exact: use the observation text verbatim, no
whitespace normalization or escaping.

If `find_replace` fails (no match found), the note may have been edited since
you last read it. Re-run `read_note`, re-derive the anchor, and retry once.
If the second attempt also fails, stop and report the error to the user — do
not loop.

**Trust `schema_validate` and the file, not the inline count.** When verifying an
edit, the `edit_note` inline observation-count echo can transiently double or
triple — a BM index re-parse artifact on notes with `###` subsections inside
`## Observations` (observed 2026-05-30: `--stale` refresh edits showed inflated
counts while the files were correct and `schema_validate` stayed clean). Confirm
against `schema_validate` and the actual file contents (re-read the note), not
that echo. Do NOT delete "duplicate" observations on the strength of the inline
count alone — first confirm the duplication exists in the file itself (re-read /
grep); a re-sync clears the phantom while the file was always correct.

When updating an existing note that has a `[popularity]` observation, use
`find_replace` to replace the old line with the current count rather than
appending a second popularity line.

### Step 6: Confirm and summarize

Report to the user:
- Ecosystem detected and note location (directory/title)
- Key findings from each source (1 line each)
- Any security concerns
- Cross-links will be added in Step 7

### Step 7: Cross-link existing notes

After writing the note, search for existing notes that reference this package
in their body text or observations but lack a wiki-link back to it:

```
search_notes(query="<package-name>", search_type="text", page_size=10)
```

For each result (excluding the note just written):
1. Read its `## Relations` section
2. If the package is mentioned in body/observations but not linked in Relations,
   add a link via `edit_note` with `find_replace`:

```
edit_note(
  identifier="<existing-note-title>",
  operation="find_replace",
  find_text="- <last_relation_type> [[<Last Existing Relation>]]",
  content="- <last_relation_type> [[<Last Existing Relation>]]\n- relates_to [[<prefix>-<package-name>]]"
)
```

Only add links where the relationship is genuine — don't link notes that
mention the same word in an unrelated context. Skip this step for updates to
existing packages where cross-links likely already exist.

**Verify the specific edge resolved — not via `build_context`.** After adding
a link, confirm that specific previously-dangling relation now resolves by
querying the relation index directly, not by re-running `build_context`:

```
search_notes(query="<existing-note-title-or-target-name>", entity_types=["relation"], page_size=10)
```

Find the specific relation row for the edge you just added or fixed and
confirm it shows a populated `to_entity`/target rather than a dangling
target. **Caution:** `build_context`'s bidirectional "Related" list traverses
only *resolved* edges and can surface a *reciprocal* relation — e.g. the
`relates_to` link the target note already carries back to the note you just
edited — which reads as success even when the specific egress edge you just
wrote is still unresolved (`to_id NULL`). Seeing the target appear in
`build_context`'s Related list does not confirm that edge; only the relation
index does.

**Reconcile bare-name stubs.** Existing notes elsewhere in the graph may
reference this package via a bare `[[<package-name>]]` wiki-link — no
ecosystem prefix — written before the prefix convention (v0.22.0+) or before
this note existed. Basic Memory resolves wiki-links by exact title match, so
`[[<package-name>]]` does NOT resolve to `[[<prefix>-<package-name>]]` — the
link silently stays broken. Reconcile it explicitly. Search relations, not
text — FTS5 strips brackets, so a `search_type="text"` query containing
`[[`/`]]` degrades to an unscoped match on the bare word; `entity_types:
["relation"]` with the bare name and no `search_type` (default hybrid)
instead searches the relation's indexed text — for a resolved relation the
title carries both endpoints, while for a dangling bare-name link the
target survives in the relation's permalink slug, which the default
hybrid/semantic search surfaces — an explicit `search_type="text"` would
not, since text search is scoped to `title`/`content_stems` only and never
matches on `permalink`:

```
search_notes(query="<package-name>", entity_types=["relation"], page_size=10)
```

For each result (excluding the note just written) that contains a bare
`[[<package-name>]]` link aimed at this package — not an unrelated note that
happens to share the bare name — rewrite it to the full title:

```
edit_note(
  identifier="<existing-note-title>",
  operation="find_replace",
  find_text="[[<package-name>]]",
  content="[[<prefix>-<package-name>]]"
)
```

As with the cross-link step above, verify each match actually names this
package before rewriting — a generic bare name (e.g. a common English word)
can produce false positives.
