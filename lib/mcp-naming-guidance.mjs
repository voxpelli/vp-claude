/**
 * Drift guard for the retired MCP tool-naming rule.
 *
 * Until 0.34.0 this repo stated, in four separate places, that a Pi direct-tool
 * name is derived by replacing the MCP server's hyphens with underscores.
 * `pi-mcp-adapter` does no such thing — its `sanitizeServerPrefix` keeps `-` in
 * the valid-character class — so the rule named tools no host registers, and an
 * unknown tool name is dropped silently rather than refused.
 *
 * Correcting the first copy did not find the others: a grep for the identifier
 * `basic_memory_` missed every instance that stated the rule in prose. This
 * guard exists because that is how the class recurs — someone rewords the rule
 * somewhere new, and no identifier search finds it.
 *
 * Modelled on `lib/analytics-guidance.mjs`, which exists for the structurally
 * identical v0.31.5 inverted-analytics regression.
 */

/**
 * Files that state, or could plausibly restate, the naming rule.
 *
 * An explicit allowlist, NOT a repo-wide scan. Measured: a bare hyphen/underscore
 * search hits Rust crate-name prose in `skills/knowledge-gaps/SKILL.md`, the
 * unrelated colon-to-hyphen title migration, and a bd snapshot — all legitimate.
 * Add a file here when it starts describing MCP tool naming.
 *
 * @type {readonly string[]}
 */
export const MCP_NAMING_FILES = [
  'extensions/index.js',
  'extensions/mcp-mapping.js',
  'docs/pi-setup.md',
  'docs/design/triple-harness-notes.md',
  'scripts/port-agent-to-pi.mjs',
  'ROADMAP.md',
  'VISION.md',
  '.claude/rules/agent-development.md',
]

/**
 * Phrasings of the retired rule, one id per variant actually observed in this
 * repo. Each was a real sentence someone wrote.
 *
 * @type {readonly { id: string, detect: RegExp }[]}
 */
export const RETIRED_RULE_PATTERNS = [
  // Every variant requires SERVER context. Without it the patterns catch
  // legitimate, unrelated prose — "Replace hyphens with underscores for the
  // crate name" is correct Rust advice and must stay silent. The retired rule
  // was always specifically about the MCP server segment.
  { id: 'hyphens-arrow-underscore', detect: /server\s+hyphens?\s*(?:→|->)\s*`?_`?/i },
  { id: 'turn-hyphens-into-underscores', detect: /turns?\s+(?:the\s+)?server(?:'s)?\s+hyphens?\s+into\s+underscores?/i },
  { id: 'convert-hyphens-to-underscores', detect: /converts?\s+(?:the\s+)?hyphens?\s+in\s+the\s+server[^.]{0,20}\s+to\s+underscores?/i },
  { id: 'replace-hyphens-with-underscores', detect: /replac(?:e|es|ed|ing)\s+(?:the\s+)?server(?:'s)?\s+hyphens?\s+with\s+underscores?/i },
]

/**
 * Phrases marking a mention as history rather than instruction. A design record
 * must be able to say "the rule used to be X, which was wrong" without tripping
 * the guard, and so must the fixed function's own docblock.
 */
const HISTORICAL_QUALIFIER = /\b(?:used to|before 0\.34\.0|until 0\.34\.0|wrongly|previously|no longer|this note's own earlier|was wrong|disproven|retired)\b/i

/** How far back to look for a qualifier. One paragraph, generously. */
const QUALIFIER_WINDOW = 400

/**
 * Find statements of the retired rule that are NOT marked as history.
 *
 * @param {string} text
 * @returns {{ id: string, match: string }[]}
 */
export function detectRetiredNamingRule (text) {
  /** @type {{ id: string, match: string }[]} */
  const found = []
  for (const { id, detect } of RETIRED_RULE_PATTERNS) {
    const re = new RegExp(detect.source, detect.flags.includes('g') ? detect.flags : `${detect.flags}g`)
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0
      const before = text.slice(Math.max(0, at - QUALIFIER_WINDOW), at)
      if (HISTORICAL_QUALIFIER.test(before)) continue
      found.push({ id, match: m[0] })
    }
  }
  return found
}
