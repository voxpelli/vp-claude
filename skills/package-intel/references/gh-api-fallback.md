# `gh api` Fallback for Niche or Poorly-Indexed Repos

When DeepWiki (Step 3a) or Context7 (Step 3b) return empty, wrong-repo,
or hallucinated answers, use `gh api` against the package's source
repository as a structured-data fallback. The endpoints below produce
stable JSON on documented GitHub REST API paths.

## When to Reach for This

Trigger conditions:

- DeepWiki returns information about a *different* repo with a similar
  name — observed Sprint 19 on `timakin/bodyclose`, where DeepWiki
  returned info about `noctx` and `go-critic`'s bodyclose check
  instead. Hallucination-class failure: confident-sounding wrong
  information.
- Context7 returns "no library found" or an unrelated package match
  for non-npm ecosystems (Go modules, Composer packages, Python
  with sparse coverage).
- DeepWiki cites specific issue or PR numbers — verify they are
  actually open and current, not closed years ago.
- The package is small, recently published, or maintained by an
  individual (poor-indexing risk).

## Endpoints

| Goal | Command |
|------|---------|
| README, manifest, source files | `gh api repos/<owner>/<repo>/contents/<path>` |
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

When the release list lags the registry version, recover from tags — but
five GitHub API/CHANGELOG behaviors will silently mislead a naive read:

- **`/tags` is ordered by creation/reachability, not semver.** Do not
  treat `.[0]` (or the first line) as "newest." Collect the tags, parse
  each to semver, sort descending, and pick the highest. The same caveat
  applies to `gh release list` (date-ordered) — pick the highest *semver*
  Release, not the top row (a backported patch can sit on top).
- **Exclude pre-releases.** Skip tags with `-rc`/`-beta`/`-alpha`/`-pre`
  suffixes and non-semver schemes (CalVer, `build-NNNN`) when choosing
  "latest stable" — recording `v2.0.0-rc1` as the stable version is worse
  than the lagging-but-correct release list. If nothing parses to a clean
  stable semver, keep the registry version unchanged.
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
  become a recorded version or changelog.
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

## Verification Rule

When DeepWiki returns claims about specific issues or PRs by number,
**always** run `gh issue view <n> --repo <r> --json state` to confirm
the issue is OPEN and its current state matches the claim. Closed-years-
ago issues read as live concerns when web-search snippets cite them —
RETRO-19 documents `golangci-lint#608` (closed 2019-09-23) being
quoted as a live panic concern in 2026.

## Cross-Contributor Discovery

Running `gh api repos/<owner>/<repo>/contributors --jq '.[].login'` on
a small repo can reveal hidden integration depth — Sprint 19 found
`ldez` (a golangci-lint maintainer) among `bodyclose`'s top
contributors, revealing that `bodyclose` is *de facto* part of
golangci-lint's quality net, actively shepherded rather than passive.

## Cross-Link

See the BM tool catalog `[pattern]` observation: "`gh api` is the
structural fallback when DeepWiki and Context7 produce unreliable or
empty output for a target repo". Promoted Sprint 19 after the
`timakin/bodyclose` recovery.
