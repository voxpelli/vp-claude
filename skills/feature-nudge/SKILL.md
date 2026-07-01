---
name: feature-nudge
description: "This skill should be used when the user asks to 'nudge me on unused features', 'which Claude Code features haven't I adopted', 'check feature adoption', 'am I using the features I noted', 'feature nudge', 'which tips have I actually used'. Scans recent Claude Code session transcripts across all projects for real evidence of feature use (typed slash-commands, model aliases, tool invocations), cross-references them against the [nudge]-tagged features in the Basic Memory note main/reference/claude-code-noteworthy-features, previews which features have adoption evidence vs none, and updates each feature's adoption status in that note's frontmatter after user approval. On any status change, it also regenerates the shared tip cache (~/.claude/references/claude-code-nudge-tips.txt) that /nudge-sync owns."
user-invocable: true
allowed-tools:
  - Glob
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
- **No transcripts found (`Glob` returned zero files)** — do **not** silently
  treat this as "no evidence for everything" (see Step 2's guard — a Glob
  path/tool failure looks identical to a genuinely empty history). Report it
  to the user and stop, rather than proposing `nudged` transitions on data
  that may just be a broken scan.
- **All transcripts found but unreadable** (a real, non-zero file list that
  fails to parse) — this is a different, legitimate case: report "No session
  evidence available" and treat every feature as no-evidence (propose
  `nudged` for anything currently `unseen`, skip everything else).
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

Glob recent session transcripts across all projects, most-recently-modified
first, capped at ~50 files (this skill's own bound on transcript-scan cost;
recent-first ordering means older sessions rarely add new adoption
evidence — a pattern also observed in the built-in `fewer-permission-prompts`
skill, but adopted here as this skill's own design choice, not a claim about
that skill's undocumented internals). Transcripts nest at
variable depth — a session file directly under a project directory, but
subagent and workflow-agent transcripts one or more levels deeper — so the
glob must be recursive, and a tilde embedded in the `pattern` string does
**not** expand (confirmed empirically: `Glob(pattern="~/.claude/projects/*/*.jsonl")`
returns zero files even when matching transcripts exist, despite real
transcripts being present). The fix, also confirmed empirically (found real
transcript files, not zero) — put the tilde in the `path` parameter instead,
which behaves the same way `Read`/`Write` expand `~` elsewhere in this
plugin:

```
Glob(pattern="**/*.jsonl", path="~/.claude/projects")
```

**If this ever returns zero files, treat it as a tool/path failure, not
"no evidence"** — report this to the user rather than silently proceeding
as if every feature had no adoption evidence (indistinguishable failure
modes are exactly how this bug shipped undetected the first time). If it
does regress, fall back to resolving the actual absolute home directory and
using `Glob(pattern="**/*.jsonl", path="<absolute-home>/.claude/projects")`
— also confirmed working, though the tilde form above should be preferred
since it needs no path resolution.

Sort by mtime descending, take the top ~50. For each catalog slug, `Grep` as
a cheap first-pass filter across those files, then `Read` matching lines to
confirm the shape is real evidence, not just a mention:

- **Typed invocation** — `type:"user"` + a `message.content` field +
  `promptSource:"typed"` + `origin.kind=="human"`. This excludes synthetic,
  replayed, or pasted content — it's what keeps a conversation *about* a
  feature (discussing it, reading about it) from false-positiving as actual
  adoption.
- **Tool use** — `type:"assistant"` + a `message.content[]` entry with
  `type:"tool_use"`.

Count **distinct sessions** (distinct transcript files) with at least one
hit per slug, not raw line matches — repeated matches within the same
session are one piece of evidence, not several.

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
- **opusplan** — 3 sessions, 2026-06-28 to 2026-07-01

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
