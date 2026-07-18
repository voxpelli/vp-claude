---
paths:
  - "schemas/**/*.md"
---

# Schema & note-output rules

Loads when editing a `schemas/**` file. The root `CLAUDE.md` keeps the schema
type list and the dual-sync rule; the schema-lifecycle workflow, the BM search
patterns, the cross-linking convention, source-citation rules, and the note
shapes that the intel skills emit all live here.

## Schema lifecycle

**First-install seeding:** On a fresh Basic Memory instance, call `write_note` for each schema file (or simply run `/intel` on any package or tool — it auto-writes the schema on first use, which will conform the note).

**Automatic validation:** The PostToolUse command hook emits `additionalContext` after every `write_note`/`edit_note` call, instructing the main session to call `schema_validate`. Schema errors are surfaced inline without blocking the write.

**Keeping in sync:** When editing a schema (fixing drift, adding fields), update both the Basic Memory note via `edit_note` and the corresponding file in `schemas/` in the same PR. Use `/schema-evolve <type>` to automate this — it detects drift, proposes changes, and dual-syncs both targets. The PostToolUse `Edit|Write` hook will also remind you to sync when editing schema files manually.

**Schema evolution workflow:** Run `schema_diff` to find fields used in notes but absent from schema (and vice versa). Fields above 25% usage are candidates for addition; fields at 0% across 10+ notes are candidates for removal. Additive changes (new optional fields) don't need a version bump. Always validate after updating: `schema_validate(note_type="<type>")`.

## Cross-linking convention

After writing or updating a note (via intel skills or maintainer fixes), search
for existing notes that reference the topic in their body text but lack a
wiki-link in `## Relations`. Add `relates_to [[prefix:name]]` via `edit_note`
with `find_replace` targeting the last relation line. Only add links where the
relationship is genuine — don't link notes that mention the same word in an
unrelated context. This turns one-way references into bidirectional graph edges.

Relation verbs must exactly match picoschema field names — `related_to` (wrong
verb), `relates to` (space not underscore), and `related_to:` (colon suffix)
all silently create non-matching relations that `schema_validate` flags as
missing. Always use `relates_to`, `depends_on`, etc. exactly as declared.

## Basic Memory search patterns

When querying Basic Memory via `search_notes`, choose the right approach:

- **Find notes by type** — use `note_types=["standard"]`, NOT
  `search_type="text"` with `query="type: standard"` (FTS5 tokenizes the
  colon, matching false positives)
- **Find dead wiki-links** — use `entity_types=["relation"]` and check
  `to_entity` absence, NOT `search_type="text"` with `query="[[prefix:"`
  (FTS5 strips brackets)
- **Find wiki-links in observations** — use `search_type="text"` with
  `entity_types=["observation"]` and prefix-specific queries like
  `query="[[npm-"` (bare `[[` alone doesn't match)
- **Find relations involving an entity** — use `entity_types=["relation"]`
  with `query="<entity-title>"` and no `search_type` (default hybrid); this
  searches the relation's indexed text — for a resolved relation the title
  carries both endpoints, while for a dangling bare-name link the target
  survives in the relation's permalink slug, which the default
  hybrid/semantic search surfaces — an explicit `search_type="text"` would
  not, since text search is scoped to `title`/`content_stems` only and never
  matches on `permalink`
- **Semantic topic search** — omit `search_type` (default hybrid) for natural
  language queries about concepts, topics, or package names

## Source citations (all note types)

Capture external source URLs so a note's provenance is self-contained and
clickable. Established after discovering that URLs inside observations are
fragile:

- **Body `## Sources` section** — list citations as markdown links:
  `- [title](https://canonical-url) — publication, date`. Preferred for
  hand-authored knowledge notes that cite per-claim or multi-source
  (engineering, concept, standard, milestone).
- **`url:` / `source:` frontmatter** — a single canonical origin URL. `intel`'s
  package and tool family templates and the `people-intel` template already do
  this (`url:` frontmatter + a markdown link in the content header) — they are
  the reference implementation.
- **Never put a source URL inside a `[category]` observation line.** A markdown
  link plus a trailing parenthetical collides with BM's observation `(context)`
  parser and the observation silently drops while `schema_validate` still passes
  (see the BM tool-catalog `[gotcha]`). Bare URLs with no `[]()` syntax survive
  in observations but are not clickable — prefer the body/frontmatter forms.
- Prefer the canonical/permalink URL form to limit link rot. Raindrop stays the
  discovery/bookmark layer; the resolvable URL still belongs in the note.
- The `knowledge-gardener` Step 11 flags (informationally) notes that already
  have a `## Sources` section but cite in bare text — it never resolves URLs
  itself (an auto-resolved wrong URL is false provenance).
- **A `source:`/`url:` frontmatter field does NOT satisfy a schema's `[source]`
  observation requirement.** `schema_validate` only checks `[category]`
  observations in the note body — it never inspects frontmatter. When a schema
  (e.g. `standard`, `service`) declares `[convention] source is required`, the
  note needs an explicit `- [source] ...` line under `## Observations`, even if
  a `source:`/`url:` field is already set in frontmatter. Setting only the
  frontmatter field will pass a first read but fail `schema_validate` — add the
  body observation up front to avoid a second write/validate round-trip.

## Note structure conventions (for `intel`'s package family output)

- Schema note identifiers use the permalink form (e.g. `main/schema/npm_package`), not the title — check with `read_note` before editing
- Title: `npm-<package-name>` (resolves `[[npm-pkg]]` wiki-links)
- Directory: `npm/`
- Type: `npm_package` (snake_case — Basic Memory enforces snake_case for all type fields)
- Three enrichment layers: frontmatter metadata, `## Observations` with `[category]` tags, `## Relations` with `[[wiki-links]]`
- Schema-required fields (like `source` for service) must be `[field]` observations in the note body — YAML frontmatter fields are NOT checked by `schema_validate`
- npm notes carry a machine-stable `[version]` observation (leading clean token, e.g. `- [version] 5.8.5`) — the canonical slot `/knowledge-gaps --stale npm` reads first (Pattern 3), before fragile header/prose extraction. Only `npm_package` defines it today; the other package schemas gain it via bd `vp-claude-f3zx`
- Use `edit_note` with `find_replace` for updates — `append` with `section` goes to end of file, not end of section
- Optional structured metadata on observations (following vp-beads convention):
  - `Ownership: upstream|us|shared` — distinguishes package bugs from integration choices
  - `Since: vX.Y.Z` — version where the observation was first relevant
  - These fields are backward-compatible — existing observations without them remain valid

## Note structure conventions (for `intel`'s tool family output)

| Prefix | Directory | Type | Title example |
|--------|-----------|------|---------------|
| `brew:` | `brew/` | `brew_formula` | `brew-ripgrep` |
| `cask:` | `casks/` | `brew_cask` | `cask-warp` |
| `action:` | `actions/` | `github_action` | `action-actions-checkout` |
| `docker:` | `docker/` | `docker_image` | `docker-node`, `docker-grafana-grafana` |
| `vscode:` | `vscode/` | `vscode_extension` | `vscode-esbenp.prettier-vscode` |

- Same three core enrichment layers as the package family (frontmatter, `## Observations`, `## Relations`) plus a type-specific content section per tool type
- Type-specific content section replaces `## Key APIs`: `## Common Usage` for brew/cask, `## Inputs & Outputs` + `## Permissions` for actions, `## Tags` + `## Base Layers` for docker, `## Features` + `## Configuration` for vscode
- Context7 is skipped for all tool types (npm-biased, not useful for tooling)
