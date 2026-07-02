# Upgrade Haul — Batch Note Refresh from an Upgrade/Outdated Line

Shared reference for `package-intel` and `tool-intel`. Both skills point here
via `${CLAUDE_PLUGIN_ROOT}/skills/package-intel/references/upgrade-haul.md`.

## Contents

- [When to use this file](#when-to-use-this-file)
- [Input parsing](#input-parsing)
- [Highlights-reel synthesis](#highlights-reel-synthesis)
- [Two recording axes](#two-recording-axes)
- [Stale-cache arbitration](#stale-cache-arbitration)
- [Batch orchestration](#batch-orchestration)
- [Relationship to `--stale`](#relationship-to---stale)
- [Per-skill adapter contract](#per-skill-adapter-contract)

## When to use this file

An **upgrade haul** is a batch refresh of already-documented notes triggered by
the *outcome* of a real upgrade — several packages or tools just moved from a
recorded version to a newer installed/current one, and each note needs its
version + changelog brought current. This is the **executor** side of version
drift: `/knowledge-gaps --stale` *detects* drift; an upgrade haul *closes* it,
either from a `--stale` handoff or directly from a pasted upgrade line.

It is distinct from a single `/package-intel <pkg>` / `/tool-intel <prefix>:<name>`
research call in three ways: the input is a **batch** (and often prefix-less),
the unit of work is a **version delta** (not a from-scratch note), and the
synthesis is a **curated changelog reel** for that delta rather than a full
note rebuild. The ecosystem-agnostic core lives here; input dialect, ecosystem
routing, and the prose target are delegated to each skill — see
[Per-skill adapter contract](#per-skill-adapter-contract).

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
- **Strip version qualifiers** off each operand: `claude-code@latest` →
  `claude-code`, `pkg@^1.2.0` → `pkg`, `image:tag` → `image`. The qualifier is
  an *instruction to the package manager*, never part of the canonical
  identifier. (Dogfood 2026-06-24: `claude-code@latest` correctly resolved by
  dropping `@latest`.)
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
  through the skill's normal changelog source (release notes → tags/compare
  fallback); this file does not re-document that pipeline.

## Two recording axes

A refreshed note carries the new version on **two orthogonal axes**. These are a
recording convention, **not an ecosystem quirk** — both apply wherever the note
type supports them:

- **Axis A — the machine-readable version slot `--stale` reads.** This is the
  **inline header pipe** `… | v<version> | <license>` (S2 **Pattern 1**) — the
  slot `--stale` reads *first* for **every** cohort under first-hit-wins. The
  haul MUST refresh the pipe. npm notes *also* carry a `[version]` observation
  (Pattern 3); update it in the **same** edit to keep the two consistent, but
  never update only the observation — the pipe outranks it, so a stale pipe
  defeats the round-trip even with a fresh `[version]` obs. (Heterogeneous
  corpus: an older note may record version only in a `| Version |` table row or
  prose — Patterns 2/6; refresh whichever slot S2 would read for *that* note,
  defaulting to the pipe for current-era notes.)
- **Axis B — the prose changelog narrative.** The human-readable reel from
  [Highlights-reel synthesis](#highlights-reel-synthesis). Its location is
  adapter-specific (see below).

**Do not block on slot-hardening work.** Extending the canonical `[version]`
schema slot to the remaining package cohorts (bead `f3zx`) and to
brew/cask/vscode (bead `80r4`) is tracked separately and unstarted. The haul
**consumes whatever slot exists today** and otherwise records the `[version]`
observation by convention — it must never wait on `f3zx`/`80r4`.

**Gotcha — refresh BOTH axes.** Updating the prose reel alone leaves the note's
*headline* version (the inline pipe) stale, and the pipe is exactly what `--stale`
re-reads — so the drift never closes. (Dogfood: an `llmfit` refresh wrote the
Release Highlights but left the top-of-note version at the old value until it was
bumped separately.) On every refreshed note, move the headline pipe `| v<version> |`
**and** the narrative — they are independent and both must move. For npm, the
`[version]` observation is a third slot that must move with the pipe (same edit).

## Stale-cache arbitration

Local package-manager metadata can lag the authoritative registry/API. When two
figures disagree:

- **Never downgrade a figure below an authoritative registry/API read.** A live
  registry/API value (e.g. `formulae.brew.sh`, the npm registry, crates.io)
  outranks a locally cached one. (Dogfood: a local `brew info` analytics/version
  read lagged the live `formulae.brew.sh` API.)
- **Stamp the source and date** on the recorded figure so a later refresh knows
  which read won and how old it is (`MCP` vs `API`, plus the date).

## Batch orchestration

Defaults for running the haul over the resolved list:

- **Each item starts on the freshness fast-path.** Run every identifier through
  the skill's **Step 1: Check for existing note** — the existing note plus its
  recorded version is the delta's left endpoint, and the freshness tier prunes
  the source pipeline. A haul is by definition a refresh, so most items hit the
  fast path.
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
Verify the **inline pipe specifically** (the slot `--stale` reads); for npm,
verify the pipe *and* the `[version]` observation both moved — a passing
obs-edit with a missed pipe-edit still leaves the round-trip broken. If the slot
is unchanged, classify the item `FAILED[edit-missed]`, do not proceed to Axis B,
and do not count it refreshed. (Precedent: the `N_before`/`N_after` survival
check in `/knowledge-maintain` — `schema_validate` passing is not proof an edit
landed; only a re-read of the specific slot is.)

## Relationship to `--stale`

Upgrade haul is the **executor** half of a bidirectional pair with the
`--stale` **detector**:

- **Detector → executor:** `knowledge-gaps --stale` finds drifted notes and, in
  its *S7 Offer batched refresh* step, routes the top stale items into these
  skills as a batch. That handoff IS an upgrade haul.
- **Executor → detector:** a haul refreshes the same Axis-A slot `--stale` reads
  — the inline header pipe (**Pattern 1**) for every cohort, plus the `[version]`
  observation for npm — so the next `--stale` run sees the closed drift.

The detector side is documented in
`skills/knowledge-gaps/references/staleness-detection.md` (S7 offer + S2
version-extraction patterns); that file carries the reverse pointer back here.

## Per-skill adapter contract

Three things are **delegated to each skill's adapter section** — the core above
deliberately does not hardcode them. An adapter MUST define:

1. **Input dialect** — how its identifiers look and how to recognize its
   upgrade/outdated command lines (which command words and flags are noise).
2. **Ecosystem routing** — how a de-qualified operand maps to a canonical note
   and source pipeline, including any per-operand prefix inference and
   sub-routing (e.g. formula-vs-cask auto-routing on a `not-in-api` signal, and
   globbing every relevant note directory in the Step-1 existence check).
3. **Axis-B narrative target** — *where* the curated reel is written:
   `## Release Highlights` for `package-intel`; inline `[feature]` / `[version]`
   observations for `tool-intel`. Target resolution need not be a fixed
   section/inline convention — an adapter may resolve it dynamically instead,
   e.g. by checking the subject note's Relations for a linked timeline note and
   routing the reel there when one exists, falling back to its default target
   otherwise (see the tool-intel adapter's linked-timeline-note check for the
   worked mechanics).

Axis A (the `[version]` observation / canonical slot) and everything else above
are shared and identical across both skills.
