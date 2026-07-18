# Upgrade Haul — Tool-Family Adapter

Loaded by `/intel` Step "Batch mode: upgrade haul" when the tool family is
involved. Supplies the tool-family surface for the shared `upgrade-haul.md`
core: bare-name formula-vs-cask auto-routing, the `not-in-api` re-dispatch, the
`@`-suffix dual-key fetch, and the Axis-B inline-observation target. The
package family uses a one-line inline `## Release Highlights` target instead of
a separate adapter (see `upgrade-haul.md`).


This section is the per-family adapter the shared reference's
*Per-family adapter contract* requires. It owns three things; everything else
(Axis A, orchestration, arbitration) is shared and lives in the reference.
Per-item outcomes and the batch-close summary follow the shared reference's
*Batch-outcome contract* — no adapter-specific extension needed.

**1. Input dialect.** Command words and flags that are noise:
`brew upgrade`, `brew outdated`, `brew install`, `brew reinstall`, leading
`-`/`--` flags, and a trailing redirect. The operands are the identifiers.
Strip version qualifiers per the shared reference — but apply its brew/cask
exception: an `@`-suffixed operand can be a REAL token (`icu4c@78` is its own
formula; `claude-code@latest` is a distinct cask channel), so fetch BOTH the
literal and stripped forms in the same stdin batch and prefer the literal hit
when it resolves. The Step-1 existence glob runs on the stripped base name
either way, so a channel cask folds into its base note (`cask-claude-code`)
instead of forking a duplicate.

**2. Ecosystem routing — bare-name → formula/cask auto-routing.** A pasted
`brew upgrade foo bar` yields **bare names with no `brew:`/`cask:` prefix**, so
the class (formula vs cask) is unknown up front. Resolve each operand:

- Run `brew info <name>` (or `mcp__homebrew__info` when the Homebrew MCP is
  reachable) and reuse the **artifacts-vs-Dependencies shape signal**: a cask
  exposes an `artifacts` block (`app`, `binary`, `pkg`); a formula exposes
  `Dependencies` / build-from-source fields. Route an `artifacts`-shaped result
  to the `casks/` directory (`brew_cask`), a `Dependencies`-shaped result to the
  `brew/` directory (`brew_formula`).
- An already-prefixed operand (`brew:foo`, `cask:bar`) skips this inference and
  routes by its prefix directly.

**Step-1 existence check globs BOTH directories.** Because formula-vs-cask is
unknown before routing, run the Step 1 (the existence check)
existence check against **both** `brew/` and `casks/` for an unknown-class bare
name:

```
list_directory(dir_name="brew",  file_name_glob="*<name>*")
list_directory(dir_name="casks", file_name_glob="*<name>*")
```

Whichever directory holds the note fixes the class (and tells you the note
already exists, so you update rather than fork). If neither matches, fall back to
the `brew info` shape signal above to pick the class for a new note.

For any multi-operand batch, replace the per-name globs with ONE full listing
of each directory (`list_directory(dir_name="brew")` +
`list_directory(dir_name="casks")`) and resolve every operand by filtering the
two listings — 2 calls total instead of 2-per-operand (shared reference,
*Batch orchestration*).

**If the shape signal is ambiguous, do not guess.** A dependency-free formula
(common for single-binary Go/Rust tools) exposes no `Dependencies` block; a
`brew info` / `mcp__homebrew__info` call can also error, or a name can resolve as
*both* a formula and a cask. In any of these cases — no clean `artifacts` shape,
no clean `Dependencies` shape, both present, or an error — surface the operand as
`class-ambiguous` in the batch summary ("needs an explicit `brew:`/`cask:`
prefix") and skip it from the auto-routed batch rather than misfiling a note
under the wrong type. (The Step-1 dual-directory glob above already resolves the
common case — an existing note — so this only bites a genuinely new, ambiguous
bare name.)

**Cask version-fetch routing on a `not-in-api` signal (dogfood edge case).**
`scripts/fetch-brew-upstream.sh` reads `formulae.brew.sh`, which is
**core-formula-only**, so it returns `upstream_state: "not-in-api"` for any
**cask** *and* for any third-party-tap formula. Join the fetch output to each
operand **by `name`**, then branch — mirroring the detector's tap handling
(knowledge-gardener Step 5b-iv resolution rules 1–2, which already classify
`tap + not-in-api/api-unavailable → Not in registry`):

1. **`not-in-api` with the name populated** → dispatch that operand to
   `scripts/fetch-cask-upstream.sh` (the `cask.json` source) and re-branch on its
   result:
   - **cask hit** (`ok`/`deprecated`/`disabled`) → it's a cask; route to
     `casks/`. (Dogfood 2026-06-24: `claude-code` is a cask — the re-dispatch
     recovered its version.)
   - **second `not-in-api`** → the operand is in neither core formulae nor casks:
     a third-party-tap or private formula. Do **not** keep the old version or
     invent one. Run `brew info <name>` for the locally-installed version, stamp
     it `(local, unverified — not in core-formula or cask APIs)` plus a `[gotcha]`
     noting the tap/private source, and report it in the batch summary's
     skipped/unverified column. (The changelog reel can still proceed via the
     upstream repo's git tags from `brew info`.)
2. **`api-unavailable`** → the script emits this as a single sentinel with an
   **empty `name`** (a curl/parse failure for the whole fetch run, not one
   operand). It does not join to any operand: treat every operand in that fetch
   batch as `unverified[api-unavailable]`, skip the version write, and report —
   **never** read a failed fetch as "no drift." An empty-name row is the
   run-failure signal.

**3. Axis-B narrative target.** The tool family records the curated changelog reel as
**inline `[feature]` / `[version]` observations** (the tool family narrative
style) — **not** a `## Release Highlights` section (that is package family's
target). Each surfaced delta change becomes its own observation line in
`## Observations`.

**Linked-timeline-note check (before writing Axis B).** A high-velocity tool's
changelog can be extracted out of the subject note into a dedicated timeline
note, leaving only a `see_also`/`documented_in` relation behind. Before writing
the reel, read the subject note's `## Relations` for such a link — a
`see_also`/`documented_in` relation whose target title matches a
"... Release History"/timeline pattern — and, when found, append the curated
reel to **that** note instead of inline. Worked example:
`casks/cask-claude-code.md` carries `see_also [[Claude Code Release History]]`
(a separate Basic Memory note, not a file in this repo); a haul touching that
cask appends its reel to the linked `Claude Code Release History` note, not
back into the cask note — re-inlining there would re-inflate exactly what was
just extracted. Fall back to today's inline behavior — appending `[feature]` /
`[version]` observations directly in the subject note — when no linked
timeline note exists. Axis A (the inline header pipe) always stays in the
subject note regardless of where Axis B lands.

**Recording targets — refresh BOTH axes.** Per the shared reference's two-axis
convention:

- **Axis A — the inline header pipe.** For brew/cask/vscode the recorded version
  lives in the note's header line (`Homepage: … | v<version> | <license>` for
  brew/cask, `Publisher: … | v<version> | <license>` for vscode — S2
  **Pattern 1**) — that is the slot `--stale brew`/`--stale cask`/`--stale vscode`
  reads first, so refresh **that**. Use `edit_note(find_replace)` on the
  `| v<old> |` token. brew/cask/vscode notes now **also** carry a `[version]`
  observation (bead `80r4`, schema slot `Pattern 3`) — a clean leading token,
  e.g. `- [version] 1.39.0`, kept in sync with the pipe on the **same** edit.
  For these tool family cohorts, under `--stale`'s first-hit-wins ordering the
  header pipe (Pattern 1) still outranks the `[version]` observation (Pattern
  3), so the pipe remains the effective read target today — the observation is
  a redundant safety slot. npm's own `--stale` now reads its `[version]`
  observation first, ahead of the header pipe (bead `vp-claude-9q7e`, shipped
  npm-only in the 0.31.4/0.32.1 releases); `9q7e` was never extended to
  brew/cask/vscode or tool family's other cohorts, so their header-pipe-first
  ordering is unchanged. Refresh both anyway; a stale `[version]` observation
  is still a corpus-quality defect even when `--stale` doesn't currently read
  it first.
- **Axis B — the inline changelog reel.** Add the curated `[feature]` /
  `[version]` observations for the delta (the tool family narrative style). This
  reel's `[version]` lines accumulate as delta narrative (one per surfaced
  change, potentially several over successive hauls) — a **different, and
  equally intentional, use of the same category** than Axis A's single
  canonical current-version slot above. This overlap predates bead `80r4` and
  is a deliberate design decision (resolved 2026-07-03, `vp-claude-jcql`), not
  an open question: both uses of `[version]` stay — the canonical slot as the
  single machine-stable current value (Pattern 3, what `--stale` reads),
  the narrative reel as accumulating delta history. Do not delete reel entries
  when reconciling a note that has both; they serve different purposes and
  neither supersedes the other.

Both axes are independent: refreshing the inline reel alone leaves the **header
pipe stale**, and the pipe is exactly what `--stale` re-reads — so the drift
never closes. On every refreshed note, move the header pipe `| v<version> |`
**and** the inline reel — they do not update each other. (Dogfood: an
`llmfit`-style refresh that wrote only the narrative left the headline version at
the old value until it was bumped separately.)

