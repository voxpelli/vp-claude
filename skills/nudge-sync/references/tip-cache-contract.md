# Tip Cache Contract

Shared reference for `nudge-sync` and `feature-nudge`. Both skills point here
via `${CLAUDE_PLUGIN_ROOT}/skills/nudge-sync/references/tip-cache-contract.md`
— `feature-nudge` lives in a separate skill directory, so it must use this
full plugin-relative path rather than a bare `references/...` path, which
would resolve relative to its own directory instead.

This file defines the **one** rule and the **one** line grammar both skills
use when regenerating the tip cache, so the two independent write paths never
drift out of sync with each other.

## Source note

`main/reference/claude-code-noteworthy-features` (Basic Memory, `reference`
type). Its `## Observations` section holds one `[nudge]` line per feature; its
YAML frontmatter holds one `adoption-<slug>` key per feature.

## Exclusion rule

A feature is **excluded** from the cache file if its frontmatter value,
trimmed of surrounding whitespace and lowercased, matches one of:

```
adopted
declined
```

Compare normalized, not byte-exact — a hand-edited `"Adopted"` or
`"adopted "` (frontmatter is ordinary YAML, not schema-gated, so this is a
real and expected way values can drift) must still be recognized. Every
other value (`unseen`, `nudged`, or the key being absent — treat absent as
`unseen`) is **included**. Both `adopted` and `declined` mean "stop
nudging"; the note itself decides which state applies, this cache never
does.

## Slug-uniqueness invariant

Every `Feature: <slug>` token in the note, once normalized (lowercase, no
leading `/`, non-alphanumeric runs collapsed to a single `-`), must be
unique across the note. If two raw tokens ever normalize to the same slug,
that is a **collision**, not a mergeable duplicate — both `nudge-sync` and
`feature-nudge` must detect this before writing anything (compare
normalized forms, not raw tokens) and **report the colliding lines and stop**
rather than silently sharing one `adoption-<slug>` frontmatter key between
two different features. Never auto-merge or auto-rename a colliding slug —
renaming orphans the existing frontmatter key and any ring-buffer history
tied to the old form.

## Cache line grammar

Each included feature becomes one line, copied **verbatim** from the note's
own `[nudge]` observation — never reformatted, reworded, or truncated:

```
- [nudge] <subject-first tip about the feature>. Feature: <slug> Added: <YYYY-MM-DD>
```

This must be byte-for-byte the same line the BM note carries, because the
SessionStart hook's ring buffer keys on the trailing `Feature: <slug>` token
and its em-dash-safe parameter-expansion parse depends on this exact shape
being present on every line.

## Target file

`~/.claude/references/claude-code-nudge-tips.txt` — one qualifying line per
row, no header, no trailing metadata. Written with a plain `Write` overwrite
(both writers do this, matching `tag-sync`'s own convention — neither has a
tool capable of a temp-file-and-rename dance, only `Write` itself). The
reader (`hooks/tip-fragment.sh`) already tolerates a partial or malformed
line gracefully, so a concurrent write racing a read degrades at worst to
one garbled or missing tip for one session — cosmetic, self-healing on the
next sync, never a crash.
