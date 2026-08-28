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
 * The two hosts' Basic Memory error taxonomies, and how they correspond.
 *
 * These are NOT drifted copies of one policy — they are genuinely different
 * vocabularies (5 bash categories, 7 JS ones), so a byte-parity assertion would
 * be wrong. What must hold is weaker and more useful: for the SAME error text,
 * the two hosts must reach corresponding categories, so a user gets the same
 * advice whichever host they are on.
 *
 * `sample` is error text a server can really emit. `claude` is the bracketed
 * tag `hooks/post-bm-failure-classify.sh` prints; `pi` is what
 * `classifyBmError` returns.
 *
 * @typedef CrossHostErrorCase
 * @property {string} sample - error text as a server would emit it
 * @property {string} claude - expected `[tag]` from the bash classifier
 * @property {string} pi - expected return from `classifyBmError`
 */

/** @type {CrossHostErrorCase[]} */
export const CROSS_HOST_ERROR_CASES = [
  { sample: 'connection refused', claude: 'server-unavailable', pi: 'unknown' },
  { sample: 'ECONNREFUSED while contacting the server', claude: 'server-unavailable', pi: 'transient' },
  { sample: 'operation timeout after 30s', claude: 'server-unavailable', pi: 'transient' },
  { sample: 'note does not exist', claude: 'note-not-found', pi: 'missing-target' },
  { sample: 'No such file or directory', claude: 'note-not-found', pi: 'missing-target' },
  { sample: 'permission denied', claude: 'permission-error', pi: 'permission' },
  { sample: 'unauthorized: access denied', claude: 'permission-error', pi: 'permission' },
  { sample: 'ValidationError: missing required field', claude: 'invalid-argument', pi: 'schema-violation' },
  { sample: 'something unexpected happened', claude: 'unknown-error', pi: 'unknown' },
]

/**
 * JS categories with no bash counterpart, each with the reason.
 *
 * DECLARED rather than incidental, following `ACTIONS_WITHOUT_TABLE` in
 * `lib/npm-triage.mjs`: without this list the coverage check below would have
 * to be weakened to "or has no mapping", which is the same as not checking.
 * Anything added here should be a category whose absence on the other host is a
 * design fact someone can defend.
 *
 * @type {Record<string, string>}
 */
export const PI_ONLY_ERROR_CATEGORIES = {
  'tool-missing': 'Claude Code addresses MCP tools as mcp__server__tool with no proxy and no flattening, so an unrecognised tool NAME is not a failure mode there. It is specific to pi-mcp-adapter, where an unknown direct name is dropped silently.',
  conflict: 'The bash classifier folds "already exists"/"duplicate" into invalid-argument. Splitting it out on the Pi side is an improvement, not a divergence — but it is recorded here rather than silently tolerated, because the day someone widens the bash side this entry is what tells them the split already exists.',
}

/**
 * Categories the JS classifier can return, hand-written.
 *
 * Deliberately NOT derived from `RECOVERY_MESSAGES` or from the two exports
 * above. The coverage check compares this list against the classifier's real
 * returns, so the two sides must come from different places — a check whose
 * sides derive from one source passes for any content, which this repo has now
 * shipped five times.
 *
 * @type {readonly string[]}
 */
export const PI_ERROR_CATEGORIES = /** @type {const} */ ([
  'schema-violation', 'missing-target', 'conflict', 'permission',
  'transient', 'tool-missing', 'unknown',
])
