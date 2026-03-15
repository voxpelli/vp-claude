---
name: schema-evolve
description: "This skill should be used when the user asks about 'schema drift', 'schema evolution', 'evolve schema', 'schema sync', 'sync schemas', 'update schema fields', 'schema field frequency', 'missing schema fields', 'unused schema fields', 'schema proposal', 'schema cardinality'. Detects drift between Basic Memory schema definitions and actual note usage, proposes field additions/removals based on frequency analysis, and dual-syncs BM notes + local schema files after approval."
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Glob
  - mcp__basic-memory__schema_diff
  - mcp__basic-memory__schema_infer
  - mcp__basic-memory__schema_validate
  - mcp__basic-memory__read_note
  - mcp__basic-memory__edit_note
  - mcp__basic-memory__list_directory
---

# Schema Evolution

Detect drift between a Basic Memory schema definition and actual note usage,
propose changes, and synchronize both the BM schema note and the local
`schemas/` file after user approval.

## Arguments

One argument: the note type in snake_case.

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

## Edge Cases

- **No schema found** — if `schema_diff` returns `schema_found: false`, report
  "No schema registered in Basic Memory for type `<note_type>`" and suggest
  seeding it from the local schema file. Stop.
- **No drift detected** — if `schema_diff` returns empty `new_fields`,
  `dropped_fields`, and `cardinality_changes`, report "Schema is in sync —
  no changes needed." Stop.
- **Local schema file missing** — if `schemas/<note_type>.md` does not exist,
  warn and offer to create it from the current BM schema note. Do not skip.
- **Small sample** — if `schema_infer` reports fewer than 5 notes, warn that
  frequency data may be unreliable. Still present the proposal but flag it.
- **User rejects proposal** — do not write anything. Report "No changes made."

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

If all three are empty, report "Schema is in sync — no drift detected." Stop.

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

### Step 5: Present proposal

Build and display a change proposal with four sections:

```markdown
## Schema Evolution Proposal: `<note_type>`

Based on **N** notes analyzed.

### Fields to Add (>25% usage, not in schema)

| Field | Source | Usage | Proposed Picoschema |
|-------|--------|-------|---------------------|
| `security` | observation | 25% (34/135) | `security?(array): string, CVE status and advisories` |

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
- **Remove** if in `dropped_fields` (0% usage). Confirm with user first.
- **Cardinality**: default to keeping `array` unless > 90% single-value.
- **Watch list**: 10-24% usage, informational only.

Ask: "Apply these changes? (You can modify individual items before applying.)"

### Step 6: Apply to BM schema note

After approval, update the Basic Memory schema note using `edit_note` with
`find_replace`. Use `main/schema/<note_type>` as the identifier.

For adding fields, insert new Picoschema lines into the `schema:` frontmatter
block. Place observation fields among existing observations, relation fields
among existing relations.

For removing fields, delete the Picoschema line from frontmatter.

Use one `edit_note` call per change for atomic, reviewable diffs.

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
- **Some fail** — list failures (pre-existing issues, not caused by evolution)
- **Schema invalid** — revert and retry

### Step 9: Report results

```markdown
## Schema Evolution Complete: `<note_type>`

### Changes Applied
- Added N fields: `field1`, `field2`
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
