---
name: deep-intel
description: "This skill should be used when the user explicitly runs `/deep-intel` to deeply research and document a service, platform, protocol, standard, concept, movement, historical milestone, project, or engineering pattern into the Basic Memory knowledge graph — 'deep research [subject]', 'deep-dive [topic]', 'research this service/platform', 'document this protocol/standard', 'research this concept/movement', 'document this milestone', 'engineering deep-dive', 'add [service/concept/standard] to the knowledge graph'. Runs a multi-angle research Workflow behind two human gates (pre-spend, pre-write) and writes a schema-typed note. NOT for a single software package (use /package-intel), NOT for a developer tool/CLI/action/image/extension (use /tool-intel), NOT for a person (use /people-intel), and NOT for freeform questions against existing notes (use /knowledge-ask). On a package/tool/person subject it detects and redirects to the right sibling."
user-invocable: true
disable-model-invocation: true
argument-hint: "<subject> [--type <service|concept|standard|milestone|project|engineering>] [--quick]"
allowed-tools:
  - Read
  - mcp__basic-memory__search_notes
  - mcp__basic-memory__read_note
  - mcp__basic-memory__write_note
  - mcp__basic-memory__edit_note
  - mcp__basic-memory__build_context
  - mcp__basic-memory__list_directory
  - mcp__basic-memory__schema_validate
---

# Deep Intel

Research a subject across many sources and write (or enrich) a schema-typed
Basic Memory note for one of the six knowledge types — `service`, `concept`,
`standard`, `milestone`, `project`, `engineering` — behind two human gates.

The heavy research runs as a **dynamic Workflow** that replicates the built-in
`/deep-research` engine (multi-angle scope → parallel search → streaming
fetch+extract → graph-aware synthesis) but targets a Basic Memory note instead
of a report. The Workflow **returns a proposed-note structure**; this skill, in
the foreground, gates the spend before launch and gates the write on completion.

`disable-model-invocation: true` — this skill is expensive (a multi-agent
Workflow) and shares trigger-space with the sibling intel skills, so it runs
**only** on an explicit `/deep-intel`, never on the model's initiative.

## Arguments

| Form | Meaning |
|------|---------|
| `<subject>` | The thing to research (a name or short phrase) |
| `--type <t>` | Force the knowledge type; otherwise inferred in Step 0 |
| `--quick` | Skip the verification + completeness passes; write a hedged, single-pass note |

## Step 0 — Resolve type and redirect non-knowledge subjects

Parse `subject`, optional `--type`, optional `--quick`. Derive `mode`:
`--quick` → `quick`; otherwise the default is `standard` (full pipeline with
verification gated to high-stakes claims). `heavy` (full topology on all tiers)
is opt-in for the most consequential subjects.

**Redirect first (the anti-duplication gate).** This skill covers only the six
knowledge types. If the subject is something a sibling already owns, do not
research it here — print a one-line redirect and STOP (print-and-exit; do not
invoke the sibling):

- An ecosystem-prefixed package or an obvious single library
  (`npm:`/`crate:`/`go:`/`composer:`/`pypi:`/`gem:`) → "`<subject>` is a package —
  run `/package-intel <subject>`." Stop.
- A developer tool with a tool prefix or an obvious CLI/action/image/extension
  (`brew:`/`cask:`/`action:`/`docker:`/`vscode:`/`gh:`/`plugin:`/`skill:`) →
  "run `/tool-intel <subject>`." Stop.
- A person (a human name) → "run `/people-intel <subject>`." Stop.

**Resolve the knowledge type.** If `--type` is given, use it. Otherwise classify
with these boundary tests and state the inferred type + one-line reasoning:

- **service** — an external hosted product/platform you consume or observe.
- **project** — something *you* own and build (or plan to).
- **standard** — a protocol or specification.
- **concept** — a movement, philosophy, or cross-domain pattern.
- **milestone** — a dated historical event, era, or critique.
- **engineering** — a cross-project, technology-focused knowledge note.

If the type is genuinely ambiguous, state the inferred type and ask the user to
confirm or pass `--type`. Wait for their response before proceeding.

Read the schema contract for the resolved type:
`${CLAUDE_PLUGIN_ROOT}/schemas/<type>.md`. The valid observation `[category]`
tags are the non-`Note` picoschema field names; the relation verbs are the
`Note`-typed field names. Derive the note shape from this at synthesis time — do
not hardcode category lists. Read
`${CLAUDE_PLUGIN_ROOT}/skills/deep-intel/references/synthesis-profiles.md` for
the per-type body shape and high-value categories.

## Step 1 — Existence check, freshness, directory

Find any existing note for the subject (typed first, then a broad semantic pass
because knowledge-type titles vary more than prefixed packages):

```text
search_notes(query="<subject>", note_types=["<type>"], page_size=5)
search_notes(query="<subject>", search_type="text", page_size=10)
```

If a note matches, read it (`read_note(identifier=..., output_format="json")`)
and decide **new vs enrich** (see Step 5). Scope research by note age the same
way the sibling intel skills do (missing/>180d = full; 60–180d = trimmed;
<60d = light refresh, and offer to skip the heavy Workflow on a very fresh note).

Pick the default directory by type (`service`→`services/`, `concept`→`concepts/`,
`standard`→`standards/`, `milestone`→`milestones/`, `project`→`projects/`,
`engineering`→`engineering/`). The user can override at the pre-write gate.

## Step 2 — PRE-SPEND gate (before any tokens are spent)

Show the plan and a **bounded worst-case** estimate, then WAIT for approval:

```text
## deep-intel plan: <subject>   (type: <type>, mode: <quick|standard|heavy>)
- Research: ~5 angles, up to ~15 fetched sources
- Verification: <none in --quick | the persisted-claim topology in standard/heavy>
- Est. whole-run agents: ~25 (quick) / ~45 (standard) / ~60 (heavy)
Proceed · "--quick" (skip verification + completeness) · cancel?
```

The estimate is bounded (research ≤ 15 sources; verification ≤ 15 persisted
claims; any completeness re-wave capped at one), so the worst case is knowable
up front. Wait for the user's choice.

## Step 3 — Launch the research Workflow

Launch the deep-intel research Workflow. Its script and launch contract live in
`${CLAUDE_PLUGIN_ROOT}/skills/deep-intel/references/research-workflow.md`; read
that file and launch the script via the **Workflow** tool, passing
`args = JSON.stringify({ subject, type, mode, existingTitle, today })`. Capture
`today` as an ISO date in the foreground and pass it — the Workflow runtime has
no `Date.now()`, so synthesis can only date the note from this argument. The Workflow's
own agents reach web-search, DeepWiki, and Basic Memory via ToolSearch, so the
deep graph reads (dedup, gap-targeting, contradiction detection) and source
research all happen inside the Workflow.

The Workflow runs in the background and **returns a structured proposed-note
object** on completion — it does **not** write to Basic Memory. Capture that
return value. **If the Workflow errors or returns an empty result, report it and
STOP — do not write a malformed note.**

## Step 4 — PRE-WRITE gate (on the completion turn)

Build a grouped preview from the returned structure and WAIT for approval. Group
observations by category, list relations by verb, put source URLs under
`## Sources`, and surface any flagged claims explicitly:

```text
## Proposed deep-intel note: <title>   (type: <type>, dir: <directory>/)

### New note  /  Appending to: <existing-title>
- [status] active
- [architecture] ...

### Sources
- [title](url) — date

Approve all, or specify which to drop.
```

Render the returned structure faithfully: the proposed note's `disputed[]`,
`dropped[]`, and `openQuestions[]` must be surfaced, never hidden. Show DISPUTED
claims in their own block (the user decides keep-hedged / drop / override — they
are never silently resolved); list what the verification topology `dropped` as
refuted so the user sees what was removed; show any completeness `openQuestions`.

Use the returned `verification` value as the label: **"multi-source
cross-checked"** (standard/heavy) — never "fact-checked"; or, in `--quick` mode,
state plainly that the note is single-pass and **not** cross-checked and stamp
`verification: quick-unverified` in the frontmatter. Write nothing the user has
not approved.

## Step 5 — Write or enrich

**New subject** → `write_note(note_type="<type>", directory="<directory>", ...)`
with the derived structure: frontmatter (`source` is required for
service/standard/milestone; `status` for project), `## Observations` with
`[category]` lines, `## Relations` with the schema's relation verbs, and a body
`## Sources` section for citations.

Build the note from the returned `proposedNote`: each observation →
`- [category] text`; each relation → `- <verb> [[<target>]]` (include
`existsInGraph: false` targets too — they are harmless forward-references that
bind when the target note appears); each source → a markdown link under
`## Sources`. Carry the returned `verification` value (`multi-source
cross-checked` or `quick-unverified`) into the frontmatter.

**Existing subject** → `edit_note(operation="find_replace")` per the sibling
write-decision table:

- Observations populated → anchor on the **last observation line**, append after.
- Observations empty → anchor on `## Observations\n`.
- Observations absent → anchor on the next header; prepend a new section.

Never use `operation="append"` with `section=` (it appends to end of file). The
match is byte-exact; on no-match, re-read, re-derive the anchor, retry once, then
stop and report.

**Contradiction with an existing observation:** do NOT `find_replace` the
existing line (it may be a deliberate hedge, or research may be wrong). APPEND a
hedged `[gotcha]` (`[controversy]` on a person note) recording both values and
their sources, and tell the user to run `/knowledge-maintain` to reconcile.

**Guardrails (honor the BM gotchas):** no `[[wiki-links]]` in observations
(relations only); source URLs only in `## Sources`/frontmatter, never inside a
`[category]` line; `find_replace` never crosses a `---` frontmatter marker.

**Post-write reconcile:** re-read the note (`read_note(output_format="json")`),
confirm the observation count matches what was written (`N_after` vs intended —
do not trust the inline index echo), then `schema_validate(identifier=...)` and
expect 0 errors. Report *landed* counts, not intended counts.

## Step 6 — Cross-link (exact-title only) and report

Find other notes that substantively reference the subject:

```text
search_notes(query="<subject>", search_type="text", page_size=10)
```

For genuine references, add a relation (`relates_to [[<exact-title>]]` or a
schema-appropriate verb) via `edit_note find_replace` on the last relation line —
**only** when the target title is an exact match returned verbatim by search (BM
resolves edges by exact title; a paraphrased target writes a dead edge). Emit
bidirectional edges where the schema vocabulary supports the inverse.

Report: type detected, note location, the key findings, anything flagged, and
the Workflow stats.
