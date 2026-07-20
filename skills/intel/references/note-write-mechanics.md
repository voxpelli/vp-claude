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
| Note exceeds ~40KB (`read_note` truncates to a persisted file with no byte-exact anchor to match) | `operation="append"` a clearly-headed new section (e.g. `## <Date> Update`) instead of a blind `find_replace` — appending after `## Relations` still registers as observations on re-parse |

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
note have been observed to truncate the note body to frontmatter only (Pi batch
eval, 2026-07-19). Chain edits sequentially across turns, or use a single
`replace_section` anchored on a stable header.

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

When updating an existing note that has a `[popularity]` observation, use
`find_replace` to replace the old line with the current count rather than
appending a second popularity line.
