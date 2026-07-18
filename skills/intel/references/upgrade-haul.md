# Upgrade Haul — Batch Note Refresh from an Upgrade/Outdated Line

Shared by both `/intel` families (package and tool). Loaded as a bare
`upgrade-haul.md` from the skill body. It is the ecosystem-agnostic **executor**
core; each family supplies an adapter (see
[Per-family adapter contract](#per-family-adapter-contract)).

## Contents

- [When to use this file](#when-to-use-this-file)
- [Input parsing](#input-parsing)
- [Highlights-reel synthesis](#highlights-reel-synthesis)
- [Two recording axes](#two-recording-axes)
- [Stale-cache arbitration](#stale-cache-arbitration)
- [Batch orchestration](#batch-orchestration)
- [Relationship to `--stale`](#relationship-to---stale)
- [Per-family adapter contract](#per-family-adapter-contract)

## When to use this file

An **upgrade haul** is a batch refresh of already-documented notes triggered by
the *outcome* of a real upgrade — several packages or tools just moved from a
recorded version to a newer installed/current one, and each note needs its
version + changelog brought current. This is the **executor** side of version
drift: `/knowledge-gaps --stale` *detects* drift; an upgrade haul *closes* it,
either from a `--stale` handoff or directly from a pasted upgrade line.

It is distinct from a single `/intel <prefix>:<name>`
research call in three ways: the input is a **batch** (and often prefix-less),
the unit of work is a **version delta** (not a from-scratch note), and the
synthesis is a **curated changelog reel** for that delta rather than a full
note rebuild. The ecosystem-agnostic core lives here; input dialect, ecosystem
routing, and the prose target are delegated to each family — see
[Per-family adapter contract](#per-family-adapter-contract).

## Input parsing

The trigger input takes two shapes. Accept both:

1. **Multiple identifiers** — a space- or newline-separated list of names, with
   or without prefixes (`fastify pino`, `brew:sem-cli cask:warp`).
2. **A raw upgrade/outdated command line** — paste straight from the terminal,
   e.g. `brew upgrade a b c`, `npm outdated`, `npm i a@latest b@latest`. Treat
   the command word + its flags as noise; the operands are the identifiers.

Normalization rules (ecosystem-agnostic):

- **Strip the command word and flags.** `brew upgrade`, `npm i`, `npm outdated`,
  leading `-`/`--` flags, and a trailing redirect are not identifiers.
- **Strip version qualifiers** off each operand: `pkg@latest` → `pkg`,
  `pkg@^1.2.0` → `pkg`, `image:tag` → `image`. The qualifier is an
  *instruction to the package manager*, never part of the canonical
  identifier — unconditional for the package ecosystems
  (npm/crate/go/composer/pypi/gem).
- **Exception — brew/cask `@`-suffixed names can be REAL tokens.** Homebrew
  uses `@` inside genuine formula/cask tokens: `icu4c@78` is its own formula,
  and `claude-code@latest` is a distinct cask *channel*, not a qualifier. For
  a brew/cask operand carrying `@`, do NOT strip blindly — include BOTH the
  literal and the stripped form in the same stdin fetch batch (the
  `fetch-*-upstream.sh` scripts take name lists; an extra miss is free) and
  prefer the literal hit when it resolves. The Step-1 existence glob still
  runs on the *stripped base name*, so both note shapes are found: a
  versioned formula with its own note (`brew-icu4c@78`) and a channel cask
  that folds into its base note's dual-channel convention
  (`claude-code@latest` → `cask-claude-code`). Never fork a separate
  `<name>@latest` note when the base note exists. (Dogfood 2026-06-24
  recorded the strip as "correctly resolved"; 2026-07-10 showed it silently
  loses the channel — the stripped fetch returned the lagging standard cask,
  2.1.197, while the installed `@latest` channel was at 2.1.206.)
- **Resolve each operand to a canonical identifier** the way a single research
  call would, then proceed. Operand-level prefix inference, formula-vs-cask
  routing, and the ecosystem-specific dialect are the **adapter's** job — this
  core only guarantees the list is split and de-qualified.

## Highlights-reel synthesis

The **unit of work is the version delta** — the recorded version in the existing
note → the installed/current version that triggered the haul. Synthesize a
*curated changelog reel* across exactly that interval, not the whole history and
not a raw commit dump:

- **Skip merges and internal refactors.** Surface user-visible changes:
  breaking changes, new features, behavior changes, notable fixes, security
  fixes, deprecations.
- **Prioritize silent behavior changes.** The reel's value is catching what a
  bare `brew upgrade` / `npm update` hides — a renamed flag, a default that
  flipped, a feature gated off. (Dogfood: a `glab` flag rename and a `biome`
  default flip were caught only because the reel was curated, not skimmed.)
- **One reel per note**, scoped to that note's own delta. Recover the changelog
  through the family's normal changelog source (release notes → tags/compare
  fallback); this file does not re-document that pipeline.

## Two recording axes

A refreshed note carries the new version on **two orthogonal axes**. These are a
recording convention, **not an ecosystem quirk** — both apply wherever the note
type supports them:

- **Axis A — the machine-readable version slot `--stale` reads first.** Which
  physical slot is authoritative is **cohort-dependent**: for `npm_package`
  notes it is the **`[version]` observation** (S2 **Pattern 3**) —
  `lib/bm-version-extract.mjs` tries Pattern 3 before Pattern 1 for npm
  specifically (bead `vp-claude-9q7e`, shipped). For every other cohort — the
  other five package cohorts (crate/go/composer/pypi/gem) and the tool
  cohorts (brew/cask/vscode) — it is still the **inline header pipe**
  `… | v<version> | <license>` (Pattern 1); extending the override beyond npm
  is tracked separately as bead `vp-claude-xux8`, not yet done. The haul MUST
  refresh whichever slot is authoritative for the note's cohort. All
  package-cohort notes carry *both* slots — the inline header pipe **and**
  the `[version]` observation; update both in the **same** edit to keep them
  consistent, but never update only the non-authoritative slot for that
  cohort — it does not win under
  first-hit-wins, so leaving the authoritative slot stale defeats the
  round-trip even with the other slot fresh. (Heterogeneous corpus: an older
  note may record version only in a `| Version |` table row or prose —
  Patterns 2/6; refresh whichever slot S2 would read for *that* note,
  defaulting to the cohort-authoritative slot for current-era notes — and
  **modernize on touch**: when the haul touches a Pattern-2/6-only note,
  also install the Pattern-1 header pipe and the Pattern-3 `[version]`
  observation in the same refresh so the note joins the current-era slot
  layout (precedent: `brew-eza`, 2026-07-10). On notes past the ~40KB
  `find_replace` limit this defers to the append-fallback — never
  blind-anchor a pipe insert on a truncated read.)
- **Axis B — the prose changelog narrative.** The human-readable reel from
  [Highlights-reel synthesis](#highlights-reel-synthesis). Its location is
  adapter-specific (see below).

**Slot-hardening is complete.** The canonical `[version]` schema slot has
shipped across all package cohorts (bead `f3zx`) and brew/cask/vscode (bead
`80r4`) — every cohort this skill touches now defines it. The
haul records the `[version]` observation by convention on every refresh, no
cohort-specific gating remains.

**Gotcha — refresh BOTH axes.** Updating the prose reel alone leaves the note's
*headline* version (the inline pipe) stale, and the pipe is what `--stale`
re-reads for every cohort except npm (which reads the `[version]` observation
instead, see Axis A above) — so the drift never closes. (Dogfood: an `llmfit`
refresh wrote the Release Highlights but left the top-of-note version at the
old value until it was bumped separately.) On every refreshed note, move the
headline pipe `| v<version> |` **and** the narrative — they are independent
and both must move. For every package cohort, the `[version]` observation is
a third slot that must move with the pipe (same edit).

## Stale-cache arbitration

Local package-manager metadata can lag the authoritative registry/API. When two
figures disagree:

- **Never downgrade a figure below an authoritative registry/API read.** A live
  registry/API value (e.g. `formulae.brew.sh`, the npm registry, crates.io)
  outranks a locally cached one. (Dogfood: a local `brew info` analytics/version
  read lagged the live `formulae.brew.sh` API.)
- **Stamp the source and date** on the recorded figure so a later refresh knows
  which read won and how old it is (`MCP` vs `API`, plus the date).
- **Registry outranks upstream tip for Axis A.** When the upstream repo has
  released past the registry (formula stable at 1.0.1 while GitHub already
  carries v1.1.2), the Axis-A slot still records the REGISTRY version — that
  is the figure `--stale` compares against, so writing the tip there would
  manufacture phantom drift on the next detector run. Record the tip in the
  Axis-B narrative instead, with an explicit "ahead of registry, not yet
  bottled/published as of YYYY-MM-DD" stamp. (Dogfood 2026-07-10: llmfit
  formula 1.0.1 vs upstream v1.1.2, released the same day.)

## Batch orchestration

Defaults for running the haul over the resolved list:

- **Each item starts on the freshness fast-path.** Run every identifier through
  the family's **Step 1: Check for existing note** — the existing note plus its
  recorded version is the delta's left endpoint, and the freshness tier prunes
  the source pipeline. A haul is by definition a refresh, so most items hit the
  fast path.
- **One listing per ecosystem directory, not per-name globs.** For any batch,
  run the Step-1 existence check as ONE full
  `list_directory(dir_name="<ecosystem-dir>")` per distinct ecosystem
  directory in the batch, resolving every operand by filtering the listing —
  O(distinct dirs) calls instead of O(operands) globs (double that when
  formula-vs-cask is unknown and both directories must be globbed). Two
  listings are never worse than four globs, so no size cutoff applies;
  single-identifier (non-batch) calls keep the per-name glob. (Dogfood
  2026-07-10: two listings resolved a 7-operand haul at once.)
- **Per-note edits are file-disjoint.** Each note lives in its own file, so
  concurrent refreshes never corrupt each other's output.
- **One central cross-link pass at the end.** Defer Step 7 cross-linking
  (which touches *shared* neighbor notes) to a single pass after all per-note
  refreshes land, so the disjoint writes never contend on a shared note.
- **Cap concurrent launches.** Follow the `~4–6` concurrent-*launch* cap from
  `CLAUDE.md` → **Parallel agent orchestration**; do not restate the throttle
  mechanics here. For longer lists, run in waves rather than one large fan-out.
- **Centralize writes in the orchestrator.** Let subagents *research* (read-only
  fan-out) but perform the `write_note`/`edit_note` calls from the main context.
  This avoids the `edit_note` inline-count echo artifact and keeps a single
  writer per note. (Dogfood: 6 file-disjoint research subagents in one message,
  writes centralized in the main context — clean, no throttle.)

### Batch-outcome contract

A haul is a *batch* — it must report a per-item outcome and never claim blanket
success while an item silently no-op'd. This mirrors the `--stale` S7 discipline
("report which succeeded vs failed") on the executor side. Classify each resolved
operand and surface a summary table at batch close:

- `refreshed[old→new]` — the Axis-A version slot was confirmed changed (see the
  verification step below) and the Axis-B narrative was written.
- `already-current` — recorded version already matched upstream; no edit needed.
- `FAILED[reason]` — an edit was attempted but did not land: `edit-missed` (the
  `find_replace` matched nothing), `note-missing` (Step 1 found no existing note —
  a haul refreshes existing notes; a missing note is out of scope, not a silent
  skip), or `write-error` (BM returned an error).
- `unverified[reason]` — the upstream version could not be retrieved, so no
  comparison was possible: `api-unavailable` (the fetch returned
  `upstream_state:"api-unavailable"`). **Never record a version as current when
  the upstream read failed, and never report `unverified` as "no drift."**

**Axis-A edit verification (required).** After the `edit_note(find_replace)` that
bumps the version, **re-read the note** and confirm the slot changed to the new
value — the repo's `find_replace` silently matches nothing on a byte mismatch
(whitespace, a `v` prefix, a stale source-stamp suffix) and on notes >~40KB.
Verify the **cohort-authoritative slot specifically** (the slot `--stale`
reads first for that cohort — the `[version]` observation for npm, the
inline pipe for every other cohort); for every package cohort, verify the
pipe *and* the `[version]` observation both moved — a passing edit to only
the non-authoritative slot still leaves the round-trip broken. If the slot
is unchanged, classify the item `FAILED[edit-missed]`, do not proceed to Axis B,
and do not count it refreshed. (Precedent: the `N_before`/`N_after` survival
check in `/knowledge-maintain` — `schema_validate` passing is not proof an edit
landed; only a re-read of the specific slot is.)

## Relationship to `--stale`

Upgrade haul is the **executor** half of a bidirectional pair with the
`--stale` **detector**:

- **Detector → executor:** `knowledge-gaps --stale` finds drifted notes and, in
  its *S7 Offer batched refresh* step, routes the top stale items into this
  skill as a batch. That handoff IS an upgrade haul.
- **Executor → detector:** a haul refreshes the same Axis-A slot `--stale` reads
  — the `[version]` observation (**Pattern 3**) for npm, the inline header
  pipe (**Pattern 1**) for every other cohort — plus, for every package
  cohort, the other of the two slots as well, so the next `--stale` run sees
  the closed drift regardless of which slot it reads first for that cohort.

The detector side is documented in
`skills/knowledge-gaps/references/staleness-detection.md` (S7 offer + S2
version-extraction patterns); that file carries the reverse pointer back here.

## Per-family adapter contract

Three things are **delegated to each family's adapter section** — the core above
deliberately does not hardcode them. An adapter MUST define:

1. **Input dialect** — how its identifiers look and how to recognize its
   upgrade/outdated command lines (which command words and flags are noise).
2. **Ecosystem routing** — how a de-qualified operand maps to a canonical note
   and source pipeline, including any per-operand prefix inference and
   sub-routing (e.g. formula-vs-cask auto-routing on a `not-in-api` signal, and
   globbing every relevant note directory in the Step-1 existence check).
3. **Axis-B narrative target** — *where* the curated reel is written:
   `## Release Highlights` for the **package** family; inline `[feature]` /
   `[version]` observations for the **tool** family. Target resolution need not
   be a fixed section/inline convention — an adapter may resolve it dynamically
   instead, e.g. by checking the subject note's Relations for a linked timeline
   note and routing the reel there when one exists, falling back to its default
   target otherwise (see the tool family adapter `upgrade-haul-adapter-tool.md`
   linked-timeline-note check for the worked mechanics).

Axis A (the machine-readable version slot, per its cohort-dependent
definition above) and everything else above are shared and identical across
both families.
