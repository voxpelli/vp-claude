/**
 * Deterministic resolution and classification of dangling Basic Memory
 * wiki-links.
 *
 * How Basic Memory actually resolves a `[[link]]`, corrected 2026-07-29 against
 * the knowledge graph's own notes on the subject — an earlier version of this
 * header asserted the opposite and was wrong in a way that changed the design:
 *
 * - The cascade is **permalink first, then exact title** (then file path, then
 *   fuzzy). Not title-only.
 * - **Relations resolve with `strict=True`, so there is NO fuzzy step on the
 *   write path.** A hyphen-vs-em-dash variant of a title dangles as a relation
 *   even though read-side fuzzy search would happily match it. That is why
 *   links that look obviously correct to a human still fail.
 * - **Relation binding happens at source-parse time.** Creating the missing
 *   target does NOT heal an existing dangling edge — only re-parsing the source
 *   does. So the repair is always "edit the link text in the SOURCE note",
 *   never "create the note the link points at".
 *
 * Neither key dominates the other, which is why the index is keyed on BOTH the
 * stored permalink tail and the slugified current title. Measured over 1,477
 * live edges: `standard.site` resolves only via the current title,
 * `webmention-testpinger` only via the stale permalink. Indexing on one alone
 * loses real repairs.
 *
 * The audit only ever sees the SLUG — Basic Memory's slugification of whatever
 * text the author wrote — so matching happens in slug space and the original
 * link text is not recoverable here. Recovering it is a SEPARATE, still-unbuilt
 * pass over the source notes, and it is required before anything is rewritten.
 * Earlier drafts of this file named `scripts/read-link-context.mjs` as though
 * that pass existed; it has never been committed on any branch, so an operator
 * following the instruction found nothing to run.
 *
 * Why deterministic matching rather than a search per target: a 2026-07-29
 * sampling session ran one fuzzy `search_notes` per dangling target and got
 * roughly half the verdicts wrong in BOTH directions — fabricated titles and
 * false "no match" on notes that plainly exist — because hitting a title with
 * a multi-term query is itself a judgement call. Fetching the title index once
 * and matching locally removes the judgement, and the search, entirely.
 *
 * This module holds the pure logic; `scripts/list-notes.mjs` and
 * `scripts/list-unresolved-links.mjs` do the I/O.
 */

/**
 * A note's title, verbatim.
 *
 * The four string domains below are BRANDED rather than plain `string` because
 * they were being confused silently. `byTitle.get(targetSlug)` — a slug looked
 * up in a title-keyed map — shipped and went undetected: it is not a type error
 * for `string`, and it quietly matches only those titles that happen to already
 * be slug-shaped. Branding turns that class of mix-up into a compile error.
 *
 * @typedef {string & {readonly __brand: 'Title'}} Title
 */

/**
 * A full permalink, e.g. `main/engineering/foo`.
 *
 * @typedef {string & {readonly __brand: 'Permalink'}} Permalink
 */

/**
 * The last segment of a stored permalink — Basic Memory's own derivation,
 * frozen at the time the note was created.
 *
 * @typedef {string & {readonly __brand: 'PermalinkTail'}} PermalinkTail
 */

/**
 * `slugify()` of a note's CURRENT title. Diverges from the stored permalink
 * tail for 56 of 2,303 notes (2.4%) — see `SlugDivergence`.
 *
 * @typedef {string & {readonly __brand: 'TitleSlug'}} TitleSlug
 */

/**
 * Either kind of slug key. The index is keyed on the union, so this is the type
 * a lookup takes; a `Title` still cannot be passed, which is the mix-up worth
 * preventing.
 *
 * @typedef {PermalinkTail | TitleSlug} SlugKey
 */

/**
 * The target of a dangling link, as the audit sees it: Basic Memory's
 * slugification of the author's link text. It lives in slug space, so it is
 * assignable to a `SlugKey` lookup by construction — and not to a `Title`.
 *
 * @typedef {SlugKey} TargetRef
 */

/**
 * @typedef TitleEntry
 * @property {Title} title Note title, verbatim.
 * @property {Permalink} permalink Full permalink.
 */

/**
 * One note plus every slug it can be found under. Prefix matching walks these
 * rows rather than a slug-keyed map: a note whose permalink tail AND title slug
 * both extend the same prefix must contribute ONE candidate, not two. Measured
 * on live data, the map shape double-counts 13 edges into a false AMBIGUOUS —
 * more damage than the union index gains. One row per NOTE makes that
 * structurally impossible instead of relying on a dedup line nobody may delete.
 *
 * @typedef SlugRow
 * @property {TitleEntry} entry The note.
 * @property {SlugKey[]} slugs Its distinct slugs, 1 or 2 of them.
 */

/**
 * A note whose stored permalink tail disagrees with `slugify(title)`.
 *
 * @typedef SlugDivergence
 * @property {Permalink} permalink Full permalink.
 * @property {Title} title Current title.
 * @property {PermalinkTail} permalinkTail What Basic Memory stored.
 * @property {TitleSlug} titleSlug What `slugify` derives today.
 * @property {'dedup-suffix' | 'apostrophe' | 'non-ascii' | 'former-title'} kind Cause.
 */

/**
 * @typedef TitleIndex
 * @property {TitleEntry[]} entries Every known note.
 * @property {Map<Title, TitleEntry[]>} byTitle Keyed on exact title.
 * @property {Map<SlugKey, TitleEntry[]>} bySlug Keyed on BOTH slug derivations.
 * @property {Map<string, TitleEntry[]>} byLowerTitle Keyed on lowercased title —
 *   a domain of its own, neither slug nor exact title, so deliberately unbranded.
 * @property {SlugRow[]} slugRows One row per note, for prefix matching.
 * @property {SlugDivergence[]} slugDivergences Notes whose two slugs disagree.
 */

/**
 * Where the link was written. Replaces an earlier boolean, because reading a
 * source note has a THIRD outcome — the note is gone, unreadable, or the link
 * text turns up in neither section — and the only honest thing to do with "we
 * do not know" is make it visible rather than fold it into one of the answers.
 *
 * Folding it into the boolean's false arm would have been actively harmful: it
 * would mark genuine relations on apostrophe and diacritic notes SPURIOUS, the
 * one bucket the pipeline promises never to touch.
 *
 * @typedef {'in-relations' | 'outside-relations' | 'unresolvable'} SectionProvenance
 */

/**
 * @typedef UnresolvedEdge
 * @property {string} fromEntity Permalink of the note holding the link.
 * @property {string} relationType Relation verb, e.g. `relates_to`.
 * @property {TargetRef} targetSlug Slugified target of the unresolved link.
 * @property {number} relationId Row id as reported by `search-notes`. Carried for
 *   reporting only — NOT an identity. Both halves of an earlier claim here were
 *   wrong: it is not stable in search output (68 index ids have no row in the
 *   `relation` table, and 15 are bound to more than one permalink), and it is not
 *   the only separator either, since the relation permalink already encodes the
 *   verb and target — 736 `(from, to_name)` pairs differ by verb alone. The
 *   database's own natural key is `UNIQUE (from_id, to_name, relation_type)`; the
 *   permalink is exactly as discriminating. See
 *   docs/design/bm-index-findings-2026-07-29.md.
 * @property {SectionProvenance} sectionProvenance Where the link was written.
 *   REQUIRED, and `classifyEdge` throws when it is absent: the enumeration pass
 *   cannot supply it, so an optional field would arrive `undefined` on the live
 *   path and classify every spurious prose extraction as repairable.
 */

/** @typedef {'slug-equal' | 'case-insensitive-title' | 'slug-prefix'} MatchStrategy */

/**
 * @typedef MatchResult
 * @property {MatchStrategy | undefined} strategy Winning strategy, or undefined.
 * @property {TitleEntry[]} matches Candidates the winning strategy found.
 */

/** @typedef {'repairable' | 'ambiguous' | 'forward-ref' | 'spurious' | 'placeholder' | 'uncertain'} LinkBucket */

/**
 * @typedef ClassifiedEdge
 * @property {UnresolvedEdge} edge The edge as enumerated.
 * @property {LinkBucket} bucket Canonical bucket.
 * @property {MatchStrategy | undefined} strategy Winning match strategy, if any.
 * @property {Title | undefined} suggestedTitle Exact title to link instead.
 * @property {number} candidateCount How many candidates the winning strategy found.
 * @property {TitleEntry[]} candidates Candidates, capped at `MAX_REPORTED_CANDIDATES`.
 * @property {boolean} candidatesTruncated Whether `candidates` is a partial list.
 */

/** @typedef {'npm' | 'crate' | 'brew' | 'cask' | 'docker' | 'vscode' | 'action' | 'go' | 'plugin' | 'concept'} ForwardRefKind */

/**
 * @typedef ForwardRefRank
 * @property {TargetRef} targetSlug The dangling target.
 * @property {number} sourceNotes Distinct notes referencing it.
 * @property {number} edges Total edges referencing it.
 * @property {string[]} sources Distinct source permalinks.
 * @property {ForwardRefKind} kind Routing hint — see `classifyForwardRefKind`.
 */

/**
 * Canonical bucket names. Shared between the emitting audit (gardener) and the
 * consuming repair pass (maintainer); drift between the two silently breaks the
 * handoff. NOTE: nothing pins these strings yet. This docblock used to claim
 * `scripts/check-link-resolution.mjs` did, the way `lib/staleness-contract.mjs`
 * pins the drift buckets — that script has never existed, so the drift risk it
 * described as covered is in fact open. Write the guard before relying on the
 * buckets across the gardener/maintainer boundary.
 *
 * `uncertain` is the honest destination for an edge whose provenance could not
 * be established. It is NOT repairable and never will be — it means the audit
 * does not know what it is looking at.
 *
 * Deliberately NOT annotated `Record<string, LinkBucket>`: an index signature
 * would make every member `LinkBucket | undefined` under
 * `noUncheckedIndexedAccess`. `Object.freeze` over an object LITERAL preserves
 * the literal types on its own, so `LINK_BUCKETS.REPAIRABLE` is exactly
 * `'repairable'`. The same is NOT true of a frozen ARRAY, which widens to
 * `string[]` and needs an explicit const-assertion cast to keep its literals.
 */
export const LINK_BUCKETS = Object.freeze({
  REPAIRABLE: 'repairable',
  AMBIGUOUS: 'ambiguous',
  FORWARD_REF: 'forward-ref',
  SPURIOUS: 'spurious',
  PLACEHOLDER: 'placeholder',
  UNCERTAIN: 'uncertain',
})

/**
 * A prefix match against a short, generic target returns hundreds of
 * candidates: the target `npm` extends to 623 notes. Serialising those into a
 * report buries every real short-form repair, so the count is always reported
 * and the list is capped.
 */
export const MAX_REPORTED_CANDIDATES = 10

/**
 * Permalink path segments whose notes are documentation templates. Wiki-links
 * in a schema definition are illustrative (`[[docker-x]]`, `[[npm-some-package]]`)
 * and must never be reported as debt — they are not meant to resolve.
 */
const TEMPLATE_PATH_SEGMENTS = Object.freeze(['/schema/', '/schemas/'])

/**
 * Slugify a title the way Basic Memory derives a permalink tail.
 *
 * The camelCase split is the non-obvious part and is load-bearing: `MoE`
 * becomes `mo-e`, `OpenID` becomes `open-id`, `oEmbed` becomes `o-embed`,
 * `DiSo` becomes `di-so` — all verified against live permalinks. Dots survive
 * (`Node.js` stays `node.js`); every other non-alphanumeric run collapses to a
 * single hyphen, which is why hyphen, en dash, em dash and colon variants of
 * the same title all slugify identically.
 *
 * @param {string} text Title to slugify.
 * @returns {string} Permalink-style slug.
 */
export function slugify (text) {
  return text
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replaceAll(/[^a-z0-9.]+/g, '-')
    .replaceAll(/-{2,}/g, '-')
    .replaceAll(/^-+|-+$/g, '')
}

/**
 * Slugify each segment of a permalink path, leaving the separators intact.
 *
 * @param {string} path Permalink path.
 * @returns {string} Path with every segment slugified.
 */
export function slugifyPath (path) {
  return path.split('/').map((segment) => slugify(segment)).join('/')
}

/**
 * Brand a raw title/permalink pair as a `TitleEntry`.
 *
 * The one deliberate cast at the trust boundary: everything upstream of here is
 * untyped JSON from `bm`, everything downstream is branded. Keeping the cast in
 * a single named place is the point — scattered inline casts would defeat the
 * branding entirely.
 *
 * @param {{title: string, permalink: string}} row Raw note row.
 * @returns {TitleEntry} Branded entry.
 */
export function toTitleEntry (row) {
  return {
    title: /** @type {Title} */ (row.title),
    permalink: /** @type {Permalink} */ (row.permalink),
  }
}

/**
 * Brand a raw slug string as a target reference.
 *
 * @param {string} slug Slug from the enumeration pass.
 * @returns {TargetRef} Branded reference.
 */
export function toTargetRef (slug) {
  return /** @type {TargetRef} */ (slug)
}

/**
 * The last segment of a permalink — Basic Memory's stored derivation.
 *
 * @param {Permalink} permalink Full permalink.
 * @returns {PermalinkTail} Final segment.
 */
export function permalinkTail (permalink) {
  const segments = permalink.split('/')
  return /** @type {PermalinkTail} */ (segments.at(-1) ?? permalink)
}

/**
 * `slugify()` of a title, in the title-slug domain.
 *
 * @param {Title} title Note title.
 * @returns {TitleSlug} Derived slug.
 */
export function titleSlug (title) {
  return /** @type {TitleSlug} */ (slugify(title))
}

/**
 * Every distinct slug a note can be found under.
 *
 * `slugify` is not deleted here, it is DEMOTED — from "the key" to "one of two
 * keys". The stored permalink tail is authoritative for what Basic Memory
 * recorded; the title slug is authoritative for what the note is called now.
 * Notes exist that are only findable by one or the other.
 *
 * @param {TitleEntry} entry Note.
 * @returns {SlugKey[]} One or two distinct slugs.
 */
export function noteSlugs (entry) {
  const tail = permalinkTail(entry.permalink)
  const derived = titleSlug(entry.title)
  // Compared as raw strings on purpose. The two brands are distinct domains —
  // tsc rightly refuses `tail === derived` as a comparison with no overlap —
  // but the question here is precisely whether the two derivations produced the
  // same characters, which is the one place crossing the domains is the point.
  const identical = /** @type {string} */ (tail) === /** @type {string} */ (derived)
  return identical ? [tail] : [tail, derived]
}

/**
 * Why a note's stored permalink tail disagrees with `slugify(its title)`.
 *
 * The dedup suffix is checked first because it is structural (it lives in the
 * permalink), whereas the others are properties of the title text. Note the
 * `-N` suffix is NOT a usable signal on its own: 31 of 32 digit-suffixed tails
 * in this graph are years, e.g. `federated-social-web-summit-2010`. It only
 * counts as a dedup suffix when stripping it reproduces the title slug exactly.
 *
 * @param {TitleEntry} entry Note.
 * @param {PermalinkTail} tail Stored permalink tail.
 * @param {TitleSlug} derived Slug derived from the current title.
 * @returns {SlugDivergence['kind']} Cause of the divergence.
 */
function divergenceKind (entry, tail, derived) {
  if (new RegExp(`^${derived.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+$`).test(tail)) {
    return 'dedup-suffix'
  }
  if (/['’]/.test(entry.title)) return 'apostrophe'
  // Codepoint test rather than a regex character class: writing `\x20-\x7E`
  // here once produced literal NUL and DEL bytes in the source — invisible in
  // review, and this decides which repair story a divergent note is filed under.
  if ([...entry.title].some((char) => (char.codePointAt(0) ?? 0) > 126)) return 'non-ascii'
  return 'former-title'
}

/**
 * Add an entry to a keyed bucket map.
 *
 * @template K
 * @param {Map<K, TitleEntry[]>} map Target map.
 * @param {K} key Bucket key.
 * @param {TitleEntry} entry Entry to append.
 * @returns {void}
 */
function pushInto (map, key, entry) {
  const bucket = map.get(key)
  if (bucket) {
    bucket.push(entry)
  } else {
    map.set(key, [entry])
  }
}

/**
 * Build the lookup structure every match strategy reads. Constructed once per
 * audit run; this is what replaces one fuzzy search per dangling target.
 *
 * Indexing on both slug derivations rather than only `slugify(title)` also
 * happens to be the fast path — the per-edge `slugify` calls that prefix
 * matching used to make are precomputed here, taking a full classification run
 * from ~2.0s to ~27ms. Correctness and speed are the same edit, not a trade.
 *
 * @param {TitleEntry[]} entries Every note in the graph, already deduplicated.
 * @returns {TitleIndex} Index keyed for each strategy.
 */
export function buildTitleIndex (entries) {
  /** @type {Map<Title, TitleEntry[]>} */
  const byTitle = new Map()
  /** @type {Map<SlugKey, TitleEntry[]>} */
  const bySlug = new Map()
  /** @type {Map<string, TitleEntry[]>} */
  const byLowerTitle = new Map()
  /** @type {SlugRow[]} */
  const slugRows = []
  /** @type {SlugDivergence[]} */
  const slugDivergences = []

  for (const entry of entries) {
    pushInto(byTitle, entry.title, entry)
    pushInto(byLowerTitle, entry.title.toLowerCase(), entry)

    const slugs = noteSlugs(entry)
    for (const slug of slugs) pushInto(bySlug, slug, entry)
    slugRows.push({ entry, slugs })

    if (slugs.length === 2) {
      const tail = permalinkTail(entry.permalink)
      const derived = titleSlug(entry.title)
      slugDivergences.push({
        permalink: entry.permalink,
        title: entry.title,
        permalinkTail: tail,
        titleSlug: derived,
        kind: divergenceKind(entry, tail, derived),
      })
    }
  }

  return { entries, byTitle, bySlug, byLowerTitle, slugRows, slugDivergences }
}

/**
 * Find notes whose slug extends `targetRef` at a hyphen boundary.
 *
 * This is the short-form case and the most common repairable mode: a note
 * titled `Pelle Wessman - IndieWeb Builder and Open Source Maintainer` linked
 * as `[[Pelle Wessman]]`. The boundary check prevents `web-2` matching
 * `web-2000-something`.
 *
 * @param {TitleIndex} index Title index.
 * @param {TargetRef} targetRef Reference to extend.
 * @returns {TitleEntry[]} Candidates, possibly empty.
 */
function slugPrefixMatches (index, targetRef) {
  const prefix = `${targetRef}-`
  /** @type {TitleEntry[]} */
  const found = []
  for (const row of index.slugRows) {
    if (row.slugs.some((slug) => slug.startsWith(prefix))) found.push(row.entry)
  }
  return found
}

/**
 * Match strategies in strict-to-loose order.
 *
 * A TABLE rather than a `switch`, because the previous `switch` had no case for
 * `case-insensitive-title` — it fell through to `default`, so adding a fifth
 * strategy would have silently run the case-insensitive lookup under the new
 * name. Deriving `MATCH_STRATEGIES` from the table means the name and the
 * behaviour cannot drift apart.
 *
 * `exact-title` is GONE. It looked a target slug up in the title-keyed map, so
 * it could only ever match titles that are already slug-shaped — and every such
 * title slugifies to itself, which means `slug-equal` finds it too. Verified
 * both ways: 27 of 27 live `exact-title` wins were also `slug-equal` wins.
 *
 * `case-insensitive-title` wins nothing on today's data but is NOT redundant: a
 * title like `webMention` lowercases to `webmention` while `slugify` yields
 * `web-mention`, so it catches what `slug-equal` cannot. It is ordered before
 * `slug-prefix` because it is the stricter of the two — the previous order had
 * the loosest strategy running first, which is backwards for a table whose
 * whole contract is strict-to-loose.
 *
 * @type {ReadonlyArray<{name: MatchStrategy, find: (index: TitleIndex, targetRef: TargetRef) => TitleEntry[]}>}
 */
const MATCH_STRATEGY_TABLE = Object.freeze([
  { name: 'slug-equal', find: (index, targetRef) => index.bySlug.get(targetRef) ?? [] },
  { name: 'case-insensitive-title', find: (index, targetRef) => index.byLowerTitle.get(targetRef.toLowerCase()) ?? [] },
  { name: 'slug-prefix', find: slugPrefixMatches },
])

/**
 * Strategy names in evaluation order, derived from the table so the two cannot
 * disagree.
 *
 * @type {ReadonlyArray<MatchStrategy>}
 */
export const MATCH_STRATEGIES = Object.freeze(MATCH_STRATEGY_TABLE.map((strategy) => strategy.name))

/**
 * Resolve a dangling target against the index, strictest strategy first.
 *
 * The first strategy yielding any candidate decides. Candidates are returned as
 * a fresh array: callers sort them for reports, and handing out the index's own
 * arrays let a report corrupt the index mid-run.
 *
 * @param {TargetRef} targetRef Slugified target of the unresolved link.
 * @param {TitleIndex} index Title index.
 * @returns {MatchResult} Winning strategy and its candidates.
 */
export function matchTarget (targetRef, index) {
  for (const { find, name } of MATCH_STRATEGY_TABLE) {
    const matches = find(index, targetRef)
    if (matches.length > 0) return { strategy: name, matches: [...matches] }
  }
  return { strategy: undefined, matches: [] }
}

/**
 * True when a note is a schema or template whose wiki-links are illustrative.
 *
 * @param {string} permalink Source note permalink.
 * @returns {boolean} Whether links from it are placeholders.
 */
export function isTemplateSource (permalink) {
  const padded = `/${permalink}/`
  return TEMPLATE_PATH_SEGMENTS.some((segment) => padded.includes(segment))
}

/**
 * Distinct titles among a candidate list.
 *
 * Ambiguity is a property of the REPAIR, not of the search. The repair payload
 * is a title, so two duplicate-suffixed siblings sharing one title are a single
 * unambiguous repair — counting candidates instead would refuse safe work. Left
 * unfixed alongside the duplicate-row defect, 292 notes (15%) resolved to the
 * same note three times and were reported as needing human disambiguation.
 *
 * @param {TitleEntry[]} candidates Candidate notes.
 * @returns {Set<Title>} Distinct titles.
 */
function distinctTitles (candidates) {
  return new Set(candidates.map((candidate) => candidate.title))
}

/**
 * Build the non-matching arms of a classification result.
 *
 * @param {UnresolvedEdge} edge Edge being classified.
 * @param {LinkBucket} bucket Bucket to report.
 * @returns {ClassifiedEdge} Result with no candidates.
 */
function withoutMatch (edge, bucket) {
  return {
    edge,
    bucket,
    strategy: undefined,
    suggestedTitle: undefined,
    candidateCount: 0,
    candidates: [],
    candidatesTruncated: false,
  }
}

/**
 * Classify one unresolved edge into a canonical bucket.
 *
 * Order matters. Provenance is checked first because a link outside
 * `## Relations` is not a link at all — Basic Memory silently extracts `[[...]]`
 * from prose and observation text as a relation (tracked as vp-claude-dpz6,
 * reproduced with an entire sentence as the `relation_type`). Those must never
 * be rewritten: the defect is in the extraction, not in the prose.
 *
 * Throws when `sectionProvenance` is absent, and that is the point. The
 * enumeration pass (`search-notes --entity-type relation`) carries no section
 * provenance, so the field can only come from a second pass that reads the
 * source note. An optional field would arrive `undefined` on the live path,
 * skip the guard, and classify every spurious prose extraction as REPAIRABLE —
 * the single outcome this module exists to prevent. Failing loudly is what
 * forces the two-phase design to actually be two phases.
 *
 * There is deliberately NO no-op-repair guard here. Detecting that a rewrite
 * would change nothing requires the literal `[[...]]` text, which does not
 * exist until the read pass; deriving it back from the slug is exactly the
 * re-derivation habit this module exists to remove, and the mapping is not
 * invertible anyway. The one case where a no-op is genuinely possible — a link
 * whose text already equals its target's title, which can only dangle when that
 * title is shared — is caught by the duplicate-title guard below. Everything
 * else would have resolved on Basic Memory's exact-title step. The real check
 * belongs in the repair pass, against the real text, before anything is written.
 *
 * @param {UnresolvedEdge} edge Edge to classify.
 * @param {TitleIndex} index Title index.
 * @returns {ClassifiedEdge} Bucket plus any repair suggestion.
 * @throws {TypeError} When `sectionProvenance` is not one of the three values.
 */
export function classifyEdge (edge, index) {
  if (!['in-relations', 'outside-relations', 'unresolvable'].includes(edge.sectionProvenance)) {
    throw new TypeError(
      `classifyEdge: sectionProvenance missing or invalid (${JSON.stringify(edge.sectionProvenance)}) ` +
      `for ${edge.fromEntity} -> ${edge.targetSlug}. Relation enumeration carries no section provenance; ` +
      'annotate edges with their section provenance before classifying (the pass that reads it back ' +
      'off the source notes is not built yet). Refusing to default it, ' +
      'because the default would mark spurious prose extractions repairable.'
    )
  }

  if (edge.sectionProvenance === 'outside-relations') {
    return withoutMatch(edge, LINK_BUCKETS.SPURIOUS)
  }
  if (edge.sectionProvenance === 'unresolvable') {
    return withoutMatch(edge, LINK_BUCKETS.UNCERTAIN)
  }
  if (isTemplateSource(edge.fromEntity)) {
    return withoutMatch(edge, LINK_BUCKETS.PLACEHOLDER)
  }

  const { matches, strategy } = matchTarget(edge.targetSlug, index)
  if (matches.length === 0) {
    return withoutMatch(edge, LINK_BUCKETS.FORWARD_REF)
  }

  const titles = distinctTitles(matches)
  const only = matches[0]
  // A sole match whose title is SHARED with another note is genuinely
  // ambiguous: writing that title back cannot resolve deterministically, so
  // suggesting it would be false confidence. Re-keying the index without this
  // guard turns a correct AMBIGUOUS into a confident wrong repair.
  const shared = only !== undefined && (index.byTitle.get(only.title) ?? []).length > 1
  const repairable = titles.size === 1 && only !== undefined && !shared

  return {
    edge,
    bucket: repairable ? LINK_BUCKETS.REPAIRABLE : LINK_BUCKETS.AMBIGUOUS,
    strategy,
    suggestedTitle: repairable && only ? only.title : undefined,
    candidateCount: matches.length,
    candidates: matches.slice(0, MAX_REPORTED_CANDIDATES),
    candidatesTruncated: matches.length > MAX_REPORTED_CANDIDATES,
  }
}

/**
 * Routing hint for a forward reference, so a report can say which tool would
 * document it rather than just naming it.
 *
 * An earlier version also returned `person` for any two-or-three-word slug with
 * no ecosystem prefix and no dot, with a comment asserting that shape "reads as
 * a person name far more often than a concept". Measured against the live
 * graph, that is backwards: the rule labelled 373 of 1,007 distinct dangling
 * targets as people, and on a 30-item sample 11 were people while 19 were not —
 * `abstract-leveldown`, `alpine-linux`, `aria-patterns`, `basic-memory`,
 * `bridgy-fed`. Roughly 37% precision, on a binary label, in a module written
 * to eliminate confident wrong answers. The label is gone rather than
 * documented, because it was never acted on and 373 pending person notes is
 * implausible on its face.
 *
 * @param {TargetRef} targetRef Dangling target.
 * @returns {ForwardRefKind} Ecosystem prefix, or `concept`.
 */
export function classifyForwardRefKind (targetRef) {
  /** @type {ForwardRefKind[]} */
  const ecosystems = ['npm', 'crate', 'brew', 'cask', 'docker', 'vscode', 'action', 'go', 'plugin']
  for (const eco of ecosystems) {
    if (targetRef.startsWith(`${eco}-`)) return eco
  }
  return 'concept'
}

/**
 * Rank forward references by how many DISTINCT notes reference them.
 *
 * Distinct source notes, not raw edge count: five dangling links from a single
 * note are one author's outline, whereas one target referenced from five
 * separate notes is real demand. Ranking on raw edges would invert that.
 *
 * @param {ClassifiedEdge[]} classified Classified edges.
 * @returns {ForwardRefRank[]} Ranked, most-referenced first.
 */
export function rankForwardRefs (classified) {
  /** @type {Map<TargetRef, Set<string>>} */
  const sourcesByTarget = new Map()
  /** @type {Map<TargetRef, number>} */
  const edgesByTarget = new Map()

  for (const item of classified) {
    if (item.bucket !== LINK_BUCKETS.FORWARD_REF) continue
    const { fromEntity, targetSlug } = item.edge
    const sources = sourcesByTarget.get(targetSlug) ?? new Set()
    sources.add(fromEntity)
    sourcesByTarget.set(targetSlug, sources)
    edgesByTarget.set(targetSlug, (edgesByTarget.get(targetSlug) ?? 0) + 1)
  }

  /** @type {ForwardRefRank[]} */
  const ranked = []
  for (const [targetSlug, sources] of sourcesByTarget) {
    ranked.push({
      targetSlug,
      sourceNotes: sources.size,
      edges: edgesByTarget.get(targetSlug) ?? 0,
      sources: [...sources].sort(),
      kind: classifyForwardRefKind(targetSlug),
    })
  }

  return ranked.sort(
    (a, b) =>
      b.sourceNotes - a.sourceNotes ||
      b.edges - a.edges ||
      a.targetSlug.localeCompare(b.targetSlug)
  )
}

/**
 * Summarise classified edges by bucket.
 *
 * @param {ClassifiedEdge[]} classified Classified edges.
 * @returns {Map<LinkBucket, number>} Bucket name to count.
 */
export function summariseBuckets (classified) {
  /** @type {Map<LinkBucket, number>} */
  const counts = new Map()
  for (const bucket of Object.values(LINK_BUCKETS)) counts.set(bucket, 0)
  for (const item of classified) {
    counts.set(item.bucket, (counts.get(item.bucket) ?? 0) + 1)
  }
  return counts
}

/**
 * Recover the target reference from a relation permalink.
 *
 * A relation's permalink is `<from>/<verb>/<target>`, and two properties of
 * that string defeat the obvious parse, both observed live:
 *
 * 1. The target MAY ITSELF CONTAIN SLASHES
 *    (`.../relates-to/repo-actions/create-github-app-token`), so it is not the
 *    last path segment.
 * 2. `from_entity` is the RAW entity path while the permalink carries the
 *    SLUGIFIED one — `main/schema/npm_package` reports a permalink under
 *    `main/schema/npm-package`. A literal prefix strip misses every entity
 *    whose name is not already slug-shaped. (Measured safe: across 541 distinct
 *    `from_entity` values there are no apostrophes and no non-ASCII, the two
 *    cases where `slugify` diverges from Basic Memory's own derivation.)
 *
 * So: try the literal prefix, then the slugified one, and return null rather
 * than guessing when neither matches. A mis-parsed target becomes a confident
 * wrong repair suggestion, which is strictly worse than a reported failure.
 *
 * For an UNRESOLVED relation the returned value is a bare slug — the link text
 * as Basic Memory slugified it. For a RESOLVED one it is the target's full
 * permalink (`main/npm/npm-express-session`), a different shape entirely; only
 * the `--all` enumeration mode ever sees those, and it uses them for
 * provenance, never as a match key.
 *
 * @param {{fromEntity: string, relationType: string, permalink: string}} edge Shaped relation row.
 * @returns {string | null} Target reference, or null when unparseable.
 */
export function extractTargetSlug ({ fromEntity, permalink, relationType }) {
  const verb = slugify(relationType)
  for (const base of [fromEntity, slugifyPath(fromEntity)]) {
    const prefix = `${base}/${verb}/`
    if (permalink.startsWith(prefix)) {
      const slug = permalink.slice(prefix.length)
      if (slug.length > 0) return slug
    }
  }
  return null
}
