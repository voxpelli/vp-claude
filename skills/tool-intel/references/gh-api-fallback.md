# `gh api` Fallback for Niche or Poorly-Indexed Repos

When DeepWiki (Step 3a) returns empty, wrong-repo, or hallucinated
answers, use `gh api` against the tool's source repository as a
structured-data fallback. **Scope**: applies fully to `action:`, `gh:`,
and `docker:` prefixes — the GitHub-rooted ecosystems where `gh` is most
useful — and **conditionally to `brew:`** (see below). Skip for `cask:`
and `vscode:`.

For `brew:`, the registry stable version (`versions.stable` from
formulae.brew.sh) is the authoritative version source — so you do not
need `gh api` for the version itself. But git tags are still useful when
the formula's stable version is *newer* than the upstream repo's newest
GitHub Release (the maintainer tagged and shipped to the formula without
cutting a Release — the `brew:sem` shape). In that case
`gh api repos/<owner>/<repo>/tags` recovers the changelog-bearing tag
that the release list omits. The `brew:` changelog step (Step 3d) points
here for exactly this case.

## Contents

- [When to Reach for This](#when-to-reach-for-this)
- [Endpoints](#endpoints)
- [Recovering a Version/Changelog from Tags](#recovering-a-versionchangelog-from-tags)
- [Per-Prefix Notes](#per-prefix-notes)
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
- DeepWiki cites specific issue or PR numbers — verify they are
  actually open and current, not closed years ago.

## Endpoints

| Goal | Command |
|------|---------|
| README, action.yml, manifest, source files | `gh api repos/<owner>/<repo>/contents/<path>` |
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

When the release list lags the true latest version, recover from tags —
but five GitHub API/CHANGELOG behaviors will silently mislead a naive read:

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

## Verification Rule

When DeepWiki returns claims about specific issues or PRs by number,
**always** run `gh issue view <n> --repo <r> --json state` to confirm
the issue is OPEN and its current state matches the claim. Closed-years-
ago issues read as live concerns when web-search snippets cite them.

## Cross-Link

See the BM tool catalog `[pattern]` observation: "`gh api` is the
structural fallback when DeepWiki and Context7 produce unreliable or
empty output for a target repo". Promoted Sprint 19 after the
`timakin/bodyclose` recovery.
