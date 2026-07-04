// UPSTREAM-*.md `## ` heading membership contract — guards against a
// bug-shaped entry landing under an invented or misspelled heading (the
// bead's original failure mode) without forcing every UPSTREAM file into one
// rigid template.
//
// Deliberately a MEMBERSHIP check, not an order/completeness check: every
// `## ` heading in a non-allowlisted file must be one of the six canonical
// names below, but this guard does NOT require any particular order (some
// conforming files legitimately space sections far apart — e.g.
// UPSTREAM-vp-beads.md has Feature Requests/Bugs/Upstream Opportunities at
// lines 7/143/148) and does NOT require every section to be present (e.g.
// UPSTREAM-claude-code.md has no "Upstream Opportunities" section at all,
// which is fine). Enforcing either of those would mean rewriting a
// user-maintained tracking file's structure to fit a template — exactly the
// kind of "changing what you don't understand" this project's conventions
// warn against.
//
// One file (UPSTREAM-basic-memory.md) is structurally divergent BY DESIGN —
// it uses an entirely different heading scheme ("## Latest upstream
// activity", "## Open items") rather than the standard vocabulary — and is
// excluded from the membership check entirely via the allowlist below, not
// partially checked. UPSTREAM-vp-git.md's extra `## Resolved` section is NOT
// a divergence: `Resolved` is part of the canonical vocabulary itself, so
// vp-git needs no allowlist entry.
//
// Mirrors lib/analytics-guidance.mjs and lib/plugin-load-paths.mjs: pure
// registry + pure functions here, fixture-tested (plus a live disk scan) by
// scripts/check-upstream-headings.mjs.

/**
 * The canonical `## ` heading vocabulary for UPSTREAM-*.md files. A heading
 * outside this set (in a non-allowlisted file) is either an invented section
 * or a misspelling of one of these — both worth a human look.
 *
 * @type {readonly string[]}
 */
export const CANONICAL_UPSTREAM_HEADINGS = /** @type {const} */ ([
  'Feature Requests',
  'Bugs',
  'Upstream Opportunities',
  'Cross-Vendor Inconsistencies',
  'Trend Reviews',
  'Resolved',
])

/**
 * UPSTREAM-*.md filenames (basename, repo-root-relative) excluded from the
 * membership check entirely, because they use a heading scheme that isn't
 * the standard vocabulary by design.
 *
 * @type {readonly string[]}
 */
export const UPSTREAM_HEADING_ALLOWLIST = /** @type {const} */ ([
  'UPSTREAM-basic-memory.md',
])

// A single greedy `.+` (not a `.+?` paired with a trailing `[ \t]*`, which
// eslint-plugin-regexp flags as super-linear backtracking since both
// quantifiers can trade the same trailing whitespace) — trailing whitespace
// is trimmed in JS after the match instead. The capture group starts with
// `\S` rather than `.` for the same reason: `.` also matches space/tab, so
// `[ \t]+` immediately followed by `(.+)` lets the two quantifiers trade the
// same whitespace characters (the second backtracking overlap eslint-plugin-
// regexp flags here). `\S` can never match what `[ \t]+` matches, so the two
// quantifiers are mutually exclusive — no backtracking ambiguity.
const H2_HEADING_RE = /^##[ \t]+(\S.*)$/gm

/**
 * Extract every `## ` heading's text from a document, in order of
 * appearance. A pure lexical scan (no markdown AST) — deliberately simple,
 * matching the narrow scope of this guard.
 *
 * @param {string} content - file content to scan
 * @returns {string[]} heading text, one per `## ` line, in document order
 */
export function extractH2Headings (content) {
  return [...content.matchAll(H2_HEADING_RE)].map((m) => /** @type {string} */ (m[1]).trim())
}

/**
 * Membership check: which `## ` headings in `content` are NOT in
 * `canonicalVocab`. Order- and completeness-agnostic — this only flags
 * headings that don't belong, never a missing or out-of-order one.
 *
 * @param {string} content - file content to scan
 * @param {readonly string[]} [canonicalVocab] - defaults to
 *   {@link CANONICAL_UPSTREAM_HEADINGS}
 * @returns {string[]} heading text for every `## ` heading not in the vocabulary
 */
export function detectInvalidHeadings (content, canonicalVocab = CANONICAL_UPSTREAM_HEADINGS) {
  const vocabSet = new Set(canonicalVocab)
  return extractH2Headings(content).filter((heading) => !vocabSet.has(heading))
}
