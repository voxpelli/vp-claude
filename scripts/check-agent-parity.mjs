/**
 * check:agent-parity — drift guard for the parallel agent sets.
 *
 * The canonical Claude Code agents (`agents/`) are the source of truth; the
 * pi-targeted set (`agents-pi/`) is the hand-maintained port. Each pi agent
 * carries a `portedFrom: <sha256-of-canonical-body>` frontmatter marker. This
 * guard recomputes the canonical body hash and fails when:
 *   - a canonical agent has no pi-targeted counterpart (missing port), or
 *   - the pi file's `portedFrom` no longer matches the canonical body
 *     (the canonical evolved since the port — re-run
 *     `node scripts/port-agent-to-pi.mjs agents/<name>.md` and re-apply the
 *     hand fixes).
 *
 * Mirrors the drift-guard family (check:release-counts, check:cohort-lockstep):
 * pure parse + compare, exits non-zero on any divergence.
 */

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parseFrontmatter } from '@earendil-works/pi-coding-agent'

// `.pathname` keeps percent-encoding, so a repo under a path with a space
// resolves to a directory that does not exist. fileURLToPath decodes it.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const AGENTS_DIR = join(ROOT, 'agents')
const AGENTS_PI_DIR = join(ROOT, 'agents-pi')

/**
 * Compute the sha256 (16-hex prefix) of a canonical agent's BODY — the part
 * after the frontmatter — matching the marker the port script emits.
 *
 * @param {string} content
 * @returns {string}
 */
export function canonicalBodyHash (content) {
  const bodyStart = content.indexOf('\n---', 3)
  const body = bodyStart === -1 ? '' : content.slice(bodyStart + 4).trim()
  return createHash('sha256').update(body).digest('hex').slice(0, 16)
}

/**
 * Extract the `portedFrom` marker from a pi agent file.
 *
 * @param {string} content
 * @returns {string | undefined}
 */
export function extractPortedFrom (content) {
  const { frontmatter } = parseFrontmatter(content)
  return typeof frontmatter.portedFrom === 'string' ? frontmatter.portedFrom : undefined
}

/**
 * Run the parity check over both agent directories.
 *
 * @returns {string[]} one error per divergence (empty = clean)
 */
export function checkAgentParity () {
  /** @type {string[]} */
  const errors = []

  // Every early return below MUST push an error first. Returning the still-empty
  // `errors` array reports success, so a missing or unreadable agents/ would make
  // this guard pass while checking nothing — the "check that cannot fail" class
  // this repo keeps re-introducing (see the CLI success message below, which
  // asserts a parity it never verified).
  if (!existsSync(AGENTS_DIR)) {
    errors.push(`agents/ not found at ${AGENTS_DIR} — the canonical agent set is missing, so parity cannot be checked`)
    return errors
  }

  /** @type {string[]} */
  let canonicalNames
  try {
    canonicalNames = readdirSync(AGENTS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
  } catch (err) {
    errors.push(`agents/ could not be read: ${err instanceof Error ? err.message : String(err)}`)
    return errors
  }

  // Zero canonical agents makes the loop below vacuous: its body never runs, so
  // the guard returns clean without a single comparison.
  if (canonicalNames.length === 0) {
    errors.push('agents/ contains no .md files — with nothing to compare, this guard would report success without checking anything')
    return errors
  }

  for (const name of canonicalNames) {
    const piPath = join(AGENTS_PI_DIR, `${name}.md`)
    if (!existsSync(piPath)) {
      errors.push(`agents-pi/${name}.md missing — canonical agent ${name} has no pi-targeted port`)
      continue
    }
    const canonical = readFileSync(join(AGENTS_DIR, `${name}.md`), 'utf8')
    const pi = readFileSync(piPath, 'utf8')
    const expected = canonicalBodyHash(canonical)
    const actual = extractPortedFrom(pi)
    if (actual === undefined) {
      errors.push(`agents-pi/${name}.md has no portedFrom marker — re-run node scripts/port-agent-to-pi.mjs agents/${name}.md`)
    } else if (actual !== expected) {
      errors.push(`agents-pi/${name}.md is stale: portedFrom ${actual} != canonical ${expected} — the canonical body changed since the port; re-port and re-apply hand fixes`)
    }
  }

  return errors
}

// CLI entry
// `import.meta.url` percent-encodes; `process.argv[1]` does not, so the naive
// `file://${argv[1]}` comparison is false for any path containing a space —
// and this file would then exit 0 having run nothing. For check:agent-parity
// that is a green gate that performed no comparison.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const errors = checkAgentParity()
  if (errors.length > 0) {
    for (const e of errors) console.error(`✖ ${e}`)
    console.error(`check:agent-parity: ${errors.length} divergence(s)`)
    process.exit(1)
  }
  console.log('check:agent-parity: all canonical agents have a current pi-targeted port')
}
