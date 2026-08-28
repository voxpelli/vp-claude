# stale-npm-triage — design record and deferred findings (2026-08-05)

A Workflow-tool sweep of the `npm_package` Basic Memory cohort that produces one
prioritised markdown report: what most needs a fresh `/intel`, what needs a
one-line `[version]` slot instead, and what could not be assessed at all.

Built in one session, reviewed by five adversarial agents, and **not yet run at
full scale**. This record exists because the most valuable output of that review
was a set of lessons and a set of *deliberately unfixed* findings, neither of
which survives in the code.

## Files

| Path | Role |
|---|---|
| `.claude/workflows/stale-npm-triage.js` | Orchestration: Enumerate → Scan → Resolve → Rank → Audit → Report |
| `.claude/workflows/stale-npm-triage/enumerate.mjs` | Cohort + schema-field view from one `bm tool schema-validate` call |
| `.claude/workflows/stale-npm-triage/scan-shard.mjs` | Per-note version + structural-compliance signals |
| `.claude/workflows/stale-npm-triage/registry-shard.mjs` | npm registry resolution (version, release date, downloads) |
| `.claude/workflows/stale-npm-triage/rank.mjs` | Action classes, scoring, the gate, table rendering |

Commits: `9b4f373` (lib), `0017a15` (workflow).

## How to run it

```
Workflow({ scriptPath: '<repo>/.claude/workflows/stale-npm-triage.js',
           args: { censusFile: '/tmp/npm-note-census-2026-08-04.tsv' } })
```

`censusFile` is `<noteTitle>\t<YYYY-MM-DD>` for the ecosystem directory. Without
it note-age scores 0 for every row **and** the directory reconciliation reports
a vacuous clean, so it is close to mandatory in practice. The staged file is a
prefix-based `npm/` listing captured 2026-08-04 — regenerate it via
`list_directory` when it ages out. Add `limit`/`shards` for a smoke run.

## Two lessons worth keeping

**A completeness gate must be able to fail.** The first version compared
`rows.length` against `cohort.length` where `rows` was built by iterating
`cohort` — a tautology true for any input. A 3-note cohort with *empty* scan and
registry files returned `gateOk: true`, exit 0. The workflow's own header called
this "the correctness-deciding step". It is now thirteen named sub-checks, each
of which can fail and each reported by name, with exit 2 (inputs unreadable)
distinct from exit 1 (an invariant failed). The count is derived at runtime
(`Object.keys(gate).length`), never written into a prompt as a literal — the
report is instructed to take M from the gate object's own keys. **Before trusting any gate, feed it
the null input and confirm it fails.**

**"Unmeasured" is an epistemic state, not a severity.** Ranking notes whose
version could not be read alongside notes with confirmed drift produced an
actively misleading table: seven notes that were *already current* topped the
list at 56–58 while a breaking `@ast-grep/cli` 0.44.1 → 0.45.0 — a devDependency
of this very repo — sat at rank 11. They are now separate tables, and
`unmeasured` splits three ways with three different remediations
(`no-version-recorded` → research; `version-in-wrong-slot` → copy from the
note's own `[version-history]`; `version-slot-malformed` → repair the existing
line).

A corollary worth stating: a reviewer diagnosed the second problem as "a real
extractor bug in `lib/bm-version-extract.mjs` — fix that before re-running".
That diagnosis was **wrong**. Reading the affected notes showed no `[version]`
slot and no header pipe at all; the extractor was correct and the *notes* were
out of contract. Acting on it would have meant editing fixture-tested shipped
code to accommodate non-compliant data.

## Deferred findings — not fixed, with revival triggers

These were raised by the review and consciously left. Each names what would make
it worth doing.

| Finding | Why deferred | Revival trigger |
|---|---|---|
| Drivers sit outside every gate (`.claude/workflows/**` is eslint- and ast-grep-ignored, outside `tsconfig.include`) | Fixing it touches checked config; two reviewers called it the real risk | Any second consumer of these drivers, or the first wrong-classification bug traced to an untyped row shape |
| No fixture self-test for `rank.mjs`'s decision chain | Same; the repo already tests `version-distance` and `bm-version-extract` this way | The first change to the action-class chain by anyone who did not write it |
| Relevance is a global proxy (weekly downloads); no project-manifest cross-reference | Mode B (`/knowledge-gaps` coverage) already owns manifest reading | A run whose top rows are all packages this user does not depend on |
| `contract.mjs` with discriminated unions for the NDJSON row shapes | Prototype scope; the discriminants (`status`, `upstreamState`) already exist | Adding a third producer, or a second ecosystem |
| Sharding moved into `enumerate.mjs` (would delete ~20 lines of prompt and two platform workarounds, and make `splitVerified` structurally true) | Works as-is; pure simplification | Next substantive edit to `enumeratePrompt` |
| Shared `pool()` / NDJSON helpers (duplicated across two drivers) | 12 duplicated lines; the rationale comment has already diverged between them | A third driver, or a bug fixed in one pool and not the other |
| Multi-package notes: only `packages[0]` is resolved | Reported per row as `extraPackages`, not silently dropped | A cohort where the count is material |
| Fourth-wall detection is report-only and scores nothing | Its false-positive rate over a full cohort is unmeasured | One full-cohort run's `fourthWallFlagged` list, eyeballed |
| Packument size cap biases release-date loss toward popular packages | Reported honestly per row (`dateState`) and marked `?` in the table | A cheaper release-date source than the full packument |

## Known limitations that belong in every report

- Weekly downloads are a **global** reach proxy — they say nothing about whether
  this user depends on the package.
- `classifyVersionDistance` labels a 1–2 minor gap `patch`, and does not extend
  the 0.x breaking-minor rule to 0.0.x (`0.0.66 → 0.0.69` scores as a patch).
- A `⚠` in the Documented column means the version came from a non-canonical
  frontmatter slot. Its *absence* only means the six-pattern extractor found a
  version — not necessarily in the `[version]` observation; `ranked.ndjson`'s
  `pattern` field records which of the six.
- A `?` on a score component means that component is 0 because the input was
  missing, not because the value was low.

## Unrelated finding: a third walker over the repo root

`vp-claude-70dn` (P1) records that `check:spec` walks untracked `_*` clone dirs
after `check:md` was fixed for the same class in `6337b6b`. There is a **third**
consumer that bead does not name: `eslint.config.js` has no `_*/` exclusion, so
`check:lint` did not merely report foreign findings — it *crashed* on a
TypeScript file in `_kimchi_tmp/` needing type information, producing zero
findings on this repo's own code.

The nine clone dirs were deleted 2026-08-05 (all `dirty=0`, `ahead=0`, no
stashes, public origins), which turned `npm run check` green — but the two
walkers still walk the repo root, so the next reference clone re-breaks both.
The exclusion fix is still outstanding for `check:spec` **and** `check:lint`.
