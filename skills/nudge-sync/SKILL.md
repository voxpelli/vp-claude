---
name: nudge-sync
description: "This skill should be used when the user asks to 'sync nudge tips', 'nudge sync', 'refresh the tip cache', 'rebuild the tip cache', 'regenerate claude code nudge tips', 'update the nudge tips file', or after adding new [nudge] observations to the noteworthy-features note. Reads the Basic Memory note main/reference/claude-code-noteworthy-features via MCP, filters out any feature already marked adopted in frontmatter, and writes the eligible tips to ~/.claude/references/claude-code-nudge-tips.txt for the SessionStart hook to read."
user-invocable: true
allowed-tools:
  - mcp__basic-memory__read_note
  - Write
---

# Nudge Sync

Fetch the noteworthy-features note from Basic Memory, filter out anything
already marked adopted, and write the eligible tips to a local cache file the
SessionStart hook can read without ever touching Basic Memory itself. Follows
the same vendor-sync pattern as `tag-sync`: registry (BM note) -> fetch via
MCP -> filter -> write to a synced local file. Always re-fetches on
invocation — no same-day guard: `read_note` is one cheap call, the
SessionStart hook already throttles tip display to once/day independently,
and a manual `/nudge-sync` is itself an explicit refresh request.

**Intentionally Claude-Code-specific, not a template for a generic
mechanism.** This skill hardcodes the note permalink
(`main/reference/claude-code-noteworthy-features`) and Claude-Code slug
vocabulary — a deliberate, stated exception to this project's general
domain-generic-skill convention, made explicit here rather than left as an
unexamined pattern break, because the whole task is specifically about
Claude Code feature adoption.

The output file is consumed by `hooks/tip-fragment.sh` when surfacing the
daily tip, and by no other component.

## Edge Cases

- **`read_note` fails, or returns empty/malformed content** — report the
  error and exit **without writing**. Never overwrite a working cache file
  with empty or partial content on a fetch failure.
- **`~/.claude/references/` directory missing** — `Write` creates missing
  parent directories on its own, so this is not functionally required — but
  create it explicitly anyway, at zero cost, for parity with `tag-sync`'s
  own stated convention.
- **Note has zero `[nudge]` observations** — write an empty cache file
  (this is a legitimate state, not an error); the hook already degrades to
  showing nothing on an empty file.
- **Note missing entirely** — report the error and exit without writing;
  never auto-create the note (that is `/package-intel`/`/tool-intel`'s kind
  of job, not this skill's).
- **Concurrent regeneration** (another session runs `/nudge-sync` or
  `nudge-adoption` at the same time) — not engineered around. The cache file
  is a regenerable derived artifact, never a source of truth; both writers
  do a full overwrite from the same authoritative BM note, so last-writer-wins
  converges to a correct state and any staleness self-heals on the next
  sync. A reader (the SessionStart hook) that happens to catch a write
  mid-flight degrades gracefully — it reads the tips file line-by-line and
  tolerates a malformed line, so the worst case is one garbled or missing
  tip for one session, not a crash.

## Workflow

### Step 1: Fetch the note

```
mcp__basic-memory__read_note(
  identifier="main/reference/claude-code-noteworthy-features",
  output_format="json",
  include_frontmatter=true
)
```

On failure or an empty/malformed result, follow the fetch-failure edge case
above and stop.

### Step 2: Filter

For each `[nudge]` observation line, extract its trailing `Feature: <slug>`
token. **Check the slug-uniqueness invariant first** (defined in
[`references/tip-cache-contract.md`](references/tip-cache-contract.md)): if
any two tokens normalize to the same slug, report the colliding lines and
stop — never write a cache with a silently-merged slug. Otherwise, look up
`adoption-<slug>` in the note's frontmatter (default `unseen` if the key is
absent). Apply the exclusion rule from the same contract file: exclude a
line if its frontmatter value, trimmed and lowercased, is `adopted` or
`declined`.

### Step 3: Write

Build the filtered list of lines, verbatim from the note (see the contract
file's line-grammar section — never reformat or truncate). Write the result
directly to `~/.claude/references/claude-code-nudge-tips.txt` with `Write`
— a plain full-file overwrite, matching `tag-sync`'s own convention. No
temp-file-and-rename dance: the reader already degrades gracefully on a
partial read (see the Edge Cases entry above), so the extra machinery isn't
worth it here.

### Step 4: Report

```markdown
## Nudge Tips Synced

File: ~/.claude/references/claude-code-nudge-tips.txt
Tips: <N> eligible (<M> excluded as already adopted)
```

## Additional Resources

- **[`references/tip-cache-contract.md`](references/tip-cache-contract.md)**
  — the single-source-of-truth definition of the exclusion rule and cache
  line grammar, shared with `nudge-adoption`.
