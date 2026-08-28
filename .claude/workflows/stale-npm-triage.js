export const meta = {
  name: 'stale-npm-triage',
  description: 'Cheap-model fleet sweep of an npm Basic Memory cohort: enumerate by note type, scan every note, resolve upstream, then rank the /intel candidates deterministically into a markdown report',
  whenToUse: 'When a documented npm cohort in Basic Memory needs a full drift + compliance triage and you want one prioritised "what to /intel next" table rather than a sampled report. Read-only: it proposes refreshes, it never edits a note.',
  phases: [
    { title: 'Enumerate', detail: 'one cheap agent types the cohort and splits it into shards' },
    { title: 'Scan', detail: 'one cheap agent per shard reads every note: version + compliance signals' },
    { title: 'Resolve', detail: 'one cheap agent per shard resolves those names against the npm registry' },
    { title: 'Rank', detail: 'one deterministic script assigns action classes, applies the ordering key, and runs the completeness gate' },
    { title: 'Audit', detail: 'ordering critic, top-N primary-source verifier, and completeness auditor in parallel' },
    { title: 'Report', detail: 'assemble the markdown report around the byte-exact generated tables' },
  ],
}

// Prioritised staleness + compliance triage for a Basic Memory npm cohort.
//
// ── Why a cheap fleet is sound here ─────────────────────────────────────────
// Every agent in the Scan and Resolve phases runs ONE deterministic script over
// a disjoint shard and reports what the script printed. No agent extracts a
// version, judges compliance, buckets a note, or orders a row in its head. The
// correctness-deciding step is `rank.mjs`'s completeness gate — cohort size must
// equal the sum of the action classes — not agreement between agents. That is
// the same structure as the `haiku-jsdoc-sweep` prior art: a cheap fleet made
// safe by a downstream deterministic check rather than by peer consensus, which
// would not help anyway since cheap-tier errors across identical prompts are
// correlated, not independent.
//
// ── Why the cohort is enumerated by TYPE, not by title prefix ───────────────
// The shipped `--stale` sweep filters on an `npm-` title prefix. Notes whose
// titles kept the pre-0.22.0 colon form, and notes carrying no prefix at all,
// are therefore dropped silently — the sweep reports a clean result over a
// denominator it quietly shrank. `bm tool schema-validate <type>` returns every
// note the schema actually applies to, in one ~13s call, so it is both the
// authoritative denominator and a free view of which schema fields are present.
//
// ── Why the per-note read is unavoidable, and how it is bounded ─────────────
// Basic Memory has no bulk metadata projection (filed upstream), so the version
// and the structural-section checks need the note body: ~3s per `bm tool
// read-note` (measured 2026-08-05, basic-memory 0.22.1). The cost is fixed per
// invocation, not proportional to note size, and it is per-process app
// initialisation rather than interpreter startup (`python -c pass` is 0.02s).
// Serially that is ~30 minutes for a 580-note cohort. Each shard agent runs a
// bounded worker pool, and `shards * scanConcurrency` is an UPPER BOUND on
// concurrent `bm` processes — the real ceiling is lower, since the workflow
// runtime also caps how many agents run at once. Keep the product near 8–12;
// raising it spawns that many OS processes and will thrash a memory-pressured
// machine.
//
// The registry stage is bounded separately and much more loosely
// (`shards * registryConcurrency`, default 32 concurrent HTTPS requests), on
// the grounds that sockets are cheap where processes are not. That stage
// retries a 429/5xx rather than recording a throttle as an upstream failure,
// because an unretried throttle silently removes drifted notes from the ranked
// table and files them under "could not assess".
//
// ── What the output is ──────────────────────────────────────────────────────
// One markdown file. The primary table is CONFIRMED drift — notes whose
// documented version a registry lookup proved is behind — ordered by a declared
// lexicographic key (drift class, then measured reach, then note age, then id),
// with every input to that key emitted as its own column.
//
// Notes whose version could not be READ are a separate table, deliberately.
// "We could not measure drift" is a different epistemic state from "we measured
// it and it is bad", not a lesser severity, and ranking the two together was
// measurably misleading in testing: seven notes that were in fact current
// topped the list while a breaking change to a package this repo depends on sat
// at rank 11. Archive / investigate / modernize / blocked likewise get their own
// tables, because "most in need of a /intel" is not a single axis across
// actions that are not /intel.
//
// ── Scope: this workflow is npm-specific end to end ─────────────────────────
// Only Enumerate is genuinely ecosystem-agnostic (it keys off the schema type).
// Everything downstream carries npm assumptions, and the porting checklist is:
//   registry-shard.mjs — talks to registry.npmjs.org and nothing else; must be
//     replaced wholesale for another ecosystem.
//   scan-shard.mjs     — `npm-`/`npm:` title forms, the npm_package required-
//     section list, the `npmjs.com/package/` URL fallback, and the `packages[]`
//     frontmatter convention.
//   rank.mjs           — the `@types/*` exclusion and every `/intel npm:` fix.
// `noteType` therefore names the schema to enumerate, NOT a generality switch;
// it is guarded below rather than left as a comment, because the failure it
// prevents (every name resolved against the wrong registry, producing a
// clean-looking but entirely wrong report) is far worse than a loud refusal.
//
// ── Invocation ──────────────────────────────────────────────────────────────
//   Workflow({ scriptPath: '<this file>', args: { ... } })
//     repoRoot            '/Users/pelle/Sites/ai/vp-claude'
//     noteType            'npm_package'   (guarded — see above)
//     outDir              '/tmp/stale-npm-triage'
//     outFile             '<repoRoot>/stale-npm-triage.md'
//     censusFile          ''  <- STRONGLY RECOMMENDED. `<noteTitle>\t<YYYY-MM-DD>`
//                             for the ecosystem directory. Without it, note-age
//                             is UNKNOWN for every row — it drops out of the sort
//                             key rather than scoring 0 — AND the directory
//                             reconciliation reports a vacuous clean.
//     shards              4     scanConcurrency 2   (product = the bm cap)
//     registryConcurrency 8     verifyTopN      8
//     limit               0     <- smoke-test cap; makes the census
//                                  reconciliation meaningless (guarded below)

const A = typeof args === 'string' ? JSON.parse(args) : (args ?? {})

const REPO = A.repoRoot ?? '/Users/pelle/Sites/ai/vp-claude'
const NOTE_TYPE = A.noteType ?? 'npm_package'
// The drivers reach `lib/` by a RELATIVE static import, so this invariant is now
// structural rather than asserted: a lib from a different checkout than
// `repoRoot` would silently build the report with a different version extractor
// than the repo it claims to describe, and there is no longer an argument that
// could express that mistake. (A `LIB` path used to be passed positionally.)
const DRIVERS = `${REPO}/.claude/workflows/stale-npm-triage`
const OUT = A.outDir ?? '/tmp/stale-npm-triage'
const OUT_FILE = A.outFile ?? `${REPO}/stale-npm-triage.md`
const SHARDS = A.shards ?? 4
const SCAN_CONC = A.scanConcurrency ?? 2
const REG_CONC = A.registryConcurrency ?? 8
const CENSUS_FILE = A.censusFile ?? A.datesFile ?? ''
const LIMIT = A.limit ?? 0
const TOP_N = A.verifyTopN ?? 8

if (NOTE_TYPE !== 'npm_package') {
  throw new Error(
    `stale-npm-triage: noteType '${NOTE_TYPE}' is not supported. Scan, Resolve and Rank all carry ` +
    'npm-specific assumptions (see the porting checklist in the header). Running against another ' +
    'schema would resolve every name against the npm registry and produce a clean-looking but ' +
    'entirely wrong report.'
  )
}

const CHEAP = { model: 'haiku', effort: 'low', agentType: 'general-purpose' }
const SMART = { effort: 'high', agentType: 'general-purpose' }

const READ_ONLY =
  'HARD CONSTRAINTS: (1) This is a read-only analysis pass. Do NOT call any Basic Memory write tool ' +
  '(write_note, edit_note, move_note, delete_note) and do NOT edit any file under the Basic Memory ' +
  'vault. (2) Do NOT git commit, git push, or perform any GitHub write (no gh issue/pr create, ' +
  'comment, or edit). (3) Do NOT call advisor(). (4) Report exactly what the commands printed — if a ' +
  'command fails, say so and report the failure; never substitute a plausible-looking number.'

const SHARD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'requested', 'written', 'summary'],
  properties: {
    ok: { type: 'boolean', description: 'true only if the script exited 0 and wrote its output file' },
    requested: { type: 'integer' },
    written: { type: 'integer' },
    counts: { type: 'object', additionalProperties: { type: 'integer' } },
    summary: { type: 'string', description: 'one line: what ran, plus any anomaly' },
  },
}

// ── Enumerate ───────────────────────────────────────────────────────────────
// This agent also reports today's date. The workflow runtime forbids Date.now()
// and new Date() (they would break resume), so the run date has to enter the
// pipeline from a shell, not from the script.
function enumeratePrompt () {
  return `${READ_ONLY}

You are running the ENUMERATION step of a Basic Memory staleness sweep. Run these commands exactly, in order, and report what they print.

1. mkdir -p ${OUT}
   Then clear any previous run's shard artefacts with \`find\`, NOT \`rm\` with a glob — the
   interactive shell here is zsh, where an unmatched glob aborts the command before rm ever runs.
   The MERGED and GENERATED files must go too, not just the per-shard ones: if this run later fails
   to regenerate them, every downstream agent would silently read the PREVIOUS run's data and
   produce a coherent report about the wrong sweep.
   The list below must include the ENUMERATION artefacts too — cohort.txt, enumerate.json and
   schema.ndjson. They are what a failed enumeration would leave behind from the previous sweep,
   and step 5 would then re-shard last week's cohort into a coherent report about the wrong data.
     find ${OUT} -maxdepth 1 \\( -name 'scan-*.ndjson' -o -name 'registry-*.ndjson' -o -name 'shard-*.txt' -o -name 'scan.ndjson' -o -name 'registry.ndjson' -o -name 'ranked.ndjson' -o -name 'summary.json' -o -name 'tables.json' -o -name 'tables.md' -o -name 'prose-head.md' -o -name 'downloads.ndjson' -o -name 'cohort.txt' -o -name 'enumerate.json' -o -name 'schema.ndjson' -o -name 'audit-*.txt' -o -name 'remark-report.txt' \\) -delete
2. date -u +%F
3. node ${DRIVERS}/enumerate.mjs ${NOTE_TYPE} ${OUT} <the date step 2 printed>
   Pass the date as the third argument, verbatim. It is stamped into enumerate.json so a later
   step can tell this run's artefacts from a previous run's — a content hash cannot, because it
   detects a DIFFERENT cohort, never an OLDER one.
   This runs \`bm tool schema-validate ${NOTE_TYPE}\` (expect ~15s) and writes ${OUT}/cohort.txt,
   ${OUT}/schema.ndjson and ${OUT}/enumerate.json. It prints a JSON summary — capture it verbatim.
${LIMIT ? `4. LIMIT IS SET: head -n ${LIMIT} ${OUT}/cohort.txt > ${OUT}/cohort.limited.txt && mv -f ${OUT}/cohort.limited.txt ${OUT}/cohort.txt` : '4. (no limit configured — use cohort.txt as written)'}
5. Split the cohort into exactly ${SHARDS} shard files, round-robin so each shard gets an even mix
   (do NOT use \`split -n l/N\` — macOS split does not support it, and a contiguous split would put
   every \`@scope\` note in one shard):
     awk -v n=${SHARDS} -v out=${OUT}/shard '{ f = out "-" ((NR-1)%n) ".txt"; print $0 > f }' ${OUT}/cohort.txt
   Then verify NOTHING was lost:  wc -l < ${OUT}/cohort.txt ; cat ${OUT}/shard-*.txt | wc -l
   Those two numbers MUST match. If they do not, report splitVerified:false and say so.
6. Report the shard files and their line counts: wc -l ${OUT}/shard-*.txt

Return JSON with: today (the YYYY-MM-DD from step 2), cohortSize (line count of the FINAL cohort.txt),
uniqueIdentifiers / reportedTotalEntities / duplicateIdentifiers (from the enumerate.mjs JSON),
shardFiles (the absolute paths, in order), shardCounts (line count of each, same order),
splitVerified (true only if step 5's two counts matched), and notes (one line on anything odd).`
}

const ENUM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['today', 'cohortSize', 'shardFiles', 'shardCounts', 'splitVerified'],
  properties: {
    today: { type: 'string', description: 'YYYY-MM-DD from `date -u +%F`' },
    cohortSize: { type: 'integer' },
    uniqueIdentifiers: { type: 'integer' },
    reportedTotalEntities: { type: 'integer' },
    duplicateIdentifiers: { type: 'array', items: { type: 'string' } },
    shardFiles: { type: 'array', items: { type: 'string' } },
    shardCounts: { type: 'array', items: { type: 'integer' } },
    splitVerified: { type: 'boolean' },
    notes: { type: 'string' },
  },
}

function scanPrompt (shardFile, i) {
  return `${READ_ONLY}

You are running SHARD ${i} of a Basic Memory note scan. Run exactly this one command and report what it printed:

  node ${DRIVERS}/scan-shard.mjs ${shardFile} ${OUT}/scan-${i}.ndjson ${SCAN_CONC}

It reads each note in the shard through \`bm tool read-note\` and writes one JSON object per note.
Expect it to take several minutes — each read is ~4.4s and only ${SCAN_CONC} run at a time. Do NOT
raise the concurrency argument: it is a deliberate global cap shared with the other shards.

RUN IT IN THE FOREGROUND AND WAIT FOR IT TO EXIT. Do NOT background it, do NOT wrap it in a
monitor or a polling loop, and do NOT return while it is still running. "Several minutes" is the
expected duration, not a reason to detach — a 2026-08-06 run failed exactly this way: a shard agent
backgrounded the command, returned \`written: 0\` with "background scan still in progress", and the
registry step then died on a scan file that did not exist. The script writes its output ONLY when it
finishes, so returning early guarantees an ABSENT file, never a partial one. If it has not exited,
you are not done.

Then confirm the output line count matches the shard line count:
  wc -l < ${shardFile} ; wc -l < ${OUT}/scan-${i}.ndjson

Do NOT interpret, summarise, or second-guess any row. Do NOT edit the script. Return JSON:
ok (true only if the command exited 0 AND the output file EXISTS AND the two line counts match),
requested, written, counts (the status histogram the script printed), summary (one line, naming any
mismatch).`
}

function resolvePrompt (shardFile, i) {
  return `${READ_ONLY}

You are running SHARD ${i} of an npm registry resolution. Run exactly this one command:

  node ${DRIVERS}/registry-shard.mjs ${OUT}/scan-${i}.ndjson ${OUT}/registry-${i}.ndjson ${REG_CONC}

It reads the scan shard directly and resolves every row that was read successfully and yielded a
package name; it reports how many rows it skipped as \`skippedScanRows\`. It deliberately
distinguishes a 404 (not-in-registry) from a transport failure (api-unavailable) and retries a
429/5xx — do NOT collapse those states and do NOT add your own retry loop.

A shard that resolves ZERO rows is NOT clean. If \`requested\` is 0 while the scan shard has ok rows,
report ok:false and say so — an empty result here is indistinguishable in the final report from
"these packages have no upstream", which would be a false clean.

Return JSON: ok (the command exited 0 AND requested > 0 unless the scan shard genuinely had no
usable rows), requested, written, counts (the upstreamState histogram the script printed),
summary (one line, naming skippedScanRows).`
}

function rankPrompt (today) {
  return `${READ_ONLY}

You are running the deterministic RANKING step. Run exactly these commands, in order:

1. Merge the shard outputs:
     cat ${OUT}/scan-*.ndjson > ${OUT}/scan.ndjson
     cat ${OUT}/registry-*.ndjson > ${OUT}/registry.ndjson
     wc -l ${OUT}/cohort.txt ${OUT}/scan.ndjson ${OUT}/registry.ndjson
2. Weekly downloads, for the WHOLE cohort at once:
     node ${DRIVERS}/downloads-batch.mjs ${OUT}/registry.ndjson ${OUT}/downloads.ndjson; echo "EXIT=$?"
   This runs AFTER the merge, in one process, on purpose. It used to be a third fetch inside each
   registry shard, and the 2026-08-05 sweep therefore opened 4 shards x concurrency 8 = 32
   uncoordinated sockets against api.npmjs.org: 462 of the 512 eligible rows lost their download count to HTTP
   429 and were then scored as genuinely unpopular. Do NOT move it back into the shards, do NOT run
   several copies, and do NOT raise its concurrency to "speed it up" — a burst is the failure.
   It prints \`okRate\`. If that is below 0.9 the ranking's reach tie-break is not trustworthy and
   the gate in step 3 will fail; report the number rather than re-running until it looks better.
3. Rank. Run this as ONE command in ONE call — each Bash call gets a fresh shell, so splitting the
   \`echo\` onto its own call would report the shell's exit status, not the script's:
     node ${DRIVERS}/rank.mjs ${OUT} ${today}${CENSUS_FILE ? ` ${CENSUS_FILE}` : ''}; echo "EXIT=$?"

rank.mjs assigns every cohort member exactly one action class, orders the candidates, and writes
ranked.ndjson, summary.json, tables.json and tables.md. Its exit codes are DISTINCT and you must
report which one you saw:
  0 = all gate invariants held
  1 = a completeness gate invariant FAILED (a real finding — stderr names which ones)
  2 = the inputs could not be read (nothing was computed; this is not a finding, it is a broken run)
A failed gate is a result, not something to work around: do NOT edit the script, do NOT re-run with
different inputs to make it pass, do NOT report gateOk true because the tables look plausible.

4. Print the summary for reporting: cat ${OUT}/summary.json

Return JSON: gateOk (rank.mjs exited 0 AND summary.json's .gateOk is true), gate (the whole
summary.json .gate object of named sub-checks), cohortSize, rowsEmitted, classified, actionCounts,
scanStatuses, downloadsOkRate (the \`okRate\` downloads-batch.mjs printed in step 2),
intelWithoutReleaseDate, rowsWithMissingInputs, slotUnreadableCount (length of
summary.json .slotUnreadable), exitCode, summary (one line).`
}

const RANK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  // `gate` and `exitCode` are REQUIRED, not optional. They carry the two safety
  // decisions this workflow makes, and an omitted field is not a neutral absence:
  // `Object.entries(rankRes.gate ?? {})` turns a missing `gate` into an empty
  // failedGates list, which the report prompt then renders as an affirmative
  // all-clear; a missing `exitCode` silently skips the only broken-run abort.
  required: ['gateOk', 'gate', 'exitCode', 'cohortSize', 'rowsEmitted', 'classified', 'actionCounts', 'summary'],
  properties: {
    gateOk: { type: 'boolean' },
    gate: { type: 'object', additionalProperties: { type: 'boolean' }, description: 'summary.json .gate verbatim — the named sub-checks' },
    cohortSize: { type: 'integer' },
    rowsEmitted: { type: 'integer' },
    classified: { type: 'integer' },
    actionCounts: { type: 'object', additionalProperties: { type: 'integer' } },
    scanStatuses: { type: 'object', additionalProperties: { type: 'integer' } },
    downloadsOkRate: { type: 'number', description: 'downloads-batch.mjs .okRate — below 0.9 the reach tie-break is not trustworthy' },
    intelWithoutReleaseDate: { type: 'integer' },
    rowsWithMissingInputs: { type: 'integer' },
    slotUnreadableCount: { type: 'integer' },
    exitCode: { type: 'integer', description: '0 = gate held, 1 = a gate invariant failed, 2 = inputs unreadable' },
    summary: { type: 'string' },
  },
}

// ── Audit ───────────────────────────────────────────────────────────────────
// Three disjoint checks. The critic may not change the ordering (that would make
// the ranking non-reproducible mid-run); it argues about it, and its argument
// goes into the report so the reader can discount the ordering knowingly.
//
// This prompt was rewritten with the model it interrogates. It used to ask which
// WEIGHT was indefensible and where components double-count — questions with no
// referent once the weighted sum became a lexicographic key. Left alone it would
// have returned a confident verdict about a model that no longer exists, which
// is worse than no audit: an audit nobody can tell is stale.
function criticPrompt () {
  return `${READ_ONLY}

You are adversarially reviewing the ORDERING MODEL of a knowledge-graph staleness triage — not its
code, its judgement. Read:
  jq -r 'select(.action=="intel") | [.id,.distance,.weeklyDownloads,.reachMeasured,.downloadsState,.noteAgeDays,.releaseAgeDays,(.gaps|join(";"))] | @tsv' ${OUT}/ranked.ndjson | head -40
  jq -r 'select(.action=="unmeasured") | [.id,.reason,.noteAgeDays,.weeklyDownloads,.reachMeasured] | @tsv' ${OUT}/ranked.ndjson | head -20
  jq '{downloadsStates,dateStates,rowsWithMissingInputs,unknownDriftClasses}' ${OUT}/summary.json
  jq -r '.action' ${OUT}/ranked.ndjson | sort | uniq -c

Then READ (do not execute — neither has a shebang) ${REPO}/lib/npm-triage.mjs — specifically
\`compareRows\`, \`DRIFT_ORDER\` and \`UNMEASURED_ORDER\` — and ${DRIVERS}/rank.mjs's table rendering.

The ordering is LEXICOGRAPHIC, not a score. There is no sum and no weights: each level is decisive
and nothing below it can compensate. \`intel\` rows go drift class -> measured weekly downloads
(descending; a row whose downloads lookup did not answer sorts AFTER every measured row in its
class, never as zero) -> note age (oldest first) -> id. \`unmeasured\` rows go remediation class
(cheapest fix first) -> note age -> id, and are never ranked against confirmed drift.

Attack all of it. The strongest available objection is that strict lexicographic ordering CANNOT
compensate, so say whether that costs more than the sum's compensation did:
- Name a concrete pair of ids the key orders WRONGLY, and say which level did it. The obvious
  candidate class: a very high-reach \`patch\` row that a reader would genuinely want above an
  obscure \`semver-major\`. Does such a pair exist in this data, or is it hypothetical here?
- \`distance-unknown\` sits between \`semver-minor-multi\` and \`patch\`, so it outranks EVERY patch row
  unconditionally. It means two fully parsed versions on incomparable schemes (e.g. 3.6.1 vs
  2026.3.311859). Is that position defensible against the actual rows carrying it?
- Does the reach tie-break correctly REFUSE unmeasured values? Check \`reachMeasured\`/\`downloadsState\`
  against the ordering: is any row positioned as if its reach were known when it is not, or demoted
  for a lookup failure rather than for low reach?
- Is the \`unmeasured\` table's cheapest-fix-first order right, or does it bury something urgent?
- Compliance (\`gaps\`) and release age are DISPLAYED but order nothing. Is that omission wrong —
  is there a row whose position is misleading because of it?
- Is the intel/unmeasured boundary drawn in the right place? Is any row on the wrong side of it —
  especially one classed 'modernize' or 'current' that is really drifted, or vice versa?
- \`classifyVersionDistance\` treats a 0.0.66 -> 0.0.69 gap as 'patch' (the 0.x breaking-minor rule
  does not extend to 0.0.x) and treats a 1-2 minor gap as 'patch' too. Does that mis-rank anything here?
- What signal that would obviously matter is MISSING entirely?

Be concrete and cite row ids from the data. Do NOT propose editing any file, and do NOT edit one.
Return JSON: verdict ('sound' | 'sound-with-caveats' | 'misleading'), findings (array of
{claim, evidence, severity: 'high'|'medium'|'low'}), missingSignals (array of strings),
oneLine (a single sentence a reader should see before trusting the ordering).`
}

const CRITIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'findings', 'oneLine'],
  properties: {
    verdict: { type: 'string', enum: ['sound', 'sound-with-caveats', 'misleading'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['claim', 'evidence', 'severity'],
        properties: {
          claim: { type: 'string' },
          evidence: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    missingSignals: { type: 'array', items: { type: 'string' } },
    oneLine: { type: 'string' },
  },
}

function verifierPrompt () {
  return `${READ_ONLY}

You are INDEPENDENTLY VERIFYING the top ${TOP_N} rows of a generated staleness table against primary
sources. Assume the table is wrong until each row survives.

  jq -r 'select(.action=="intel") | [.id,.npmName,.documented,.versionBasis,.upstream,.distance,.releaseDate] | @tsv' ${OUT}/ranked.ndjson | head -${TOP_N}

For EACH of those rows, check both sides yourself:
- Documented version: \`bm tool read-note --include-frontmatter <id> | jq -r .content\` and find what
  version the note actually claims. Note that the note may carry several version-looking strings —
  a header pipe, a \`- [version]\` observation, and narrative lines in a release reel. Say which one
  the table picked and whether that was the right one.
- Upstream version: \`curl -sL https://registry.npmjs.org/<name>/latest | jq -r .version\`
  (URL-encode a scoped name's slash as %2F).

Flag any row where the documented version, upstream version, or drift class is wrong, AND any row
where the note does not exist or the package name was misrecovered. A row you cannot check is
'unverified', not 'confirmed'.

Return JSON: checked (integer), rows (array of {id, verdict: 'confirmed'|'refuted'|'unverified',
detail}), refutedCount, oneLine.`
}

const VERIFIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['checked', 'rows', 'refutedCount', 'oneLine'],
  properties: {
    checked: { type: 'integer' },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'verdict', 'detail'],
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: ['confirmed', 'refuted', 'unverified'] },
          detail: { type: 'string' },
        },
      },
    },
    refutedCount: { type: 'integer' },
    oneLine: { type: 'string' },
  },
}

function completenessPrompt () {
  return `${READ_ONLY}

You are auditing COMPLETENESS — whether this sweep covered what it claims to have covered. Run:

1. Denominator arithmetic:
     wc -l < ${OUT}/cohort.txt
     jq -r '.action' ${OUT}/ranked.ndjson | sort | uniq -c
     jq -r '[.cohortSize,.rowsEmitted,.classified,.gateOk] | @tsv' ${OUT}/summary.json
2. Every cohort id appears exactly once in ranked.ndjson. Write scratch files under ${OUT}, never
   a fixed /tmp path — two runs would otherwise clobber each other's intermediates:
     jq -r '.id' ${OUT}/ranked.ndjson | sort > ${OUT}/audit-ranked-ids.txt
     sort ${OUT}/cohort.txt > ${OUT}/audit-cohort-ids.txt
     diff ${OUT}/audit-cohort-ids.txt ${OUT}/audit-ranked-ids.txt > ${OUT}/audit-diff.txt; echo "DIFF_EXIT=$?"; head -20 ${OUT}/audit-diff.txt
     jq -r '.id' ${OUT}/ranked.ndjson | sort | uniq -d | head
3. Rows that were scanned but never resolved upstream (a silent hole). FIRST confirm the inputs are
   non-empty — if a jq step fails, the shell still creates an empty file and \`comm\` then reports
   ZERO holes exactly when the hole is total:
     wc -l < ${OUT}/scan.ndjson ; wc -l < ${OUT}/registry.ndjson
     jq -r 'select(.status=="ok" and .npmName!="" and .npmName!=null) | .id' ${OUT}/scan.ndjson | sort > ${OUT}/audit-named.txt
     jq -r '.id' ${OUT}/registry.ndjson | sort > ${OUT}/audit-resolved.txt
     wc -l < ${OUT}/audit-named.txt
     comm -23 ${OUT}/audit-named.txt ${OUT}/audit-resolved.txt | tee ${OUT}/audit-unresolved.txt | head -20 ; wc -l < ${OUT}/audit-unresolved.txt
   If audit-named.txt is empty while cohort.txt is not, report consistent:false — that is a broken
   detector, not a clean result.
4. How many /intel rows lack a real upstream release date (their \`Released\` column is blank because
   the registry never gave one — the ordering does not use it at all, so this is a completeness
   number, not a ranking one):
     jq -r 'select(.action=="intel" and .releaseAgeDays==null) | .id' ${OUT}/ranked.ndjson | wc -l
5. Note-age coverage: jq -r 'select(.noteAgeDays==null) | .id' ${OUT}/ranked.ndjson | wc -l
6. Directory reconciliation — the enumeration is by note TYPE, so a note filed in the ecosystem
   directory but NOT carrying that schema type is swept by nobody. rank.mjs already computed both
   directions; report them:
     jq -r '{censusRows, cohortMatchedInCensus, missingFromCensus: (.cohortMissingFromCensus|length), inDirNotTyped: (.censusRowsNotInCohort|length)}' ${OUT}/summary.json
     jq -r '.censusRowsNotInCohort[]' ${OUT}/summary.json | head -20
   \`censusRowsNotInCohort\` is the finding that matters: those notes exist in the directory and this
   sweep never looked at them. If no census file was supplied, censusRows is 0 — say so explicitly
   rather than reporting "0 unswept", which would be a false clean.
${LIMIT
  ? `   !! THIS RUN IS LIMITED to ${LIMIT} notes, so \`censusRowsNotInCohort\` counts everything the limit
   excluded and is NOT a corpus finding. Report it as "not meaningful under --limit" and give the
   number only with that caveat attached.`
  : '   This run is unlimited, so the count is a real corpus finding.'}

Report the numbers exactly. A discrepancy is the finding — do NOT fix anything, do NOT edit files.
Return JSON: cohortSize, rankedRows, duplicateRows (integer), missingFromRanked (array of ids, max 20),
unresolvedNamed (integer), intelWithoutReleaseDate (integer), rowsWithoutNoteAge (integer),
consistent (boolean), oneLine.`
}

const COMPLETENESS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cohortSize', 'rankedRows', 'consistent', 'oneLine'],
  properties: {
    cohortSize: { type: 'integer' },
    rankedRows: { type: 'integer' },
    duplicateRows: { type: 'integer' },
    missingFromRanked: { type: 'array', items: { type: 'string' } },
    unresolvedNamed: { type: 'integer' },
    intelWithoutReleaseDate: { type: 'integer' },
    rowsWithoutNoteAge: { type: 'integer' },
    censusRows: { type: 'integer', description: '0 means no census supplied — NOT "nothing unswept"' },
    inDirectoryNotTyped: { type: 'integer' },
    inDirectoryNotTypedIds: { type: 'array', items: { type: 'string' } },
    consistent: { type: 'boolean' },
    oneLine: { type: 'string' },
  },
}

function reportPrompt (today, enumRes, rankRes, critic, verifier, completeness, health) {
  return `${READ_ONLY} — with ONE exception: you MUST write the report file ${OUT_FILE}. That is the deliverable. Write no other file except ${OUT}/prose-head.md.

Assemble the final report for a staleness + compliance triage of the \`${NOTE_TYPE}\` cohort.

Inputs available on disk:
  ${OUT}/tables.md      — the generated tables, ALREADY CORRECT. Never retype or edit a table row.
  ${OUT}/summary.json   — counts, state histograms, gate status.
  ${OUT}/enumerate.json — cohort enumeration + duplicate identifiers.

Structured results from the other phases (use these verbatim, do not re-derive):
  ENUMERATE: ${JSON.stringify(enumRes)}
  RANK:      ${JSON.stringify(rankRes)}
  CRITIC:    ${JSON.stringify(critic)}
  VERIFIER:  ${JSON.stringify(verifier)}
  COMPLETENESS: ${JSON.stringify(completeness)}
  RUN HEALTH: ${JSON.stringify(health)}

A \`null\` for CRITIC, VERIFIER or COMPLETENESS means that audit agent DID NOT RUN. Say so
explicitly — "the verifier did not run" is a completely different statement from "the verifier
found nothing", and the reader must not have to guess which one they are looking at.

Write ${OUT}/prose-head.md containing, in this order:
1. \`# npm knowledge-graph staleness & compliance triage\` and a line stating the run date ${today},
   the cohort denominator, and that the cohort was enumerated by note TYPE (not title prefix).
2. \`## How to read this\` — the primary table is CONFIRMED drift (a registry lookup proved the
   documented version is behind); every input to the ordering is its own column, so any row's
   position can be checked by eye; the other tables are DIFFERENT actions, not lower priority. State plainly that
   \`unmeasured\` means drift is UNKNOWN rather than zero, that most of those rows need a one-line
   \`[version]\` slot rather than research, and that a \`modernize\` row is a slot fix, not a research task.
3. \`## Ordering model\` — state the sort key in one short list, and say plainly that it is
   LEXICOGRAPHIC rather than a weighted score: each level decides outright and nothing below it
   compensates. \`intel\`: drift class -> measured weekly downloads (descending) -> note age (oldest
   first) -> id. \`unmeasured\`: remediation class (cheapest fix first) -> note age -> id. Say what
   that buys — a \`patch\` bump can no longer tie a confirmed \`semver-major\`, and a downloads lookup
   that never answered can no longer read as low reach — and what it costs: there is no compensation,
   so a hugely popular \`patch\` row sits below every \`semver-major\` however obscure. Do NOT invent
   weights or numbers; there are none. If summary.json's \`unknownDriftClasses\` is non-empty, list it
   here — those rows were ordered by a class the key does not know and sat at the bottom of their table.
4. \`## Completeness\` — the denominator, the full action histogram, and the gate. Report the gate as
   a POSITIVE count — "N of M named sub-checks held" — taking M from the number of keys in RANK's
   \`gate\` object (NOT RUN HEALTH, which carries only \`failedGates\`/\`shardProblems\`/shard counts —
   naming the wrong block there is what made this branch unreachable) and naming each FAILED one
   from \`failedGates\`. Do NOT infer "all held"
   from \`failedGates\` being empty: an empty list and an absent gate look identical downstream, and
   only a count sourced from \`gate\`'s own keys can tell them apart. If \`gate\` is missing or empty,
   say the gate did not report and treat the run as UNVERIFIED — never as clean. Also list every entry in
   \`shardProblems\` verbatim, since a dead shard's notes are simply absent from the results; and give
   every number the completeness audit returned. If ANY row was unaccounted for, say so prominently
   and put it ABOVE the tables. Then render summary.json's \`downloadsStates\` and \`dateStates\` as two
   small histograms with a one-line reading of each: they separate "the API answered and there is
   nothing there" from "the API never answered", which look identical in a blank cell and call for
   opposite responses — one is a fact about the packages, the other about this run. State
   \`rowsWithMissingInputs\` beside them, and say what a missing ordering input actually does now: the
   row falls to the END of its class on that level rather than being scored 0, so it is not
   mis-ranked as low-value, it is un-ranked on that dimension.
5. \`## Audit\` — the critic's verdict and findings, and the verifier's per-row results. If the critic
   called the model misleading or the verifier refuted a row, that belongs ABOVE the tables, not
   buried. Do not soften it.
6. \`## Limitations\` — at minimum, all of these:
   - Weekly downloads are a GLOBAL reach proxy and say nothing about whether these packages are used
     in any of this user's own projects. Nothing here cross-references a project manifest.
   - The drift classifier labels a 1–2 minor gap 'patch', and does not extend the 0.x
     breaking-minor rule to 0.0.x — so a 0.0.66 -> 0.0.69 gap scores as a patch.
   - A \`⚠\` in the Documented column means the version came from a non-canonical frontmatter slot,
     not the note's own \`[version]\` observation.
   - Note-age comes from a supplied directory census whose capture date is NOT the run date.
     ${CENSUS_FILE ? `This run used \`${CENSUS_FILE}\` — name it.` : 'NO census was supplied for this run: say plainly that note-age was UNKNOWN for every row, so the third level of the sort key never fired and ordering fell through to note id, and that the directory reconciliation could not be performed.'}
   - Structural compliance (the \`Note gaps\` column) and upstream release age are DISPLAYED but do
     not order anything. Compliance decides \`current\` vs \`modernize\`, nothing more.
   - The fourth-wall column is REPORT-ONLY and orders nothing: its false-positive rate over a full
     cohort has not been measured.
   - Whatever the completeness audit reported as present in the directory but not carrying the
     schema type — those notes were never examined by this sweep at all.

Then assemble the file, preserving the tables byte-for-byte. Capture the exit status — a missing
tables.md would otherwise leave a report with real-looking counts and NO tables at all:
  cat ${OUT}/prose-head.md ${OUT}/tables.md > ${OUT_FILE}; echo "CAT_EXIT=$?"; wc -l ${OUT_FILE}
If CAT_EXIT is non-zero, stop and report it — do not hand-write substitute tables.

Finally validate the markdown against the repo's own remark config (it loads remark-gfm and
remark-lint-no-hidden-table-cell, which is what catches an unescaped \`|\` splitting a row).
Two things make the naive invocation silently useless, so use exactly this form:
  npm --prefix ${REPO} exec -- remark --quiet --frail --no-ignore --no-stdout --rc-path ${REPO}/package.json ${OUT_FILE} > ${OUT}/remark-report.txt 2>&1; echo "REMARK_EXIT=$?"; tail -30 ${OUT}/remark-report.txt
  - Use \`npm --prefix\`, NOT \`cd ${REPO} && … > redirect\` — that shape trips a manual-approval
    prompt in this environment and would stall an unattended run at its final phase.
  - Set \`remarkClean: false\` only if a finding from a rule OTHER than \`remark-validate-links\`
    survives; that rule fails merely for running outside a git repository.
  - \`--no-ignore\` is REQUIRED: ${OUT_FILE} is listed in .remarkignore (to keep a generated
    artefact out of the repo-wide check:md), and remark REFUSES an explicitly named ignored file
    with "Cannot process specified file: it's ignored" and exit 1 — a failure that says nothing
    about markdown quality. Without this flag the step has never actually validated anything.
  - \`--no-stdout\` is REQUIRED: remark writes the PROCESSED DOCUMENT to stdout unless told not to,
    and \`--quiet\` does not suppress it — that is why an earlier remark-report.txt contained 87 KB
    of the report's own prose instead of a findings list. Anyone "fixing" that by changing the
    redirect will reproduce it.
  - \`--rc-path\` is REQUIRED: remark discovers config from the FILE's directory upward, not from cwd,
    so a report written outside the repo loads zero lint plugins and passes vacuously.
  - Capture the exit code WITHOUT a pipe — \`cmd | tail\` reports tail's status, not remark's.
Report the result honestly, including which file the findings landed in. If findings fall in YOUR
prose, fix the prose and re-assemble. If findings fall inside the table block, do NOT edit a table
row — report them as a generator defect (line numbers + the message) so the table stays byte-identical
to tables.md. \`remark-validate-links\` will also fail outside a git repository; note that as an
artefact of the output location rather than a defect in the document.

Return JSON: outFile, lines (wc -l of the final file), remarkClean (boolean — REMARK_EXIT was 0, or
its only findings were remark-validate-links), headline (one sentence:
how many /intel candidates, what tops the list and why), warnings (array of anything a reader must
know before acting).`
}

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['outFile', 'lines', 'remarkClean', 'headline'],
  properties: {
    outFile: { type: 'string' },
    lines: { type: 'integer' },
    remarkClean: { type: 'boolean' },
    headline: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
}

// ── Run ─────────────────────────────────────────────────────────────────────
phase('Enumerate')
const enumRes = await agent(enumeratePrompt(), { label: `enumerate:${NOTE_TYPE}`, phase: 'Enumerate', ...CHEAP, schema: ENUM_SCHEMA })
if (!enumRes) throw new Error('stale-npm-triage: enumeration failed — cannot proceed without a cohort')
log(`Cohort: ${enumRes.cohortSize} notes of type ${NOTE_TYPE} across ${enumRes.shardFiles.length} shards (run date ${enumRes.today})`)
if (enumRes.duplicateIdentifiers?.length) {
  log(`schema-validate returned ${enumRes.duplicateIdentifiers.length} duplicate identifier(s): ${enumRes.duplicateIdentifiers.join(', ')}`)
}

// Scan then resolve, per shard, with NO barrier between the two stages: a shard
// that finishes reading starts hitting the registry while its siblings are still
// reading. The stages are I/O-bound on different resources, so serialising them
// across shards would waste most of the wall-clock.
const shardResults = await pipeline(
  enumRes.shardFiles,
  (shardFile, _item, i) => agent(scanPrompt(shardFile, i), { label: `scan:shard-${i}`, phase: 'Scan', ...CHEAP, schema: SHARD_SCHEMA }),
  (scanRes, shardFile, i) => agent(resolvePrompt(shardFile, i), { label: `resolve:shard-${i}`, phase: 'Resolve', ...CHEAP, schema: SHARD_SCHEMA })
    .then(reg => ({ index: i, scan: scanRes, registry: reg }))
)

// DERIVE the health of a stage rather than trusting the agent's self-reported
// `ok`: `requested` and `written` sit in the same object, so a stage that wrote
// fewer rows than it was given is detectable here without asking anyone.
const stageOk = (/** @type {{ ok?: boolean, requested?: number, written?: number } | null | undefined} */ s) =>
  !!s?.ok && typeof s.requested === 'number' && typeof s.written === 'number' && s.requested === s.written

/** @type {string[]} */
const shardProblems = []
shardResults.forEach((r, i) => {
  if (!r) { shardProblems.push(`shard-${i}: returned nothing — its notes are NOT in the results`); return }
  if (!stageOk(r.scan)) shardProblems.push(`shard-${r.index}: scan unhealthy (ok=${r.scan?.ok}, ${r.scan?.requested}→${r.scan?.written}) — ${r.scan?.summary ?? 'no summary'}`)
  if (!stageOk(r.registry)) shardProblems.push(`shard-${r.index}: resolve unhealthy (ok=${r.registry?.ok}, ${r.registry?.requested}→${r.registry?.written}) — ${r.registry?.summary ?? 'no summary'}`)
})
if (!enumRes.splitVerified) shardProblems.push('shard split did not verify against the cohort line count — some ids may never have been scanned')
const okShards = shardResults.filter(r => r && stageOk(r.scan) && stageOk(r.registry))
log(`Shards: ${okShards.length}/${enumRes.shardFiles.length} completed both stages cleanly`)
for (const p of shardProblems) log(p)

// Barrier is genuine here: scoring and the completeness gate need every row.
phase('Rank')
const rankRes = await agent(rankPrompt(enumRes.today), { label: 'rank', phase: 'Rank', ...CHEAP, schema: RANK_SCHEMA })
if (!rankRes) throw new Error('stale-npm-triage: ranking step returned nothing — no report can be trusted')
// Exit 2 means the inputs were unreadable: nothing was computed, so there is no
// report to write and the audit phases would be reading stale or absent files.
if (rankRes.exitCode === 2) {
  throw new Error(`stale-npm-triage: rank.mjs could not read its inputs (exit 2) — ${rankRes.summary ?? 'no detail'}. Nothing was computed; not writing a report.`)
}

// An absent gate is not a passing gate. `Object.entries(undefined ?? {})` yields an
// empty failedGates list that reads downstream exactly like "every check held", so
// the absence has to be fatal here rather than inferred anywhere later.
const gateEntries = Object.entries(rankRes.gate ?? {})
if (gateEntries.length === 0) {
  throw new Error('stale-npm-triage: the ranking step reported no gate object — the run is UNVERIFIED, not clean. Refusing to continue to the report.')
}
const failedGates = gateEntries.filter(([, v]) => v === false).map(([k]) => k)

// Derived, not taken on the agent's word. `gateOk` is a cheap-tier agent's own
// summary of two facts it also reports individually; when the three disagree the
// two concrete ones win. The rank prompt already has to ask the agent not to
// report gateOk true "because the tables look plausible" — this is what makes
// that instruction unnecessary rather than merely hopeful.
const gateOk = rankRes.exitCode === 0 && failedGates.length === 0
if (gateOk !== rankRes.gateOk) {
  log(`Rank: agent self-reported gateOk=${rankRes.gateOk} but exitCode=${rankRes.exitCode} and ${failedGates.length} failed sub-check(s) — using the derived value ${gateOk}`)
}
log(`Rank: downloads measured for ${typeof rankRes.downloadsOkRate === 'number' ? `${Math.round(rankRes.downloadsOkRate * 100)}%` : 'an unreported share'} of eligible rows — below 90% the reach tie-break is not trustworthy`)
log(`Rank: gate ${gateOk ? `PASSED (${gateEntries.length}/${gateEntries.length} sub-checks held)` : `FAILED (${failedGates.join(', ') || `exit ${rankRes.exitCode}`})`} — ${rankRes.classified}/${rankRes.cohortSize} classified; ${JSON.stringify(rankRes.actionCounts)}`)

phase('Audit')
const [critic, verifier, completeness] = await parallel([
  () => agent(criticPrompt(), { label: 'audit:ordering', phase: 'Audit', ...SMART, schema: CRITIC_SCHEMA }),
  () => agent(verifierPrompt(), { label: 'audit:top-rows', phase: 'Audit', ...SMART, schema: VERIFIER_SCHEMA }),
  () => agent(completenessPrompt(), { label: 'audit:completeness', phase: 'Audit', ...CHEAP, schema: COMPLETENESS_SCHEMA }),
])
// Recompute rather than trust: `refutedCount` is derivable from `rows`, and a
// dead agent must be distinguishable from one that found nothing.
const refutedDerived = Array.isArray(verifier?.rows) ? verifier.rows.filter(x => x.verdict === 'refuted').length : null
log(`Audit: critic=${critic?.verdict ?? 'DID NOT RUN'}; verifier refuted ${refutedDerived ?? 'DID NOT RUN'} of ${verifier?.rows?.length ?? '?'}; completeness consistent=${completeness?.consistent ?? 'DID NOT RUN'}`)

phase('Report')
const report = await agent(
  // The derived `gateOk` overrides the rank agent's self-report before the object
  // reaches the report agent — otherwise the report is written from the one value
  // in `rankRes` that nothing verified, while the two facts that decide it
  // (`exitCode`, `failedGates`) sit right beside it unused.
  reportPrompt(enumRes.today, enumRes, { ...rankRes, gateOk }, critic, verifier, completeness, { failedGates, shardProblems, okShards: okShards.length, totalShards: enumRes.shardFiles.length }),
  { label: 'report', phase: 'Report', ...SMART, schema: REPORT_SCHEMA }
)

return {
  outFile: report?.outFile ?? OUT_FILE,
  runDate: enumRes.today,
  noteType: NOTE_TYPE,
  cohortSize: enumRes.cohortSize,
  duplicateIdentifiers: enumRes.duplicateIdentifiers ?? [],
  shards: { total: enumRes.shardFiles.length, clean: okShards.length, problems: shardProblems },
  censusFile: CENSUS_FILE || null,
  gateOk,
  // A field nobody reads is worse than one nobody produces: `remarkClean` was
  // required of the report agent and then dropped on the floor, so a malformed
  // table could reach the caller silently. `null` = the report step did not run.
  remarkClean: report ? (report.remarkClean ?? null) : null,
  failedGates,
  exitCode: rankRes.exitCode ?? null,
  actionCounts: rankRes.actionCounts,
  audit: {
    // `null` distinguishes "did not run" from a real result throughout.
    orderingVerdict: critic?.verdict ?? null,
    orderingOneLine: critic?.oneLine ?? null,
    topRowsChecked: Array.isArray(verifier?.rows) ? verifier.rows.length : null,
    topRowsRefuted: refutedDerived,
    completenessConsistent: completeness?.consistent ?? null,
    agentsThatDidNotRun: [critic ? null : 'ordering-critic', verifier ? null : 'top-rows-verifier', completeness ? null : 'completeness'].filter(Boolean),
  },
  report: report ?? null,
}
