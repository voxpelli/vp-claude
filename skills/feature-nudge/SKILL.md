---
name: feature-nudge
description: "This skill should be used when the user asks to 'nudge me on unused features', 'which Claude Code features haven't I adopted', 'check feature adoption', 'am I using the features I noted', 'feature nudge', 'which tips have I actually used'. Scans recent Claude Code session transcripts across all projects for real evidence of feature use (typed slash-commands, model aliases, tool invocations), cross-references them against the [nudge]-tagged features in the Basic Memory note main/reference/claude-code-noteworthy-features, previews which features have adoption evidence vs none, and updates each feature's adoption status in that note's frontmatter after user approval. On any status change, it also regenerates the shared tip cache (~/.claude/references/claude-code-nudge-tips.txt) that /nudge-sync owns."
user-invocable: true
allowed-tools:
  - Grep
  - Read
  - Write
  - mcp__basic-memory__read_note
  - mcp__basic-memory__edit_note
---

# Feature Nudge

Scan recent Claude Code session transcripts across all projects for real
evidence that a documented feature has actually been used, cross-reference
against the `[nudge]`-tagged catalog in Basic Memory, preview the proposed
adoption-status changes, and write only what the user approves. Mirrors
`session-reflect`'s scan -> preview -> approve -> write shape, but scans
*historical* transcripts across all projects rather than the current
conversation — hence `feature-nudge`, not a `session-*` name.

**Intentionally Claude-Code-specific, not a template for a generic
mechanism.** This skill hardcodes the note permalink
(`main/reference/claude-code-noteworthy-features`) and Claude-Code slug
vocabulary — a deliberate, stated exception to this project's general
domain-generic-skill convention, made explicit here rather than left as an
unexamined pattern break, because the whole task is specifically about
Claude Code feature adoption.

## Edge Cases

- **Note missing** — report and exit. Never auto-create it (that's
  `/package-intel`/`/tool-intel`'s kind of job, not this skill's).
- **No `[nudge]` observations in the note** — report "No features to check
  adoption for" and exit.
- **`~/.claude/projects` doesn't exist at all** (confirmed empirically: this
  raises a "Path does not exist" tool error, not a clean zero-match result)
  — this is the **benign** fresh-install case, never seen Claude Code
  before this skill's own invocation. Catch the specific path-not-found
  error from Step 2's sanity grep and treat it as "No session evidence
  available yet": propose `nudged` for anything currently `unseen`, skip
  everything else. Do **not** report this as a tool/path failure — it is
  the expected state for a brand-new install.
- **Sanity grep (see Step 2) returns zero matches, or errors with anything
  other than the specific "path does not exist" signature above** — this is
  the genuine tool/path failure case (a Grep path/tool failure looks
  identical to a genuinely empty history otherwise). Report it to the user
  and stop, rather than proposing `nudged` transitions on data that may
  just be a broken scan. Treat only the exact missing-directory case above
  as benign — any other error (permission denied, an unrelated tool fault,
  anything ambiguous) falls here, not there.
- **A specific feature slug's grep returns zero matches while the sanity
  grep succeeded** — this is normal, expected no-evidence for that one
  feature; propose `nudged` if currently `unseen`, per Step 3's table.
- **A specific slug's `Grep` call itself errors (not a clean zero-match
  result) partway through the per-slug loop** — do not fold this into
  "no evidence for that feature." Report the affected slug(s) as
  scan-failed in the Step 4 preview and exclude them from any proposed
  transition this run, rather than silently proposing `nudged` on a failed
  read.
- **A slug's tip text has no backtick-quoted span at all, or truncating at
  `<` (see Step 2) yields an empty search term** — skip this slug and
  report it rather than searching with a malformed or empty term.
- **A `Grep`-matched file's `Read` fails or its content doesn't parse as
  expected** — do not silently count this as "no shape match" for that
  file. Exclude it from evidence for this slug but flag it in the Step 4
  preview (e.g. "N files could not be read and were excluded") so the user
  can see the evidence count may be incomplete. Never let one unreadable
  file suppress `adopted` when another matched file for the same slug
  already passed the shape check.
- **A slug's `Grep` result hits the tool's own result cap** (confirmed: a
  broad token can exceed ~250 matched files) — accepted, not engineered
  around: evidence is confirmed the moment any one matched file passes the
  shape check, so a cap can only ever under-count the *session number*
  shown in the preview, never flip a real "adopted" into a false
  "no evidence."
- **A non-slash-command feature is adopted entirely outside any Claude Code
  transcript** — environment variables (set in shell rc files), settings.json
  fields, and model-picker choices leave no trace in a session transcript at
  all, genuinely used or not. This is a structural limitation of
  transcript-scanning itself, not a bug: these features will keep proposing
  `nudged` indefinitely regardless of real adoption. Accepted rather than
  engineered around — there is no transcript-based signal to check.
- **Orphaned `adoption-<slug>` frontmatter keys** (a `[nudge]` observation
  was later deleted from the note body, but its frontmatter key remains) —
  left as-is. The key is inert: `schema_validate` ignores frontmatter, and a
  future `read_note` on an absent-from-body slug simply never surfaces it.
  Not worth a reconciliation pass for a low-probability, harmless gap.
- **`edit_note` `find_replace` fails** (no match found) — the note may have
  changed since Step 1's read. Re-read the note, retry once against the
  actual current frontmatter value, then report and stop if it still fails.
  Do not loop.
- **User declines all** — report "No changes made" and exit cleanly.
- **A separate, lower-probability BM-side risk, accepted rather than
  engineered around** — concurrent `edit_note` calls to the *same BM note*
  (not the local cache file) are last-write-wins with no row-level locking.
  If this skill and an interactive `/knowledge-maintain` pass ever touched
  the noteworthy-features note at the same moment, one edit could be
  silently overwritten. Not mitigated with new machinery, since both are
  interactive, on-demand, effectively-single-writer in practice — stated
  here so it isn't rediscovered as a surprise later.

## Workflow

### 1. Load the catalog

```
mcp__basic-memory__read_note(
  identifier="main/reference/claude-code-noteworthy-features",
  output_format="json",
  include_frontmatter=true
)
```

Collect each `[nudge]` observation's `Feature: <slug>` token + tip text, and
each current `adoption-<slug>` frontmatter value (default `unseen` if the key
is absent). Missing note -> report and exit per Edge Cases. **Check the
slug-uniqueness invariant** (`${CLAUDE_PLUGIN_ROOT}/skills/nudge-sync/references/tip-cache-contract.md`):
if two tokens normalize to the same slug, report the collision and stop
before proposing any transitions — never silently treat two colliding
features as one.

### 2. Gather evidence

**Search by content directly — do not pre-filter by a "recent files"
working set.** An earlier version of this step used `Glob` to build a
most-recently-modified-first working set of ~50 transcript files, then
grepped only within it. This shipped a real, silent bug: Claude Code's
`Glob` caps its returned file list (confirmed: capped well under the total
file count across `~/.claude/projects`), and that cap is a traversal-order
truncation, not a true mtime-sorted slice — so "sort what `Glob` returned,
take the top ~50" was sorting an arbitrary subset. In one real run, the
actively-running session's own transcript (the freshest file on the whole
machine) was completely absent from the computed "top 50." A specific
feature's mentions are sparse relative to any practical file-count cap, so
searching by content directly is both simpler and reliably correct — it
never depends on getting file *ordering* right.

**Sanity check first**, once per invocation, before the per-slug loop:

```
Grep(pattern="\"type\":\"user\"", path="~/.claude/projects",
     glob="**/*.jsonl", output_mode="files_with_matches")
```

This literal string (no space after the colon — confirmed empirically that
real transcript JSON has none; a `"type": "user"` form with a space matches
nothing) is present in every real session transcript, so it is a reliable
first check that transcript scanning works at all:
- **A "Path does not exist" error** — `~/.claude/projects` itself is
  missing. This is the benign fresh-install case (see Edge Cases): treat as
  "no session evidence available yet," not a failure.
- **Zero matches with no error** (the directory exists but nothing matched
  this ubiquitous string) — genuine tool/path failure. Report to the user
  and stop; never silently proceed as if every feature had no evidence
  (indistinguishable failure modes are exactly how the original bug shipped
  undetected).
- **A non-zero match count (expect many — this string is common enough
  that the result may itself hit the tool's own result-count cap, which is
  fine here: this check only needs "more than zero," not an exact count)**
  — transcript scanning works; proceed to the per-slug loop below.

**Per-slug search.** For each catalog slug, derive a `<search-term>` from
the tip text (loaded in Step 1) — **not** the normalized slug, which is a
machine key for frontmatter/ring-buffer matching that nobody ever types
into a session:
1. Extract the first backtick-quoted span from the slug's tip text (every
   seed tip's prose leads with one, e.g. `` `opusplan` ``, `` `/advisor` ``,
   `` `/fork <directive>` ``, `` `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP=1` ``).
2. If it contains a placeholder argument (a `<...>` token, e.g.
   `/fork <directive>`, `/batch <instruction>`), truncate at the first `<`
   and trim trailing whitespace, keeping only the fixed literal part
   (`/fork <directive>` → `/fork`).
3. Use the resulting literal string as `<search-term>`. None of the current
   seed terms contain regex metacharacters, so no escaping is needed today
   — but a future tip containing one (`.`, `(`, `$`, etc.) would need
   literal-string escaping before use as a `Grep` pattern.

**Branch on whether `<search-term>` starts with `/` (a slash command) — the
two cases need genuinely different evidence criteria, not just different
patterns.**

**Slash-command terms — search for the dispatch tag directly, not the bare
term.** A `promptSource:"typed"` + `origin.kind=="human"` check (an earlier
version of this doc relied on exactly this) does **not** distinguish a user
*typing the command* from a user *typing a sentence that merely mentions
it* — both satisfy every one of those fields. Confirmed empirically instead:
Claude Code wraps every genuine slash-command dispatch (built-in or
plugin-namespaced) in a `<command-name>...</command-name>` tag inside
`message.content`, and free-text mentions never produce this wrapper
regardless of where in the message the term appears. So search for the tag
directly:

```
Grep(pattern="<command-name><search-term></command-name>",
     path="~/.claude/projects", glob="**/*.jsonl",
     output_mode="files_with_matches")
```

**`Read` each matched file and confirm the tag-wrapped string appears
specifically within a `type:"user"` entry** — a `Grep` match on the file
alone is not sufficient. Confirmed by dogfooding this exact mechanism: a
matched file can contain the tag-wrapped string inside a `type:"assistant"`
`tool_use` entry instead — specifically, this very kind of search's own
prior `Grep` call, logged with the literal pattern as its `input.pattern`
argument, which is real noise this mechanism produces, not a hypothetical.
A `type:"user"` entry containing the tag **is** the evidence — no further
shape-check needed, since the tag itself is the invocation signal (and
confirmed separately: this collapses a noisy bare-word match count, e.g.
~100+ files for a common term, down to zero-or-few genuine hits). **Any
match on a `type:"assistant"` entry is not evidence — discard it,
regardless of what tool or arguments produced it.** This is also why
"Tool use" is not a valid evidence path for slash-command terms at all: a
slash command is always human-dispatched, never assistant-tool-invoked, so
accepting a `type:"assistant"` match here would count exactly the
self-referential noise just described as if it were genuine adoption.

**Non-slash terms** (bare words, environment variables, settings fields —
e.g. `opusplan`, `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP=1`) have no
equivalent structural marker to search for. Fall back to:

```
Grep(pattern="<search-term>", path="~/.claude/projects", glob="**/*.jsonl",
     output_mode="files_with_matches")
```

Then `Read` each matched file to confirm the shape is real evidence, not
just a mention:

- **Typed invocation** — `type:"user"` + a `message.content` field +
  `promptSource:"typed"` + `origin.kind=="human"`. This excludes synthetic,
  replayed, or pasted content, but — unlike the tag-based check above —
  does **not** distinguish genuine use from a human merely discussing the
  term; see the Edge Cases entry on this class of feature for the accepted
  limitation.
- **Tool use** — `type:"assistant"` + a `message.content[]` entry with
  `type:"tool_use"`.
- **Whole-word match, not a bare substring** — confirmed by a real
  pre-fix run: a bare `advisor` search matched ordinary prose about
  "security advisor**ies**." Before counting a match as shape-confirmed,
  verify the search term is not embedded inside a longer word: the
  characters immediately **before and after** the match, if alphanumeric,
  must not continue the same word (checking only one side leaves the other
  boundary open to the identical false-positive class).

Count **distinct sessions** (distinct transcript files) with at least one
shape-confirmed hit per slug, not raw line matches — repeated matches
within the same session are one piece of evidence, not several. If a
slug's own `Grep` result hits the tool's result-count cap (confirmed: a
broad bare-word token can exceed ~250 matched files — the tag-based search
above does not have this exposure in practice, since it only matches
genuine dispatches), this cannot produce a false "no evidence" — a hit is
confirmed the moment any one matched file passes the shape check, so a cap
can only ever under-count the *session number* shown in the Step 4 preview.

### 3. Compute transitions

For each feature:

| Current status | Evidence found this scan | Proposed transition |
|---|---|---|
| not `adopted` | yes | `adopted` |
| `unseen` | no | `nudged` |
| anything else | no | unchanged, skip silently |

### 4. Preview and wait

Group the proposed changes:

````markdown
## Feature Adoption Check

### Evidence found — proposing "adopted"
- **opusplan** — 3 sessions

### No evidence yet — proposing "nudged"
- **rewind** — "Restores the conversation to an earlier point..."

Approve all, approve one (e.g. "approve opusplan"), or decline.
````

Never write anything before this gate.

### 5. Write approved changes

For each approved change, `edit_note` with `find_replace` anchored strictly
*inside* the YAML frontmatter block, never spanning a `---` marker (this
project's established Sprint-24 safe-edit pattern, avoiding a known
duplicate-frontmatter bug):

```
edit_note(
  identifier="main/reference/claude-code-noteworthy-features",
  operation="find_replace",
  find_text="adoption-<slug>: <old-status>",
  content="adoption-<slug>: <new-status>"
)
```

Re-read the note once afterward (`read_note(output_format="json",
include_frontmatter=true)`) to confirm the frontmatter value actually
changed, not just that the edit call returned success.

On any actual status change, regenerate the local tip cache directly with
`Write`, using **this step's own confirmation re-read** — not the earlier
Step 1 catalog, which could be stale if anything else edited the note
between Step 1 and now — and the shared filter/grammar defined in
`${CLAUDE_PLUGIN_ROOT}/skills/nudge-sync/references/tip-cache-contract.md`.
Write directly to `~/.claude/references/claude-code-nudge-tips.txt` — a
plain full-file overwrite, matching `/nudge-sync`'s own convention (see its
Edge Cases for why the extra temp-file-and-rename machinery isn't worth it:
the SessionStart hook already degrades gracefully on a partial read). This
is what closes the loop with the SessionStart hook — without a second MCP
read beyond the confirmation already happening, and without a shell-out to
`/nudge-sync`.

### 6. Report

```markdown
## Feature Nudge Complete

Updated: N (opusplan -> adopted, ...)
Declined: M
Skipped (no change): K
```

## Additional Resources

- **[`${CLAUDE_PLUGIN_ROOT}/skills/nudge-sync/references/tip-cache-contract.md`](../nudge-sync/references/tip-cache-contract.md)**
  — the exclusion rule and cache line grammar used in Step 5, shared with
  `/nudge-sync`.
