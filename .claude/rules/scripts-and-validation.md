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
  - `auditToolReferences()` — every `mcp__*` tool *referenced in prose* (incl.
    inline-backtick spans, via the `lib/mdast.mjs` AST walk that skips fenced
    blocks + frontmatter) must be declared in `allowed-tools`/`tools` — catches a
    used-but-undeclared tool. It does NOT flag the reverse (a declared-but-unused
    phantom tool); that stays a manual periodic audit (see the skill-development
    rule's tool-list hygiene). It fails loudly if the AST yields no scannable prose
    yet the raw bytes carry `mcp__` (or bare built-in-tool, see below) tokens (an
    unclosed fence — would otherwise pass vacuously).
  - `findUndeclaredBuiltinTools()` (called from `auditToolReferences()`) — the
    bare-built-in-tool counterpart to the `mcp__` check above (`Read`, `Write`,
    `Bash`, `Glob`, `Grep`, `Agent`, ... — the `KNOWN_BUILTIN_TOOLS` set;
    `AskUserQuestion` is deliberately excluded, see the skill-development rule's
    interaction conventions). Unlike `mcp__x__y`, a bare tool name is an ordinary
    English word, so this pass only scans **inline-code (backtick) spans** — a
    local remark walk restricted to `inlineCode` nodes (`collectInlineCodeSpans`,
    a sibling of `lib/mdast.mjs`'s `collectScannableText` kept inline in
    `validate-plugin.mjs` rather than merged into the shared helper, since the
    text-vs-code distinction only matters here) — never plain prose text, or
    ordinary sentences like "Read the file first" would false-fire. Severity is
    **`warn()`, not `error()`**: even backtick-wrapped, a tool name can
    legitimately appear in "why this skill does NOT use tool X" prose (proven
    case: nudge-adoption's `` `Glob` `` mentions, explaining a discarded design —
    grammatically identical to a genuine-use sentence, so no local rule can tell
    them apart), and a known instance is allowlisted in
    `BUILTIN_MENTION_EXCEPTIONS` (keyed `"<path>:<Tool>"`) rather than silenced
    by weakening the detector. New built-in tools — when Claude Code ships a new
    tool name that could plausibly be referenced in skill/agent prose, add it to
    `KNOWN_BUILTIN_TOOLS`; there is no automatic source of truth for this list,
    unlike `KNOWN_MCP_PREFIXES` which at least has a documented per-server
    maintenance trigger (see the skill-development rule's tool-list hygiene).
    The detector itself (`findUndeclaredBuiltinTools`,
    a pure function) has an inline self-test right after its definition —
    synthetic fixtures only, asserts it fires on a planted undeclared-tool
    reference and stays silent on an all-declared fixture — and that self-test
    **is** `error()`, since detector correctness is unambiguous even though its
    application to real prose isn't. First real-world catch: `Edit` referenced
    in `agents/knowledge-maintainer.md`'s Rule 3 but absent from its `tools:`
    list (vp-claude-v5ps).
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
  count mismatch fails. Also gates README.md's hooks-count sentence and CLAUDE.md's
  `<!-- schema-count: N -->` comment anchor against disk. `plugin.json`/
  `marketplace.json` carry no raw count to check (verified, not just unimplemented)
  and stay in sync via the release checklist; MEMORY.md is out-of-repo, also
  checklist-only.
- **`check:mdast` (`check-mdast.mjs`)** — fixture self-test for `lib/mdast.mjs`
  `collectScannableText`, which `validate-plugin.mjs` `auditToolReferences` uses
  to scan prose + inline-code for `mcp__*` tokens while skipping fenced blocks
  (any depth) + frontmatter via an AST walk (robust where regex fence-masking
  leaked: tilde fences, 4-backtick nesting). NOTE the boundary: AST is the wrong
  tool for `staleness-contract` (its target headings live INSIDE fenced blocks —
  an AST sees opaque `code` and would pass vacuously), which stays line-regex.
- **`check:installed-plugins` (`check-list-installed-plugins.mjs`)** — fixture
  self-test for `lib/installed-plugins.mjs`, the pure resolver that `/knowledge-gaps
  --global` Step 7c delegates to (via the `scripts/list-installed-plugins.mjs` CLI).
  Covers every per-plugin `source` shape (`"./"`/`"./sub"` local-string → marketplace
  repo + `#name`; `{github,repo}` → dedicated repo; `{git-subdir,url}` → parsed
  owner/repo + `#name`; unresolved → `name@marketplace` fallback) + skill
  grouping-by-`source`. The CLI's file I/O stays live-only (like `fetch-*-upstream.sh`).
- **`check:plugin-load-paths` (`check-plugin-load-paths.mjs`)** — live-globs
  `skills/**/*.md`, extracts every `${CLAUDE_PLUGIN_ROOT}/...` path referenced in
  prose (`lib/plugin-load-paths.mjs`, reusing `lib/mdast.mjs`'s
  `collectScannableText` to skip fenced blocks and template `<placeholder>`
  paths), and asserts each one resolves on disk — catches a moved/renamed shared
  reference file rotting silently, since neither `remark-validate-links` (real
  link nodes only) nor `validate-plugin.mjs` (`${CLAUDE_PLUGIN_ROOT}` inside hook
  commands only) cover this case. Fixture self-test: real path passes, dangling
  path fails, template placeholder skipped.
- **`check:bm-version-extract` (`check-bm-version-extract.mjs`)** — fixture
  self-test of the S2 version extractor (`lib/bm-version-extract.mjs`,
  `extractBmVersion`): the 6 priority-ordered patterns, the strict
  `| Version | ... |` table-row label guard (rejects `| Spec Version | ... |`),
  a semver-range-in-prose non-match paired with the same range correctly
  resolving via `[version-range]`, and a channel-mismatch table row that must
  not shadow a fresher `[version]` observation. This is the canonical logic
  that `staleness-detection.md` S2 and `knowledge-gardener.md` Step 5b-ii
  mirror as prose tables.
- **`check:analytics-guidance` (`check-analytics-guidance.mjs`)** — live +
  fixture guard against one specific regression class (fixed in v0.31.5,
  commit 972c70d): the `tool-intel` brew/cask ecosystem references, both note
  templates, and the `brew_formula`/`brew_cask` schemas once claimed "the
  formulae.brew.sh JSON API does not expose analytics" and told the skill to
  omit `[popularity]` whenever the Homebrew MCP was down — but that JSON
  response already carries an `analytics` block, so the doc contradicted the
  skill's own (correct) behavior for many releases undetected. `lib/analytics-
  guidance.mjs` exports the canonical six-file list plus two checks:
  `detectInvertedAnalyticsClaims` (fails on a reintroduced "does not expose
  analytics" / "MCP-sourced only" / "no structured fallback" phrasing) and
  `hasAnalyticsJsonFallbackMention` (a loose "analytics" ↔ "JSON" proximity
  check, so a rewrite can't silently drop the fallback mention while still
  avoiding the three banned phrasings). Deliberately narrow — this is not a
  general doc-matches-behavior framework, only a guard against this one
  regression class reappearing.
- **`check:upstream-headings` (`check-upstream-headings.mjs`)** — live +
  fixture guard against a bug-shaped entry landing under an invented or
  misspelled `## ` heading in an `UPSTREAM-*.md` file. `lib/upstream-heading-
  vocab.mjs` exports a canonical six-name vocabulary (Feature Requests, Bugs,
  Upstream Opportunities, Cross-Vendor Inconsistencies, Trend Reviews,
  Resolved) and a pure `detectInvalidHeadings` membership check. Deliberately
  a MEMBERSHIP check only — it does NOT enforce heading order (some
  conforming files legitimately space sections far apart) and does NOT
  enforce completeness (some conforming files legitimately omit optional
  sections). `UPSTREAM-basic-memory.md` is allowlisted and excluded from the
  check entirely, because it uses an unrelated heading scheme by design
  ("## Latest upstream activity", "## Open items") — rewriting a
  user-maintained tracking file's structure to fit a template would be
  exactly the kind of "changing what you don't understand" this project's
  conventions warn against. `UPSTREAM-vp-git.md`'s extra `## Resolved`
  section needed no allowlist entry once `Resolved` was added to the
  vocabulary itself.
- **`check:cohort-lockstep` (`check-cohort-lockstep.mjs`)** — live + fixture
  guard that the `--stale` cohort configuration table in
  `staleness-detection.md` and its mirrored table in `knowledge-gardener.md`
  Step 5b list the same cohort set. `lib/cohort-table-contract.mjs` extracts
  each table's cohort tokens via LINE-REGEX anchored on the shared header-row
  labels (`Prefix`/`Fetch script`/`Deprecation?`), not a markdown AST — written
  before `remark-gfm` was added to this repo (see below); now that it IS
  installed, this module deliberately stays line-regex anyway since the logic
  is already correct and tested, and migrating it to an AST walk would be
  churn with no functional benefit. (`remark-gfm` + `remark-lint-no-hidden-
  table-cell` were added to `check:md`'s own `remarkConfig` the same session,
  for a DIFFERENT reason — catching malformed table structure, e.g. an
  inconsistent column count, repo-wide via generic lint rather than this
  check's narrow cohort-specific comparison; `remark-lint-table-cell-padding`
  is explicitly disabled since it's cosmetic noise, not structural.) This is a
  DIFFERENT lockstep risk from the one flagged at
  `agents/knowledge-gardener.md`'s own "Version-extraction patterns mirrored
  ... update both in lockstep (no machine contract couples them)" comment —
  that comment is about the S2 version-extraction PATTERN PROSE (the six
  priority-ordered pattern descriptions), which this check does not cover and
  which still has no machine contract. The cohort TABLE this check does cover
  had no comment flagging it at all before this check existed — a more silent
  gap, not a more visible one.

When adding a new "X must agree with Y" invariant, follow this family: a hard
`error()` for mechanically-unambiguous checks (counts, sizes), a `warn()` for
heuristics. Anchor on a uniquely-greppable marker, never a count that recurs
across prose sentences (the use/mention footgun).

### warn()-level findings surface as GitHub annotations

`warn()` findings (5 call sites as of this writing: the bare-built-in-tool
check inside `auditToolReferences()`, unknown hook events, `type: "prompt"`
hooks, unknown skill frontmatter fields, description-length) never fail CI —
`process.exit(1)` only fires on `errors.length > 0`. That is deliberate (see
above), but a finding that can never fail CI still needs *some* CI-visible
surface or it just accumulates in scrollback forever with nothing forcing
triage. The report block at the end of `validate-plugin.mjs`, gated on
`process.env.GITHUB_ACTIONS`, additionally emits each warning as a GitHub
Actions `::warning file=<path>::<message>` workflow command (both the `file=`
property and the message are escaped per GitHub's documented workflow-command
rules via `escapeWorkflowCommandValue()`). The Actions runner parses that
format straight off stdout into a PR-visible check annotation — no
`.github/workflows/ci.yml` change was needed, since nothing in that workflow
redirects or filters the `npm run check` step's stdout (worth re-checking if
that step is ever piped through a formatter). Non-CI runs are unaffected: the
existing plain `⚠`-prefixed `console.warn` output always runs first,
unconditionally — the GitHub-annotation block is strictly additive, not a
replacement. No `warn()` call site tracks a line number today, so every
annotation currently uses the file-only form; a future call site that does
track one should add `,line=<N>` to the same workflow-command string rather
than inventing an unrelated mechanism. Net effect: any new `warn()` call
automatically gets CI visibility for free — there is nothing to remember or
wire up per call site beyond the `(file, message)` pair `warn()` already
takes. This behavior can only be verified on a real GitHub Actions run — the
annotation is an Actions-runner side effect on stdout, invisible to
`npm run check` locally.

## bm CLI quirks

Scripts using the `bm` CLI must work around three asymmetries:

- `bm tool search-notes` returns JSON by default — results array contains `title`, `permalink`, `content`, `matched_chunk`, `metadata`. Pipeable to `jq`.
- `bm tool read-note` returns a JSON envelope (`{title, permalink, file_path, content, frontmatter}`) — there is NO raw-markdown flag, and the note body is the escaped `.content` string. Pipe through `jq -r '.content'` before any line-oriented regex; a grep over the raw envelope matches the whole body as one line (verified bm 0.21.6 — every `bm tool` subcommand hardcodes JSON output). Parsed observation/section data still requires the MCP `read_note` tool.
- `bm project info` requires a project NAME argument: `bm project info main --json`. The `--json` output exposes `statistics.isolated_entities` (int), `statistics.note_types` (dict), `statistics.observation_categories` (dict), `statistics.most_connected_entities` (array).

## Script conventions

Scripts output NDJSON (one JSON object per line), use `set -euo pipefail`, and
pass shellcheck + `shfmt`. The `fetch-<eco>-upstream.sh` workers are API-only —
they never touch `~/basic-memory/`; the calling agent does BM access via MCP and
pipes names/ids on stdin.
