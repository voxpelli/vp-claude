// Brew/cask analytics-source guidance contract — guards specifically against
// the regression fixed in v0.31.5 (see CHANGELOG.md, commit 972c70d): every
// `/intel` doc surface (tool family) for brew/cask (2 ecosystem references, 2 note
// templates, 2 schemas) claimed "the formulae.brew.sh JSON API does not
// expose analytics" and told the skill to omit the `[popularity]` observation
// whenever the Homebrew MCP was unavailable — but the JSON response already
// fetched in that skill's own Step 2 DOES carry an `analytics` block
// (verified against real `sem-cli`/`ripgrep`/`claude-code` API responses).
// The doc guidance contradicted the skill's actual (correct) behavior for
// many releases, with nothing able to catch it.
//
// Deliberately narrow (per the originating bead): this is NOT a general
// "docs match behavior" framework. It only asserts two things about the six
// canonical files below: (1) none of them reintroduce the inverted claim,
// and (2) each still mentions the JSON `analytics` fallback where the
// correct guidance requires it. Mirrors lib/fourth-wall-rules.mjs and
// lib/staleness-contract.mjs: pure registry + pure functions here,
// fixture-tested (plus a live disk scan) by scripts/check-analytics-guidance.mjs.

/**
 * The doc surfaces this guard checks, repo-root-relative: the six the v0.31.5
 * regression originally touched, plus README.md — the user-facing setup doc,
 * added 2026-07-17 after a branch review caught the inverted "JSON API does not
 * expose analytics" claim reappearing there, outside the original six-file set
 * the gate scanned. Any file that repeats brew/cask analytics-source guidance
 * should be added here too (prose-only maintenance, like the rest of this
 * repo's drift-guard file lists).
 *
 * @type {readonly string[]}
 */
export const ANALYTICS_GUIDANCE_FILES = /** @type {const} */ ([
  'skills/intel/references/ecosystem-brew.md',
  'skills/intel/references/ecosystem-cask.md',
  'skills/intel/references/note-template-brew.md',
  'skills/intel/references/note-template-cask.md',
  'schemas/brew_formula.md',
  'schemas/brew_cask.md',
  'README.md',
])

/**
 * @typedef InvertedClaimPattern
 * @property {string} id - stable identifier for the phrasing variant
 * @property {RegExp} detect - high-precision pattern for the inverted claim
 * @property {string} summary - what the pattern catches
 */

/**
 * Phrasing variants of the inverted claim, taken from the actual pre-fix text
 * (verified against commit 972c70d~1) and the bead's own three named
 * equivalents. Each is deliberately literal/narrow — this guard's job is to
 * catch a REINTRODUCTION of this specific regression, not to police analytics
 * prose in general.
 *
 * @type {readonly InvertedClaimPattern[]}
 */
export const INVERTED_ANALYTICS_CLAIM_PATTERNS = /** @type {const} */ ([
  {
    id: 'does-not-expose-analytics',
    detect: /does not expose (?:install )?analytics/i,
    summary: 'Claims the formulae.brew.sh JSON does not expose analytics (it does, since v0.31.5).',
  },
  {
    id: 'mcp-sourced-only',
    detect: /MCP-sourced only/i,
    summary: 'Claims popularity/analytics data is MCP-sourced only, with no JSON fallback.',
  },
  {
    id: 'no-structured-fallback',
    detect: /no structured fallback/i,
    summary: 'Claims there is no structured fallback when the MCP is unavailable.',
  },
])

/**
 * Apply every inverted-claim pattern to a doc surface's text.
 *
 * @param {string} text - file content to scan
 * @returns {{ id: string, match: string }[]} one entry per fired pattern
 */
export function detectInvertedAnalyticsClaims (text) {
  /** @type {{ id: string, match: string }[]} */
  const hits = []
  for (const pattern of INVERTED_ANALYTICS_CLAIM_PATTERNS) {
    const m = text.match(pattern.detect)
    if (m) hits.push({ id: pattern.id, match: m[0] })
  }
  return hits
}

// A loose bidirectional proximity check ("analytics" and "JSON" within ~150
// chars of each other, either order) — deliberately not anchored to exact
// current wording (that would make the guard itself brittle to a legitimate
// future rephrase). It only confirms the doc still connects the two concepts
// somewhere, which is the substance of the correct guidance.
const ANALYTICS_JSON_PROXIMITY_RE = /json[\s\S]{0,150}analytics|analytics[\s\S]{0,150}json/i

/**
 * Positive assertion: does the text mention the JSON `analytics` fallback at
 * all? Guards against the guidance being weakened to omit the fallback
 * mention entirely (a corrected doc must still connect "analytics" and
 * "JSON", not merely avoid the three inverted phrasings above).
 *
 * @param {string} text - file content to scan
 * @returns {boolean}
 */
export function hasAnalyticsJsonFallbackMention (text) {
  return ANALYTICS_JSON_PROXIMITY_RE.test(text)
}
