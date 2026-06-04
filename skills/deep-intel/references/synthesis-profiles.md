# Per-type synthesis profiles

The authoritative set of valid observation `[category]` tags and relation verbs
for a type is its picoschema in `schemas/<type>.md` — derive those at synthesis
time, do not hardcode them here. This file is **guidance**: the de-facto body
shape and the high-value categories that good notes of each type actually use.
No note templates ship; the schema is the single contract.

Cross-cutting rules (all types):

- Exact-title cross-links only. A pre-synthesis graph read returns candidate hub
  titles verbatim; emit a resolved edge only on an exact title match, else a
  forward-reference. BM resolves relation edges by exact title/permalink — a
  paraphrased target writes a dead edge.
- Source URLs go in a body `## Sources` section (markdown links) or frontmatter
  (`source:`/`url:`), **never** inside a `[category]` observation line — a
  markdown link plus a trailing parenthetical collides with the observation
  `(context)` parser and silently drops the whole observation.
- No `[[wiki-links]]` inside observations — the parser treats `[[` as a relation
  boundary. Wiki-links belong in `## Relations` only.

## service

- Body: `## Overview` + era/background sections (founding, funding, status, pivots).
- High-value categories: `[status]` (required), `[architecture]`, `[innovation]`,
  `[adoption]`, `[impact]`, `[risk]`.
- Relation verbs: `created_by`, `founded_by`, `competes_with`, `integrates_with`,
  `implements`, `used_by`, `part_of`.
- Citations: `[source]` observation + a `## Sources` body section.

## concept

- Body: `## Overview` (definition + canonical example) + named sections.
- High-value categories: `[definition]`, `[principle]`, `[pattern]`,
  `[application]`, `[influence]`, `[limitation]`.
- Relation verbs: `enables`, `contrasts_with`, `part_of`, `implements`,
  `depends_on`, `relates_to`.
- Citations: `## Sources` body section.

## standard

- Body: `## Overview` (what + spec URL + status) + `## Protocol Flow` + named sections.
- High-value categories: `[status]` (required), `[adoption]`, `[design]`,
  `[security]`, `[limitation]`.
- Relation verbs: `extends`, `extended_by`, `implemented_by`, `succeeded_by`,
  `part_of`, `relates_to`.
- Citations: `[source]` observation + `## Sources` body section.

## milestone

- Body: `## Overview` (event/era + dates) + background + era sections + a lessons section.
- High-value categories: `[era]`, `[lesson]`, `[turning-point]`, `[precedent]`,
  `[pattern]`.
- Relation verbs: `part_of`, `context_for`, `lesson_for`, `informs`,
  `created_by`, `relates_to`.
- Citations: `[source]` observation + `## Sources` body section.

## project

- Body: frontmatter-heavy; concise prose + observations + relations.
- High-value categories: `[status]` (required enum), `[product]`,
  `[architecture]`, `[decision]`, `[feature]`.
- Relation verbs: `built_with`, `depends_on`, `part_of`, `implements`,
  `follows_pattern`, `relates_to`.
- Citations: `[source]` observation (often internal references).

## engineering

- Body: adaptive to the topic (guide / decision tree / pattern with examples).
- High-value categories: `[pattern]`, `[gotcha]`, `[convention]`, `[decision]`,
  `[comparison]`, `[lesson]`, `[anti-pattern]`.
- Relation verbs: `relates_to`, `extends`, `has_spoke`, `hub_for`, `inspired_by`,
  `depends_on`, `references`.
- Citations: `## Sources` body section.

Note: `engineering` and `project` are usually self-authored from live work
(session-reflect's domain) and are the weakest external-research fit — prefer
the lighter `--quick` path for them.
