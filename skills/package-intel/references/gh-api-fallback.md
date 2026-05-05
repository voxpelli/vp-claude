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
| Issue freshness verification | `gh issue view <n> --repo <owner>/<repo> --json state,title,closedAt` |
| PR ground truth | `gh pr view <n> --repo <owner>/<repo> --json state,mergedAt,title` |
| Maintainer profile + co-contributors | `gh api repos/<owner>/<repo>/contributors --jq '.[].login'` |
| Release count | `gh release list --repo <owner>/<repo> --limit 100 \| wc -l` |
| Latest release notes | `gh release view --repo <owner>/<repo>` |

For raw file content (decoded), pipe `gh api .../contents/<path>` through
`jq -r '.content' \| base64 -d`. For directory listings, omit the file
path: `gh api repos/<owner>/<repo>/contents` returns an array.

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
