# tool-intel Next Generation — Design

**Date:** 2026-07-10 · **Status:** Synthesized from 2 proposals × 3 judging lenses · **Architecture:** Hybrid (user-decided): lean foreground single-tool path + Workflow-orchestrated batch haul + from-scratch `--verify`

---

## 1. Decision: winning proposal

**Winner: `tool-intel-minimal-change-redesign` (Proposal 1)** — panel scores **8 / 8.5 / 8** vs **5.5 / 6.5** for the workflow-native alternative (Proposal 2). A third proposal was never received (truncated input; all judges scored it 0 = "unreceived", not a demerit).

Why it wins, per the panel:

- **Guard compliance by construction, not re-verification** (judge 2, score 8.5): zero moved/renamed files keeps `check:plugin-load-paths`, `check:analytics-guidance`, `check:cohort-lockstep`, and `check:release-counts` green without touching any pinned surface.
- **Best tenet fit** (judge 1): fetch scripts reused verbatim as a deterministic zero-model-cost pre-pass (the honest answer to bead **8gcf** — only drifted notes get read); `upgrade-haul.md` stays canonical and is imported by reference, not rewritten (understanding before velocity); no `workflows/*.mjs` coupling to a young harness (lock-in resistance — the plugin stays pure markdown+JSON at runtime).
- **Best cost-visibility sequencing** (judge 3): the deterministic fetch pre-pass runs *before* Gate 1, so the user approves a small, concrete, already-pruned number (N operands → D drifted → D workers), with an actual-vs-estimated line building calibration trust.
- Proposal 2's genuine strengths — machine-guarded contracts, mechanical BM-gotcha validation, deeper guard awareness — are **graftable without its costs** (executable orchestration runtime, two contract-identical execution paths, an extra Opus judge layer, a big-bang 789→300-line SKILL.md rewrite, and a semver framing that inverts this repo's convention: under vp-claude-p25u precedent, additive ships as **patch**, minor signals breaking).

## 2. Grafts applied (from Proposal 2, per panel consensus)

| # | Graft | Closes |
|---|-------|--------|
| G1 | `lib/haul-contract.mjs` + `scripts/check-haul-contract.mjs`: outcome-vocabulary enum + triage bucketing as tested JS, lockstep-checked against `upgrade-haul.md` and `haul-workflow.md` prose | Winner's own risk #1 — re-instantiating the **bf73** hand-mirrored-prose class ([crystallization](https://hf.co/papers/2607.07052)) |
| G2 | Mechanical observation-line lint before pre-write preview: reject `[[` (spurious-relation mint), `](` + trailing parenthetical (silent observation drop), non-bare URLs | Winner's risk #9 — BM data-loss gotchas enforced by prompt convention only (platform-gotcha friction items) |
| G3 | Absorb bead **y40** now: bare `github.com/<org>/<repo>` URLs probed against formulae.brew.sh / cask.json / marketplace.json to infer ecosystem; ambiguous → `class-ambiguous`, never guessed | Bead y40 (adapter-local, guard-neutral) |
| G4 | Admission-throttle instant-failure = **retryable-with-backoff**, never `FAILED[reason]` (workers are read-only → retry idempotent) | Winner's risk #6; concurrency friction item |
| G5 | **fgy** fixed on *all* surfaces, not just the new one — with the agent-file caveat: `${CLAUDE_PLUGIN_ROOT}` does NOT expand in agent `.md`, so `knowledge-gardener.md` prose instructs resolving the plugin root from its installed location first | Bead fgy in full |
| G6 | Ground-truth anchoring for reel spot-checks: compare drafts against fetched FetchResult/changelog evidence, **never the worker's narrative**; batch summary gains a spot-check column | Fabrication risk ([narrative-graded judges hit ~93% FPR](https://arxiv.org/abs/2601.14691); [ground-truth requirement](https://readysolutions.ai/blog/2026-06-13-when-to-trust-an-llm-judge)) |
| G7 | Hedge-trailer proliferation cap for `--verify` before any bulk run over the pre-0.31.2 (**y5p1**) cohort | Note-readability degradation risk |
| G8 | Deferred-bead recipes recorded now (revival triggers, per plan-hygiene rule): gh-api-fallback consolidation (delete + repoint-all-prose atomic + **doc-grep for relative mentions** — `check:plugin-load-paths` only sees `${CLAUDE_PLUGIN_ROOT}`-prefixed paths); **ihs** 3-way lockstep (canonical skill-side table + gardener mirror, `lib/cohort-table-contract.mjs` extended 2-way→3-way with fixtures same-commit) | ihs, gh-api-fallback duplication — deferral without lost revival path |
| G9 | **Mandatory correction** (judge 2, verified against `lib/plugin-load-paths.mjs`): a literal `${CLAUDE_PLUGIN_ROOT}/scripts/fetch-*-upstream.sh` glob in prose **fails** `check:plugin-load-paths` — `*` is not template-skipped, only `<...>` placeholders are. Use `fetch-<ecosystem>-upstream.sh` in prose; enumerate concrete script names only inside fenced blocks | Latent CI red exactly where the winning proposal claimed green |

Optional (not committed): Proposal 2's separate-tier ground-truth judge stage over all drafts. G6's foreground evidence-anchored spot-check is the shipped mitigation; the judge stage is recorded as an escalation if fabrication is observed in practice (open question Q2).

---

## 3. Final file structure

**Net new: 2 markdown references + 1 lib + 2 scripts. Moved/renamed: 0. Skill count stays 16, agents 4, hooks 5, schemas 23 — `check:release-counts` untouched.**

```
skills/tool-intel/
  SKILL.md                          # edited in place (~+45/-5 lines): orchestrated-haul pointer,
                                    #   --verify section, y40 bare-URL probe in Step 0, frontmatter
  references/                       # all 16 existing files UNCHANGED paths (analytics-guidance pins hold)
    verify-claims.md                # NEW (~200 lines): --verify spec (taxonomy, evidence discipline,
                                    #   verdict schema, fail-closed rules, report template)

skills/package-intel/
  SKILL.md                          # ~5-line parallel pointer in its batch adapter
  references/
    haul-workflow.md                # NEW (~250 lines): orchestrated-haul spec, beside upgrade-haul.md /
                                    #   forge-fallback.md (existing shared-reference convention).
                                    #   Imports upgrade-haul.md contracts BY REFERENCE — never rewrites them.
    upgrade-haul.md                 # UNCHANGED — stays canonical for adapter dialect, two axes,
                                    #   batch-outcome contract, Axis-A verification

lib/
  haul-contract.mjs                 # NEW (G1+G2): outcome-vocabulary enum, deterministic triage bucketing,
                                    #   validateObservationLine() — house ESM/JSDoc conventions (check:ast-grep)

scripts/
  check-haul-contract.mjs           # NEW: fixtures — triage bucketing (incl. the 0.32.3 parseable-version/
                                    #   not-in-api regression class), observation-lint fires on planted
                                    #   violations, AND lockstep: outcome strings in upgrade-haul.md +
                                    #   haul-workflow.md match the enum   → npm run check:haul-contract
  lint-observations.mjs             # NEW: thin CLI over validateObservationLine (stdin: draft observation
                                    #   lines → findings) — invoked by haul Phase 3 and --verify Phase D
```

Prose-only updates (not machine-guarded): CLAUDE.md Plugin Layout tree + Validation list + Scripts table + lib comment; `.claude/rules/skill-development.md` and `scripts-and-validation.md`; README; CHANGELOG; MEMORY.md.

No frontmatter `allowed-tools` changes needed: workers launch as subagents; writes stay foreground with existing BM tools; `--verify`'s OSV.dev/deps.dev calls are plain `curl` (existing Bash), so `KNOWN_MCP_PREFIXES` is untouched. `AskUserQuestion` stays out of allowed-tools (convention); gates are prose-invoked.

## 4. Foreground single-tool path — unchanged

`/tool-intel <prefix>:<name>` Steps 0–7 stay the lean foreground path, **untouched** except:

- **Step 0 (G3, bead y40):** the parser additionally accepts bare `github.com/<org>/<repo>` URLs. Probe order: formulae.brew.sh name match → cask.json token → marketplace.json plugin probe → `action:`/`gh:` heuristic on repo layout. Any ambiguous probe surfaces `class-ambiguous` to the user — never guessed.
- All 0.32.5 fixes are load-bearing inputs the redesign builds on unchanged: @-suffix dual-key fetch, one `list_directory` per ecosystem dir, registry-outranks-upstream-tip, modernize-on-touch for Pattern-2/6 notes.

## 5. Haul Workflow spec

A **static per-item pipeline** (fixed stages, predictable cost — [static workflows suit tool-use tasks](https://hf.co/papers/2506.18096)), supervisor/worker with **writes centralized outside workers** ([tree-of-workers](https://hf.co/papers/2512.03887)), **exactly one worker per drifted item** ([homogeneous per-item multi-agent wastes compute](https://hf.co/papers/2601.12307)). Spec lives in `skills/package-intel/references/haul-workflow.md`; both intel skills' batch adapters point at it.

**Dispatch threshold:** after the Phase-1 fetch pre-pass, **≥4 drifted items** → orchestrated haul; below → today's inline foreground flow runs verbatim (one well-run agent matches homogeneous multi-agent at lower compute).

### Phase 0 — Resolve (foreground, no agents)
Existing batch adapter unchanged: input-dialect parse (+ G3 bare-URL probe), @-suffix dual-key fetch keys, one `list_directory` per ecosystem dir, formula-vs-cask routing, `class-ambiguous` skips. Output: resolved operands with per-item left endpoints (recorded version, note path, Relations excerpt for the Axis-B linked-timeline pre-resolution).

### Phase 1 — Fetch (foreground Bash, deterministic, zero model cost)
Existing `fetch-*-upstream.sh` scripts run verbatim as a batched stdin pre-pass, referenced by `${CLAUDE_PLUGIN_ROOT}`-absolute paths — written in prose as `fetch-<ecosystem>-upstream.sh` per **G9** (bead fgy fixed on this surface). Classification happens NOW via the `lib/haul-contract.mjs` triage function (G1): `already-current` and `unverified[api-unavailable]` items exit here and never spawn a worker — the single biggest cost lever and the design answer to bead **8gcf** (only drifted notes ever get a full `read_note`). Empty-name sentinel = whole-fetch failure, never "no drift" (existing contract, kept).

### GATE 1 — pre-spend estimate (human)
Report: N operands → D drifted → D workers, wave-capped launches, estimated token band. Calibration anchors: the [~15× multi-agent token multiplier](https://www.zenml.io/llmops-database/building-a-multi-agent-research-system-for-complex-information-tasks), the [Dynamic-Workflows pre-run cost-warning precedent (~807K tokens / 27 agents)](https://aipractitioner.substack.com/p/claude-dynamic-workflows-scaling), framed as [cost-of-pass](https://hf.co/papers/2508.02694). User options: proceed / trim list / fall back to inline haul. Actuals recorded in the batch summary to calibrate future estimates.

### Phase 2 — Per-item workers (parallel, read-only)
- **Concurrency:** ≤4–6 launches per wave (admission-throttle cap); remainder queued. **G4:** near-instant zero-output failure = retryable-with-backoff (read-only ⇒ idempotent), never a per-item `FAILED`.
- **Model tier: Sonnet** — workers must ToolSearch-load `mcp__deepwiki__*`/`mcp__tavily__*`, which Haiku cannot (platform fact); no worker stage is MCP-free enough to justify a Haiku split.
- **Input:** a distilled bounded pack ([context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)) — identifier, old→new, repo URL + forge, ecosystem, Axis-B target (inline vs linked-timeline-note, **pre-resolved by the foreground** so workers never touch BM).
- **Changelog procedure = Renovate's algorithm** ([sourceUrl → host check → Releases metadata AND changelog filenames → filter to bumped range, LINK don't inline](https://docs.renovatebot.com/key-concepts/changelogs)), with the [same-datasource rule](https://github.com/renovatebot/renovate/issues/14726) (verify the new version against the datasource type the fetch used). git-tag ranges via `gh api`, not reinvented ([git-cliff territory](https://git-cliff.org/)). Breaking-change **text** always foregrounded over any aggregate score ([2403.09012](https://arxiv.org/html/2403.09012v1)).
- **Discipline:** no `advisor()`, no BM writes, no repo writes.

**Per-worker strict output schema** (spec ambiguity causes [~33% of multi-agent failures](https://www.glukhov.org/ai-systems/architecture/multi-agent-orchestration-patterns)), via StructuredOutput:

```json
{
  "identifier": "brew:icu4c@78",
  "outcome": "drafted | unverified[<reason>]",
  "version_confirmed": {"old": "…", "new": "…", "datasource": "…"},
  "changelog_source": {"type": "releases|changelog-file|git-tags|none", "url": "…"},
  "reel": [{"category": "feature|version|gotcha|security|deprecation", "text": "…", "source_url": "…"}],
  "breaking_changes": ["…"],
  "size_hint_bytes": 0
}
```

Reel-line rules baked into the schema docs *and* mechanically enforced later (G2): bare URLs only, no wiki-links, no link+trailing-parenthetical. **Supervisor invariant:** items-in == items-out; a crashed/timed-out worker (after G4 retry) becomes `unverified[worker-failed]`, never a silent drop.

### Phase 3 — Assemble + GATE 2 pre-write preview (foreground)
1. Drafts → concrete `edit_note` ops: Axis-A header-pipe + `[version]` observation in the same edit; Axis-B to inline observations or the linked timeline note; `size_hint` > ~40KB → **append-fallback** (find_replace anchoring defeated on big notes — platform gotcha).
2. **G2 mechanical lint:** every draft observation line piped through `scripts/lint-observations.mjs` — findings block the line from the preview until fixed. Convention becomes code.
3. **G6 spot-check:** one random reel line per item re-anchored against the raw fetched evidence (changelog URL / FetchResult), never the worker's summary narrative.
4. Per-item diff preview; user approves per-item or batch.

### Phase 4 — Write + verify (foreground, single writer)
Existing contract **verbatim**: `edit_note`; **mandatory Axis-A re-read** of the cohort-authoritative slot (echo counts untrusted — platform gotcha); one central Step-7 cross-link pass last.

**Batch-outcome contract (kept, machine-guarded by G1):**
`refreshed[old→new] / already-current / FAILED[edit-missed|note-missing|write-error] / unverified[reason]` — never report unverified as no-drift. Batch-close summary table gains a **spot-check column** (G6) and an **actual-vs-estimated spend line** (Gate-1 calibration).

## 6. `--verify` spec

**Invocation:** `/tool-intel --verify <prefix>:<name>`. Designed from scratch (independent of the deep-intel branch). First consumer: pre-0.31.2 notes carrying unverified load-bearing gotchas (bead **y5p1**). Spec in `skills/tool-intel/references/verify-claims.md`.

### Phase A — claim extraction (foreground)
Read the note; atomize load-bearing claims: `[gotcha]`, `[security]`, `[deprecation]`, version/status assertions, dependency-impact claims (the 0.32.4 `depends_on` vs `built_with`/`used_by` distinction). Claim record:

```json
{"id": "c3", "text": "…", "category": "gotcha",
 "check_route": "registry-field|doc-fetch|repo-file|vuln-db|command-probe",
 "cited_urls": ["…"]}
```

Claims are atomized **before** any verification so no verifier ever grades the note's overall narrative ([adversarial-judge pipelines](https://dev.to/varun_pratapbhardwaj_b13/how-adversarial-judge-pipelines-make-ai-agents-trustworthy-4pgn); [fabricated narratives push judge FPR to ~93%](https://arxiv.org/abs/2601.14691)). **GATE 1: pre-spend estimate** (N claims × M fetches, token band) before any agent launch.

### Phase B — ground-truth-fetch discipline (retrieval strictly precedes verification)
[CiteCheck ordering](https://arxiv.org/html/2605.27700v1): an evidence-fetcher stage (Sonnet — needs MCP tavily/deepwiki; registry + [OSV.dev](https://osv.dev) + [deps.dev](https://docs.deps.dev/api/v3) hits are plain curl) builds a per-claim pack of **actually fetched** primary sources. Hard rules:

- **A citation is never evidence until fetched** — plausible-looking URLs score zero ([authority bias](https://research.ibm.com/publications/justice-or-prejudice-quantifying-biases-in-llm-as-a-judge)).
- The fetcher receives claim text + cited_urls **only** — never the note's surrounding justification prose ([poisonable-justification guard](https://hf.co/papers/2508.06059); [at least one checker must see ground truth, not the generator's story](https://readysolutions.ai/blog/2026-06-13-when-to-trust-an-llm-judge)).

### Phase C — skeptic pass (not 3-verifiers-and-vote)
One proposer-vs-skeptic comparison per claim over the evidence pack ([debate beats single-pass](https://hf.co/papers/2507.19090)); majority voting rejected because parallel judges share correlated biases ([divergence-audit instead](https://www.emergentmind.com/topics/multi-agent-mllm-as-a-judge-mam)). Evidence order shuffled between passes on ambiguous claims ([position bias](https://hf.co/papers/2406.07791)).

- **Escalation ladder:** unresolved after round 1 → ONE progressive re-retrieval round over only the unresolved set ([2603.28488](https://hf.co/papers/2603.28488)), bounded by the approved budget ([trust-threshold-or-budget stop](https://cleanlab.ai/blog/reliable-agentic-rag)). Still-split → **human queue** in the report, never auto-resolved ([no single judge verdict is ground truth](https://hf.co/papers/2506.09443)).
- **Deceptive-critique guard:** the skeptic may flip a verdict only on **new fetched evidence**, never on another agent's argument alone ([one round of misleading critique can flip correct answers](https://arxiv.org/abs/2506.03332)).

### Verdict shape (per claim)
```json
{"id": "c3", "verdict": "confirmed|drifted|unsupported|contradicted|unverifiable",
 "correction": "…?", "evidence": [{"url": "…", "fetched": "2026-07-10", "excerpt": "…"}],
 "rounds": 1, "split": false}
```

### Fail-closed action rules (applied at the foreground pre-write preview — the only writer; edits linted via G2)
| Verdict | Action |
|---|---|
| **confirmed** | KEEP + stamp `— Verified: 2026-07-10` — reuses the shipped `lib/observation-metadata.mjs` trailer parser + `check:obs-metadata`; zero new machinery |
| **drifted** | CORRECT: propose the edited observation with new value + bare source URL |
| **unsupported** | HEDGE: append `(unverified as of 2026-07-10 — no primary source found)`; never silently keep, never drop |
| **contradicted** | DROP only when ≥1 fetched primary source directly contradicts AND the claim is not date-scoped historical ("as of v1.2" → date-scoped hedge instead); otherwise downgrade to hedge |
| **unverifiable** (source gone / paywalled / `command-probe` — local command execution out of verifier scope) | HEDGE with reason; **no fetch = no verdict**, never a confirmation |
| **split** | Human-queue section of the report; no edit proposed |

**Report discipline:** leads with the confirmed/hedged/dropped ratio so a mostly-hedged run cannot masquerade as full confirmation. **G7 hedge cap:** a per-note hedge budget (default: hedge-stamp ≤5 individual observations; beyond that, one summary observation `[gotcha] N observations below unverified as of <date> — see --verify report` replaces per-line stamps) must exist before any bulk y5p1 campaign. **Calibration** ([automated-evaluation calibration](https://langfuse.com/blog/2025-09-05-automated-evaluations)): first 3 runs (and every ~10th after) ask the user to spot-check 3 sampled `confirmed` verdicts; disagreements logged as `[gotcha]` lines on the skill's own BM note. Rationale: `--stale` catches version rot; `--verify` catches claim rot — [a curated note allowed to rot lies with confidence](https://hackernoon.com/stop-letting-coding-agents-search-the-same-docs-every-day).

## 7. Migration waves — `npm run check` green at every step

All additive → **patch releases** per the vp-claude-p25u precedent (semver-0: minor = breaking). Conventional commits; dogfood before tag. bd is currently write-locked (v1.1.0 Dolt panic) — track wave beads in the plan file until unlocked; never `bd create` before the fix.

**Wave 1 — contract lib (G1+G2), no behavior change.**
Add `lib/haul-contract.mjs` (outcome enum, triage bucketing incl. registry-outranks-tip as code + the 0.32.3 parseable-version/not-in-api regression class as fixtures, `validateObservationLine`), `scripts/check-haul-contract.mjs` (lockstep vs `upgrade-haul.md`'s existing outcome strings only — `haul-workflow.md` doesn't exist yet), `scripts/lint-observations.mjs`; wire `check:haul-contract` into package.json + CLAUDE.md Validation/Scripts prose. House ast-grep rules apply → `check:ast-grep` green by construction.

**Wave 2 — orchestrated haul (atomic commit).**
Add `skills/package-intel/references/haul-workflow.md` + the ~15-line tool-intel SKILL.md `### Orchestrated haul (4+ drifted items)` subsection + the ~5-line package-intel SKILL.md pointer + extend `check-haul-contract.mjs` lockstep to include `haul-workflow.md` — all in ONE commit (`check:plugin-load-paths` requires file-then-pointer atomicity). **G9:** prose paths use the `fetch-<ecosystem>-upstream.sh` placeholder form (`<...>` is template-skipped); concrete script names only in fenced blocks. No pinned analytics files touched; no cohort tables touched; no MCP prefixes added.

**Wave 3 — fgy full fix (G5).**
Repoint every CWD-relative `scripts/…` invocation in `staleness-detection.md` and the tool-intel SKILL.md batch section to `${CLAUDE_PLUGIN_ROOT}`-absolute. `knowledge-gardener.md` gets the resolve-plugin-root-from-installed-location-first wording (agent `.md` can't expand the variable). ⚠️ The cohort tables in `staleness-detection.md` and `knowledge-gardener.md` share a "Fetch script" column guarded by `check:cohort-lockstep` — if cell text changes, edit **both files in the same commit** so the tables stay identical.

**Wave 4 — `--verify` (atomic commit).**
Add `skills/tool-intel/references/verify-claims.md` + the ~25-line `## --verify mode` SKILL.md section + frontmatter `description`/`argument-hint` additions, same-commit for the load-path guard. OSV/deps.dev via Bash curl — no allowed-tools or `KNOWN_MCP_PREFIXES` changes. Add the `--verify` row to CLAUDE.md's skill-routing table.

**Wave 5 — release.**
Prose/counts: CLAUDE.md Plugin Layout tree (tool-intel references 16→17, package-intel 15→16 — prose-only; skills stay 16 so `check:release-counts` passes untouched), `.claude/rules/skill-development.md`, README, CHANGELOG, MEMORY.md, `plugin.json` + `marketplace.json` version. **Dogfood before tag** (release checklist — static checks can't catch semantic leakage): one real ≥5-item brew haul through the workflow path exercising both gates (include one cask, one @-suffixed formula), plus one `--verify` run on a pre-0.31.2 brew note (y5p1's cohort) with hand spot-checked verdicts as the first calibration sample. Lightweight tag, push tag (compare-link 404 otherwise) — **push only after explicit user approval** (standing policy).

## 8. Implementation work breakdown (bead-ready)

*bd write-locked — hold in the plan file; file verbatim when unlocked, verify each create with `bd list -p <N>`.*

| Priority | Title | Wave |
|---|---|---|
| P1 | `lib/haul-contract.mjs` + `check:haul-contract`: outcome-vocab enum, triage bucketing fixtures, observation-line lint (`lint-observations.mjs`) | 1 |
| P1 | `haul-workflow.md` + orchestrated-haul dispatch in both intel SKILL.md files (atomic; `fetch-<ecosystem>-upstream.sh` placeholder form, never a literal `*` glob) | 2 |
| P1 | `verify-claims.md` + `--verify` SKILL.md section + routing-table row (atomic) | 4 |
| P2 | fgy: repoint all CWD-relative `scripts/` refs to `${CLAUDE_PLUGIN_ROOT}`-absolute (cohort-lockstep same-commit caveat; gardener resolve-root wording) — closes bead **fgy** | 3 |
| P2 | y40: Step-0 bare-GitHub-URL ecosystem probe with `class-ambiguous` fallback — closes bead **y40** | 2 or 4 |
| P2 | Release wave: prose/counts, version bump, dogfood haul + dogfood --verify, tag | 5 |
| P3 | `--verify` hedge-cap + summary-observation form; then bulk y5p1 campaign — bead **y5p1** stays open until a verify pass has actually run over the cohort | post-5 |
| P3 | gh-api-fallback consolidation (deferred; recipe on file: delete + repoint atomic + doc-grep for relative `references/gh-api-fallback.md` mentions the load-path guard can't see) — revival trigger: next edit touching that file | later |
| P3 | ihs brew-classification centralization (deferred; recipe: canonical skill-side table + retained gardener mirror, `cohort-table-contract.mjs` 2-way→3-way, fixtures same-commit) — revival trigger: next edit to any of the three copies | later |
| P4 | Pre-spend estimator calibration log (accumulate actual-vs-estimated lines; revise the token band after 3 hauls) | ongoing |

Untouched open beads (orthogonal, stay independent): **8gcf** (designed around, not closed — BM still lacks bulk projection; upstream candidate), **b48**, **5al**, **ycm** (P4 install-count-delta noted as a future `--verify`/`--stale` signal).

## 9. Risks + open questions

**Risks (post-graft residuals):**

1. ~~Hand-mirrored haul schemas (bf73 class)~~ — **closed by G1**; residual: worker *prompt text* inside `haul-workflow.md` fenced examples is not lockstep-guarded — a prompt edit drifting a field name fails only at run time.
2. ~~BM gotchas by prompt convention~~ — observation-line gotchas **closed by G2**; residual: the >40KB append-fallback and echo-count distrust remain prose discipline in Phase 3/4 (no validator).
3. Pre-spend estimates uncalibrated at launch — only the ~15× multiplier and one ~807K-token datapoint anchor the band; first hauls may overshoot. Mitigation: actual-vs-estimated line + P4 calibration bead; the first user surprise is a real cost.
4. Worker fabrication residual — a real URL can carry a wrong summary; G6's evidence-anchored spot-check is partial mitigation, `--verify` is the systemic backstop on a different cadence. Escalation path: adopt Proposal 2's ground-truth judge stage (Q2).
5. `--verify` coverage honestly partial — `command-probe` claims and dead/paywalled sources land in `unverifiable`-hedged; a run can exit mostly date-hedged. The confirmed/hedged ratio leading the report is the guard against over-reading.
6. Skeptic-pass reliability — evidence-only-flip reduces but doesn't eliminate deceptive-critique flips; a skeptic citing a real-but-irrelevant URL passes the letter of the rule. Split→human-queue is the real backstop; resist future automation of exactly that step.
7. Launch-cap UX — 20+ drifted items means multi-wave, slow hauls; throttle is load-dependent so G4 retries can still recur. Read-only workers make retry safe; UX stays rough.
8. SKILL.md grows to ~830 lines / ~50KB — away from progressive disclosure; the restructuring debt is deferred, not cancelled (Q3).
9. Deferred consolidations compound — each new consumer of the ihs table and gh-api-fallback raises eventual centralization cost; G8's recorded recipes + revival triggers are the mitigation against drop-without-trigger.
10. bd write-lock timing — bead closes (y40/fgy) can't land until the Dolt panic clears; plan-file tracking risks the known drop failure mode if the release ships first.

**Open questions:**

- **Q1:** Is ≥4 drifted items the right workflow-dispatch threshold, or should it be token-budget-based? Decide after 3 dogfooded hauls (P4 calibration data).
- **Q2:** Adopt the separate-tier ground-truth judge stage if G6 spot-checks catch ≥1 fabricated reel line in the first 5 hauls? (Recorded trigger.)
- **Q3:** SKILL.md restructuring toward a thin dispatcher — own bead after the hybrid ships, or fold into the ihs/gh-api-fallback consolidation pass?
- **Q4:** Should `check:haul-contract`'s lockstep eventually cover the fenced worker-prompt examples (risk 1 residual), and is that tractable without a markdown-AST table parser?
- **Q5:** Hedge-cap default (5 per note?) needs validation against a real pre-0.31.2 note's gotcha density before the y5p1 campaign.

## 10. Sources

Evidence URLs actually used in this design:

- <https://hf.co/papers/2506.18096> — static workflows suit predictable tool-use tasks (haul phase design)
- <https://hf.co/papers/2512.03887> — supervisor/worker with centralized writes
- <https://hf.co/papers/2601.12307> — one worker per item; homogeneous multi-agent wastes compute (dispatch threshold)
- <https://hf.co/papers/2508.02694> — cost-of-pass framing (Gate 1)
- <https://www.zenml.io/llmops-database/building-a-multi-agent-research-system-for-complex-information-tasks> — ~15× multi-agent token multiplier
- <https://aipractitioner.substack.com/p/claude-dynamic-workflows-scaling> — pre-run cost-warning precedent (~807K tokens / 27 agents)
- <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents> — bounded worker context packs
- <https://docs.renovatebot.com/key-concepts/changelogs> — changelog-discovery algorithm
- <https://github.com/renovatebot/renovate/issues/14726> — same-datasource verification rule
- <https://git-cliff.org/> — tag-range changelog extraction as a solved layer
- <https://www.glukhov.org/ai-systems/architecture/multi-agent-orchestration-patterns> — MAST: ~33% of multi-agent failures are spec ambiguity (strict schemas)
- <https://arxiv.org/html/2403.09012v1> — breaking-change text over aggregate scores
- <https://hf.co/papers/2607.07052> — progressive crystallization of prose logic into validated code (G1)
- <https://dev.to/varun_pratapbhardwaj_b13/how-adversarial-judge-pipelines-make-ai-agents-trustworthy-4pgn> — claim atomization + human-queue routing
- <https://arxiv.org/abs/2601.14691> — fabricated narratives push judge FPR to ~93%
- <https://arxiv.org/html/2605.27700v1> — CiteCheck: retrieval strictly precedes verification
- <https://research.ibm.com/publications/justice-or-prejudice-quantifying-biases-in-llm-as-a-judge> — authority bias; unfetched citations score zero
- <https://hf.co/papers/2508.06059> — poisonable-justification guard
- <https://readysolutions.ai/blog/2026-06-13-when-to-trust-an-llm-judge> — ≥1 checker must see ground truth, not the generator's story
- <https://hf.co/papers/2507.19090> — debate beats single-pass verification
- <https://www.emergentmind.com/topics/multi-agent-mllm-as-a-judge-mam> — correlated judge biases; divergence-audit over majority vote
- <https://hf.co/papers/2406.07791> — position bias; evidence-order shuffling
- <https://hf.co/papers/2603.28488> — progressive re-retrieval of unresolved sets only
- <https://cleanlab.ai/blog/reliable-agentic-rag> — trust-threshold-or-budget stop
- <https://hf.co/papers/2506.09443> — no single judge verdict is ground truth
- <https://arxiv.org/abs/2506.03332> — deceptive critique can flip correct answers (evidence-only-flip rule)
- <https://osv.dev> — vulnerability-claim ground truth
- <https://docs.deps.dev/api/v3> — registry-independent dependency cross-check
- <https://langfuse.com/blog/2025-09-05-automated-evaluations> — verdict spot-check calibration discipline
- <https://hackernoon.com/stop-letting-coding-agents-search-the-same-docs-every-day> — claim-rot rationale for `--verify`
- <https://mindstudio.ai/blog/llm-as-judge-agent-safety-pattern> — separate-tier judge (optional escalation, Q2)
