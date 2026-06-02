# UPSTREAM: vp-git

Friction, feature requests, and contribution opportunities against the
[vp-git](https://github.com/voxpelli/claude-git) plugin's skills and tooling,
discovered while building vp-knowledge. vp-git is a sibling plugin in the
`vp-plugins` marketplace; per the sibling-vs-upstream carve-out, concrete
artifact-level fixes (bugs, feature requests, contributions against shipped
skills/tooling) belong here, while cross-project patterns and divergences
belong in `SYNERGY-vp-git.md`.

## Bugs

- **README.md skill list is stale — lists 2 skills, ships 3** (2026-06-02) —
  `README.md` "## Skills" documents only `/rebase-validate` and
  `/stack-cascade`; the `tag-audit` skill (added in v0.8.0, 2026-05-27) is
  missing, while `plugin.json`, `CLAUDE.md`, and `CHANGELOG.md` all correctly
  list 3. Surfaced by the 2026-06-02 sibling teardown. This is exactly the
  drift class a `check:release-counts` assertion (assert component counts
  match across plugin.json / README / CLAUDE.md / marketplace) would catch —
  vp-git has no such gate (neither does vp-knowledge yet; tracked as a shared
  extraction in `SYNERGY-vp-git.md` and the `@voxpelli/claude-plugin-tools`
  bundle).
  Ownership: upstream (vp-git) · Workaround: n/a — cosmetic doc drift; the
  plugin loads all 3 skills correctly from `plugin.json`.

## Feature Requests

_No entries yet._

## Upstream Opportunities

- **Adopt vp-git's deterministic-verdict-before-LLM discipline** (2026-06-02) —
  vp-git's `rebase-validate` is the family's reference implementation of
  "the deterministic tool computes the verdict; the model orchestrates and
  classifies, never reasons in its place," with a fail-loud-over-false-zero
  rule (the Step-2 summarizer `sys.exit`s rather than report a plausible zero,
  and records "tool unavailable" as distinct from "tool passed"). vp-knowledge
  already half-practices this (`fetch-*-upstream.sh` compute drift verdicts,
  the LLM narrates) but should codify the fail-loud guard in its audit scripts
  wherever a tool can silently emit empty output. This is an _adoption_
  opportunity (we learn from them); also tracked in `SYNERGY-vp-git.md`.
  Ownership: us (vp-knowledge to adopt) · Workaround: n/a

## Resolved

_No entries yet._
