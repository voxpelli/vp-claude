/**
 * The cross-host contract between `hooks/` (Claude Code, bash) and
 * `extensions/` (Pi, JS).
 *
 * Four policies are implemented once per host, and for a long time nothing
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
 *
 * The first version of this file failed that standard three ways, none of them
 * caught by the guard itself, all fixed here:
 *   - its "shared prose" section named both hosts and called only one, so it
 *     passed with the Pi text deleted outright;
 *   - its corpus held no string matching two classifier arms, so the branch
 *     ORDER both implementations are commented as sharing was unobservable;
 *   - it checked Pi's category coverage and not Claude Code's.
 * Keep that in mind before adding a case here: the failure mode is a check that
 * reads as thorough.
 */

/**
 * How many completed sprints to compare the two audit-cadence implementations
 * over. Must span more than one full 4-sprint cycle, or an off-by-one that
 * happens to align at the sampled points passes. Asserted DIRECTLY by the
 * check — an assertion-count floor cannot see this constant shrink, and at 13
 * against a floor of 50 it could fall to 2 with the run still green.
 */
export const CADENCE_SPRINT_RANGE = 13

/**
 * Category names the bash hook can emit, hand-written.
 *
 * Its counterpart `PI_ERROR_CATEGORIES` existed from the start; this one did
 * not, so coverage was one-directional — a seventh arm added to the hook, with
 * no Pi counterpart and no corpus string, left the check at 61/61.
 */
export const CLAUDE_ERROR_CATEGORIES = /** @type {const} */ ([
  'server-unavailable', 'note-not-found', 'invalid-argument',
  'permission-error', 'note-conflict', 'unknown-error',
])

/**
 * Categories the JS classifier can return, hand-written.
 *
 * Deliberately NOT derived from `RECOVERY_MESSAGES` or from the exports below.
 * The coverage check compares this against what the classifier really returns,
 * so the two sides must come from different places — a check whose sides derive
 * from one source passes for any content, which this repo has shipped before.
 *
 * NOTE the absent `@type` docblock, and do not add one. A docblock
 * `@type {readonly string[]}` OVERRIDES the inline const cast, collapsing the
 * literal tuple to `string[]` — which is what this file used to do, so
 * `'transiant'` compiled cleanly and only the runtime check could catch it.
 * `lib/npm-triage.mjs`'s `RENDERED_ACTIONS` has the working form.
 */
export const PI_ERROR_CATEGORIES = /** @type {const} */ ([
  'schema-violation', 'missing-target', 'conflict', 'permission',
  'transient', 'tool-missing', 'unknown',
])

/** @typedef {typeof CLAUDE_ERROR_CATEGORIES[number]} ClaudeErrorCategory */
/** @typedef {typeof PI_ERROR_CATEGORIES[number]} PiErrorCategory */

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
 * Typed over BOTH unions, so a typo on either side is a build error rather than
 * something only the runtime check can notice.
 *
 * @type {Record<ClaudeErrorCategory, PiErrorCategory>}
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
 * agree. An earlier version listed nine hand-picked samples and passed 47/47
 * while the two hosts disagreed on 17 of 27 real inputs — a check that cannot
 * fail, assembled by choosing its own inputs. If a string here is genuinely
 * classified differently on the two hosts, that is a finding to fix or to mark,
 * never a sample to drop.
 *
 * Two later additions are load-bearing and easy to delete as noise:
 *
 *   - The AMBIGUOUS block. Both implementations carry a comment saying their
 *     branch ORDER must match, and order is only observable on a string that
 *     matches two or more arms. Zero of the original 27 did, so swapping two of
 *     `classifyBmError`'s arms left the check at 61/61.
 *   - `validation  error` (TWO spaces). The hook's `validation *error` is a
 *     POSIX BRE — zero-or-more spaces — and the JS was written ` ?error`,
 *     zero-or-one. That divergence shipped, and the corpus held only the
 *     one-space form.
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
  'validation error', 'validation  error', 'Validation   Error', 'ValidationError',
  'schema validation failed', 'missing required field', 'malformed identifier',
  'invalid argument', 'title too long', 'value too short',
  // conflict
  'already exists', 'duplicate entry', 'conflict detected',
  // AMBIGUOUS — each matches two or more arms, so the branch ORDER decides the
  // answer. Without these, the ordering contract is asserted in prose only.
  'invalid permission', 'no such duplicate', 'unauthorized: note not found',
  'connection refused: invalid argument', 'timeout while checking permission',
  'duplicate entry: malformed identifier',
  // unknown
  'something unexpected happened',
])

/**
 * The one place the two hosts' post-compaction recovery text may differ, and
 * the exact strings involved.
 *
 * On Pi the Basic Memory server is addressed by name, so it says "the
 * basic-memory (mcp__basic-memory__*) tools" where Claude Code says "the
 * mcp__basic-memory__* tools". Declaring the substitution lets the check assert
 * BYTE EQUALITY of everything else — far stronger than the "both mention the
 * namespace" invariant it replaces, which had to go because that section read
 * only the Claude Code side and passed with the Pi text wiped entirely.
 *
 * @type {{ pi: string, claude: string }[]}
 */
export const RECOVERY_HOST_SUBSTITUTIONS = [
  {
    pi: 'the basic-memory (mcp__basic-memory__*) tools',
    claude: 'the mcp__basic-memory__* tools',
  },
]

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
