# Tool Enrichment — Six Sources

**Read this file IN FULL** before running tool-family enrichment. Loaded by
`/intel` Step 3 when `FAMILY=tool`. Run the six sources below. Each prefix's
skip/run gates are explicit (DeepWiki for action/docker and conditional gh;
man-page for brew/cask only; Open VSX for vscode only; Homebrew analytics and
the agent-leverage surface check for brew/cask) and MUST stay explicit — never
collapse them into a generic loop.


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

**Agent-leverage surface check (`brew:`, `cask:` only — optional addendum
beyond the six sources above, like Homebrew analytics; not counted in the
headline six; inherits source f)'s failure-handling discipline above):**

*How would a coding agent best use this tool?* The answer bifurcates by the
tool's **interface**, not the agent: an **MCP-native** path exists only for the
few tools that ship an MCP server; a **machine-readable CLI** path
(`--json` / `--format` / `--output-format` / `--reporter=json` / `-o json` / a
REST API) exists for some CLI tools and works through bash for any agent
(Claude Code's own Bash tool, pi.dev, CI) — it costs no standing context
because it's discovered on demand. Most ordinary CLIs have **neither**
surface; that is the expected, majority case, not a finding — see the
honesty gate below.

- **Cask pre-filter (skip silently otherwise).** Run this check on a `cask:`
  only when the already-fetched Step 2 cask JSON shows a genuine dev-tool
  signal:
  - **Primary signal — a companion binary artifact.** The cask's `artifacts`
    field (already fetched in Step 2) has a non-empty `binary:` entry — the
    reliable signal: `cask:claude-code` ships `claude (Binary)`,
    `cask:monitorcontrol` ships only `.app` and correctly has none.
  - **Secondary signal — `desc`/tags.** `desc` or tags mention CLI / SDK /
    command-line / API.
  - Do **not** key on `caveats` (it routinely tells users to run terminal
    commands for ordinary GUI post-install setup — a false-run trap) or on a
    bare "terminal" match (GUI terminal emulators legitimately describe
    themselves that way, e.g. iTerm2's `desc` is literally "Terminal
    emulator" — another false-run trap).

  If neither signal fires, this is a pure consumer GUI cask with no
  agent-leverage surface — record nothing and move on (Step 6:
  intentionally-skipped; this is not a gap). `brew:` formulae are CLI-first —
  always run the check for `brew:` (though, per the honesty gate below,
  recording a `[agent-leverage]` line is the exception, not the rule).

- **Binary resolution (before probing — mirrors source f)'s toolchain-guard
  discipline).** The target binary's name can differ from the formula/cask
  token (`ripgrep`→`rg`) — resolve it before probing, never assume token ==
  binary:
  1. Prefer the actual binary name already established in Step 2/Common Usage
     (or, for a cask, the name(s) in the `artifacts.binary` entry) over the
     raw formula/cask token.
  2. Confirm it resolves: `command -v <binary> >/dev/null 2>&1`. If that
     fails under the token name, retry once under the actual binary name
     before concluding it can't be found (same retry discipline as source
     f)'s man-page name lookup).
  3. **If the binary still doesn't resolve** (not installed locally, or a
     cask whose binary artifact isn't on `PATH`), this is a **probe failure,
     never a negative finding** — do not record `[agent-leverage]` at all;
     nothing was actually probed. Report Step 6 status as
     **attempted-but-failed** ("binary `<name>` not found locally; `--help`
     could not be run") and stop here for this tool. An empty or errored
     `--help` output is not "no surface" — only a successfully-run
     `--help`/`serve --help` that omits a surface is a genuine negative.
  4. If the cask passed the pre-filter via `desc`/tags but ships no
     `artifacts.binary` at all, there is nothing to resolve or probe — skip
     silently (Step 6: intentionally-skipped), same as the pre-filter's own
     silent-skip branch.

- **MCP-native probe (binary resolved).** Check, in order, and record ONLY a
  flag/subcommand/companion-binary actually confirmed this session — never
  one merely mentioned in prose:
  1. Grep the already-fetched man-page excerpt (source f — if it was skipped
     for the whole session per its own toolchain guard, skip this sub-step
     and rely on live output only) and any already-fetched README/DeepWiki
     material for `mcp` / `--mcp` / `serve`.
  2. Confirm live: `<binary> --help 2>&1 | grep -i mcp` AND
     `<binary> serve --help 2>&1 | grep -i mcp` — the two most common shapes,
     not exhaustive; a non-`serve` subcommand, a config/env-based
     registration, or a separate companion binary can't be enumerated this
     way.
  3. Check for a companion binary using common MCP-server naming
     conventions: `command -v <binary>-mcp`, `command -v mcp-server-<binary>`.

  A negative MCP finding from this probe is always **bounded, never
  absolute** — see the honesty gate below for the required phrasing and the
  prohibition on claiming the CLI path is superior.

- **CLI machine-readable probe (binary resolved).** Run
  `<binary> --help 2>&1 | head -100` and look for `--json` / `--format` /
  `--output-format` / `-o` / `--reporter` and exit-code documentation;
  cross-check the man-page excerpt (or README/DeepWiki material if source f)
  was session-skipped).

- **Verify, never infer** (per [`verify-before-capture.md`](verify-before-capture.md)):
  every recorded surface must trace to a command actually run this session —
  never "it's written in Go so it probably has `--json`." If the man page
  advertises a flag a live `--help` doesn't show (or vice versa — version
  drift), record both with provenance and prefer the more recent, rather than
  silently picking one.

**Honesty gate + output.** Record with the `[agent-leverage]` category —
**declared** (`validation: warn`) in the `brew_formula`/`brew_cask` and
`npm_package`/`crate_package`/`pypi_package` schemas. The check always **runs** (subject to the pre-filter and
binary resolution above), but **recording is the exception, not the rule** —
most CLIs are ordinary text-only tools and warrant no `[agent-leverage]` line
at all:

- **Ordinary — no expectation violated (default; record nothing).** A plain
  text-only CLI with no `--json`/MCP surface (e.g. `tree`, `wget`) is the
  expected majority case, not a finding. Do not write a line just because the
  check ran.
- **Genuine positive** (a confirmed MCP flag/subcommand/companion-binary, or a
  confirmed machine-readable CLI flag) → one `[agent-leverage]` observation
  stating the leverage path(s) found this session, plus at most one
  `[pattern]` if a second recipe earns a line. Do not claim it is "the
  best-leverage path" unless the MCP probe above was fully run and negative —
  if MCP wasn't exhaustively checked, say "the CLI path found this session,"
  not that it's superior. A notably useful invocation can also land as a
  `## Common Usage` bullet.
- **Surprising negative** — narrowly scoped to a tool a reader would
  genuinely *expect* to be agent-scriptable (markets itself for
  CI/automation/pipelines, or is explicitly non-interactive-first while
  advertising scripting use) but isn't (e.g. an interactive-only TUI whose
  features need a TTY) → exactly one `[agent-leverage]` line stating the
  limitation. Do **not** use this bucket for an ordinary CLI that simply
  lacks `--json` — that's the default "ordinary" case above, which records
  nothing.
- **Obviously irrelevant** (a pure GUI cask, a system library) → record
  nothing; Step 6: intentionally-skipped.
- A bounded MCP negative, when recorded alongside a CLI positive, must use
  bounded language: "no MCP surface found in top-level `--help`, `serve
  --help`, or an obvious companion-binary name this session — a non-`serve`
  subcommand or config/env-based registration was not exhaustively checked."
  Never write a bare "no MCP surface" as if it were exhaustively ruled out.
- Any genuine caveat (JSON not uniform across a tool's subcommands;
  undocumented/inconsistent exit codes; an experimental reporter schema) → a
  `[gotcha]` alongside — additive to, not counted against, the bloat cap
  below.
- **Bloat cap:** never more than 1 `[agent-leverage]` + 1 `[pattern]` for a
  positive, or exactly 1 `[agent-leverage]` for a surprising negative; never
  both a positive and a surprising negative for the same subject; never a
  filler line for the "ordinary" default or the cask pre-filter's silent-skip
  branch. This cap counts only `[agent-leverage]`/`[pattern]` lines from this
  check — it does not restrict the `[gotcha]` caveat line above or an
  optional `## Common Usage` bullet.

**Cross-link (Step 7).** When this check records a finding, add
`relates_to [[Agent-Tool Leverage — MCP Server or Machine-Readable CLI, Assessed Per Tool]]`
in `## Relations` — the hub note collecting the per-tool assessments.

**Step 6 reporting.** Report this check's status using SKILL.md's canonical
three-state contract (Step 6): a binary that failed to resolve, or a probe
command that errored, reports **attempted-but-failed**; a genuine run that
lands on the "ordinary" default (records nothing) still reports **used** — it
was attempted, it just found nothing worth recording; the cask pre-filter's
silent-skip, and a cask that passes the pre-filter but exposes no invocable
binary artifact to probe, both report **intentionally-skipped**. Only a
recorded positive or surprising negative leaves a note-level artifact
searchable later (`category:agent-leverage`) — a "used, nothing recorded"
result is auditable only via this session's Step 6 report, not via a later
graph search; "stays auditable over time" holds for positives via the
category, not for the majority records-nothing case.

**Pre-write graph check — avoid duplicating linked-note observations.** Before recording new observations in Step 4, pull existing graph context: `build_context(url="<prefix>-<name>", depth=1, max_related=10)`; if it returns nothing, fall back to `search_notes(query="<name>", search_type="text", page_size=10)`. Skip capturing a new observation whose fact a linked (or to-be-linked) note already records — cite that note instead. Mirrors the package family's Knowledge-graph relevance check in enrichment-package.md, applied across all observation types.

