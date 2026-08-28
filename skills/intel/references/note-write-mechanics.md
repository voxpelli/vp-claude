# Write or Update the Note — Mechanics

Shared by both `/intel` families. Loaded from Step 5 (write). The note title is
`<prefix>-<name>` throughout (e.g. `crate-serde`, `brew-ripgrep`).

**New note:** Use `write_note` with the full template. Set the `note_type` to the
routing row's type (e.g., `note_type="crate_package"` for the package family,
`note_type="brew_formula"` for the tool family).

**Relocated stub (a note about this subject already exists, but at a
different directory or title than the target location — e.g. an
old `indieweb/history/` stub for what is now a documented package or tool):**
This is **not** a fresh create, and it is **not** a physical relocation
either — verified via a live dry-run (2026-07-02, current BM version 0.22.1):
`write_note(overwrite=True, directory=<new>, ...)` targeting a *different*
directory than the existing stub does NOT find or overwrite the stub by
title. It creates a genuinely new, separate note at the new location (with
its own freshly-correct `permalink` — no stale-permalink re-key needed) and
leaves the old stub completely untouched at its old path. Left alone, this
produces a silent duplicate: two notes for one subject, only one of them
current. `move_note` was not independently verified in this dry-run; don't
assume it behaves differently without checking. Handle it explicitly:

1. If Step 1's existence check didn't surface the stub (it globs only the
   target directory), run a broader
   `search_notes(query="<name>")` before concluding the note is new
   — a stub in an unrelated directory won't match the directory-scoped glob.
2. Read the stub (reuse the "Step 1: Check for existing note" read above if you
   already have it) and record its `## Relations` entries and current
   `permalink`.
3. Write the new note with `write_note(overwrite=True, ...)`, targeting the
   correct `directory` and title (the `<prefix>-<name>` convention this skill
   uses throughout), and fold the stub's genuine
   relations (ones that still apply to the subject's new identity, not
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

**Existing note:** Pick the operation based on the note's current state:

| Note state | Use |
|------------|-----|
| `## Observations` has at least one `- [category]` line | `find_replace` anchored on the last observation line |
| `## Observations` exists but is empty | `find_replace` anchored on `## Observations\n` |
| `## Observations` is absent entirely | `find_replace` anchored on the next section header (typically `## Relations\n`); prepend a new `## Observations` section before it |
| Last observation wraps across multiple lines | Include all continuation lines in both `find_text` and the prefix of `content`, then append the new observation after |
| A large note's `read_note` output was redirected to a file by the host instead of shown inline | Derive the anchor from **that persisted file**, then `find_replace` as normal. Never anchor on an inline preview or summary of the content — that is the actual failure mode |

Canonical call (populated section):

````
edit_note(
  identifier="<prefix>-<name>",
  operation="find_replace",
  find_text="- [<last-category>] <last observation text>",
  content="- [<last-category>] <last observation text>\n- [<new-category>] <new observation text>"
)
````

Empty-section fallback (anchor on header):

````
edit_note(
  identifier="<prefix>-<name>",
  operation="find_replace",
  find_text="## Observations\n",
  content="## Observations\n- [<new-category>] <new observation text>\n"
)
````

Do NOT use `operation="append"` with `section="Observations"` when the section
already exists — it appends to end of file, not end of section. The substring
match in `find_replace` is byte-exact: use the observation text verbatim, no
whitespace normalization or escaping.

**Single-writer-per-message rule.** Never issue multiple `edit_note` calls on the
same identifier in one message. Concurrent `find_replace` operations on a single
note truncated the body to frontmatter only under Pi's MCP adapter (Pi batch
eval, 2026-07-19); not reproduced under Claude Code (2026-07-21 test — both
parallel edits landed cleanly), so sequential edits are the safe default on any host. Chain
edits sequentially across turns, or use a single `replace_section` anchored on a
stable header — but read the boundary rule below first. If a batch is ever
unavoidable, re-read afterward and confirm the body survived — a truncation
shows as frontmatter-only.

**`replace_section` does NOT replace the whole section — it stops at the first
heading of ANY level.** This is the single most misread edit operation, and the
older description here ("replaces the *entire* content under that header, so you
must supply the full section body") produced exactly the wrong instruction:
supplying the full body DUPLICATES every sub-heading, because the originals were
never consumed. Verified against the installed version's source, not inferred —
`entity_service.py` `replace_section_content` at tag `v0.22.1`, whose own
docstring says "until it encounters the next header of ANY level" and whose loop
is a bare `if next_line.startswith("#"): break`.

Three consequences of that implementation, in the order they bite:

- **A section with `###` children:** supply only the prose that sits directly
  under the header, never the children. Anchor on the deepest heading you
  actually mean to replace.
- **No fenced-code awareness at 0.22.1.** The check is `startswith("#")` on the
  raw line, so a `# comment` inside a ` ``` ` block ends the replacement early
  and the rest of your content lands after a stray fence. Prefer `find_replace`
  for any section containing code blocks.
- **A header that does not match is not an error — it APPENDS.** A typo'd or
  drifted header name silently creates a new section at end-of-file rather than
  failing, so the note looks edited and the intended section is untouched. A
  DUPLICATE header does raise (`ValueError`, "requires unique headers").

⚠️ **Version-gated — recheck on upgrade.** Upstream `main` has since added a
`replace_subsections` parameter defaulting to **`True`**, which INVERTS the
boundary rule (it then consumes to the next same-or-higher-level heading), and
added fenced-code awareness (`_fenced_code_line_flags`). Neither is present at
0.22.1, and the installed `edit_note` tool schema exposes no such parameter —
that absence is the cheapest way to tell which behaviour you have.

**Re-read before re-anchoring.** If any edit has already landed on a note this
session, re-read it before constructing the next `find_replace` anchor. The
sanctioned reuse of an earlier `read_note` (permitted by the existing-note mechanics above) is safe
only for the *first* edit on a note in a session; after any edit has landed, a
fresh read is required because the file content may have shifted.

**Overwrite recovery must come from a fresh read.** If a `find_replace` fails
and you fall back to `write_note(overwrite=true)`, source the full body from a
fresh `read_note`, never a stale in-context copy. `overwrite=true` is a
correct recovery mechanism, but only when the replacement content is verified
current.

If `find_replace` fails (no match found), the note may have been edited since
you last read it. Re-run `read_note`, re-derive the anchor, and retry once.
If the second attempt also fails, stop and report the error to the user — do
not loop.

**An `edit_note` ERROR does not mean the edit did not land. Re-read before any
retry.** `database is locked` is the one seen in practice, and it is raised
*after* the file on disk has already changed. Verified in the installed version's
source (`entity_service.py` `edit_entity_with_content`, tag `v0.22.1`): the
file write comes first and the index updates follow it in the same request —

```
checksum = await self.file_service.write_file(...)   # the file has changed HERE
entity   = await self.upsert_entity_from_markdown(...)  # a lock error can raise HERE
entity   = await self.repository.update(...)            # ...or HERE
```

— with the code's own comment reading "once the file write succeeds, we refresh
observations, relations, and checksum in the same request".

So the retry-once rule above applies ONLY to a no-match `find_replace`, which is
a refusal that changed nothing. For any other error, `read_note` first and check
whether your content is already present. A blind retry of an `append` writes it
twice; a blind retry of a `find_replace` then fails no-match and reads as a
second, unrelated problem. The note is fine either way — it is the INDEX that
is behind, and the next sync reconciles it.

**Cross-reference:** for upgrade-haul refreshes, the required dual-slot
verification (both header pipe and `[version]` observation) is documented in
`upgrade-haul.md` — Axis-A edit verification. That check is mandatory and
independent of these mechanics.

**Trust `schema_validate` and the file, not the inline count.** When verifying an
edit, the `edit_note` inline observation-count echo can transiently double or
triple — a BM index re-parse artifact on notes with `###` subsections inside
`## Observations` (observed 2026-05-30: `--stale` refresh edits showed inflated
counts while the files were correct and `schema_validate` stayed clean). Confirm
against `schema_validate` and the actual file contents (re-read the note), not
that echo. Do NOT delete "duplicate" observations on the strength of the inline
count alone — first confirm the duplication exists in the file itself (re-read /
grep); a re-sync clears the phantom while the file was always correct.

**The relations echo counts inbound *and* outbound edges.** `edit_note`'s
`Resolved:`/`Unresolved:` line is not a count of the note's own `## Relations`
lines — BM sums incoming and outgoing relations before computing it, so a note
with 14 relation lines legitimately echoes ~28 when 15 other notes link to it.
That gap is correct by design; do not read it as duplication and do not "clean
up" relations on the strength of it. (The `Unresolved:` line is emitted only
when that count is non-zero, so its absence means zero unresolved, not a
missing field.) The real artifact here is a transient **under**-count — an echo
listing only the inbound rows, with the `Unresolved:` line vanishing, then
recovering on the next edit (observed twice on 2026-07-28 while the file
provably kept all its relation lines throughout). As with the observation
count: verify against the file, not the echo.

When updating an existing note that has a `[popularity]` observation, use
`find_replace` to replace the old line with the current count rather than
appending a second popularity line.
