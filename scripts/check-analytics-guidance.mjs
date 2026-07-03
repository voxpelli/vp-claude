// Live check + regression test for the brew/cask analytics-source guidance
// contract (lib/analytics-guidance.mjs). Mirrors check-plugin-load-paths.mjs:
// (1) live-reads the six canonical doc surfaces and asserts none reintroduces
// the inverted analytics-source claim fixed in v0.31.5, and each still
// mentions the JSON `analytics` fallback; (2) fixture-tests the pure
// detectors so the guard is proven to catch a planted regression and to stay
// silent on legitimate near-miss prose. Wired into `npm run check` via
// run-p check:*.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCheckHarness } from '../lib/check-harness.mjs'
import {
  ANALYTICS_GUIDANCE_FILES,
  detectInvertedAnalyticsClaims,
  hasAnalyticsJsonFallbackMention,
  INVERTED_ANALYTICS_CLAIM_PATTERNS,
} from '../lib/analytics-guidance.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { check, done } = createCheckHarness()

// --- live check ---

console.log('\nanalytics-guidance: canonical doc surfaces stay consistent with the v0.31.5 fix')

for (const relativePath of ANALYTICS_GUIDANCE_FILES) {
  const content = readFileSync(join(ROOT, relativePath), 'utf8')
  const hits = detectInvertedAnalyticsClaims(content)
  check(`${relativePath} does not reintroduce the inverted analytics-source claim`, hits.length === 0)
  for (const hit of hits) console.log(`    ${relativePath}: ${hit.id} matched "${hit.match}"`)
  check(`${relativePath} still mentions the JSON analytics fallback`, hasAnalyticsJsonFallbackMention(content))
}

// --- fixture self-test ---

console.log('\nanalytics-guidance: fixture self-test')

console.log('\nanalytics-guidance: each pattern fires on its planted violation')
const VIOLATIONS = {
  'does-not-expose-analytics': 'The formulae.brew.sh JSON API does not expose analytics.',
  'mcp-sourced-only': 'Install counts from Homebrew analytics — MCP-sourced only.',
  'no-structured-fallback': 'there is no structured fallback and fabricating counts would be wrong.',
}
for (const [id, text] of Object.entries(VIOLATIONS)) {
  check(`${id} fires on its planted violation`, detectInvertedAnalyticsClaims(text).some((h) => h.id === id))
}
check('every canonical pattern has a planted-violation fixture', INVERTED_ANALYTICS_CLAIM_PATTERNS.every((p) => p.id in VIOLATIONS))

console.log('\nanalytics-guidance: a second inverted-claim phrasing variant also fires')
check(
  'does-not-expose-analytics fires on the "install analytics" variant',
  detectInvertedAnalyticsClaims('The JSON API does not expose install analytics.').some((h) => h.id === 'does-not-expose-analytics')
)

console.log('\nanalytics-guidance: near-miss legitimate prose stays silent')
const NEAR_MISS = [
  'The formulae.brew.sh JSON API exposes an `analytics` block, so analytics are always obtainable.',
  'When neither source yields counts, omit the `[popularity]` observation rather than fabricating one.',
  'The MCP and the JSON API draw on the same Homebrew analytics dataset but can diverge via client-cache lag.',
]
for (const text of NEAR_MISS) {
  check(`stays silent on near-miss: "${text.slice(0, 60)}"`, detectInvertedAnalyticsClaims(text).length === 0)
}

console.log('\nanalytics-guidance: JSON/analytics fallback proximity detector')
check('detects the fallback mention in corrected brew wording', hasAnalyticsJsonFallbackMention('the formulae.brew.sh JSON API fetched in Step 2 includes an `analytics` block'))
check('detects the fallback mention in corrected schema wording (reverse order)', hasAnalyticsJsonFallbackMention('source from Homebrew MCP or the formulae.brew.sh JSON analytics block'))
check('does NOT detect a fallback mention when analytics/JSON are unrelated and far apart', !hasAnalyticsJsonFallbackMention('Homebrew analytics are popular.' + ' filler'.repeat(100) + ' This uses JSON elsewhere in an unrelated file.'))
check('does NOT detect a fallback mention when the text never mentions JSON at all', !hasAnalyticsJsonFallbackMention('Homebrew install analytics come from the MCP server only.'))

done()
