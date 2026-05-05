# `gh api` Fallback for Niche or Poorly-Indexed Repos

When DeepWiki (Step 3a) returns empty, wrong-repo, or hallucinated
answers, use `gh api` against the tool's source repository as a
structured-data fallback. **Scope**: applies to `action:`, `gh:`, and
`docker:` prefixes — these are the GitHub-rooted ecosystems where
`gh` is most useful. Skip for `brew:`, `cask:`, and `vscode:`.

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
| Issue freshness verification | `gh issue view <n> --repo <owner>/<repo> --json state,title,closedAt` |
| PR ground truth | `gh pr view <n> --repo <owner>/<repo> --json state,mergedAt,title` |
| Maintainer profile + co-contributors | `gh api repos/<owner>/<repo>/contributors --jq '.[].login'` |
| Release count | `gh release list --repo <owner>/<repo> --limit 100 \| wc -l` |
| Latest release notes | `gh release view --repo <owner>/<repo>` |

For raw file content (decoded), pipe `gh api .../contents/<path>` through
`jq -r '.content' \| base64 -d`. For directory listings, omit the file
path: `gh api repos/<owner>/<repo>/contents` returns an array.

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
