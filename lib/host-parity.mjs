/**
 * The cross-host contract between `hooks/` (Claude Code, bash) and
 * `extensions/` (Pi, JS).
 *
 * Four policies are implemented once per host, and until 0.35.0 nothing
 * compared them. `check:agent-parity` guards `agents/` against `agents-pi/`;
 * this pair had no equivalent, and it cost a live bug: the audit cadence
 * disagreed by a full sprint for every release up to 0.34.0 while BOTH sides
 * were tested — each guard only ever checked that its own copy was
 * self-consistent, so neither could fail on the disagreement between them.
 *
 * `check:host-parity` is deliberately BEHAVIOURAL rather than textual. It runs
 * the real bash hook as a subprocess and the real JS function in-process, and
 * compares what they produce. VISION.md's standing complaint about this repo is
 * that most guards verify two documents agree; a guard written to close a
 * two-implementations gap should not be another one of those.
 */

/**
 * How many completed sprints to compare the two audit-cadence implementations
 * over. Must span more than one full 4-sprint cycle, or an off-by-one that
 * happens to align at the sampled points passes.
 */
export const CADENCE_SPRINT_RANGE = 13

/**
 * How the two hosts' Basic Memory error-category NAMES correspond.
 *
 * The vocabularies differ because each host's taxonomy was written
 * independently and neither name set is worth churning. What must NOT differ is
 * which bucket a given error text lands in — otherwise the advice a user gets
 * depends on their host, which is exactly what was happening: a sweep over the
 * corpus below found the two agreeing on 10 of 27 strings. The Pi side was
 * case-sensitive where the hook uses `grep -qi`, had no `connection refused` or
 * `unavailable` arm at all, and checked its branches in a different order.
 *
 * @type {Record<string, string>}
 */
export const ERROR_CATEGORY_EQUIVALENCE = {
  'server-unavailable': 'transient',
  'note-not-found': 'missing-target',
  'invalid-argument': 'schema-violation',
  'permission-error': 'permission',
  'note-conflict': 'conflict',
  'unknown-error': 'unknown',
}

/**
 * The corpus both classifiers are run over.
 *
 * Every realistic error string, NOT a curated set of the ones that happen to
 * agree. The first version of this file listed nine hand-picked samples and
 * passed 47/47 while the two hosts disagreed on most real inputs — a check that
 * cannot fail, assembled by choosing its own inputs. If a string here is
 * genuinely classified differently on the two hosts, that is a finding to fix
 * or to mark, never a sample to drop.
 *
 * @type {readonly string[]}
 */
export const ERROR_CORPUS = /** @type {const} */ ([
  // transient / server-unavailable
  'connection refused', 'Connection refused', 'ECONNREFUSED', 'ETIMEDOUT',
  'service unavailable', 'operation timeout after 30s', 'Timeout',
  // missing-target / note-not-found
  'note does not exist', 'No such file or directory', 'not found',
  'no note with that id',
  // permission
  'permission denied', 'unauthorized', 'Forbidden', 'access denied',
  // schema-violation / invalid-argument
  'validation error', 'ValidationError', 'schema validation failed',
  'missing required field', 'malformed identifier', 'invalid argument',
  'title too long', 'value too short',
  // conflict
  'already exists', 'duplicate entry', 'conflict detected',
  // unknown
  'something unexpected happened',
])

/**
 * Categories with no counterpart on the other host, each with the reason.
 *
 * DECLARED rather than incidental, following `ACTIONS_WITHOUT_TABLE` in
 * `lib/npm-triage.mjs`: without this the coverage check would have to be
 * weakened to "or has no mapping", which is the same as not checking.
 *
 * @type {Record<string, string>}
 */
export const PI_ONLY_ERROR_CATEGORIES = {
  'tool-missing': 'Claude Code addresses MCP tools as mcp__server__tool with no proxy and no flattening, so an unrecognised tool NAME is not a failure mode there. It is specific to pi-mcp-adapter, where an unknown direct name is dropped silently. Set by an isToolNameError override AFTER classifyBmError, so it is unreachable from the corpus above by design.',
}

/**
 * Categories the JS classifier can return, hand-written.
 *
 * Deliberately NOT derived from `RECOVERY_MESSAGES` or from the exports above.
 * The coverage check compares this against what the classifier really returns,
 * so the two sides must come from different places — a check whose sides derive
 * from one source passes for any content, which this repo has shipped five
 * times.
 *
 * @type {readonly string[]}
 */
export const PI_ERROR_CATEGORIES = /** @type {const} */ ([
  'schema-violation', 'missing-target', 'conflict', 'permission',
  'transient', 'tool-missing', 'unknown',
])
