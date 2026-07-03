// Relation-vocabulary drift guard — the CI-automation piece of a 3-bead
// relation-verb-lint workstream (vp-claude-7cq schema-evolve audit → 9n0
// maintainer pre-write guard → this one, vp-claude-fwnq.4). Extracts the
// canonical relation-verb vocabulary from the 23 schemas/*.md picoschema
// blocks via line-regex (mirrors lib/staleness-contract.mjs's own
// line-regex-over-a-canonical-list approach — a markdown AST is the wrong
// tool here too, since a picoschema field list and a `## Relation
// Vocabulary` prose bullet list are both plain lines, not link/heading
// nodes an AST would model distinctly).
//
// What this guards against: a MALFORMED surface form of an otherwise-
// canonical verb appearing in a schema's `## Relation Vocabulary` prose —
// e.g. `see also` (space, historical bug fixed in v0.29.1) or `relates to:`
// (space + trailing colon) where the underscored form (`see_also`,
// `relates_to`) IS declared as a `Note`-typed picoschema field somewhere in
// the schema corpus. This is deliberately narrow: a prose verb that is
// well-formed (snake_case, no colon) but simply undeclared anywhere in the
// picoschema corpus (e.g. `configured_in_dotfiles` in brew_cask.md) is a
// real gap but NOT this guard's job — that's exactly what vp-claude-7cq's
// interactive `/schema-evolve` reconciliation and this bead's own
// gardener-live comparison step (schema-declared vocabulary vs
// `statistics.relation_types` on the live graph) are for. A CI hard-fail on
// every undeclared-but-plausible verb would preempt that reconciliation
// workflow and require touching all 23 schema files just to add this guard,
// which is out of scope here.
//
// The canonical set is a GLOBAL UNION across all 23 schema files, not
// scoped per-file — schema authors routinely document verbs in their own
// `## Relation Vocabulary` prose that are declared in a DIFFERENT schema's
// picoschema (e.g. gh_extension.md's prose lists `extended_by`, which is
// only declared as a Note field in brew_formula.md, for the inverse
// relation on the host tool's note). Scoping per-file would false-positive
// on this legitimate cross-schema-reference pattern.

const SCHEMA_BLOCK_START = /^schema:/
const SCHEMA_BLOCK_END = /^settings:/
const RELATION_VOCAB_HEADING = /^## Relation Vocabulary\s*$/
const NEXT_HEADING = /^## /

/**
 * Emit side: every `Note`-typed picoschema field declared in a single
 * schema file's frontmatter `schema:` block. Pure — line-regex scoped to
 * between `schema:` and `settings:`, mirroring the in-block-edit-safe
 * region documented for dual-sync edits.
 *
 * @param {string} content - raw text of one `schemas/<type>.md` file
 * @returns {string[]} declared relation-verb field names, in file order (may repeat across calls, dedupe at the caller)
 */
export function extractPicoschemaRelationVerbs (content) {
  /** @type {string[]} */
  const verbs = []
  let inSchemaBlock = false
  for (const line of content.split('\n')) {
    if (SCHEMA_BLOCK_START.test(line)) {
      inSchemaBlock = true
      continue
    }
    if (!inSchemaBlock) continue
    if (SCHEMA_BLOCK_END.test(line)) {
      inSchemaBlock = false
      continue
    }
    // Field lines look like `  relates_to?(array): Note, related notes` or
    // `  complements?: Note, complementary standard`. Continuation lines of
    // a wrapped description don't start with a 2-space field+colon shape
    // and are skipped by the regex not matching.
    const m = line.match(/^\s{2}([a-z][a-z_]*)\??(?:\(array\))?:\s*Note,/)
    if (m && m[1] !== undefined) verbs.push(m[1])
  }
  return verbs
}

/**
 * Builds the global canonical relation-verb set across every schema file's
 * content. Pure.
 *
 * @param {string[]} contents - raw text of every `schemas/<type>.md` file
 * @returns {Set<string>}
 */
export function buildCanonicalRelationVerbs (contents) {
  const canonical = new Set()
  for (const content of contents) {
    for (const verb of extractPicoschemaRelationVerbs(content)) canonical.add(verb)
  }
  return canonical
}

/**
 * @typedef RelationVocabCandidate
 * @property {string} label - the extracted label/phrase before any `[[target]]`, trimmed
 * @property {string} line - the raw bullet line, for error attribution
 */

/**
 * Extracts one candidate per `## Relation Vocabulary` bullet in a single
 * schema file. A bullet must start `- \`...\`` (dash, space, backtick) to be
 * considered at all — this is the shape every schema file's Relation
 * Vocabulary section actually uses (`` `verb [[target]]` — description `` or
 * `` `verb` — `target-pattern` — description ``). The candidate label is
 * the text before the first `[[` inside that first backtick span (or the
 * whole span if it has no `[[`) — deliberately NOT filtered to
 * identifier-shaped strings here, since a malformed spaced verb (the thing
 * this guard exists to catch) is by definition not identifier-shaped.
 *
 * @param {string} content - raw text of one `schemas/<type>.md` file
 * @returns {RelationVocabCandidate[]}
 */
export function extractRelationVocabCandidates (content) {
  const headingIndex = content.split('\n').findIndex((line) => RELATION_VOCAB_HEADING.test(line))
  if (headingIndex === -1) return []

  const lines = content.split('\n')
  /** @type {RelationVocabCandidate[]} */
  const candidates = []
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue
    if (NEXT_HEADING.test(line)) break
    const bulletMatch = line.match(/^-\s+`([^`]+)`/)
    if (!bulletMatch || bulletMatch[1] === undefined) continue
    const raw = bulletMatch[1].trim()
    const label = (raw.includes('[[') ? raw.slice(0, raw.indexOf('[[')) : raw).trim()
    if (label === '') continue
    candidates.push({ label, line: line.trim() })
  }
  return candidates
}

/**
 * Normalizes a candidate label the same way the historical bug's fix did:
 * lowercase, strip trailing colon(s), collapse whitespace runs to a single
 * underscore. Pure.
 *
 * @param {string} label
 * @returns {string}
 */
function normalizeLabel (label) {
  return label
    .toLowerCase()
    .replace(/:+$/, '')
    .trim()
    .replaceAll(/\s+/g, '_')
}

/**
 * Consume side: checks a single schema file's `## Relation Vocabulary`
 * candidates against the global canonical verb set. Flags ONLY the
 * malformed-variant class described in the module header — a candidate
 * whose normalized form is canonical but whose surface form differs from
 * that canonical form exactly. Pure.
 *
 * @param {string} content - raw text of one `schemas/<type>.md` file
 * @param {Set<string>} canonicalVerbs - global union, see buildCanonicalRelationVerbs
 * @returns {{ checked: number, errors: string[] }}
 */
export function checkRelationVocabDrift (content, canonicalVerbs) {
  /** @type {string[]} */
  const errors = []
  const candidates = extractRelationVocabCandidates(content)
  for (const { label, line } of candidates) {
    if (canonicalVerbs.has(label)) continue
    const normalized = normalizeLabel(label)
    if (normalized !== label && canonicalVerbs.has(normalized)) {
      errors.push(`"## Relation Vocabulary" bullet uses malformed verb "${label}" — canonical picoschema form is "${normalized}" (line: ${line})`)
    }
  }
  return { checked: candidates.length, errors }
}
