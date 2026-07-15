# `gh api` Fallback for Niche or Poorly-Indexed Repos

When DeepWiki (in tool enrichment) or Context7 (package family only) return
empty, wrong-repo, or hallucinated answers, use `gh api` against the target's
source repository as a structured-data fallback. The endpoints below produce
stable JSON on documented GitHub REST API paths.

## Applicability by prefix

`gh api` is GitHub-rooted, so its usefulness varies by ecosystem. Each cell
below is grounded in a documented behavior — the only genuinely inferential
rows are `plugin:`/`skill:`, which **invert** the fallback framing (see the note
after the table).

| Prefix | Family | `gh api` role | Basis |
|--------|--------|---------------|-------|
| `npm` | package | **Fallback** — when Context7 misses or the package is poorly indexed; and for changelog-from-tags | Context7-miss + poor-indexing triggers below |
| `crate`, `go`, `composer`, `pypi`, `gem` | package | **Fallback (often primary structural source)** — Context7 coverage is sparse or absent for non-npm ecosystems | "Context7 returns 'no library found' / unrelated match for non-npm ecosystems" trigger below |
| `brew` | tool | **Conditional** — registry `versions.stable` (formulae.brew.sh) is authoritative for the version; use `gh api .../tags` only to recover a changelog-bearing tag when the stable version is newer than the upstream repo's newest GitHub Release | tool enrichment brew changelog step |
| `cask` | tool | **Skip** — `cask.json` is authoritative; the artifact is a prebuilt app and its changelog is rarely GitHub-rooted | tool enrichment scope |
| `vscode` | tool | **Skip** — Open VSX / VS Marketplace are authoritative for version and changelog | tool enrichment scope |
| `action` | tool | **Full** — GitHub-rooted; `action.yml` is the canonical inputs/outputs source | Per-Prefix Notes below |
| `gh` | tool | **Full** — `gh release list` drives `runtime_shape`; `contents/` inspects the script entry point | Per-Prefix Notes below |
| `docker` | tool | **Full** — find the GitHub source repo (Docker Hub `source` field / description link), then use the contents/commits/contributors endpoints | Per-Prefix Notes below |
| `plugin` | tool | **Primary (not a fallback)** — no registry exists; `plugin.json` is resolved live via `gh api`, and the changelog comes from tags/commits | `--stale plugin` is "gh-api-based, not registry-based" |
| `skill` | tool | **Source-only** — the bundle's `owner/repo` source lives on GitHub (`contents`/`commits`), but there is no canonical registry version | `--stale skill` unsupported |

**`plugin:`/`skill:` framing note.** For every other prefix, `gh api` is what
you reach for *after* DeepWiki/Context7 miss. For `plugin:` it is the
*first-line* source of truth (there is no registry and DeepWiki rarely indexes a
plugin repo), and for `skill:` it is the only structural source for the bundle's
contents. The same endpoints apply — you just don't wait for a miss to use them.

## Contents

- [When to Reach for This](#when-to-reach-for-this)
- [Endpoints](#endpoints)
- [Recovering a Version/Changelog from Tags](#recovering-a-versionchangelog-from-tags)
- [Per-Prefix Notes](#per-prefix-notes)
- [Cross-Contributor Discovery](#cross-contributor-discovery)
- [Verification Rule](#verification-rule)
- [Cross-Link](#cross-link)

## When to Reach for This

Trigger conditions:

- DeepWiki returns information about a *different* repo with a similar
  name — observed Sprint 19 on `timakin/bodyclose`, where DeepWiki
  returned info about `noctx` and `go-critic`'s bodyclose check
  instead. Hallucination-class failure: confident-sounding wrong
  information.
- DeepWiki returns "Repository not found" for an `action:` or `gh:`
  prefix that is actually live on GitHub — `voxpelli/claude-beads`
  is a current example (not indexed; upstream slug
  `steveyegge/beads` is the source of truth).
- For `gh:` extensions: when `gh release list` returns ≥1 release
  but DeepWiki has no useful answer (alpha-quality bash extensions
  are commonly missing from DeepWiki's index even when they have
  releases).
- **(package family)** Context7 returns "no library found" or an unrelated
  package match for non-npm ecosystems (Go modules, Composer packages, Python
  with sparse coverage).
- The target is small, recently published, or maintained by an
  individual (poor-indexing risk).
- DeepWiki cites specific issue or PR numbers — verify they are
  actually open and current, not closed years ago.

## Endpoints

| Goal | Command |
|------|---------|
| README, `action.yml`, manifest, source files | `gh api repos/<owner>/<repo>/contents/<path>` |
| Change history | `gh api repos/<owner>/<repo>/commits` |
| Git tags (when the release list is stale or empty) | `gh api repos/<owner>/<repo>/tags --jq '.[].name'` |
| Issue freshness verification | `gh issue view <n> --repo <owner>/<repo> --json state,title,closedAt` |
| PR ground truth | `gh pr view <n> --repo <owner>/<repo> --json state,mergedAt,title` |
| Maintainer profile + co-contributors | `gh api repos/<owner>/<repo>/contributors --jq '.[].login'` |
| Release count | `gh release list --repo <owner>/<repo> --limit 100 \| wc -l` |
| Latest release notes | `gh release view --repo <owner>/<repo>` |

For raw file content (decoded), pipe `gh api .../contents/<path>` through
`jq -r '.content' \| base64 -d`. For directory listings, omit the file
path: `gh api repos/<owner>/<repo>/contents` returns an array.

## Recovering a Version/Changelog from Tags

When the release list lags the registry / true latest version, recover from
tags — but five GitHub API/CHANGELOG behaviors will silently mislead a naive
read:

- **`/tags` is ordered by creation/reachability, not semver.** Do not
  treat `.[0]` (or the first line) as "newest." Collect the tags, parse
  each to semver, sort descending, and pick the highest. The same caveat
  applies to `gh release list` (date-ordered) — pick the highest *semver*
  Release, not the top row (a backported patch can sit on top).
- **Exclude pre-releases.** Skip tags with `-rc`/`-beta`/`-alpha`/`-pre`
  suffixes and non-semver schemes (CalVer, `build-NNNN`) when choosing
  "latest stable" — recording `v2.0.0-rc1` as the stable version is worse
  than the lagging-but-correct release list. If nothing parses to a clean
  stable semver, keep the release-list/registry version unchanged.
- **`compare/<base>...<head>` truncates at 250 commits** and returns a
  `status` field. If `total_commits` exceeds the returned `.commits`
  array, the changelog is partial — say so. If `.status` is `diverged`
  or `behind`, `<base>` is not an ancestor of `<head>` (wrong/renamed
  tag) and the commit list is meaningless — fall back to
  `commits?sha=<newest-tag>`.
- **An error is not an empty result.** `2>/dev/null` hides auth,
  rate-limit, network, and 404 failures — all of which yield empty stdout
  indistinguishable from a genuinely empty array. Treat empty output as a
  *fact* (no tags / no releases) only after confirming the command
  exited 0; the quickest check is to re-run without `2>/dev/null`. On
  error, surface it and record nothing — never let a suppressed failure
  become a recorded version, changelog, or `runtime_shape`.
- **A hand-maintained `CHANGELOG.md` can lag its own git tags.** Repos
  that cut `## [Unreleased]` into versioned headers by hand (rather than
  via an automated release tool) don't always cut on the same cadence as
  they push tags. Before trusting `## [Unreleased]` prose to attribute a
  feature to a *single* version, compare the newest version header in
  `CHANGELOG.md` against the newest semver tag from `/tags`. If the cut
  header is behind the newest tag, the `Unreleased` section is blending
  multiple releases with no boundary markers — do not attribute any of
  its content to one version. Instead derive the changelog for each
  affected version from `gh api
  repos/<owner>/<repo>/compare/<tagA>...<tagB>` commit ranges. Real case:
  `brew-sem-cli`'s note attributed two features to v0.16.2 based on
  `Unreleased` prose; `compare/v0.16.2...v0.17.0` proved both actually
  shipped in v0.17.0 (3 commits: #449/#450/#451-452), while
  v0.16.1→v0.16.2 was only a rustfmt tweak and an MCP-registry
  namespace-casing fix. At correction time the CHANGELOG's newest cut
  header (`## [0.15.1]`) was four releases behind the newest tag
  (`v0.17.0`). Corrected 2026-07-03.

## Per-Prefix Notes

- **`action:`** — `gh api repos/<owner>/<repo>/contents/action.yml` (or
  `action.yaml`) is the canonical inputs/outputs source. Pair with
  `gh release list` for version history. The contributors endpoint
  reveals supply-chain context (e.g., a single-maintainer action vs
  an organization-backed one).
- **`gh:`** — `gh release list --repo <owner>/<repo>` already drives
  `runtime_shape` classification (binary/script/local). Empty result
  means script-shape. Use `contents/` to inspect the script entry
  point referenced by the extension's `gh-` script binary or repo
  README.
- **`docker:`** — find the GitHub source repo via the Docker Hub
  `source` field or repository link in the image description, then
  use the contents/commits/contributors endpoints against that repo.
- **`plugin:`** — resolve `plugin.json` live (the `--stale plugin`
  mechanism: read the marketplace-hosted identifier's `plugin.json`
  path via `marketplace.json`, then `.version`). No registry exists, so
  this is the primary version source, and tags/commits supply the
  changelog.

## Cross-Contributor Discovery

Running `gh api repos/<owner>/<repo>/contributors --jq '.[].login'` on
a small repo can reveal hidden integration depth — Sprint 19 found
`ldez` (a golangci-lint maintainer) among `bodyclose`'s top
contributors, revealing that `bodyclose` is *de facto* part of
golangci-lint's quality net, actively shepherded rather than passive.

## Verification Rule

When DeepWiki returns claims about specific issues or PRs by number,
**always** run `gh issue view <n> --repo <r> --json state` to confirm
the issue is OPEN and its current state matches the claim. Closed-years-
ago issues read as live concerns when web-search snippets cite them —
RETRO-19 documents `golangci-lint#608` (closed 2019-09-23) being
quoted as a live panic concern in 2026.

## Cross-Link

See the BM tool catalog `[pattern]` observation: "`gh api` is the
structural fallback when DeepWiki and Context7 produce unreliable or
empty output for a target repo". Promoted Sprint 19 after the
`timakin/bodyclose` recovery.
