# `/intel` skill corrections — findings record, 2026-07-28

**Base:** `50472f2` · **Head:** `aca337b` (16 commits) · **Committed to git:** 2026-07-29

This file was written as an uncommitted working artifact on 2026-07-28. It is
committed here because it is the only record of several things that do not
survive compression into tracker rows: a decision with a revival trigger
(Part 3), a corrected measurement methodology (Part 4), and a map of what was
and was not independently verified (Part 5). Nothing else in this repository
records them.

**Read this file when** touching `skills/intel/**`, the S2 version extractor, or
the Homebrew analytics guidance — the verification map in Part 5 tells you which
claims in that prose have been checked at source and which have not.

## What this was

A `/intel brew:beads` run surfaced defects in the vp-knowledge plugin's own
guidance. Nine candidate findings went through a 4-agent adversarial panel;
four were refuted and the rest became a plan
(`~/.claude/plans/vp-knowledge-adversarial-skill-corrections.md`), implemented
in the 16 commits. A second review round then attacked the corrections
themselves and found five defects **in the corrections**, which are also fixed.

The reason that matters: this repo's product is markdown under `skills/` and
`agents/` that an LLM agent *executes*. A wrong sentence is a behavioural bug
that makes a future agent write a wrong, durable note into a knowledge graph.
Every drift guard in `npm run check` verifies that two *documents* agree; none
verifies that a document matches *reality*. Nothing here was caught by CI, and
CI was green throughout.

## Where the open work went (2026-07-29)

Every still-open finding below is now filed in `bd`. **Recorded so a later
tracker migration does not double-import them**, and so that closing a bead
does not lose the reasoning that produced it.

| Finding | Bead | Priority |
|---|---|---|
| 1 — Step 6 completeness check can silently never run | `vp-claude-r7dl` | P2 |
| 2 — npm popularity: three states, one symptom | `vp-claude-btnd` | P2 |
| 3 — no fallback when the bare-name analytics key is missing | `vp-claude-oi3f` | P3 |
| 4 — quantitative claims have no reproducible artifact | `vp-claude-jmzl` | P3 |
| 5 — Pattern 3 never matches an indented observation line | `vp-claude-1lm6` | P2 |
| 11 — "can diverge" undersells a ~27% gap | `vp-claude-mz6u` | P3 |
| 13 — hardcoded "seven behaviors" count is an unguarded rot point | `vp-claude-k6so` | P3 |
| Part 6 — three npm notes extract to `null` | `vp-claude-nwl2` | P3 |

Findings **6, 7, 8, 9 and 10 are release-blocking prose defects** and are fixed
in the 0.33.6 prose commit rather than filed. Finding **12 was settled on
2026-07-29** — see below. The 273 no-slot npm notes are recorded as a
**decision, not a task** (Part 6).

Filed at the same time, deferred from `SWARM-39.md` and previously unbeaded:

| Item | Bead | Priority |
|---|---|---|
| #34 bare-relative cross-load ref resolver | `vp-claude-5nca` | P2 |
| #35 `check-skill-name-drift.mjs` (high leverage) | `vp-claude-q6a6` | P1 |
| #36 split `knowledge-gaps/SKILL.md`, lower the `check:spec` cap | `vp-claude-aq1k` | P2 |

`SKILL.md` for `knowledge-gaps` was **665 lines** when #36 was recorded as
optional. It is **824** as of 2026-07-29, against `check:spec`'s 1000-line hard
error cap — it grew 24% while the split sat unfiled, which is a stronger
argument for doing it than the one originally written down.

## Part 1 — Fixed

### From the original plan

| Commit | Finding |
|---|---|
| `45dc788` | Homebrew `analytics.install."30d"` is an object keyed by invocation variant, not a scalar. Prose described the paths as if they resolved to numbers; the library-detection ratio divided two objects. Casks have neither `build_error` nor `install_on_request`. The bulk `formula.json` index carries no `analytics`/`generated_date`. |
| `4fd898b` | **The ~40KB `read_note` truncation rule never described a real defect.** basic-memory has no size branch at any tag checked; ten `find_replace` edits landed byte-exactly on a 53KB note. Worst instance was in `upgrade-haul.md`'s Axis-A verification, where the false cause sat beside real ones and would absorb a genuine byte-mismatch failure. |
| `1433953` | `gh` compare does not truncate at 250 — that is the default single-page cap and it paginates. Plus: a Release's `name` is not its `tag_name`; raw REST reports a merged PR as `closed` on both `issues/<n>` and `pulls/<n>`. |
| `150d8aa` | The changelog gate missed tag-only versions. Mechanism: GitHub's generated notes range from the previous **tag**, so a version tagged without a Release is invisible in *every* Release body, permanently. |
| `930daae` | A changelog, commit message or README is a **claim, not evidence** about anything outside its own diff. Two in-session confirmations, both of which produced a wrong durable note before being caught. |
| `afcb16f` | The `edit_note` relations echo counts inbound **and** outbound edges — correct by design, not an artifact. My first explanation was wrong, and the wrong reading invites a destructive "cleanup" of real relations. |
| `acaa615` | Batch-vs-fresh disambiguation; `repository` beats `homepage` for forge detection; an npm downloads window can predate publication (so a `0` measures nothing). |
| `02f35c4` | `extractBmVersion` was first-`[version]`-**line**-wins, not first-**parseable**-wins. Found by dogfooding, not review. |
| `d3e0ecc` | basic-memory #940 is closed *for a different symptom*; the relation race was quarantined, not fixed — materially worse than "open". |
| `9452f18` | beads write-lock root cause was wrong (the Dolt pin is 136 commits **ahead** of the cited fix, not behind); 1.1.2 ships a fix that opens the DB but does not repair drifted rows. |

### Found by reviewing the corrections

| Commit | Finding | Severity |
|---|---|---|
| `c2540ef` | **The A4 tag-prefix rule was unsound.** It derived a prefix from the newest release's `tag_name`, but in a monorepo that release often belongs to another package — vitejs/vite's newest is `plugin-legacy@8.2.2` while core tags `v8.1.5`. The 404 guard fired but the procedure then **dead-ended**, having stated a failure condition with no response. Replaced with tag-list matching plus a four-branch resolution table. | HIGH |
| `aca337b` | **The A5 compare command was uncomputable.** `gh api --paginate` re-runs `--jq` per page: arrays concatenate, scalars repeat. The documented filter yields `subjects + 2 × pages` lines, so the completeness check could not be performed on its own output. Split into two calls. | HIGH |
| `c8c854c` | The retired 40KB rule survived in `docs/design/tool-intel-next-gen.md` — an **unimplemented, bead-ready spec**. My original grep was scoped to `skills/ agents/ UPSTREAM-*` and never looked at `docs/`. | HIGH |
| `ab49d33` | The analytics fix hadn't reached `note-template-brew.md`, which is what the agent actually writes from. `check:analytics-guidance` passing proved nothing — that guard tests three banned phrasings and cannot see a path described as a scalar. | MEDIUM |
| `35e78cc` | Two of my own new fixtures were titled `npm-foo` but carried no `type: npm_package` frontmatter, so they ran under the default order and never exercised the npm override they were written to prove. Plus five unpinned boundaries. | MEDIUM |
| `8c89bec` | Decision record + revival trigger for the read-order trade-off (below). | — |

## Part 2 — Findings not fixed in the 16 commits

**Status column added 2026-07-29.** See "Where the open work went" above.

1. **MEDIUM — the "report it in Step 6" instruction is not wired into Step 6.**
   *Filed as `vp-claude-r7dl`.*
   `enrichment-tool.md` / `enrichment-package.md` say every stop is "a
   reportable outcome, never a silent skip — say in Step 6 that the
   completeness check did not run and why". But `skills/intel/SKILL.md` Step 6
   itemises *sources* (`used / attempted-but-failed / intentionally-skipped`),
   and the completeness check is a sub-check *within* the changelog source. An
   agent can honestly report "changelog: used" while the check silently never
   ran. This is the exact failure the new text warns against, one level up.
   *Fix:* add an explicit Step 6 bullet. Deliberately deferred — it touches the
   Step 6 contract and deserves design, not another same-session patch.

2. **MEDIUM — npm pre-publication window: the informative branch is optional.**
   *Filed as `vp-claude-btnd`.*
   `ecosystem-npm.md` says "skip the observation **or** state the window
   explicitly", directly beside an established "skip the popularity observation
   silently" precedent for a *different* condition (call failure). Nothing
   forces the informative branch, and no Step 6 bullet requires disambiguating.
   Three states — call failed / too new to measure / never checked — collapse to
   one symptom: an absent `[popularity]` line.
   *Fix:* make "state the window explicitly" mandatory (the data is already
   fetched), or require a `[gotcha]`/`[limitation]` line.

3. **LOW — no stated fallback if the bare-name analytics key is missing.**
   *Filed as `vp-claude-oi3f`.*
   Reviewer tested ~15 formulae spanning very-low-traffic, pure-dependency and
   renamed cases and **could not produce a real miss**, so this is theoretical.
   Worth a one-line "if absent, treat as 0 and say so — never substitute the
   `--HEAD` variant".

4. **LOW / process — quantitative claims have no committed reproducible
   artifact.** *Filed as `vp-claude-jmzl`.*
   "18 of 502 npm notes", "7 of 330 version bumps across 42
   formulae", "6 of 40 null-head formulae" live in comments and commit
   messages. Checking them means redoing the scan. Either commit the scan
   script or soften the claims.

5. **Pre-existing, out of scope — Pattern 3 never matches an indented
   observation line.** *Filed as `vp-claude-1lm6`.*
   The `^-` anchor requires the dash at column 0.
   Identical on both implementations, so not a regression from this work.

### From the prose-accuracy audit — defects introduced by the corrections

6. **MEDIUM — a stated mechanism I could not support.**
   *Fixed in the 0.33.6 prose commit.*
   `ecosystem-brew.md` says "Never sum the variants: that double-counts a
   source build against the bottle install it replaces." The *instruction* is
   right; the *reason* is probably wrong. Homebrew records one event per
   name-plus-options, which makes the bare-name and `--HEAD` keys **disjoint
   partitions**, not a duplicate pair — summing would yield a true total, and
   the real reason not to sum is comparability (every note must report the same
   population, and the on-request ÷ install ratio must span one population).
   This matters more than a normal prose defect because agents reason *from*
   rationales: "the variants overlap" invites further wrong inferences.
   *Fix:* restate as comparability, or source a mechanism claim from Homebrew's
   analytics docs first. Disjointness was **not** established empirically
   either — do not simply assert the opposite.

7. **MEDIUM — `diverged` now means two different things in two files, and I
   only updated one.** *Fixed in the 0.33.6 prose commit.*
   `enrichment-tool.md` (new) says `diverged` is *realistic*
   on repos cutting from release branches. `gh-api-fallback.md` (unchanged text,
   retained inside a bullet I edited) still says `diverged` means the base "is
   not an ancestor of `<head>` (**wrong/renamed tag**) and the commit list is
   **meaningless**". The enrichment blocks explicitly delegate to
   `gh-api-fallback.md`, so an agent following the delegation is told its
   correctly-resolved tags must be wrong and goes hunting for a nonexistent tag
   error. *Fix:* keep `behind` as the error signal; reclassify `diverged` as
   normal release-branch topology that still is not a clean changelog.

8. **MEDIUM — an unsupported universal claim, in only one half of a lockstep
   pair.** *Fixed in the 0.33.6 prose commit.*
   `enrichment-package.md` asserts "most registries' popular packages
   are published from monorepos" as the justification for the whole
   matching-over-prefix-stripping rule. No measurement is cited, "most" is a
   strong quantitative claim across six registries, and the sentence is
   **absent** from `enrichment-tool.md` despite the explicit mirror comment — so
   the pair has diverged in epistemic footing, not just family detail. The tool
   side cites its measurement ("7 of 330 version bumps"); the asymmetry is the
   tell. The rule survives without the claim. *Fix:* "Monorepo publishing is
   common enough in the package family that prefix-stripping cannot be assumed
   safe."

9. **LOW — a stamped count that drifted the same day it was written.**
   *Fixed in the 0.33.6 prose commit.*
   `ecosystem-brew.md` says "checked across all **8,519** entries, 2026-07-28";
   the index measured **8,520** hours later. The number is load-bearing for
   nothing (the finding is "zero entries carry the key"). *Fix:* drop the
   count, keep the date.

10. **LOW — illustrative figures that look like data.**
    *Fixed in the 0.33.6 prose commit.*
    `{"ripgrep": 95355, "ripgrep --HEAD": 95}` is now 96617/97; the cask example
    `{"iterm2": 14285}` is now 24665 (73% higher). Harmless as shape
    illustrations. *Fix:* make them obviously illustrative so nobody reads them
    as counts.

11. **LOW / informational — "can diverge" undersells the gap.**
    *Filed as `vp-claude-mz6u`.*
    Local `brew info ripgrep` reports 70,654 installs/30d against the live
    JSON's 96,617 — **~27% apart on the same metric, same day**. Pre-existing
    wording, not introduced here, but worth quantifying. Note the `[popularity]`
    example line in `ecosystem-brew.md` is exactly the stale local `brew info`
    snapshot — self-consistent, since it is stamped `(Homebrew MCP, YYYY-MM)`.

12. **RESOLVED 2026-07-29 — no contradiction.** The question was whether
    `note-template-cask.md` still tells the agent to record `install_on_request`
    for casks, which would contradict the confirmed finding that casks have
    neither `build_error` nor `install_on_request`. It does not: neither
    `note-template-cask.md` nor `schemas/brew_cask.md` mentions either field,
    and `ecosystem-cask.md:42-43` states the absence correctly. The change set
    introduced no contradiction here. **Recorded as a negative result rather
    than deleted** — the question was worth asking, and the next person to
    wonder should not have to re-run the grep.

13. **UNVERIFIED — the "seven behaviors" count in `gh-api-fallback.md`.**
    *Filed as `vp-claude-k6so`.* Counted 2026-07-29: `gh-api-fallback.md:89`
    says "seven GitHub API/CHANGELOG behaviors" and there are exactly seven
    bullets, so it is **correct today**. It is filed anyway because a hardcoded
    count adjacent to an edited list is an unguarded rot point, not because it
    is currently wrong.

## Part 3 — The read-order trade-off (decided: pinned, not fixed)

The `02f35c4` fix carries a genuine regression window. For `npm_package` notes
Pattern 3 outranks Pattern 1 (bead `9q7e`), so when the first `[version]` line
is unparseable the loop lands on a later one instead of falling through to the
header pipe. If that later line is stale, it returns an older version than the
pipe holds; the `[version-range]` variant additionally sets `isRange`, which
**excludes an up-to-date note from `--stale` bucketing entirely**.

**It is not decidable from the note.** A parseable `[version]` line below an
unparseable one is textually identical whether it is the canonical slot (the
`brew-beads` case the fix exists for) or a stale leftover. Two fixtures pin
that same shape with opposite desirable answers — the proof that no
read-ordering rule satisfies both.

**Measured across all 502 npm notes:** 18 carry 2+ `[version]` observations
(one with 7, one with 5, one with 4); **all 18 return identical results** under
old and new. Either the first line parses (loop never advances) or all are
narrative (Pattern 3 declines, pipe wins as before). The precondition exists in
the corpus; the trigger does not.

**Decision:** leave pinned. **Revival trigger:** the first real note where a
stale later `[version]` shadows a fresher pipe, or flips `isRange` on an
up-to-date note. At that point build an `ambiguous` signal — but note it lands
in `lib/staleness-contract.mjs` (machine-guarded by `check:contract`) plus the
gardener emit side, the maintainer queue lane and both prose mirrors, which is
why it was not folded into a corrections change set.

## Part 4 — Corrections to my own measurements

Recorded because two durable records were wrong before being fixed.

1. **"8 multi-`[version]` notes" was from a partial scan** (318 of 502) reported
   as if complete. Real figure: **18**. The conclusion survived — but by luck,
   not method. Corrected in `8c89bec`.

2. **The zero-slot figure was wrong — now corrected.** I reported "278 of 502
   npm notes have no `[version]` observation". My counting script was:

   ```bash
   c=$(bm tool read-note "$id" | jq -r '.content' | grep -c '^- \[version' || echo 0)
   ```

   A **failed read** yields empty input, `grep -c` returns 0, `|| echo 0`
   fires — read failure is indistinguishable from genuine zero.

   A corrected scan (read failure reported as `READFAIL`, never as `0`)
   completed over all 502 notes:

   | `[version]` lines | Notes |
   |---|---|
   | 0 | **273** |
   | 1 | 210 |
   | 2 | 14 |
   | 3 / 4 / 5 / 7 | 1 each |
   | read failure | 1 |

   **273 of 502 (54%)**, not 278 — the original was inflated by 5 read
   failures. My own follow-up estimate of ~255–270 was in turn too pessimistic.
   The corrected scan independently reproduces the **18** multi-slot notes
   (14 + 1 + 1 + 1 + 1), so Part 3's decision rests on a clean measurement.

   Same defect class as the findings above: an error silently became a
   plausible-looking measurement. Note it could not have been caught by
   inspection — 278 is as believable as 273. It surfaced only because a note
   scored `0` and visibly *had* the slot when opened.

## Part 5 — Verification coverage

**Independently confirmed at source level** (fact-check agent, primary sources
this session):

- `read_note` has no truncation branch at 0.22.1, v0.15.0, v0.20.0, v0.21.6.
  The only size-like hits at older tags slice the *not-found fallback list*,
  never the body. Local file `diff`-identical to the upstream tag.
- `find_replace` has no size gate (`entity_service.py` 1228–1247).
- `models/knowledge.py` 130–132: `relations = incoming_relations + outgoing_relations`.
- `edit_note.py` 685–695 computes over that combined set and emits
  `Unresolved:` only when non-zero — traced through `EntityResponse` →
  `SQLAlchemyModel(from_attributes=True)`, not merely arithmetic.
- #940 closed 2026-06-12 `state_reason: completed`, with the `skipif`
  quarantine present at tag v0.22.1 line 393 ("quarantined pending
  root-cause, still runs locally").

**Independently confirmed** (prose-accuracy audit, live `formulae.brew.sh`,
same day) — the whole Homebrew analytics group:

- `install."30d"`, `install_on_request` and `build_error` are all variant-keyed
  objects; casks carry `install` only.
- The bulk index has zero entries with `analytics` and zero with
  `generated_date`, across all of them.
- `scripts/fetch-brew-upstream.sh:55` does read that bulk index deliberately.
- **The `--HEAD`-despite-null-`urls.head` claim generalises**: 10 of 80
  null-head formulae (12.5%) at double my sample size, versus my 6 of 40 (15%).
  My sample was representative, not lucky.
- Two bonus confirmations that are what actually make "read the bare-name key"
  safe, and which the prose never claimed: the bare-name key was present in
  **120 of 120** sampled formulae (so `.["<name>"]` never silently yields
  null), and `--HEAD` was the *only* variant suffix observed across them — so
  the prose's "(or other flag)" hedge is cautious rather than wrong.

**Verified by me during the work** (not independently re-checked): the beads /
Dolt claims (C1–C6), the vite monorepo tag trap, the tag-matching regex against
adversarial inputs, and the `--paginate`/`--jq` per-page repetition.

**Verified 2026-07-29 — three items moved out of "never verified by anyone".**
All three were cheap, and all three held. That they held is not the point: two
of them were concrete falsifiable facts sitting in *shipped agent-executed
prose*, and one was a second-order claim the fact-check agent had flagged as
the highest-risk gap in the change set.

- **B1 — confirmed, and the repo is now named in the prose.** The example was
  written as "chainsaw", which is ambiguous: `kyverno/chainsaw` has no `v2.14.0`
  tag at all, so anyone re-checking it against that repo would have concluded
  the example was fabricated. The formula points at `WithSecureLabs/chainsaw`,
  where it holds exactly — the Release titled `v2.14.0` has
  `tag_name: v2.14.0-1`, and a separate bare `v2.14.0` tag exists with no
  Release, resolving to a **different commit** (`e99aad52` vs `46a238a3`).
  `gh-api-fallback.md` now names the repo and the differing commits.
- **B4 — confirmed exactly.** `repos/helm/helm/compare/v4.1.4...v4.2.0` returns
  `status=diverged ahead_by=306 behind_by=46`, matching the figures in
  `enrichment-tool.md` digit for digit. `total_commits` is 306 — equal to
  `ahead_by` — which independently confirms the reading behind finding 7's fix:
  on `diverged`, the commit list is the head-only side, usable as a changelog
  but not a linear range.
- **C3 / C4 — confirmed, both counts.** `go.mod` pins
  `github.com/dolthub/dolt/go v0.40.5-0.20260605230755-1bf533220ab0` byte-identically
  at `v1.1.0` and `v1.1.2`, so the credited "Dolt 2.1.10" is absent; and the
  migrations tree tops out at `0053_repair_rig_wisps` at **both** tags with no
  `0057_*` file at either. The operational warning ("1.1.2 lets the database
  open; it does not repair drifted rows") stands. Recorded in
  `UPSTREAM-vp-beads.md`.

**Still never verified by anyone:** nothing from the B or C blocks. The
remaining gaps are the prose-accuracy audit's own, below.

**Never verified by anyone — the prose-accuracy audit's own gaps.** It reached
group 1 (Homebrew) only, and explicitly listed what it did not touch:

- The `gh-api-fallback.md` group: the chainsaw `name`-vs-`tag_name` example,
  the raw-REST merged-PR behaviour, and whether the caveat is correctly scoped
  to REST rather than the CLI.
- The tag-resolution group, including **the four-row decision table, which is
  entirely unexercised against real data.** It flags the "several candidates →
  keep the pair sharing a prefix" branch as most likely to meet an unhandled
  shape, and wants the `grep -E "(^|[^0-9.])${RE}$"` anchoring attacked with
  calver tags, `release-1.1.2`, `-rc1` suffixes and prefix-case variants. I
  tested that regex on vite plus seven adversarial inputs; that is not the same
  as testing the table.
- The npm download-window group.
- The `UPSTREAM-basic-memory.md` group — which it flags as **highest blast
  radius**, since a wrong retirement of the 40KB rule propagates across six
  files. (This group was independently confirmed by the fact-check agent above,
  so it is in fact the best-verified group in the change set. The two agents
  did not know about each other.)
- The `UPSTREAM-vp-beads.md` group, "exactly the situation where the
  replacement most deserves an independent check".

**Review dimensions that never reported at all** (agents killed by a monthly
spend limit, not relaunched): adversarial code review, and project-convention
review — though I did that one's propagation half myself, which is how the
`docs/` miss (`c8c854c`) was found.

**The architect round was never run.** It was requested — one architect per
high/critical finding, one collective, one adversarial big-picture — and did
not happen. Judged unnecessary for the 0.33.6 release, because an architect
round reviews *design* and this change set introduces none.

## Part 6 — Basic Memory cleanup

Three populations, only two worth acting on:

| Population | Verdict |
|---|---|
| 18 notes with 2+ `[version]` | Benign today (all extract identically), but they are the *precondition* for the pinned regression. Worth collapsing to a single canonical slot, narrative moved to `[feature]`. |
| 3 notes extracting to `null` under both implementations (`npm-aarongustafson-form-required-if`, `-checkboxes`, `npm-lightningcss-cli`) | Real coverage hole — invisible to `--stale`. **Filed as `vp-claude-nwl2`.** |
| 273 notes with no `[version]` slot | **DECISION: leave alone permanently.** See below. |

### Decision — the 273 no-slot npm notes are not a backlog item

Recorded as a **decision, not a task**, deliberately: a task invites completion,
and this is a conversation that otherwise recurs every quarter as someone
notices "54% of npm notes have no version recorded" and reads it as a gap.

It is not a gap. Per `staleness-detection.md`, the Sprint-32
**promote-verified-only** decision means a note acquires its `[version]` slot
organically when it is next refreshed against a live registry — never by bulk
backfill. Backfilling 273 notes would stamp **unverified** versions into the
canonical slot that `--stale` reads, which is precisely the failure that
decision exists to prevent: `--stale` would then compare upstream against a
number nobody checked, and report confident drift verdicts derived from a guess.

**Revival trigger:** none by note count. Revisit only if the promote-verified-only
decision itself is reversed.

Also noted: `npm-fastify-formbody` records the non-semver token `8.0.x` (carried
into `vp-claude-nwl2`).

Bulk BM mutation is ASK-FIRST — the exact per-note edits need review before
anything is touched.

## Part 7 — Release state

**As of 2026-07-28:** nothing was released. No version bump, no `CHANGELOG.md`,
no `marketplace.json`, no `README.md`, no tag, **no push**, no GitHub writes.
The installed plugin cache still served the old prose — including the false
40KB rule and the wrong `compare` claim.

Per the `vp-claude-p25u` precedent this is a **patch** (bugfixes plus additive
guidance). The `CHANGELOG` entry names `150d8aa` (tag-only detection) and
`02f35c4` (extractor behaviour) specifically — those two change behaviour; the
rest is prose.

**The acceptance criterion is the installed cache, not the tag.** Committing,
bumping and tagging all leave the cache serving the false prose until a
reinstall. Verify by grepping the installed cache for the retired 40KB rule and
the old `compare` claim after `/plugin install vp-knowledge@vp-plugins`.
