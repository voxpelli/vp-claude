---
paths:
  - "scripts/**"
  - "lib/**"
  - "validate-plugin.mjs"
---

# Scripts & validation rules

Loads when editing `scripts/**`, `lib/**`, or `validate-plugin.mjs`. The root
`CLAUDE.md` carries the script inventory table and the `bd` quirks; this rule
carries the `bm` CLI quirks and the full picture of the repo's drift guards.

## Drift guards (the "make drift fail CI" family)

`npm run check` runs `run-p check:*`. Several of those targets exist specifically
to turn silent doc/config drift into a hard CI failure — the house pattern is
"assert agreement between two surfaces at check time rather than trust prose":

- **`check:plugin` (`validate-plugin.mjs`)** — structural validation of skills,
  agents, hooks. Notable assertions:
  - `auditToolReferences()` — every tool in a component's `allowed-tools`/`tools`
    must actually be referenced in its prose (catches phantom tools).
  - `validateMcpPrefixes()` — every `mcp__<server>__*` prefix used must be in
    `KNOWN_MCP_PREFIXES` (catches typos / undocumented MCP deps).
  - phantom-subagent check — keys on `subagent_type=` so it survives the
    `Task`→`Agent` rename.
  - **CLAUDE.md size guard** — `error()`s if `CLAUDE.md` is ≥ 39,000 chars, i.e.
    1k below Claude Code's own 40k "Large CLAUDE.md" warning, so CI fails
    *before* the warning would fire at session start. This is why bulk reference
    lives in `.claude/rules/*.md` (path-scoped, conditionally loaded, off the
    session-start budget) instead of inline.
- **`check:contract` (`check-staleness-contract.mjs`)** — fixture self-test of the
  emit↔consume staleness drift-bucket contract (imports `lib/staleness-contract.mjs`);
  proves the validator catches bucket-string drift between the gardener (emit) and
  the maintainer (consume).
- **`check:distance` (`check-version-distance.mjs`)** — fixture self-test of the
  semver↔calver version-distance classifier (imports `lib/version-distance.mjs`);
  proves the scheme-mismatch guard and the version-zero rule hold.
- **`check:hooks` (`check-hooks.mjs`)** — integration test that each hook emits
  exactly one JSON object on stdout.
- **`check:md` / `check:sh`** — remark `--frail` (markdown, including these
  `.claude/rules/*.md` files) and shellcheck + `shfmt -d` (all `hooks/*.sh` and
  `scripts/*.sh`).
- **`check:fourthwall` (`check-fourthwall.mjs`)** — fixture self-test of the
  fourth-wall rule registry (`lib/fourth-wall-rules.mjs`): every deterministic
  `detect` fires on a planted violation and stays silent on near-misses, the
  vp-note-quality SKILL.md documents every rule id, and its Rule-Registry table's
  deterministic/judgment column matches the registry flags. The gardener/maintainer
  `search_notes` scans align by convention (markdown agents — not contract-checked).
- **`check:release-counts` (`check-release-counts.mjs`)** — live + fixture check
  that CLAUDE.md's `### Skills/Agents/Hooks (N)` headings match on-disk counts
  (`lib/release-counts.mjs`); fixtures prove the parser is heading-anchored and a
  count mismatch fails. CLAUDE.md only — other release surfaces stay in sync via
  the release checklist.
- **`check:mirror` (`check-mirror.mjs`)** — asserts prose blocks deliberately
  duplicated across files (wrapped in paired `<!-- mirror:start <id> -->` /
  `<!-- mirror:end <id> -->` markers) stay byte-identical per group. Replaces the
  honor-system "mirrored — update both" comments; the first group is
  `research-verify-capture` (package-intel ↔ tool-intel). Add a block to a group
  by wrapping it in same-`<id>` markers in 2+ files.
- **`check:mdast` (`check-mdast.mjs`)** — fixture self-test for `lib/mdast.mjs`
  `collectScannableText`, which `validate-plugin.mjs` `auditToolReferences` uses
  to scan prose + inline-code for `mcp__*` tokens while skipping fenced blocks
  (any depth) + frontmatter via an AST walk (robust where regex fence-masking
  leaked: tilde fences, 4-backtick nesting). NOTE the boundary: AST is the wrong
  tool for `staleness-contract` (its target headings live INSIDE fenced blocks —
  an AST sees opaque `code` and would pass vacuously), which stays line-regex.

When adding a new "X must agree with Y" invariant, follow this family: a hard
`error()` for mechanically-unambiguous checks (counts, sizes), a `warn()` for
heuristics. Anchor on a uniquely-greppable marker, never a count that recurs
across prose sentences (the use/mention footgun).

## bm CLI quirks

Scripts using the `bm` CLI must work around three asymmetries:

- `bm tool search-notes` returns JSON by default — results array contains `title`, `permalink`, `content`, `matched_chunk`, `metadata`. Pipeable to `jq`.
- `bm tool read-note` has NO `--output-format json` flag — only raw markdown. The structured observations array is only available via the MCP `read_note(output_format='json')` tool. Scripts using `bm tool` cannot get parsed section data and must text-parse instead.
- `bm project info` requires a project NAME argument: `bm project info main --json`. The `--json` output exposes `statistics.isolated_entities` (int), `statistics.note_types` (dict), `statistics.observation_categories` (dict), `statistics.most_connected_entities` (array).

## Script conventions

Scripts output NDJSON (one JSON object per line), use `set -euo pipefail`, and
pass shellcheck + `shfmt`. The `fetch-<eco>-upstream.sh` workers are API-only —
they never touch `~/basic-memory/`; the calling agent does BM access via MCP and
pipes names/ids on stdin.
