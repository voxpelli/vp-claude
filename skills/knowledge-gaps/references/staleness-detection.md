# Staleness Detection — Reference

Use this reference when `/knowledge-gaps` is invoked with the `--stale` flag.
The mode replaces the normal manifest-driven coverage workflow with a focused
upstream-drift check: it compares the version recorded in a Basic Memory note
against the current upstream version and buckets the notes.

`--stale` takes an optional ecosystem token: `--stale [brew|npm|cask|crate|vscode]`.
A bare `--stale` checks **all** supported cohorts. Drift detection is only valid
for registry-backed, single-canonical-latest, stable-channel ecosystems — these
five qualify. `action`, `gh`, `go`, and `docker` are deliberately excluded
(floating-major pins, HEAD-installs, module-path majors, mutable tags — no
canonical comparable version); reject those tokens with an error listing the
valid set.

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

If a cohort's filtered list is empty, skip that cohort silently (or, for an
explicit single-ecosystem `--stale <eco>`, report "No `<prefix>` notes
documented in Basic Memory yet — nothing to check" and suggest seeding one via
`/tool-intel` or `/package-intel`).

### S2. Extract documented version per note (MCP, multi-pattern)

For each filtered title, call:

```
read_note(identifier="<title>", include_frontmatter=true, output_format="json")
```

Issue up to 5 concurrent `read_note` calls per turn to keep latency bounded.
**The corpus is heterogeneous** — the recorded version lives in different places
in different notes (different `*-intel` template eras). Match these patterns in
**priority order, first hit wins**:

<!-- Version-extraction patterns mirrored in agents/knowledge-gardener.md Step 5b-ii — update both in lockstep (no machine contract couples them) -->

| Priority | Pattern | Example |
|---|---|---|
| 1 | Inline header pipe | `Homepage: … \| v1.39.0 \| <license>` |
| 2 | `\| Version \| <value> \|` table row | `\| Version \| 0.26.1 \|` |
| 3 | `[version]` / `[version-range]` observation | `- [version] 5.8.5` / `- [version-range] ^9.0.0` |
| 4 | Frontmatter `version:` | `version: 12.4.0` |
| 5 | `## Release Highlights` / `## Version History` newest entry | `## Release Highlights\n- **v5.8.5** (2026-05-…) — …` |
| 6 | Registry/prose fallback | `- **Version**: 0.11.13 (…)` / `Current: v3.2.4 (…)` |

Pattern 3 reads the version directly from the note's `observations` array — the
canonical `[version]` slot proposed for the package schemas (bead `f3zx` / Wave
3). It is **not yet emitted by the default `/package-intel` templates**, but it
appears in some hand-edited notes, so check it before the curated prose. Accept
either `[version]` or `[version-range]`; for a range, take the first concrete
version token (strip a leading range operator: `^`, `~`, `>=`, `>`, `<=`, `<`,
`=`). Pattern 5 takes the **highest semver** among the versions referenced in
the `## Release Highlights` or `## Version History` list (linked or bold) — do
**not** assume the top bullet is newest; these blocks are grouped by change-type
(breaking/feature/fix), not version order. **Release Highlights ranks last on
purpose:** the list is hand-curated and may lag the real latest release, so
trusting it risks a false "current" — worse than an honest `<unparseable>`. Only
fall to it when patterns 1–4 and the prose fallback all miss. Until `f3zx` lands
the `[version]` slot, Pattern 5 is what actually recovers most
otherwise-`<unparseable>` package notes.

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

Pipe the recovered names (one per line) to the cohort's fetch script:

```
Bash("printf '%s\\n' <name1> <name2> … | bash scripts/fetch-<eco>-upstream.sh")
```

Each script emits NDJSON per name. Core fields (identical across scripts):
`name`, `upstream_version`, `homepage`, `deprecated`, `disabled`, `tier`,
`days_stale`, `upstream_state` (`ok` | `deprecated` | `disabled` |
`not-in-api` | `api-unavailable`). The vscode script adds `openvsx_version`
(raw default `.version`, may be a pre-release), `marketplace_version`,
`openvsx_namespace_access`, `openvsx_verified`, `openvsx_publisher`, and
`openvsx_prerelease` (true when the default `.version` is a pre-release). For
vscode, `upstream_version` is the resolved latest **stable** version, which can
differ from `openvsx_version`.

Join each NDJSON row back to its source note via the `name` field — it equals
the recovered name you piped in (npm `packages[0]` or the prefix-stripped
name). S4 then keys the bucket back to the note's full title (e.g. join
`fastify` → `npm-fastify`), since the report and refresh commands use titles.

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
  benign gap (see `tool-intel`'s `references/ecosystem-vscode.md`
  "Open VSX Trust Signal").

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
| `patch` | trailing-component change |
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
`[<distance-class>]` tag; the `knowledge-maintainer` Section 3b batch ordering
keys off `[semver-major]` > `[semver-minor-multi]` > `[patch]`.

**Per-cohort distance notes:**

- **brew / npm / crate** are clean semver → the model applies directly.
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
| npm-fastify | 4.28.1 | 5.8.5 | 410d ago | `[semver-major]` | `/package-intel npm:fastify` |

#### Drifted <30d (P notes — recent upstream release)

| Note | Documented | Upstream | Released | Distance | Refresh command |
|------|-----------|----------|----------|----------|-----------------|
| npm-pino | 9.5.0 | 9.5.1 | 4d ago | `[patch]` | `/package-intel npm:pino` |

#### Drifted, age unknown (Q notes)

| Note | Documented | Upstream | Distance | Refresh command |
|------|-----------|----------|----------|-----------------|
| cask-eza | 0.18.0 | 0.20.5 | `[distance-unknown]` | `/tool-intel cask:eza` |

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
is nothing stable to compare). Drift cannot be checked automatically. For
vscode, show the Marketplace version as an annotation when available.

**vscode security split — not all "not in registry" is benign.** When a vscode
note is `not-in-api` AND `marketplace_version` is non-empty, it is
**marketplace-only**: the Open VSX namespace is unclaimed and *squattable*, and
fork-IDEs (Cursor/Windsurf/Codium/Theia) resolve installs against Open VSX —
an attacker who registers the namespace ships malware to those users. Annotate
these as a **⚠ security exposure** (not a passive gap) and suggest a
`/tool-intel vscode:<id>` refresh so the note records the Open VSX trust signal.
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
````

For cohorts whose ecosystem has no deprecation flag (`crate`, `vscode`), the
`Archive candidates` bucket is omitted — its absence is expected by both this
report and the maintainer.

### S7. Offer batched refresh

If 2 or more notes are in a cohort's `Drifted >30d` bucket, offer to refresh the
top 5 in parallel via the cohort's routed command (prefix → skill):
`brew-`/`cask-`/`vscode-` → `/tool-intel <prefix>:<name>`; `npm-` →
`/package-intel npm:<name>`; `crate-` → `/package-intel crate:<name>`.

> Want me to refresh the top 5 stale notes (released >30 days ago) now?
> I can run them as parallel calls — they're file-disjoint so this is safe.

For notes in `Drifted <30d` or `Drifted, age unknown`, ask which to refresh
individually rather than auto-batching — recent releases may be pre-stable or
short-lived. This matches the `knowledge-maintainer` Section 3b routing.

Example accepted batch (single turn, names recovered per S3):

```
Skill(skill: "package-intel", args: "npm:fastify")
Skill(skill: "package-intel", args: "npm:pino")
Skill(skill: "tool-intel", args: "cask:warp")
```

For more than 5 `Drifted >30d` items, prioritize `[semver-major]` first, then
`[semver-minor-multi]`, then `[patch]`, and ask which to launch rather than a
larger fan-out. Track partial failures: if any refresh invocation fails, report
which succeeded vs failed rather than claiming the whole batch succeeded.

### S8. Scope footnote

After the report, include a one-line footnote acknowledging scope:

> *Staleness detection covers registry-backed, stable-channel ecosystems: brew,
> npm, cask, crate, and vscode (vscode checks both Open VSX and the VS
> Marketplace). `action`, `gh`, `go`, and `docker` are excluded by construction
> — they have no single canonical comparable version. `plugin` is deferred (no
> central registry API; many plugins SHA-track without bumping version) and
> `skill` is unsupported (no comparable version — ships off a moving `main`);
> both are covered by `/knowledge-gaps --plugins` (coverage, not drift). `pypi`,
> `gem`, and `composer` are deferred until their cohorts grow.*
