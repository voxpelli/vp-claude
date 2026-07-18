# Tool Enrichment — Six Sources

**Read this file IN FULL** before running tool-family enrichment. Loaded by
`/intel` Step 3 when `FAMILY=tool`. Run the six sources below. Each prefix's
skip/run gates are explicit (DeepWiki for action/docker and conditional gh;
man-page for brew/cask only; Open VSX for vscode only; Homebrew analytics for
brew/cask) and MUST stay explicit — never collapse them into a generic loop.


**Context7 is skipped for all tool types** — it is npm-biased and has no
useful coverage of Homebrew, Actions, Docker, or VSCode ecosystems.

Launch research queries — parallelize where possible:

**a) DeepWiki — architecture and design (action:, docker:, conditional for gh:):**

Use DeepWiki for tools that have upstream GitHub repositories with meaningful
code to analyze. Skip for `brew:` and `cask:` (formulae/casks rarely have
rich repos). Use for `vscode:` when a public GitHub repo exists. For `gh:`,
use **conditionally** — only when `gh release list --repo <owner>/<repo>`
returns ≥1 release (a reliable proxy for "well-known enough to be indexed";
alpha bash extensions like `gh-notify` are not in DeepWiki). **Also skip for any
tool whose `repo_forge != github` (from Step 2)** — DeepWiki indexes only
GitHub; note the skip in Step 6 (expected, not an error).

```
ask_question(repo="owner/repo", question="What are the key inputs, outputs, design patterns, gotchas, and security considerations?")
```

For `action:`, use `owner/repo` directly from the identifier.
For `docker:`, find the GitHub source repo via the Docker Hub `source` field
or repository link in the image description.

**Hallucination caveat** — DeepWiki can return information about a *different* repo with a similar name, or reply "Repository not found" for repos that exist (e.g., `voxpelli/claude-beads` is not indexed; upstream `steveyegge/beads` is). For `action:`, `gh:`, and `docker:` prefixes, fall back to `gh api` against the source repo per [`gh-api-fallback.md`](gh-api-fallback.md).

**Indexing lag** — DeepWiki re-indexes periodically, so for fast-moving CLI tools, recently added commands or flags may not appear yet. When Step 2 or the changelog step (3d) surfaces a version newer than what DeepWiki describes, treat its feature coverage as incomplete for that version range and supplement from the tool's `--help` output, README, or commit log.

**b) Tavily — security, gotchas, and recent changes:**

Always run for all tool types. Tailor the query to the tool category:

- `brew:`/`cask:`: `tavily_search(query="<name> homebrew formula gotchas conflicts issues <year>", max_results=5)`
- `action:`: `tavily_search(query="<owner>/<repo> github action security supply chain <year>", max_results=5)`
- `docker:`: `tavily_search(query="<image> docker image CVE vulnerability <year>", max_results=5)`
- `vscode:`: `tavily_search(query="<extension-id> vscode extension performance issues <year>", max_results=5)`
- `gh:`: `tavily_search(query="<owner>/<repo> gh extension security supply chain <year>", max_results=5)`

For `action:` notes, also extract the action definition directly:
```
tavily_extract(urls=["https://github.com/<owner>/<repo>/blob/main/action.yml"], query="inputs outputs runs permissions")
```
Fall back to `action.yaml` if `action.yml` returns nothing.

**c) Raindrop — bookmarked articles:**
```
find_bookmarks(search="<name>")
```

If bookmarks are found, fetch content from the top 2-3 most relevant results
(judge relevance by title and tags matching the tool):
```
fetch_bookmark_content(bookmark_id=<id>)
```

These are articles the user deliberately saved — high relevance signal.

**d) Changelog / versions:**

**Forge branch (`vscode:`, `brew:`, `cask:`):** if `repo_forge != github` (from
Step 2), the upstream repo's changelog lives on a non-GitHub forge — follow
[`forge-fallback.md`](forge-fallback.md)
(shared reference: Codeberg/Forgejo REST, sourcehut, unknown-forge fallback)
instead of the `gh` commands below. `action:`/`gh:`/`docker:` are unaffected
(GitHub or Docker Hub by construction).

- `action:`: Use GitHub releases — `gh release list --repo <owner>/<repo> --limit 10 2>/dev/null`; if empty, `tavily_extract` on the GitHub CHANGELOG.md
- `docker:`: Use Docker Hub tags API (see `ecosystem-docker.md`) for tag strategy overview
- `brew:`/`cask:`: Extract version from the formulae.brew.sh API response (already fetched in Step 2). If that stable version is *newer* than the upstream repo's newest GitHub Release, the release notes for the current version are missing — recover the changelog from git tags per [`gh-api-fallback.md`](gh-api-fallback.md) ("Recovering a Version/Changelog from Tags"). This is the `brew:sem` shape.
- `vscode:`: Extract version from Open VSX API response (already fetched in Step 2)
- `gh:`: Use GitHub releases — `gh release list --repo <owner>/<repo> --limit 10 2>/dev/null`; empty result means `runtime_shape: script` (or `local` per Step 2's classification ladder)

<!-- Staleness-detection logic is mirrored in the package-family enrichment (enrichment-package.md) — update both. Recording target differs by ecosystem: a [version] observation here, ## Release Highlights there. -->
**Release-list staleness (`action:`/`gh:`)** — these prefixes have no independent registry, so the GitHub release list is the only version signal — and it lags whenever a maintainer pushes a git tag without cutting a Release. **Always cross-check** the newest Release against the newest git tag:

```bash
gh api repos/<owner>/<repo>/tags --jq '.[].name' 2>/dev/null | head -20
```

The `/tags` and `gh release list` outputs are *not* semver-sorted, and an error reads the same as an empty result — re-run without `2>/dev/null` to confirm the command exited 0, then follow the sorting, pre-release, and error≠empty rules in [`gh-api-fallback.md`](gh-api-fallback.md) ("Recovering a Version/Changelog from Tags") before trusting either. If the newest stable semver tag is ahead of the newest Release (or the release list is empty but the repo has recent commits), treat that tag as the real latest version, and derive a changelog from the commits between the last released tag and it:

```bash
gh api repos/<owner>/<repo>/compare/<last-release-tag>...<newest-tag> \
  --jq '.commits[].commit.message | split("\n")[0]' 2>/dev/null
```

(With no prior Release to compare from, list recent commits instead: `gh api "repos/<owner>/<repo>/commits?sha=<newest-tag>"`.) Record the recovered version as a `[version]` observation with explicit provenance, so a later reader knows it came from a tag, not a Release: `- [version] X.Y.Z (git tag <tag-name> — no GitHub Release as of YYYY-MM-DD)` — keep that parenthetical link-free (a markdown link plus a trailing parenthetical silently drops the whole observation past BM's `(context)` parser). Curate the commit subjects (skip merges and internal refactors) rather than dumping them. A release list that is empty *and* has no newer git tag (command confirmed to have exited 0) still means `runtime_shape: script` for `gh:`.

For `action:`, `gh:`, and `docker:` prefixes, [`gh-api-fallback.md`](gh-api-fallback.md) documents additional `gh api` endpoints (contents, commits, contributors, issue/PR verification) — useful when DeepWiki was unreliable in step 3a or when the changelog is sparse.

**e) Readwise — curated personal insights:**
```
readwise_search_highlights(vector_search_term="<tool-name>")
reader_search_documents(query="<tool-name> <tool-type>")
```

Highlights contain expert-selected passages from the user's reading. If results
found, extract patterns, gotchas, and best practices for observations. If both
return empty, note "source e: no Readwise content found" and proceed.

**f) Local man page — flag/option exhaustiveness (`brew:`, `cask:` only):**

Run for `brew:` and `cask:` only — **skip entirely for `action:`, `docker:`,
`vscode:`, `gh:`, `plugin:`, and `skill:`**, which rarely or never ship a man
page. Many Homebrew formulae ship a man page that is the canonical reference
for flag semantics and edge cases a README omits.

**Session-level toolchain guard (once per session, before the first
`brew:`/`cask:` lookup — not a per-lookup check):** `man` + `col -bx` is a
macOS-default toolchain assumption, not guaranteed elsewhere — minimal
CI/devcontainer/Docker images routinely strip `man-db` and/or the `col`
utility (`bsdmainutils`/`util-linux`). If either binary is missing, its
"command not found" error lands on stderr, which the per-lookup command's
`2>/dev/null` below suppresses identically to a genuine "no man page exists"
case — with nothing to distinguish them, this source would silently and
permanently degrade to useless on such a machine. Verify the toolchain once
per session instead:

```bash
command -v man >/dev/null && command -v col >/dev/null
```

If this check fails, skip source f) entirely for the rest of the session and
record it as a systemic note in Step 6 (confirm/summarize) — e.g. "man-page
enrichment unavailable this session: `man`/`col` toolchain not found" — not
a per-tool note. Checking once per session (rather than the exit code of
every individual lookup) is deliberate: a per-lookup exit-code check would
reintroduce false negatives on formulae that genuinely ship no man page, the
exact failure mode "Empty output means skip" below exists to avoid. If the
toolchain check passes, proceed with the per-tool command unchanged for
every `brew:`/`cask:` lookup this session:

```bash
man -P cat -- "<name>" 2>/dev/null | col -bx | head -300
```

`-P cat` bypasses the pager so the command never blocks waiting for
interactive input; `col -bx` strips the overstrike/backspace formatting
(bold, underline) man pages use down to plain text. The `head -300` cap keeps
the excerpt bounded — man pages for larger tools can run past 1,000–4,000
lines, and the flag/option reference near the top (after the synopsis) is
almost always the high-signal part.

**Empty output means "skip" — not an error.** Once the session-level guard
above has confirmed the toolchain is present, many formulae still ship no man
page at all, and `man` still exits `0` while printing nothing in that case;
treat empty stdout as "no man page found" and move on silently. Do **not**
treat a nonzero exit code as confirmation of anything either — a name that
doesn't resolve also produces a nonzero exit, and it carries the same "skip"
meaning as an empty result, not a failure worth reporting. Note also that the
man page's registered name can differ from the formula name (e.g. the
`ripgrep` formula ships a man page under `rg`, its binary name) — if the
plain formula name comes back empty, retry once against the binary name
already known from Step 2/Common Usage before concluding there is no man
page.

Mine the excerpt for material genuinely beyond what DeepWiki/Tavily/the
README already covered — exhaustive flag lists, exit-code semantics,
config-file locations and precedence, environment-variable overrides — and
record it as `[gotcha]`, `[convention]`, or `[reference]` observations with
`(man page)` provenance, e.g.
`- [convention] config file path set via RIPGREP_CONFIG_PATH env var, one shell argument per line, # comments ignored (man page)`
or
`- [gotcha] default regex engine is finite-automata-based; backreferences and look-around require building with PCRE2 and passing -P/--pcre2 (man page)`.
Skip anything already captured from another source rather than duplicating it.

**Pre-write graph check — avoid duplicating linked-note observations.** Before recording new observations in Step 4, pull existing graph context: `build_context(url="<prefix>-<name>", depth=1, max_related=10)`; if it returns nothing, fall back to `search_notes(query="<name>", search_type="text", page_size=10)`. Skip capturing a new observation whose fact a linked (or to-be-linked) note already records — cite that note instead. Mirrors the package family's Knowledge-graph relevance check in enrichment-package.md, applied across all observation types.

