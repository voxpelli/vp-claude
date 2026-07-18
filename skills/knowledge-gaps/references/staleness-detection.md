# Staleness Detection — Reference

Use this reference when `/knowledge-gaps` is invoked with the `--stale` flag.
The mode replaces the normal manifest-driven coverage workflow with a focused
upstream-drift check: it compares the version recorded in a Basic Memory note
against the current upstream version and buckets the notes.

`--stale` takes an optional ecosystem token: `--stale [brew|npm|cask|crate|vscode|plugin]`.
A bare `--stale` checks **all** supported cohorts. Drift detection is only valid
for ecosystems that have a **single authoritative current version** — five are
registry-backed (brew/npm/cask/crate/vscode); `plugin` is the first non-registry
cohort, resolving its current version by fetching `plugin.json` directly from
GitHub via `gh api` instead of a registry (see the Cohort configuration table
below). `action`, `gh`, `go`, and `docker` are deliberately excluded
(floating-major pins, HEAD-installs, module-path majors, mutable tags — no
canonical comparable version); reject those tokens with an error listing the
valid set.

It also takes three optional scope modifiers — `--limit N`, `--since <date>`,
`--sample N` — for narrowing a large cohort before the expensive part of the
workflow runs. The full flag grammar and validation rules live in the
`knowledge-gaps` `SKILL.md` Mode A section (the parsing owner); this file
documents where each modifier is applied within S1-S8 and the "Large-cohort
strategy" pattern that composes them.

**BM access is via MCP only.** The per-ecosystem `scripts/fetch-<eco>-upstream.sh`
scripts do the *external* API work and never read `~/basic-memory/`. This skill
collects BM-side data via the MCP tools and pipes names to the scripts.

The bucket names below are the same canonical strings the `knowledge-gardener`
Step 5b-iv uses, so a user-invoked staleness report and an autonomous gardener
report are interchangeable as input to the `knowledge-maintainer` Section 3b.

## Contents

- [Cohort configuration](#cohort-configuration)
- [Workflow](#workflow)
  - [S1. Enumerate documented notes (MCP)](#s1-enumerate-documented-notes-mcp)
  - [S2. Extract documented version per note (MCP, multi-pattern)](#s2-extract-documented-version-per-note-mcp-multi-pattern)
  - [S3. Recover the real package name, then fetch upstream facts](#s3-recover-the-real-package-name-then-fetch-upstream-facts)
  - [S4. Compute drift and bucket (two-dimensional)](#s4-compute-drift-and-bucket-two-dimensional)
  - [S5. Handle edge cases](#s5-handle-edge-cases)
  - [S6. Render the report](#s6-render-the-report)
  - [S7. Offer batched refresh](#s7-offer-batched-refresh)
  - [S8. Scope footnote](#s8-scope-footnote)
- [Large-cohort strategy (parallel subagents)](#large-cohort-strategy-parallel-subagents)

## Cohort configuration

Each supported ecosystem maps a note-title prefix to a BM directory, a fetch
script, and the upstream version field the script returns:

| Token | Prefix | BM directory | Fetch script | Upstream version | Deprecation? |
|-------|--------|--------------|--------------|------------------|--------------|
| `brew` | `brew-` | `brew/` | `fetch-brew-upstream.sh` | `.versions.stable` | yes |
| `npm` | `npm-` | `npm/` | `fetch-npm-upstream.sh` | `dist-tags.latest` | yes |
| `cask` | `cask-` | `casks/` | `fetch-cask-upstream.sh` | `.version` (leading comma-segment) | yes |
| `crate` | `crate-` | `crates/` | `fetch-crate-upstream.sh` | `.crate.max_stable_version` | no |
| `vscode` | `vscode-` | `vscode/` | `fetch-vscode-upstream.sh` | Open VSX latest **stable** (non-pre-release); falls back to `.version` | no |
| `plugin` | `plugin-` | `plugins/` | `fetch-plugin-upstream.sh` | `plugin.json` `.version` (resolved live via marketplace.json → path → plugin.json; no schema field stores the path) | no |

Run the workflow below **once per selected cohort**, emitting one
`### Version Drift — <eco>` section per cohort.

## Workflow

### S1. Enumerate documented notes (MCP)

For each selected cohort:

```
list_directory(dir_name="<directory>", depth=1)
```

From the returned listing, **keep only titles starting with the cohort prefix**
(filter out drafts and non-prefixed notes).

**Floating-package exclusion filter (npm only, applies before scope modifiers):**
also drop any title whose recovered package name starts with `@types/` — in
title form, `npm-@types-*` (e.g. `npm-@types-node`, `npm-@types-react`). These
are DefinitelyTyped packages that exist solely to track another package's
version; they will always read as "drifted" against their own release
cadence, which is tracking behavior, not real staleness. This is a **filter**,
not a bucket — an excluded note produces no bullet in any `#### <bucket>`
section and is not counted in any bucket total. It always applies (not
gated behind a flag) and is independent of the `--since`/`--limit`/`--sample`
scope modifiers below. Carry forward how many titles this filter dropped —
S8 reports the count.

If a cohort's filtered list is empty, skip that cohort silently (or, for an
explicit single-ecosystem `--stale <eco>`, report "No `<prefix>` notes
documented in Basic Memory yet — nothing to check" and suggest seeding one via
`/intel`).

**Scope modifiers apply here, before S2's per-note read storm** — this is what
makes `--since`/`--limit`/`--sample` shrink N before the expensive part of the
workflow rather than merely trimming the rendered report:

- **`--since <date>`** — call `recent_activity(timeframe="<date>", type="entity",
  output_format="json")` ONCE per invocation (not once per cohort — a single
  call covers every selected cohort), with an explicit `page_size`, paginating
  by incrementing `page` until a page returns fewer items than `page_size` (or
  an empty result) — `recent_activity` has no `has_more` field, unlike
  `search_notes` — to get the set of titles active since `<date>`. Subtract
  that set from each cohort's filtered listing from S1 above — the notes NOT
  in the recent-activity set are the ones untouched since `<date>`, i.e.
  candidates a previous audit hasn't already refreshed. This is the same
  recent-activity-minus-inventory technique the `knowledge-gardener` Step 5
  stale-note detection uses, applied here to shrink the cohort instead of to
  flag it. **Processing (do not script):** collect the active-titles set from
  the flat top-level `result` array (singular key — not `results`, and not
  nested) mentally, deduplicating as you go (`recent_activity` was observed
  returning duplicate rows for the same entity in live testing), and diff it
  against the S1 listing — don't write ad-hoc code to do the set subtraction.
- **`--limit N`** — after the `--since` subtraction (if present), keep only
  the first N titles remaining in each cohort's listing (S1 order — nothing is
  known about drift yet at this stage, so this is not a staleness-ranked
  slice).
- **`--sample N`** — same insertion point as `--limit`, but draws N titles at
  random from the remaining listing instead of taking the first N.

Only the notes surviving this filtering proceed to S2. Carry forward how many
were excluded by the `@types/*` filter and by each scope modifier — S8
reports both, distinctly (the `@types/*` count is unconditional; the scope-
modifier counts only appear when a modifier flag was actually passed).

### S2. Extract documented version per note (MCP, multi-pattern)

For each filtered title, call:

```
read_note(identifier="<title>", include_frontmatter=true, output_format="json")
```

Issue up to 5 concurrent `read_note` calls per turn to keep latency bounded.
**The corpus is heterogeneous** — the recorded version lives in different places
in different notes (different `*-intel` template eras). Match these patterns in
**priority order, first hit wins**:

**Canonical logic:** the table below is documentation — the real,
fixture-tested matching logic is `lib/bm-version-extract.mjs`
(`extractBmVersion(noteContent, noteTitle)` → `{version, pattern}`), proven by
`scripts/check-bm-version-extract.mjs` (`npm run check:bm-version-extract`).
It is kept in sync with `agents/knowledge-gardener.md` Step 5b-ii, fixture-tested
against both the strict `| Version | ... |` table-row label guard and the
semver-range/channel-mismatch regressions.

<!-- Version-extraction patterns mirrored in agents/knowledge-gardener.md Step 5b-ii — update both in lockstep (no machine contract couples them); the actual logic lives in lib/bm-version-extract.mjs -->

| Priority | Pattern | Example |
|---|---|---|
| 1 | Inline header pipe | `Homepage: … \| v1.39.0 \| <license>` |
| 2 | `\| Version \| <value> \|` table row | `\| Version \| 0.26.1 \|` |
| 3 | `[version]` / `[version-range]` observation | `- [version] 5.8.5` / `- [version-range] ^9.0.0` |
| 4 | Frontmatter `version:` | `version: 12.4.0` |
| 5 | `## Release Highlights` / `## Version History` newest entry | `## Release Highlights\n- **v5.8.5** (2026-05-…) — …` |
| 6 | Registry/prose fallback | `- **Version**: 0.11.13 (…)` / `Current: v3.2.4 (…)` |

Pattern 3 reads the version directly from the note's `observations` array — the
canonical `[version]` slot. The `/intel` npm template **emits it since
0.31.4** (and 71 npm notes were backfilled); the other five package cohorts
(crate/go/composer/pypi/gem) **emit it since bead `f3zx`** extended the slot to
their schemas + templates. The `/intel` brew/cask/vscode templates **emit
it since bead `80r4`**.
Per the Sprint 32 promote-verified-only decision, existing notes are **not**
bulk-backfilled by that bead — only a note a maintainer has *already
header-verified as version-accurate* gets the `[version]` line stamped as a
side effect of that verification pass; every other existing note acquires the
slot organically the next time it's refreshed (`/intel` write path, or a
`--stale` S7 batched refresh). `action`, `gh`, `go`, and `docker` stay outside `--stale`'s supported
cohort set entirely (per the "Cohort configuration" table above), so they have
no `[version]` slot and none is planned. **"Emitted" still is not "read first"
for most cohorts:** under the base first-hit-wins ordering, Pattern 1 (the
inline header pipe) outranks Pattern 3, and the brew/cask/vscode templates
emit *both* — so for a standard note in any of these three cohorts `--stale`
still reads the pipe, and the `[version]` observation remains a redundant
secondary slot. **`npm_package` notes are the one exception** (bead
`vp-claude-9q7e`, shipped): `lib/bm-version-extract.mjs` detects the note's
`type: npm_package` frontmatter and tries Pattern 3 *before* Pattern 1 for
those notes only, so the misparse-shield for version-string packages
(`yaml`, `semver`) actually fires now. Extending the same override to the
tool cohorts (brew/cask/vscode) or the other five package cohorts is tracked
separately as bead `vp-claude-xux8`.

**Multiple `[version]` observations on one note (brew/cask/vscode).** These
three cohorts also accumulate `[feature]` / `[version]` narrative-reel lines
from `intel`'s tool-family upgrade-haul Axis B (a deliberate, intentional second use
of the same category — resolved 2026-07-03, `vp-claude-jcql`), so a note can
carry more than one `[version]` line. This is not ambiguous in practice:
`extractBmVersion()`'s regex takes the **first** match in document order, and
the note templates emit the canonical slot as the *first* line of
`## Observations`, with reel entries appended after it — so Pattern 3
reliably reads the canonical slot, never a reel entry, without any
additional disambiguation logic.

**Range-pin exclusion filter (not a bucket):** a `[version-range]` observation
(or any other pattern whose captured raw value still carries a leading range
operator — `^`, `~`, `>=`, `>`, `<=`, `<`, `=`) records that the note's
dependency is itself unpinned — it is defined to float with whatever version
its target resolves to. Do **not** strip the operator and treat the remainder
as a concrete `bm_version` for comparison purposes — that would report a
"drift" that is really just the pin doing its job. Instead **exclude the
note from S4 bucketing entirely**, the same way the `@types/*` filter (S1)
does: no bullet in any `#### <bucket>` section, not counted in any bucket
total. **Mechanism:** `extractBmVersion()` returns this as an explicit
`isRange` boolean alongside `{ version, pattern }` — `isRange: true` only for
a `[version-range]` observation match — precisely so this exclusion can be
applied without the stripped, resolved token being mistaken for a genuine
concrete pin (the two are textually indistinguishable once the operator is
gone). Only a bare `[version]` observation (`isRange: false`) is accepted as
a concrete `bm_version` for drift comparison. Carry forward how many notes
this filter excluded — S8 reports the count alongside the `@types/*` count.

Pattern 5 takes the **highest semver** among the versions referenced in
the `## Release Highlights` or `## Version History` list (linked or bold) — do
**not** assume the top bullet is newest; these blocks are grouped by change-type
(breaking/feature/fix), not version order. **Release Highlights ranks last on
purpose:** the list is hand-curated and may lag the real latest release, so
trusting it risks a false "current" — worse than an honest `<unparseable>`. Only
fall to it when patterns 1–4 and the prose fallback all miss. The non-npm
package cohorts (crate/go/composer/pypi/gem) now define the `[version]` slot
too (bead `f3zx`), but per the promote-verified-only doctrine existing notes
are not bulk-backfilled — they acquire the slot organically on next refresh.
Until then, Pattern 5 is what actually recovers most otherwise-`<unparseable>`
notes in those cohorts.

**Strip a leading `v`** from the extracted value (`v1.39.0` ≡ `1.39.0`). If no
pattern matches, record `bm_version="<unparseable>"` and continue — that is a
genuine corpus-quality finding, not a parser miss.

> **Coverage gate:** before trusting bucket counts, sanity-check that the
> extractor parses ≥95% of each cohort. A higher `Unparseable` rate means the
> patterns need tuning for that cohort's template era, not that the notes are
> all stale. Report residual `Unparseable` as a corpus-quality finding.

### S3. Recover the real package name, then fetch upstream facts

The upstream name is not always the title minus the prefix:

- **npm — always read `frontmatter.packages[0]`** (never prefix-strip). The
  vault has scoped notes (`npm-@fastify-postgres`) and non-prefixed titles
  (`@sentry-node`, whose package is `@sentry/node`); only `packages[0]` is
  reliable. A title that is neither `npm-*` nor has a usable `packages[0]` is a
  corpus-quality finding — report it, don't silently skip.
- **brew / cask / crate / vscode — strip the anchored leading `<prefix>-`**
  (single leading occurrence only; internal hyphens and dots are preserved:
  `cask-font-fira-code` → `font-fira-code`, `crate-async-trait` →
  `async-trait`, `vscode-esbenp.prettier-vscode` → `esbenp.prettier-vscode`).
- **plugin — `marketplace.json` and `plugin.json` are two distinct files at
  two different paths; do not conflate them.** `marketplace.json` (fetched
  once per marketplace repo) is an INDEX — its `plugins[]` entries carry a
  `source` field (used to resolve a path) and sometimes a redundant, possibly-
  stale `version` annotation. `plugin.json` (fetched per plugin, at the
  resolved path) is the plugin's OWN manifest and the sole authoritative
  source for `upstream_version` — `fetch-plugin-upstream.sh` never reads
  `.version` from `marketplace.json`. The identifier shape below depends on
  whether the note carries a `[marketplace] <name>@<marketplace>` observation,
  NOT on whether `url:` frontmatter is present. Recover the plugin name from
  `[marketplace]` when present. **Do not naively concatenate the plugin's own
  `url:`/
  `[source]` repo with an unrelated third-party marketplace's name** — verified
  real-world failure mode: `plugin-voxpelli-claude-git`'s `url:` is
  `voxpelli/claude-git` (the plugin's own dedicated repo) but its
  `[marketplace]` observation names `vp-git@vp-plugins`, a DIFFERENT repo
  (`voxpelli/vp-claude`) hosting that aggregating marketplace — concatenating
  them as `voxpelli/claude-git#vp-git` queries the wrong repo's
  `marketplace.json` and 404s.
  - **No `[marketplace]` observation at all** — a standalone dedicated repo;
    emit bare `owner/repo` from `url:`/`[source]`.
  - **`[marketplace]` observation present, and the note's own prose/
    observations confirm the marketplace is self-hosted** (the marketplace
    lives in the SAME repo as `url:`/`[source]` — the common case, e.g. a
    single-plugin repo whose one plugin may still live in a subdirectory, not
    root) — emit `owner/repo#name` using that same repo.
  - **`[marketplace]` observation present, but the note's own prose confirms
    it names a THIRD-PARTY aggregating marketplace hosted in a different
    repo** (e.g. "distributed via the aggregating `vp-plugins` marketplace...
    the repo itself carries no marketplace.json") — prefer bare `owner/repo`
    from the plugin's OWN `url:`/`[source]` instead: that repo's root
    `plugin.json` is what the note actually documents, and it resolves
    correctly without needing to know which repo hosts the third-party
    marketplace by name.

Pipe the recovered names (one per line) to the cohort's fetch script:

```
Bash("printf '%s\\n' <name1> <name2> … | bash scripts/fetch-<eco>-upstream.sh")
```

Each script emits NDJSON per name. Core fields (identical across scripts):
`name`, `upstream_version`, `homepage`, `deprecated`, `disabled`, `tier`,
`days_stale`, `upstream_state` (`ok` | `deprecated` | `disabled` |
`not-in-api` | `api-unavailable`). `fetch-brew-upstream.sh` and
`fetch-cask-upstream.sh` both emit `days_stale_source`, but with different
value enums — brew: `"release"` | `"tag"` | `null` (provenance of
`days_stale`); cask: `"tap-bump"` | `null` (its Tier-2 opportunistic bump-date
enrichment). npm/crate/vscode still don't emit it, so don't rely on its
presence for those cohorts. The vscode script adds `openvsx_version`
(raw default `.version`, may be a pre-release), `marketplace_version`,
`openvsx_namespace_access`, `openvsx_verified`, `openvsx_publisher`, and
`openvsx_prerelease` (true when the default `.version` is a pre-release). For
vscode, `upstream_version` is the resolved latest **stable** version, which can
differ from `openvsx_version`.

Join each NDJSON row back to its source note via the `name` field — it equals
the recovered name you piped in (npm `packages[0]` or the prefix-stripped
name). S4 then keys the bucket back to the note's full title (e.g. join
`fastify` → `npm-fastify`), since the report and refresh commands use titles.
**plugin is the one exception:** its join-back key is the FULL `owner/repo#name`
(or bare `owner/repo`) identifier, echoed unchanged by the fetch script — not a
simple package name — since owner/repo/name can't be losslessly recovered from
a title-derived short name the way every other cohort's prefix-strip can.

`upstream_state` describes the *upstream fact* only — drift is computed by this
skill, in S4, by comparing `upstream_version` against `bm_version`.

**Per-cohort fetch shape:**

- **brew / cask** are **bulk** (one blob fetch, indexed) — a single curl
  failure is cohort-wide `api-unavailable`.
- **npm / crate / vscode** are **per-name** — a 404 is that one note's
  `not-in-api`; a 5xx/timeout is that one note's `api-unavailable` (the rest of
  the cohort still reports normally).
- **crate** rate-limits (1 s between calls); large cohorts serialize.
- **vscode** queries **both** Open VSX (authoritative — the drift verdict) and
  the VS Marketplace (best-effort annotation). Compute drift against
  **`upstream_version`** (the resolved latest *stable* version), NOT the raw
  `openvsx_version` — Open VSX has no `stable` alias and sorts CalVer
  pre-releases above semver stable, so `.version` can be a pre-release; the
  script resolves the latest non-pre-release version into `upstream_version`.
  When `openvsx_prerelease == true` AND no stable was found (a pre-release-only
  extension), `upstream_version` is the pre-release — apply the S4
  scheme-mismatch guard before comparing against a semver `bm_version`. When
  `marketplace_version` is *ahead*, surface it as an annotation only — never
  the verdict, never a bucket. A vscode `not-in-api` (Open VSX 404) with a
  **non-empty `marketplace_version`** is the **marketplace-only** case: the
  Open VSX namespace is unclaimed/squattable and fork-IDEs (Cursor/Windsurf/Codium)
  resolve installs against it — flag it as a security exposure in S6, not a
  benign gap (see `intel`'s `references/ecosystem-vscode.md`
  "Open VSX Trust Signal").
- **plugin** is **per-identifier via `gh api`**, not a registry call —
  `marketplace.json` is fetched and cached once per distinct marketplace repo
  (not once per plugin sharing it), then each identifier's `plugin.json` is
  fetched individually. A missing/unauthenticated `gh` is cohort-wide
  `api-unavailable` (checked once via preflight, not per identifier); a 404 on
  `plugin.json`, a marketplace.json with no matching `plugins[]` entry, or a
  `plugin.json` present but with no `.version` field (verified via a live
  end-to-end run, 2026-07-04: version presence is per-PLUGIN, not
  per-marketplace — of Anthropic's 18 official plugins, 13 are version-less
  and 5 carry real `.version` fields; do not assume a whole marketplace is
  uniformly version-less from one plugin's example) is that one note's
  `not-in-api`; any other fetch failure is that one note's `api-unavailable`.

### S4. Compute drift and bucket (two-dimensional)

**Strip a leading `v`** from both `bm_version` and `upstream_version` before
comparing. Then resolve each note into a canonical bucket using the **same
2-dimensional (age × semver-distance) model the `knowledge-gardener` Step 5b-iv
defines** — that agent file is the canonical full ruleset (9 ordered rules);
the summary here must stay in lockstep with it.

**Canonical buckets:**

| Canonical bucket | Trigger |
|---|---|
| `Drifted >30d` | versions differ, `days_stale > 30` **or** semver-major escalation |
| `Drifted <30d` | versions differ, `days_stale ≤ 30` |
| `Drifted, age unknown` | versions differ, `days_stale == null` |
| `Archive candidates` | `upstream_state` is `deprecated`/`disabled` (npm, cask, brew only) |
| `Unparseable` | `bm_version == "<unparseable>"` (S2 found no pattern) |
| `Not in registry` | `upstream_state == "not-in-api"` |
| `API unavailable` | `upstream_state == "api-unavailable"` |

**Dimension 2 — semver distance** between `bm_version` and `upstream_version`,
annotated inline so the maintainer can prioritize:

| Distance class | Meaning |
|---|---|
| `semver-major` | leading major differs (`1.84.0` → `2.0.1`); for `0.x` any minor bump qualifies (pre-1.0 minor is breaking) |
| `semver-minor-multi` | major matches, minor jumped by ≥3 |
| `patch` | trailing-component (patch-level) change, **or** any same-major minor jump smaller than the `semver-minor-multi` threshold (minor difference < 3, i.e. 1 or 2) — a catch-all, not just a patch-digit-only diff |
| `distance-unknown` | either version not cleanly semver-splittable, **or** the two versions use different schemes (one is CalVer — leading component ≥ 2000 — the other is not). A scheme mismatch is NEVER escalated as `semver-major` |

**Scheme-mismatch guard (runs first):** before classifying distance, check
whether the two versions share a scheme. A leading numeric component ≥ 2000 is
CalVer; everything else is semver. If one is CalVer and the other is not,
distance is `distance-unknown` regardless of the numeric comparison — a CalVer
year (e.g. `2026.3.311859`) MUST NOT be read as a semver major against `3`. The
canonical logic is `lib/version-distance.mjs` (`classifyVersionDistance`,
fixture-tested via `check:distance`); keep this summary in lockstep with it.

**Escalation rule (preserved verbatim from the gardener):** a `semver-major`
gap forces `Drifted >30d` **regardless of `days_stale`** — a major-version gap
is forward-compatibility risk the age axis hides. Annotate the bullet with the
`[<distance-class>]` tag; the `knowledge-maintainer` Section 3b Refresh Queue
ordering keys off `[semver-major]` > `[semver-minor-multi]` > `[patch]`.

**Ahead-of-registry guard (runs before bucketing, after the scheme-mismatch
guard):** a note can legitimately record a version newer than the registry's
— e.g. it tracks a `@latest` channel that moves faster than a versioned
registry entry (`cask-claude-code` tracking `claude-code@latest 2.1.170`
against an unsuffixed registry token at `2.1.153` is a real case). Bucketing
this as `Drifted` is a false alarm, but an unguarded "note-version >
upstream-version ⇒ benign" rule would permanently mask a real extraction
mis-grab (the 0.31.4 yaml/semver incident looked exactly like "ahead" and was
actually a parsing bug). Apply this **annotation only — never a new bucket,
never the verdict** — the same shape as the vscode `marketplace_version`
precedent above. Treat a note as benignly ahead only when **both** guards
hold:

- **(a) Same-scheme, cleanly semver-parseable comparison** — `bm_version` is
  cleanly greater than `upstream_version` per `isAheadOfRegistry()` in
  `lib/version-distance.mjs` (fixture-tested via `check:distance`). This is
  the *ordering* companion to `classifyVersionDistance`'s magnitude
  classification: it returns `false` — never "ahead" — for a CalVer note on
  either side or any value that fails a clean `MAJOR.MINOR[.PATCH]` split.
  CalVer notes and comma-mangled cask strings that don't resolve to clean
  semver must NOT go through this path — you can't reliably tell "ahead"
  from "malformed" without clean structure, so they stay in the normal drift
  path.
- **(b) Registry-lag timing** — the note's own frontmatter `updated_at` (the
  same freshness field `intel`/`people-intel` already
  use) is more recent than the upstream registry's last-observed movement
  (the upstream release date, derivable from today's date minus the fetch
  script's `days_stale`). This is what distinguishes a genuine
  "we're tracking `@latest`, the registry snapshot hasn't caught up yet" case
  from an old, stale note that merely carries a higher version number for an
  unrelated reason (a bad manual edit, a copy-paste from the wrong channel).

**When both guards hold:** treat the note as current — no bucket entry (the
same "no report entry" treatment as an exact version match) — and add it to
the `#### Summary` line as an informational annotation rather than a drift
bullet, e.g. `Ahead of registry (informational, not drift): 1 note —
cask-claude-code (2.1.170 vs 2.1.153, updated 2026-06-30)`. This never adds a
`####` heading — `Summary` already exists in the canonical template.

**When guard (a) holds but guard (b) fails (or is indeterminate — e.g. no
`updated_at` on the note):** the note falls through to the normal
versions-differ rules below unchanged, but the rendered bullet carries an
extra `[ahead-of-registry?]` tag (note the trailing `?`) alongside its
`[<distance-class>]` tag — flagging it for human judgment rather than
auto-resolving it as benign. This keeps a stale note with an unexplained
higher version number visible in `Drifted`, not silently suppressed.

**Per-cohort distance notes:**

- **brew / npm / crate / plugin** are clean semver → the model applies
  directly (most `plugin.json` `version` fields are semver in practice; a
  non-semver value falls through to `distance-unknown` like any other cohort).
- **vscode** is nominally semver but some extensions run a dual-channel model
  (stable=semver, pre-release=CalVer, e.g. `biomejs.biome`). The fetch script
  resolves `upstream_version` to the latest stable version; only a
  pre-release-only extension yields a CalVer `upstream_version`, in which case
  the scheme-mismatch guard produces `distance-unknown` (never `semver-major`).
- **cask** versions are comma-mangled; after taking the leading comma-segment,
  if it is not clean semver it resolves to **`distance-unknown`** (never a false
  `semver-major`).

Within `Drifted >30d` and `Drifted <30d`, sub-sort by `days_stale` descending so
the most overdue refreshes surface first. `Drifted, age unknown` sorts to the
end of the drifted section.

### S5. Handle edge cases

- **Bulk cohort (brew/cask) unreachable** — if the only NDJSON line has
  `upstream_state="api-unavailable"`, report "Could not reach the `<eco>` API —
  staleness check skipped for this cohort" and omit that cohort's section.
- **Per-name cohort (npm/crate/vscode)** — individual `api-unavailable` rows are
  listed under the `API unavailable` bucket; they do not abort the cohort.
- **plugin, missing/unauthenticated `gh`** — every identifier reports
  `upstream_state="api-unavailable"` from a single preflight check; report
  "Could not authenticate to the GitHub API — staleness check skipped for the
  plugin cohort" and omit that cohort's section, the same treatment as the
  bulk-cohort case above. A per-identifier `not-in-api`/`api-unavailable` (gh
  authenticated, but one plugin's fetch failed) does NOT abort the cohort,
  same as the per-name case.
- **All current** — if every note in a cohort resolves to current+OK, report
  "All N documented `<eco>` notes are current with upstream." and skip that
  cohort's S6 section.

### S6. Render the report

Emit one `### Version Drift — <eco>` section per checked cohort, using canonical
`####` sub-headings (these match the gardener's names exactly — keep them
character-exact; the maintainer Section 3b text-searches for them):

````markdown
### Version Drift — npm — N documented notes checked

#### Drifted >30d (M notes — refresh recommended)

| Note | Documented | Upstream | Released | Distance | Refresh command |
|------|-----------|----------|----------|----------|-----------------|
| npm-fastify | 4.28.1 | 5.8.5 | 410d ago | `[semver-major]` | `/intel npm:fastify` |

#### Drifted <30d (P notes — recent upstream release)

| Note | Documented | Upstream | Released | Distance | Refresh command |
|------|-----------|----------|----------|----------|-----------------|
| npm-pino | 9.5.0 | 9.5.1 | 4d ago | `[patch]` | `/intel npm:pino` |
| cask-stale-tracker | 3.4.0 | 3.2.1 | 2d ago | `[patch] [ahead-of-registry?]` | `/intel cask:stale-tracker` *(guard (a) holds — 3.4.0 is cleanly ahead — but `updated_at` predates this release, so it stays Drifted flagged for human judgment)* |

#### Drifted, age unknown (Q notes)

`fetch-cask-upstream.sh` carries Tier-2 opportunistic bump-date enrichment
(mirroring brew's Tier 2) — it matches the leading comma-segment of the
current version against `Homebrew/homebrew-cask` commit history, so a cask
row now often resolves `days_stale` and sorts into `Drifted >30d`/`<30d`
instead. This bucket is no longer "cask always lands here" — it now means
Tier 2 found no matching bump commit (pre-2023-08 sharding, a pre-fonts-
migration path, an `old_tokens` rename, or `gh` unavailable/unauthed), which
still happens routinely for older casks.

| Note | Documented | Upstream | Distance | Refresh command |
|------|-----------|----------|----------|-----------------|
| cask-eza | 0.18.0 | 0.20.5 | `[distance-unknown]` | `/intel cask:eza` |

#### Archive candidates (R notes)

| Note | Documented | Upstream status | Suggested action |
|------|-----------|-----------------|------------------|
| npm-request | 2.88.2 | deprecated | `move_note(identifier="npm-request", new_path="archive/npm-request")` |

#### Unparseable (S notes)

These notes don't match any known version pattern. Run the cohort's refresh
command to restore the metadata layer.

- npm-foo, npm-bar

#### Not in registry (T notes — drift check skipped)

No comparable upstream version in the registry API — unpublished, renamed, or
removed; for brew, tap-distributed; for vscode, present only on the VS
Marketplace (not Open VSX); for crate, published but with no stable release yet
(prerelease-only — the crate exists, so this is not literal absence, but there
is nothing stable to compare); for plugin, `plugin.json` is missing or carries
no `.version` field — **a per-plugin state, not a per-marketplace one**
(verified via a live run: 13 of Anthropic's 18 official plugins are
version-less while the other 5 carry real versions — do not generalize from
one plugin's example to its whole marketplace), or the plugin has been
renamed/removed from its marketplace. Drift cannot be checked automatically.
For vscode, show the Marketplace version as an annotation when available.

**vscode security split — not all "not in registry" is benign.** When a vscode
note is `not-in-api` AND `marketplace_version` is non-empty, it is
**marketplace-only**: the Open VSX namespace is unclaimed and *squattable*, and
fork-IDEs (Cursor/Windsurf/Codium/Theia) resolve installs against Open VSX —
an attacker who registers the namespace ships malware to those users. Annotate
these as a **⚠ security exposure** (not a passive gap) and suggest a
`/intel vscode:<id>` refresh so the note records the Open VSX trust signal.
A `not-in-api` with an *empty* `marketplace_version` is the benign
"not-published-anywhere" case (likely renamed/removed/private).

- vscode-ms-something (Marketplace 1.2.3 — not on Open VSX) ⚠ squattable namespace (fork-IDE exposure)
- vscode-foo-gone (not on Open VSX or Marketplace — likely removed)

#### Summary

- Drifted >30d: M notes — top 5 by overdue days: …
- Drifted <30d: P notes
- Drifted, age unknown: Q notes
- Archive candidates: R notes
- Unparseable: S notes
- Not in registry: T notes
- API unavailable: U notes
- Current (no action needed): K notes
- Ahead of registry (informational, not drift): V notes — cask-claude-code (2.1.170 vs 2.1.153, updated 2026-06-30)
````

For cohorts whose ecosystem has no deprecation flag (`crate`, `vscode`,
`plugin`), the `Archive candidates` bucket is omitted — its absence is
expected by both this report and the maintainer.

### S7. Offer batched refresh

If 2 or more notes are in a cohort's `Drifted >30d` bucket, offer to refresh the
top 5 in parallel via the cohort's routed command (prefix → skill):
`brew-`/`cask-`/`vscode-` → `/intel <prefix>:<name>`; `npm-` →
`/intel npm:<name>`; `crate-` → `/intel crate:<name>`;
`plugin-` → `/intel plugin:<owner>/<repo>[#<name>]` (reconstruct the
colon-prefixed form from the recovered `owner/repo#name` join-back key — S3's
composite key IS this form already, just add the `plugin:` prefix).

> Want me to refresh the top 5 stale notes (released >30 days ago) now?
> I can run them as parallel calls — they're file-disjoint so this is safe.

For notes in `Drifted <30d` or `Drifted, age unknown`, ask which to refresh
individually rather than auto-batching — recent releases may be pre-stable or
short-lived. **This is a separate mechanism from the `knowledge-maintainer`
Section 3b, not the same routing:** S7 offers a live, interactive refresh
inside this skill's own `--stale` turn — on acceptance it invokes the
`Skill` tool directly, in the foreground, with the user present to approve.
Section 3b, by contrast, never executes a refresh itself; it only emits a
Refresh Queue (grouped by the same bucket/distance-class priority order used
here) for a human to action afterward in a separate, later session. The two
share the same bucket names and the same `[semver-major]` >
`[semver-minor-multi]` > `[patch]` prioritization convention — so a person
moving between a `--stale` report and a maintainer Refresh Queue sees
consistent ordering — but they are independent code paths with different
execution models, not one "matching" the other.

Example accepted batch (single turn, names recovered per S3). Hand each skill its
**whole sublist in one call** — a multi-identifier `args` string is what triggers
the executor's upgrade-haul batch path; a single identifier per call would fall
through to the normal single-note path and skip the haul (delta reel, central
cross-link pass, batch-outcome contract). One call per family — the batch
executor routes package identifiers and tool identifiers through separate
per-family adapters, so keep each call single-family:

```
Skill(skill: "intel", args: "npm:fastify npm:pino")
Skill(skill: "intel", args: "cask:warp brew:ripgrep")
```

For more than 5 `Drifted >30d` items, prioritize `[semver-major]` first, then
`[semver-minor-multi]`, then `[patch]`, and ask which to launch rather than a
larger fan-out. Track partial failures: if any refresh invocation fails, report
which succeeded vs failed rather than claiming the whole batch succeeded.

**This batched handoff IS an upgrade haul — it is the *detector* half of a
bidirectional pair.** When the user accepts, the batch routes into the
*executor* side: `intel`'s **Batch mode: upgrade haul** section for whichever
family the identifiers belong to, which loads the
shared core `skills/intel/references/upgrade-haul.md` (input parsing,
highlights-reel synthesis, the two recording axes, batch orchestration). The
executor refreshes the same Axis-A `[version]` observation this skill reads via
S2 **Pattern 3**, so the next `--stale` run sees the closed drift. The reel each
executor writes already brackets exactly the recorded→upstream delta this report
surfaces. See the reference's *Relationship to `--stale`* section — this pointer
is its reverse partner.

### S8. Scope footnote

After the report, include a one-line footnote acknowledging scope:

> *Staleness detection covers brew, npm, cask, crate, vscode (vscode checks
> both Open VSX and the VS Marketplace), and plugin (resolved live via
> GitHub's API rather than a registry). `action`, `gh`, `go`, and `docker` are
> excluded by construction — they have no single canonical comparable
> version. `skill` is unsupported (no comparable version — ships off a moving
> `main`); it is covered by `/knowledge-gaps --global` (coverage, not drift)
> instead. `pypi`, `gem`, and `composer` are deferred until their cohorts
> grow.*

**Floating-package / range-pin exclusion footnote:** always append a line
reporting the combined count of notes the S1 `@types/*` filter and the S2
range-pin filter dropped before bucketing, per cohort where nonzero — this is
what makes the exclusion auditable rather than a silent gap between "notes
enumerated" and "notes bucketed." Omit the line entirely for a cohort where
both counts are zero:

> *npm: 14 notes excluded from drift bucketing before comparison — 9
> `@types/*` packages and 5 notes with a range-pinned recorded version
> (`^`/`~`/`>=`) — both track their target's version by design, not real
> drift, so they are filtered rather than bucketed.*

**When a scope modifier narrowed the cohort** (`--limit`, `--since`, or
`--sample` was present), append a second footnote line naming which one(s) and
the resulting count — this is the difference between a scoped run and a full
sweep, and a reader of just the rendered report has no other way to tell:

> *This run was scoped: `--since 2026-06-01` excluded 210 notes touched on or
> after that date; `--limit 50` then capped the npm cohort to the first 50 of
> the remaining 178. N notes checked out of an unscoped cohort of 388. Run
> `/knowledge-gaps --stale npm` without scope flags for the full sweep.*

Omit the flags that weren't used from the sentence (a `--limit`-only run
doesn't mention `--since`); always state both the checked count and the full
unscoped cohort size so the delta is legible without re-running the audit.

## Large-cohort strategy (parallel subagents)

A cohort like a 388-note `npm` directory is too large to check in a single
`--stale` turn even with scope modifiers narrowing one run at a time — S2's
per-note reads and S3's per-name upstream fetches are both O(N), and a single
turn has a practical ceiling on tool-call count. For a cohort this size,
partition it into waves and run each wave as an isolated subagent rather than
as sequential turns in the main session.

**Partitioning:** tile the cohort into waves using **successive `--since`
cutoffs**, not `--limit`. `--limit N` always returns the *same* first N titles
for an unchanged cohort — it has no offset/page/skip mechanism in its flag
grammar — so calling it again for "wave 2" would silently re-fetch the
identical first N notes rather than advance through the cohort; `--limit`
is only safe to layer on *top* of an already date-disjoint `--since` slice,
never used alone to tile a large cohort. `--since`, by contrast, is
genuinely partition-safe, because its "untouched since `<date>`" sets nest:
an earlier (further-in-the-past) boundary always yields a *smaller* set than
a later (more-recent) boundary — anything untouched since 2020-01-01 is
necessarily also untouched since 2026-01-01, but not the reverse. So pick a
sequence of boundary dates running from oldest to most recent (e.g.
`2020-01-01`, then `2025-01-01`, then `2026-01-01`, then `2026-06-01`
against a 388-note cohort) and process waves in that order, subtracting the
union of all prior waves' titles from each new wave's `--since` result before
processing it — wave 1 is the (smallest) untouched-since-2020 set; wave 2 is
the untouched-since-2025 set minus wave 1's titles; wave 3 is the
untouched-since-2026 set minus waves 1-2's titles, and so on. Each wave then
covers a distinct date band (e.g. "last touched between 2025 and 2026"), the
bands are disjoint by construction, and the earliest (most overdue) notes
land in wave 1 — the priority order a `--stale` run wants. Waves don't need
to coordinate with each other beyond knowing which prior boundaries already
ran. **`--sample` is not partition-safe for tiling** — it draws at random,
so parallel waves using `--sample` would overlap in some places and miss
others; reserve `--sample` for a single spot-check run, never for covering a
full cohort across waves.

**Launching waves:** dispatch each wave as an `Agent` call running
`--stale <eco> --since <wave-boundary-date>`, one call per boundary date from
the sequence above, in parallel. These are read-only MCP
queries and external API reads — S7's refresh only runs on explicit
acceptance — so concurrent waves are write-safe by construction. Cap
concurrent *launches* the same way the `/intel` batch
fan-out does (a handful at once, not a burst of ten — see this project's
`CLAUDE.md` "Parallel agent orchestration" note) to avoid the API-side
admission throttle, which is distinct from any upstream data-source rate
limit. Keep `AskUserQuestion` out of a wave subagent's tool access — it
auto-approves and silently returns empty answers inside a subagent, which
would corrupt S7's interactive refresh offer; have each wave stop after S6
(render) and hand its section back, with the orchestrating turn making the S7
offer once, on the combined result.

**Skill resolution inside a subagent is unconfirmed.** A subagent inherits the
parent's tool allowlist, so it *can* invoke `Skill`, but whether
plugin-namespaced resolution (`Skill(skill: "knowledge-gaps", args: "--stale
npm --since 2026-01-01")`) works reliably from inside a subagent is
undocumented.
Don't rely on it for a wave: hand the subagent this workflow directly — read
the relevant S1-S8 steps into its prompt (or point it at this file's path)
rather than asking it to resolve `/knowledge-gaps` by name.

**Aggregating results:** each wave returns one `### Version Drift — <eco>`
section (S6), scoped to its slice, with an S8 footnote naming its `--since`
boundary. The orchestrating turn concatenates the wave sections under one report
header and sums the per-bucket counts across waves for a combined
`#### Summary` — it does not re-run S1-S3 itself just to produce a rollup.

**This is a manual stopgap, not the sanctioned mechanism.** A
Dynamic Workflow script that partitions into waves and aggregates off the
orchestrator's context was investigated as the Claude-Code-native way to
process a cohort this size, tracked as spike `vp-claude-4g53` — the spike
concluded with a **DEFER verdict** (already run and decided, not open work):
adopting it wasn't justified at current cohort sizes. The pattern above
remains the documented approach, and it is the in-plugin half of the fix.
The real fix for the underlying O(N)-read friction (S2's per-note
`read_note` calls) is a Basic Memory bulk-read feature request upstream, not
something this plugin can build around further without duplicating BM's own
indexer (YAGNI).
