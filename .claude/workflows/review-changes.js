export const meta = {
  name: 'review-changes',
  description: 'Local multi-agent code review: fan out the pr-review-toolkit spectrum over a diff, adversarially verify each dimension’s findings',
  whenToUse: 'A high-stakes pre-tag / pre-merge review of a branch or diff when a single-context skim is not enough: the full pr-review-toolkit roster (correctness, type design, silent failures, comments, tests, simplification), each finding refuted by an independent skeptic before it survives. Optionally pass args.context to frame the review (or omit it — a Sonnet recon step auto-drafts the framing); args.base / args.head scope the diff.',
  phases: [
    { title: 'Scope', detail: 'auto-infer review context when none is supplied' },
    { title: 'Review', detail: 'pr-review-toolkit dimensions over the diff' },
    { title: 'Verify', detail: 'adversarial skeptic refutes each dimension’s findings' },
  ],
}

// ── review-changes ──────────────────────────────────────────────────────────
// Local, standalone, multi-agent code review. Fans out the pr-review-toolkit
// spectrum over a diff, then verifies each dimension's findings with an
// independent adversarial skeptic (default-to-REFUTED) so plausible-but-wrong
// findings do not survive. Returns per-dimension { findings, verdicts }.
//
// INVOKE:
//   Workflow({ name: 'review-changes', args: {
//     base:    'main',        // diff base (branch/commit/tag); default 'main'
//     head:    'HEAD',        // diff head; default 'HEAD'
//     context: '...prose...', // OPTIONAL: what changed + its PRIMARY RISK + scope map.
//                             //   Omit it and a Sonnet recon step auto-drafts the framing.
//     only:    ['code-reviewer', 'pr-test-analyzer'], // optional roster subset
//     focus:   { 'code-reviewer': '...override...' },  // optional per-dimension focus
//     verify:  true,          // run the adversarial verify pass; default true
//   }})
//
// DEPENDS ON the `pr-review-toolkit` plugin (the `pr-review-toolkit:*` agent types).
//
// PROVISIONAL HOME. This lives in vp-knowledge's .claude/workflows/ for now, but
// its natural long-term home is the sibling vp-beads plugin, co-located with the
// `swarm-wave` skill: swarm-wave already owns the multi-agent-review-gate domain
// (its post-wave-gate runs a narrower 2-reviewer + `npm run check` gate), and this
// is the richer, sprint-decoupled generalization of that pattern. Tracked as an
// Extraction Candidate in SYNERGY-vp-beads.md. The only couplings that must travel
// are the `pr-review-toolkit:*` agent types and the `.claude/workflows/` location —
// both exist identically in vp-beads — so keep this vp-knowledge-agnostic and the
// move stays a straight file relocation.
// ────────────────────────────────────────────────────────────────────────────

const A = args || {}
const BASE = typeof A.base === 'string' && A.base ? A.base : 'main'
const HEAD = typeof A.head === 'string' && A.head ? A.head : 'HEAD'
const VERIFY = A.verify !== false
const ONLY = Array.isArray(A.only) && A.only.length ? A.only : null
const FOCUS = (A.focus && typeof A.focus === 'object') ? A.focus : {}
// Context frames the whole review — the `primary_risk` line is what points the six
// reviewers. If the caller supplied one, use it verbatim (guided path, unchanged).
// Otherwise a single Sonnet reconnaissance agent drafts it from the diff + repo
// conventions — reconnaissance is Sonnet's lane, and reviewers cross-check its
// framing against the real diff, so it is never authoritative alone. Falls back to
// a generic instruction if that agent dies.
const GENERIC_CONTEXT = 'No project context was supplied — infer the change’s shape and its primary risk from the diff itself and from the repository’s CLAUDE.md / AGENTS.md house conventions.'

const CONTEXT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'what changed and why (intent, 2-4 sentences) — not a file list' },
    scope_map: { type: 'string', description: 'surface breakdown: code vs prose/config, highest-risk files, mechanical (rename/move/format) vs substantive' },
    primary_risk: { type: 'string', description: 'the single most important thing reviewers should focus on — the change most likely to hide a real defect' },
  },
  required: ['summary', 'primary_risk'],
}

let CONTEXT
if (typeof A.context === 'string' && A.context) {
  CONTEXT = A.context
} else {
  log('No args.context supplied — running a Sonnet reconnaissance step to frame the review.')
  const recon = await agent(
    `You are the reconnaissance step of a local multi-agent code review. No human-supplied context was provided, so your job is to FRAME the change for six downstream reviewers — NOT to review it.

Inspect the change:
- \`git diff --stat ${BASE} ${HEAD}\` (if empty, use \`git diff --stat HEAD\` — uncommitted work)
- \`git log --oneline ${BASE}..${HEAD}\` for intent
- read the repository's CLAUDE.md / AGENTS.md for what this project is and its house conventions
- open a few of the most-changed files if their purpose is not clear from the names

Return via the schema:
- summary: 2-4 sentences on WHAT changed and WHY (the intent), not a file list.
- scope_map: the surface breakdown — code vs prose/docs/config, the handful of highest-risk files, and which changes are mechanical (renames/moves/formatting) vs substantive.
- primary_risk: the SINGLE most important thing the reviewers should focus on — the change most likely to hide a real defect. Be specific and opinionated; this one line points six reviewers.

Do NOT list defects or review the code — only frame it. Do NOT call advisor().`,
    { label: 'auto-context', phase: 'Scope', agentType: 'general-purpose', model: 'sonnet', schema: CONTEXT_SCHEMA },
  )
  CONTEXT = recon
    ? `${recon.summary}\n\nSCOPE MAP:\n${recon.scope_map || '(not provided)'}\n\nPRIMARY RISK (auto-inferred by the reconnaissance step — a hypothesis to focus on, not gospel): ${recon.primary_risk}`
    : GENERIC_CONTEXT
}

const ALL_DIMENSIONS = [
  {
    label: 'code-reviewer',
    agentType: 'pr-review-toolkit:code-reviewer',
    focus: 'CORRECTNESS & LOGIC. Read every changed hunk AND its enclosing function — a bug in an unchanged line of a touched function is in scope (the change re-exposes or fails to fix it). Hunt inverted/wrong conditions, off-by-one, null/undefined deref, missing await, falsy-zero checks, wrong-variable copy-paste, swallowed errors, unescaped regex metachars. For every DELETED or replaced line, name the invariant it enforced and find where the new code re-establishes it — a dropped guard, validation, or behavior is the highest-value catch. Trace callers and callees of each changed function for a broken precondition, a changed return shape, or a new exception. Check the diff against the repository’s CLAUDE.md / AGENTS.md conventions and flag clear violations (quote the rule).',
  },
  {
    label: 'type-design-analyzer',
    agentType: 'pr-review-toolkit:type-design-analyzer',
    focus: 'TYPE DESIGN of the changed typed code. Look for an invariant that should be encoded in a type but is left to hand-maintained convention, weakly-typed data at parse / IO boundaries (an `any` where `unknown` + narrowing belongs), and types that fail to make illegal states unrepresentable. Concentrate on the code files; skip pure prose / markdown.',
  },
  {
    label: 'silent-failure-hunter',
    agentType: 'pr-review-toolkit:silent-failure-hunter',
    focus: 'SILENT FAILURES & ERROR HANDLING. Hunt swallowed exceptions, empty or re-throw-less catch blocks, and fallbacks that mask a real failure. Especially: a check, guard, or test that can PASS VACUOUSLY after the change — reporting green while measuring nothing (a repointed path that no longer resolves, an allowlist that no longer suppresses anything, an assertion that can never fail). A check that no longer exercises what it claims is the worst outcome here.',
  },
  {
    label: 'comment-analyzer',
    agentType: 'pr-review-toolkit:comment-analyzer',
    focus: 'COMMENT / DOC-STRING ACCURACY across both code and prose. Flag every comment or doc-string that now LIES about the thing it annotates after the change. Highest-value targets: "keep in sync" / "mirrored in X" / "update both" markers the change invalidated or left pointing at a moved, renamed, or deleted target; and doc-strings describing an old signature, name, or behavior.',
  },
  {
    label: 'pr-test-analyzer',
    agentType: 'pr-review-toolkit:pr-test-analyzer',
    focus: 'TEST COVERAGE. Assess whether the new or changed behavior is actually covered, and whether any test passes VACUOUSLY (asserts nothing that would fail if the behavior regressed, or hard-codes a spot-check where a derived invariant would be stronger). Name the single missing test that would have caught THIS change’s specific risk class. Distinguish an inherent-format gap (prose / config with no runtime) from a real coverage hole.',
  },
  {
    label: 'code-simplifier',
    agentType: 'pr-review-toolkit:code-simplifier',
    focus: 'SIMPLIFICATION — PRESERVE ALL FUNCTIONALITY (never propose cutting a capability). Flag duplication the change adds or leaves behind, over-complex control flow with a simpler equivalent, redundant or derivable state, and dead / vestigial code. Name the simpler form. Respect a deliberate anti-flatten or per-case authoring choice the change’s design calls for — do not flag intentional structure as duplication.',
  },
]

const DIMENSIONS = ONLY ? ALL_DIMENSIONS.filter((d) => ONLY.includes(d.label)) : ALL_DIMENSIONS

const PREAMBLE = `You are one dimension of a local multi-agent code review.

CHANGE UNDER REVIEW: run \`git diff ${BASE} ${HEAD}\` for the committed diff. If that range is empty, fall back to \`git diff HEAD\` (uncommitted working-tree changes) and say that you did. Read the enclosing context of any hunk you flag — open the full file when needed. For a deletion, retrieve the prior content with \`git show ${BASE}:<path>\`.

PROJECT CONTEXT:
${CONTEXT}

Report ONLY defects you can tie to a concrete failure scenario (a specific input or state → a wrong outcome). Skip style nits with no consequence. An empty findings array is an honest, valid result. Do NOT call advisor().`

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          file: { type: 'string', description: 'repo-relative path' },
          line: { type: 'number', description: '1-indexed line, or 0 if not line-anchored' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          category: { type: 'string', description: 'short kebab-case slug' },
          summary: { type: 'string', description: 'one-sentence statement of the defect' },
          failure_scenario: { type: 'string', description: 'concrete input/state -> wrong outcome' },
        },
        required: ['file', 'line', 'severity', 'category', 'summary', 'failure_scenario'],
      },
    },
    dimension_assessment: { type: 'string', description: 'one-paragraph overall read of this dimension' },
  },
  required: ['findings', 'dimension_assessment'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          finding_summary: { type: 'string', description: 'echo the finding being judged' },
          verdict: { type: 'string', enum: ['CONFIRMED', 'REFUTED', 'UNCERTAIN'] },
          adjusted_severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'none'] },
          reasoning: { type: 'string', description: 'concrete evidence for the verdict, plus any refinement the finding implies (a better fix, or a real-but-lower-severity variant)' },
        },
        required: ['finding_summary', 'verdict', 'adjusted_severity', 'reasoning'],
      },
    },
  },
  required: ['verdicts'],
}

const reviewStage = (d) => agent(
  `${PREAMBLE}\n\n=== YOUR DIMENSION ===\n${FOCUS[d.label] || d.focus}\n\nReturn your findings via the structured schema, most-severe first.`,
  { label: `review:${d.label}`, phase: 'Review', agentType: d.agentType, schema: FINDINGS_SCHEMA },
)

const verifyStage = (review, d) => {
  const findings = review?.findings ?? []
  const base = { dimension: d.label, assessment: review?.dimension_assessment ?? '(no result)', findings, verdicts: [] }
  if (!VERIFY || findings.length === 0) return base
  return agent(
    `You are an ADVERSARIAL verifier for a local multi-agent code review (diff: \`git diff ${BASE} ${HEAD}\`; fall back to \`git diff HEAD\` if that range is empty). A "${d.label}" reviewer produced the findings below. Your job is to REFUTE each one.\n\nFor EACH finding: reproduce it against the actual code (\`git diff\`, \`git show ${BASE}:<path>\`, read the current file). A finding is CONFIRMED only if you can state a concrete input or state that triggers the defect in the code AS IT IS. If you cannot — or it is handled elsewhere, is intentional per the change’s design, is already caught by an existing check / test / gate, or is a style preference with no failure — mark it REFUTED. Default to REFUTED under uncertainty; use UNCERTAIN only when the evidence genuinely conflicts. Set adjusted_severity to your calibrated severity, or "none" if REFUTED. When you refute, still note any refinement the finding implies (a better fix, or a real-but-lower-severity variant) in your reasoning. Do NOT call advisor().\n\nFINDINGS TO VERIFY (JSON):\n${JSON.stringify(findings, null, 2)}`,
    { label: `verify:${d.label}`, phase: 'Verify', schema: VERDICT_SCHEMA },
  ).then((v) => ({ ...base, verdicts: v?.verdicts ?? [] }))
}

const results = VERIFY
  ? await pipeline(DIMENSIONS, reviewStage, verifyStage)
  : await parallel(DIMENSIONS.map((d) => () => Promise.resolve(reviewStage(d)).then((r) => verifyStage(r, d))))

return results.filter(Boolean)
