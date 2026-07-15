---
name: schema-evolve
description: "This skill should be used when the user asks about 'schema drift', 'schema evolution', 'evolve schema', 'schema sync', 'sync schemas', 'update schema fields', 'schema field frequency', 'missing schema fields', 'unused schema fields', 'schema proposal', 'schema cardinality', 'check schema', 'schema audit', 'schema changes'. Detects drift between Basic Memory schema definitions and actual note usage, proposes field additions/removals based on frequency analysis, and dual-syncs BM notes + local schema files after approval."
user-invocable: true
argument-hint: "<note_type> [--prescribed verb1,verb2,...]"
allowed-tools:
  - Read
  - Edit
  - Glob
  - mcp__basic-memory__schema_diff
  - mcp__basic-memory__schema_infer
  - mcp__basic-memory__schema_validate
  - mcp__basic-memory__read_note
  - mcp__basic-memory__edit_note
---

# Schema Evolution

Detect drift between a Basic Memory schema definition and actual note usage,
propose changes, and synchronize both the BM schema note and the local
`schemas/` file after user approval.

## Arguments

**Required:** the note type in snake_case.

| Example | Schema file |
|---------|-------------|
| `npm_package` | `schemas/npm_package.md` |
| `brew_formula` | `schemas/brew_formula.md` |
| `github_action` | `schemas/github_action.md` |
| `engineering` | `schemas/engineering.md` |
| `standard` | `schemas/standard.md` |

The argument must match a `type` value used in Basic Memory note frontmatter
and a corresponding file in `schemas/`. If the type is unknown, list available
schema files and ask the user to pick one.

**Optional:** `--prescribed verb1,verb2,...` — force-add specified relation
verbs (or observation field names) to the schema regardless of usage
frequency. See "Modes" below.

## Modes

The skill operates in two complementary modes:

### Drift-driven mode (default)

Invocation: `/schema-evolve <note_type>`

Frequency-based: `schema_diff` and `schema_infer` decide what to add or
remove. Fields are added only when their actual per-type usage crosses
the 25% threshold. This is the right mode for organic schema evolution
where the notes lead and the schema catches up.

Limitation: prescribed cross-schema vocabulary (e.g., a Tier-0 verb set
that should be declared identically across many schemas) cannot be
absorbed this way until each schema independently crosses 25% — which
may never happen for narrow types.

### Prescribed mode

Invocation: `/schema-evolve <note_type> --prescribed verb1,verb2,...`

Frequency-bypass: the listed names are force-added to the target schema
regardless of usage. Intended for absorbing cross-schema vocabulary
(Tier-0 verbs the operator wants declared uniformly across schemas) or
for adding fields ahead of authoring practice.

The two modes compose: in a single invocation, prescribed additions are
applied alongside drift-driven proposals. Removal and cardinality
proposals continue to come from `schema_diff` / `schema_infer` and are
unaffected by `--prescribed`.

## Edge Cases

- **No schema found** — if `schema_diff` returns `schema_found: false`, report
  "No schema registered in Basic Memory for type `<note_type>`." Direct the
  user to run `/intel` first (it auto-seeds the schema
  on first use), or to use `/memory-schema` to create the schema manually. Stop.
- **No drift detected** — if `schema_diff` returns empty `new_fields`,
  `dropped_fields`, and `cardinality_changes`, AND `--prescribed` was not
  supplied (or every prescribed verb is already declared), report "Schema
  is in sync — no changes needed." Stop.
- **Prescribed verb already present** — if a `--prescribed` entry already
  appears in the schema's `schema:` block, treat it as a no-op for that
  entry. List it in the proposal under "Already present (skipping)" so the
  operator can confirm the verb name matched what they expected. Continue
  with the remaining prescribed entries.
- **Invalid prescribed verb name** — reject any prescribed entry that is
  not a valid picoschema identifier (must match `[a-z][a-z0-9_]*` —
  lowercase, snake_case, no spaces, no leading digits). Report the
  invalid entries and ask the user to re-issue with corrected names. Do
  not silently drop them.
- **Empty `--prescribed` list** — if `--prescribed` is supplied with no
  verbs (or only whitespace/commas), warn and fall back to drift-driven
  mode.
- **Local schema file missing** — if `schemas/<note_type>.md` does not exist,
  warn and offer to create it from the current BM schema note. Do not skip.
- **Small sample** — if `schema_infer` reports fewer than 5 notes, warn that
  frequency data may be unreliable. Still present the proposal but flag it.
- **User rejects proposal** — do not write anything. Report "No changes made."
- **Pre-existing divergence** — if the BM schema note and local `schemas/`
  file differ before evolution begins (detected in Step 4), present the
  divergence first and ask the user to reconcile before proceeding.

## Workflow

### Step 1: Validate inputs

Confirm the note type argument is provided. Verify the local schema file
exists:

```
Glob(pattern="schemas/<note_type>.md")
```

If the file does not exist, list available schemas:

```
Glob(pattern="schemas/*.md")
```

Report available types and ask the user to choose.

If `--prescribed` was supplied, parse the comma-separated list, trim
whitespace, drop empties, and validate each entry against the picoschema
identifier pattern `[a-z][a-z0-9_]*`. Report invalid entries and stop;
do not proceed with a partial list. Keep the validated list in memory
for Steps 4, 5, 6, and 7.

### Step 2: Detect drift

Run `schema_diff` to compare the registered schema against actual note usage:

```
schema_diff(note_type="<note_type>", output_format="json")
```

This returns:
- `new_fields` — categories or relations used in notes but not in the schema
  (candidates for addition)
- `dropped_fields` — fields in the schema but never used (candidates for
  removal)
- `cardinality_changes` — array vs single-value mismatches

If all three are empty AND no `--prescribed` verbs remain after the
already-present check in Step 4, report "Schema is in sync — no drift
detected." Stop. If `--prescribed` verbs remain to be added, continue.

### Step 3: Gather frequency data

Run `schema_infer` with a low threshold to surface emerging fields:

```
schema_infer(note_type="<note_type>", output_format="json", threshold=0.1)
```

Extract for each field: `name`, `source` (observation/relation), `count`,
`total`, `percentage`, `is_array`.

### Step 4: Read current schema

Read both the BM schema note and the local file:

```
read_note(identifier="main/schema/<note_type>", include_frontmatter=true, output_format="text")
Read(file_path="<plugin-root>/schemas/<note_type>.md")
```

Note: BM schema note identifiers use the `main/schema/<type>` permalink form
with underscores matching the entity name (e.g., `main/schema/npm_package`).

Compare the `schema:` blocks of both sources. If they differ (pre-existing
divergence), present the differences and ask the user to reconcile before
proceeding with evolution. Do not compound existing drift.

If `--prescribed` was supplied, scan the (now-reconciled) `schema:` block
for each prescribed verb name. Partition the list into:

- **To add** — names not yet declared in the schema block
- **Already present** — names already declared (no-op for these entries)

Carry both partitions forward to Step 5.

### Step 5: Present proposal

Build and display a change proposal with four sections:

```markdown
## Schema Evolution Proposal: `<note_type>`

Based on **N** notes analyzed.

### Fields to Add (>25% usage, not in schema)

| Field | Source | Usage | Proposed Picoschema |
|-------|--------|-------|---------------------|
| `security` | observation | 25% (34/135) | `security?(array): string, CVE status and advisories` |

### Prescribed Additions (frequency-bypass)

Shown only when `--prescribed` is supplied. Source defaults to `relation`
unless `schema_infer` data clearly indicates the verb is being used as an
observation field — in that case, prompt the user to confirm intent.

| Field | Source | Current Usage | Proposed Picoschema |
|-------|--------|---------------|---------------------|
| `relates_to` | relation | 8% (3/35) | `relates_to?(array): [[entity]], generic cross-reference` |

### Prescribed: Already Present (no-op)

| Field | Source | Note |
|-------|--------|------|
| `depends_on` | relation | Already declared — skipping |

### Fields to Remove (0% usage across all notes)

| Field | Source | Current Picoschema |
|-------|--------|--------------------|
| `benefit` | observation | `benefit?(array): string, advantages` |

### Cardinality Fixes

| Field | Declared | Actual | Suggestion |
|-------|----------|--------|------------|
| `convention` | array | single | Keep array (forward-compatible) |

### Watch List (10-24% usage, not yet proposing)

| Field | Source | Usage |
|-------|--------|-------|
| `workaround` | observation | 18% (24/135) |
```

**Decision rules:**
- **Add** if in `new_fields` AND >= 25% usage. Always optional (`?`).
- **Prescribed Add** — present every `--prescribed` "to add" entry,
  regardless of frequency. Always optional (`?`). The default Picoschema
  is `<name>?(array): [[entity]], <one-line description>` for relations;
  for observations use `<name>?(array): string, <description>`. Suggest a
  description but prompt the user to refine it before applying. Always
  declare prescribed entries as `(array)` for forward compatibility.
- **Remove** if in `dropped_fields` (0% usage). Confirm with user first.
- **Cardinality**: default to keeping `array` unless > 90% single-value.
- **Watch list**: 10-24% usage, informational only.

Ask: "Apply these changes? (You can modify individual items before applying.)"

### Step 6: Apply to BM schema note

After approval, update the Basic Memory schema note using `edit_note` with
`find_replace`. Use `main/schema/<note_type>` as the identifier.

For adding fields, insert new Picoschema lines into the `schema:` frontmatter
block. Place observation fields among existing observations, relation fields
among existing relations. Treat prescribed additions identically to
drift-driven additions at this step — the only difference is provenance,
not the edit shape.

For removing fields, delete the Picoschema line from frontmatter.

Use one `edit_note` call per change for atomic, reviewable diffs.

Keep `find_text` inside the YAML `schema:` block (between `schema:` and
the next top-level key such as `settings:`). Never include the `---`
frontmatter markers in `find_text` — crossing that boundary triggers the
known duplicate-frontmatter bug on schema notes.

### Step 7: Apply to local schema file

Update `schemas/<note_type>.md` with the same changes using the `Edit` tool.
The local file mirrors the BM note — changes to the `schema:` block must
match exactly.

### Step 8: Validate

Run `schema_validate` against the updated schema:

```
schema_validate(note_type="<note_type>", output_format="json")
```

- **All pass** — report success with count
- **Some fail** — list failures. These are typically pre-existing issues
  exposed by the schema change, not caused by it. Present as "notes to fix"
- **Schema invalid** — report the validation error to the user. Do not
  auto-revert. The user can manually fix the schema or undo via
  `git checkout schemas/<type>.md` for the local file

### Step 9: Report results

```markdown
## Schema Evolution Complete: `<note_type>`

### Changes Applied
- Added N fields (drift-driven): `field1`, `field2`
- Added P fields (prescribed): `verb_a`, `verb_b`
- Skipped Q prescribed entries (already present): `verb_c`
- Removed M fields: `field3`

### Files Modified
- BM schema note: `main/schema/<note_type>`
- Local schema: `schemas/<note_type>.md`

### Validation
- N notes validated, M passed

### Watch List for Next Evolution
- `field_x` at 18% — revisit when it crosses 25%
```

Remind the user to commit the local schema file change.
