export const meta = {
  name: 'repair-links',
  description: 'Propose (never apply) repairs for dangling wiki-links in a Basic Memory vault',
  whenToUse: 'When dangling [[wiki-links]] need triaging into safe repairs, judgement calls, and rejects. Produces a dry-run report only — applying anything is a separate, explicitly-approved step.',
  phases: [
    { title: 'Collect', detail: 'run mdwv graph-lint, classify every candidate by separator' },
    { title: 'Judge', detail: 'one agent per ambiguous candidate chunk, reading the source note' },
    { title: 'Verify', detail: 'adversarially refute every proposed repair' },
    { title: 'Report', detail: 'synthesise the dry-run report' },
  ],
}

// Dangling-wiki-link repair proposal, as a workflow.
//
// SAFETY, non-negotiable and repeated in every agent prompt: this workflow
// NEVER edits a note. Basic Memory binds a relation when the SOURCE note is
// parsed, so a repair must go through the `edit_note` MCP tool, and that is a
// separate step the user approves explicitly. Everything here is a proposal.
//
// The triage rests on one measured rule. This vault titles notes
// `<Name> - <Description>`, so a short-form link is safe to repair exactly when
// the candidate title extends the written target at a DESCRIPTIVE separator.
// Measured over 185 real candidates: 123 (66%) descriptive-suffix, correct in
// every sample; 48 (26%) plain-space continuation, genuinely mixed; 14 (8%)
// bare token continuation, WRONG in every sample and naming a different package
// (`npm-babel` -> `npm-babel-plugin-htm`). Length is not a usable proxy —
// `WordPress` is 18% of its correct candidate, `brew-sdl2` is 56% of its wrong
// one — so the separator does the work a ratio threshold gets backwards.
//
// Agents are therefore spent only where the deterministic rule is genuinely
// undecided: the plain-space middle band. The safe band is spot-checked rather
// than fully judged, because a rule validated on samples can still be wrong,
// and the reject band is verified too — a rule that over-rejects is also a bug.

const VAULT = args?.vaultRoot ?? '/Users/pelle/basic-memory-worktrees/claude-index-committable'
const MDWV = args?.mdwvBin ?? '/Users/pelle/Sites/ai/md-wiki-vec/bin/mdwv.js'
const OUT = args?.outDir ?? '/tmp/repair-links'
const JUDGE_CHUNKS = args?.judgeChunks ?? 6
const SPOTCHECK = args?.spotcheck ?? 12

const NEVER_WRITE =
  'HARD CONSTRAINT: this is a read-only proposal pass. Do NOT call any Basic Memory write tool ' +
  '(write_note, edit_note, move_note, delete_note). Do NOT edit any file under the vault. Do NOT ' +
  'call advisor(). If you think something must be written, say so in your output instead of doing it.'

const RULE =
  'Classification rule, applied to what the candidate title adds AFTER the written target:\n' +
  '  - "descriptive-suffix": the remainder begins with " - ", " — ", " – ", ": " or " (". SAFE.\n' +
  '  - "word-continuation": the remainder begins with a space but no separator. AMBIGUOUS.\n' +
  '  - "token-continuation": the remainder does not begin with whitespace at all. REJECT — these\n' +
  '    name a DIFFERENT entity (npm-babel -> npm-babel-plugin-htm is two different packages).'

const COLLECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reportPath', 'counts', 'ambiguous', 'rejected', 'safeSample'],
  properties: {
    reportPath: { type: 'string', description: 'Path to the full classified NDJSON written to disk' },
    counts: {
      type: 'object',
      additionalProperties: false,
      required: ['unresolvedTotal', 'missingTotal', 'titleMismatch', 'descriptiveSuffix', 'wordContinuation', 'tokenContinuation'],
      properties: {
        unresolvedTotal: { type: 'integer' },
        missingTotal: { type: 'integer' },
        titleMismatch: { type: 'integer' },
        descriptiveSuffix: { type: 'integer' },
        wordContinuation: { type: 'integer' },
        tokenContinuation: { type: 'integer' },
      },
    },
    ambiguous: {
      type: 'array',
      description: 'Every word-continuation candidate — the band needing judgement',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['target', 'source', 'candidateTitle', 'candidatePermalink'],
        properties: {
          target: { type: 'string' },
          source: { type: 'string' },
          candidateTitle: { type: 'string' },
          candidatePermalink: { type: 'string' },
        },
      },
    },
    rejected: {
      type: 'array',
      description: 'Every token-continuation candidate — proposed for rejection',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['target', 'source', 'candidateTitle'],
        properties: {
          target: { type: 'string' },
          source: { type: 'string' },
          candidateTitle: { type: 'string' },
        },
      },
    },
    safeSample: {
      type: 'array',
      description: 'A sample of descriptive-suffix candidates, for spot-checking the rule',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['target', 'source', 'candidateTitle', 'candidatePermalink'],
        properties: {
          target: { type: 'string' },
          source: { type: 'string' },
          candidateTitle: { type: 'string' },
          candidatePermalink: { type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['target', 'source', 'decision', 'reason'],
        properties: {
          target: { type: 'string' },
          source: { type: 'string' },
          decision: {
            type: 'string',
            enum: ['apply', 'reject', 'needs-human'],
            description: 'apply = the candidate is the note the author meant; reject = it is not; needs-human = genuinely undecidable from the evidence',
          },
          reason: { type: 'string', description: 'One sentence, citing what in the source note decided it' },
          suggestedAlternative: { type: 'string', description: 'A better target title, if one is apparent' },
        },
      },
    },
  },
}

const REFUTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['refuted', 'survivors', 'summary'],
  properties: {
    refuted: {
      type: 'array',
      description: 'Proposals this pass believes are WRONG',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['target', 'source', 'why'],
        properties: {
          target: { type: 'string' },
          source: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    survivors: { type: 'integer', description: 'How many proposals this pass could not refute' },
    summary: { type: 'string' },
  },
}

/**
 * Split a list into n roughly-equal chunks, preserving order.
 *
 * Deterministic on purpose: the workflow must be resumable, and a chunking that
 * varies between runs would invalidate every cached agent result.
 */
function chunk (items, n) {
  const out = []
  const size = Math.ceil(items.length / n) || 1
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// ---------------------------------------------------------------- Collect

phase('Collect')

const collected = await agent(
  `Run md-wiki-vec's graph-lint over a Basic Memory vault and classify its repair candidates.

${NEVER_WRITE}

STEP 1 — run, from the vault root:
    cd ${VAULT} && node ${MDWV} graph-lint --limit 2000 --format json

The JSON has \`buckets.missing_target\`, \`buckets.phantom_edge\`,
\`buckets.title_mismatch\`, \`buckets.schema_template_noise\`, and a \`summary\`
with \`unresolved_total\`, \`hygiene_total\`, \`missing_total\`.

Each \`title_mismatch\` entry is \`{target, source, candidate_title, candidate_permalink}\`
where \`target\` is the link text the author actually wrote and \`candidate_title\`
is an existing note title that \`target\` is a strict prefix of.

STEP 2 — classify EVERY title_mismatch entry.

${RULE}

Compute the remainder as \`candidate_title.slice(target.length)\`. Do this in a
script (mkdir -p ${OUT} and write one there), not by hand — there are ~185
entries and hand-classification is exactly the judgement call this rule exists
to remove.

STEP 3 — write the full classified set as NDJSON to ${OUT}/classified.ndjson,
one object per line: {target, source, candidateTitle, candidatePermalink, class}.

STEP 4 — return: the report path; the counts; EVERY word-continuation entry;
EVERY token-continuation entry; and the first ${SPOTCHECK} descriptive-suffix
entries as a spot-check sample.

If graph-lint fails, or the vault has no committed index, say so plainly and
return zero counts rather than inventing entries. An empty result is a fact
worth reporting; a fabricated one is not.`,
  { label: 'collect:graph-lint', phase: 'Collect', schema: COLLECT_SCHEMA }
)

if (!collected || collected.counts.titleMismatch === 0) {
  log('graph-lint returned no title_mismatch candidates — nothing to propose.')
  return { proposals: [], rejected: [], note: 'no candidates' }
}

const c = collected.counts
log(`${c.unresolvedTotal} unresolved · ${c.missingTotal} missing targets · ${c.titleMismatch} title_mismatch`)
log(`safe ${c.descriptiveSuffix} · ambiguous ${c.wordContinuation} · reject ${c.tokenContinuation}`)

// ---------------------------------------------------------------- Judge

phase('Judge')

// Only the ambiguous band gets a judge. Chunked rather than one-agent-per-item:
// each judgement needs the SOURCE note read, and several candidates usually
// share a source, so chunking lets one read serve several decisions.
const batches = chunk(collected.ambiguous, JUDGE_CHUNKS)

const judged = (await parallel(batches.map((batch, i) => () =>
  agent(
    `Decide, for each candidate below, whether the candidate note is the one the author meant.

${NEVER_WRITE}

These are wiki-links that do not resolve. Each has a candidate whose title
begins with the written target followed by a SPACE (no descriptive separator),
which is the band the deterministic rule cannot settle. Some are right
("Browserify" -> "Browserify 2011 - Node.js Modules for the Browser"), some are
wrong ("Claude Code" -> "Claude Code /design-sync and the DesignSync Tool", where
the link means the product and the candidate is one narrow feature note).

METHOD — for each candidate:
1. Read the SOURCE note in the vault (${VAULT}) and find the line containing the
   link. The surrounding sentence and the relation verb are the evidence.
2. Ask: does the candidate note describe THE SAME THING the source is pointing
   at, or merely something whose title starts the same way?
3. A candidate that narrows the subject (product -> one feature, tool -> one
   sub-topic) is a REJECT even though the prefix matches.
4. If a different existing note is obviously the right target, name it in
   \`suggestedAlternative\`. Search the vault to check before naming one.

Default to \`needs-human\` when the evidence does not decide it. A wrong "apply"
silently rewires the knowledge graph; a "needs-human" costs someone thirty
seconds. The asymmetry is the whole point.

CANDIDATES (batch ${i + 1} of ${batches.length}):
${JSON.stringify(batch, null, 1)}`,
    { label: `judge:batch-${i + 1}`, phase: 'Judge', schema: VERDICT_SCHEMA }
  )
))).filter(Boolean)

const verdicts = judged.flatMap((j) => j.verdicts ?? [])
const accepted = verdicts.filter((v) => v.decision === 'apply')
const needsHuman = verdicts.filter((v) => v.decision === 'needs-human')
log(`judged ${verdicts.length}: ${accepted.length} apply · ${needsHuman.length} needs-human · ${verdicts.length - accepted.length - needsHuman.length} reject`)

// ---------------------------------------------------------------- Verify

phase('Verify')

// Three DIFFERENT lenses, not three copies of one skeptic. Redundancy only
// cancels error when the agents can fail independently, and identical prompts
// share one blind spot.
const LENSES = [
  {
    key: 'rule',
    prompt:
      `Attack the CLASSIFICATION RULE itself, not individual entries.\n\n${RULE}\n\n` +
      `Read ${OUT}/classified.ndjson. Find descriptive-suffix entries where the rule says SAFE but the ` +
      `repair would be WRONG, and token-continuation entries where it says REJECT but the repair would be ` +
      `RIGHT. Both directions matter: a rule that over-rejects is also a bug. Here is the spot-check ` +
      `sample the collector returned:\n${JSON.stringify(collected.safeSample, null, 1)}`,
  },
  {
    key: 'accepted',
    prompt:
      'Attack the ACCEPTED judgements below. For each, argue the candidate is NOT the note the author ' +
      'meant. Read the source note in the vault for evidence. Refute anything where the candidate ' +
      'narrows the subject rather than naming it.\n\n' +
      JSON.stringify(accepted, null, 1),
  },
  {
    key: 'rejected',
    prompt:
      'Attack the REJECTIONS below — these are candidates the deterministic rule threw out because the ' +
      'candidate title continues the target with no space. Argue that any of them is actually a correct ' +
      'repair that is being wrongly discarded. Check whether the target and candidate really are ' +
      'different entities.\n\n' +
      JSON.stringify(collected.rejected, null, 1),
  },
]

const refutations = (await parallel(LENSES.map((lens) => () =>
  agent(
    `You are an adversarial reviewer. Your job is to REFUTE, not confirm. Default to "refuted" when uncertain.

${NEVER_WRITE}

Vault root: ${VAULT}

${lens.prompt}

Report only what you can actually support with evidence from a note you read. "I could not refute any of
these" is a valid and useful answer — do not manufacture objections to look thorough.`,
    { label: `refute:${lens.key}`, phase: 'Verify', schema: REFUTE_SCHEMA }
  )
))).filter(Boolean)

const refutedKeys = new Set(
  refutations.flatMap((r) => (r.refuted ?? []).map((x) => `${x.source}|${x.target}`))
)
const survivingAccepted = accepted.filter((v) => !refutedKeys.has(`${v.source}|${v.target}`))
log(`refuted ${refutedKeys.size} proposal(s); ${survivingAccepted.length} of ${accepted.length} judged repairs survive`)

// ---------------------------------------------------------------- Report

phase('Report')

const report = await agent(
  `Write the dry-run repair report to ${OUT}/REPORT.md. Write ONLY that file.

${NEVER_WRITE} — writing the report file itself is the single exception.

The report is read by a human deciding what to apply, so it must make the
REJECTED and UNCERTAIN material as visible as the safe material. A report that
buries them reads as "all clear" and that is the failure this whole pipeline
exists to prevent.

Structure it as:
1. Headline counts: ${c.unresolvedTotal} unresolved links, ${c.missingTotal} distinct missing
   targets, ${c.titleMismatch} repair candidates.
2. SAFE — ${c.descriptiveSuffix} descriptive-suffix repairs. Say plainly that these were
   accepted by rule and only ${collected.safeSample.length} were spot-checked, so the band is
   not individually verified.
3. JUDGED — the ${accepted.length} accepted judgements, ${survivingAccepted.length} of which survived
   adversarial review. List every one that did NOT survive, with the reason.
4. NEEDS HUMAN — ${needsHuman.length} the judges declined to decide, with their reasons.
5. REJECTED — ${c.tokenContinuation} candidates whose title continues the target with no space.
   Name each one and its wrong candidate. These are the dangerous ones precisely
   because they look plausible.
6. Adversarial findings, verbatim, including any that attacked the RULE rather
   than an entry.
7. A short "what to do next" section. It must state that nothing has been
   applied, that applying goes through the edit_note MCP tool and not file
   writes, and that a repair must replace EVERY occurrence of the link in a note
   — 88 notes in this vault repeat the same wiki-link inside one ## Relations
   section, so a first-occurrence-only edit leaves the rest dangling.

DATA
Counts: ${JSON.stringify(c)}
Surviving accepted: ${JSON.stringify(survivingAccepted, null, 1)}
Needs human: ${JSON.stringify(needsHuman, null, 1)}
Rejected by rule: ${JSON.stringify(collected.rejected, null, 1)}
Refutations: ${JSON.stringify(refutations, null, 1)}

Return the absolute path you wrote, and a five-line summary.`,
  { label: 'report:synthesise', phase: 'Report' }
)

return {
  reportPath: `${OUT}/REPORT.md`,
  classifiedPath: collected.reportPath,
  counts: c,
  accepted: survivingAccepted.length,
  needsHuman: needsHuman.length,
  rejected: collected.rejected.length,
  refuted: refutedKeys.size,
  summary: report,
}
