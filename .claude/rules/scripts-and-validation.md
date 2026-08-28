---
paths:
  - "scripts/**"
  - "lib/**"
  - "validate-plugin.mjs"
---

# Scripts & validation rules

Loads when editing `scripts/**`, `lib/**`, or `validate-plugin.mjs`. This rule
carries the per-script inventory table, the `bm` CLI quirks, and the full
picture of the repo's drift guards. The root `CLAUDE.md` keeps only a pointer
here, so the inventory costs nothing at session start; the `bd` quirks live
there, under `## Task Tracking`.

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
    case: `nudge`'s `` `Glob` `` mentions (inherited from the pre-0.33.0
    nudge-adoption skill when it merged into `nudge`), explaining a discarded design —
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
  proves the scheme-mismatch guard and the version-zero rule hold. Also carries a
  SOURCE-SCAN drift guard: every `return '...'` literal in
  `classifyVersionDistance`'s body must appear in the exported
  `VERSION_DISTANCE_CLASSES` tuple, so a new class cannot reach a consumer that
  ORDERS by class (`lib/npm-triage.mjs`'s `DRIFT_ORDER`) without being ranked.
  Scanning source rather than asserting `Object.keys(DRIFT_ORDER)` against the
  tuple is the whole point — that form was written first and is vacuous, since
  the map is derived from the tuple. A vacuity guard fails loudly if the scan
  finds no function.
- **`check:npm-triage` (`check-npm-triage.mjs`)** — fixture self-test of the npm
  staleness sweep's decision logic (`lib/npm-triage.mjs`): the action-class chain,
  `normalizeNpmName`, `buildGate`, and `compareRows` (the lexicographic ordering,
  exercised by sorting an array and asserting the id sequence — the order is the
  observable). Note the inverted convention it carries —
  a `DEFECT:`-prefixed case asserts the CURRENT WRONG answer, deliberately, so a
  known defect has a failing-test trigger when it is fixed rather than being
  changed unobserved. Do not "correct" a `DEFECT:` expectation without also
  fixing the code it describes. The five pinned when the file was written are
  all now flipped (three gate checks that could not fail, and the `<digits>.x`
  fall-through into confirmed drift); the convention stands for the next one.
  A FOURTH vacuous check was found here in 2026-08 by plant-and-revert — a
  drift-class coverage assertion whose two sides were both derived from one
  tuple — and this file wrote it, so the rule applies to the guards as much as
  to the code they guard.
- **`check:ndjson` (`check-ndjson.mjs`)** — fixture self-test of the shared
  NDJSON reader/writer (`lib/ndjson.mjs`). The case that earns it: a truncated
  line is COUNTED and reported, never thrown on and never dropped. The two sweep
  drivers had diverged on exactly that — `rank.mjs` counted it, `registry-shard.mjs`
  called bare `JSON.parse` and died — and the disagreement was invisible because
  exercising either took a live 21-minute sweep.
- **`check:npm-downloads` (`check-npm-downloads.mjs`)** — fixture self-test of
  `lib/npm-downloads.mjs`. api.npmjs.org answers a ONE-name request with an
  unwrapped body (`{downloads, start, end, package}`) rather than a keyed map, and
  the bulk path read it as a keyed map — so a package npm had answered for with a
  real number was filed "npm never answered". Reachable whenever
  `plain.length % 128 === 1`. The interpreters lived inline in a top-level-await
  driver, so before the extraction there was nowhere to put this test at all;
  a live run could only reach the case by accident.
- **`check:http-json` (`check-http-json.mjs`)** — fixture self-test of the
  throttle-aware fetcher (`lib/http-json.mjs`) against a SCRIPTED FAKE fetch, so
  the retry policy is observable without a live registry. Covers `Retry-After` in
  both RFC 9110 forms (delta-seconds and HTTP-date, both capped), jitter in both
  backoff arms, 404 never retried, 429/5xx retried, non-throttle 4xx not retried,
  and the attempt count riding along in the failure reason (`http-429/5`). The
  policy it replaced — `sleep(500 * attempt)` twice, `Retry-After` ignored — lost
  462 of the 512 eligible download counts in the 2026-08-05 sweep and shipped precisely
  because a 21-minute run was the only way to see it.
- **`check:hooks` (`check-hooks.mjs`)** — integration test that each hook emits
  exactly one JSON object on stdout.
- **`check:host-parity` (`check-host-parity.mjs`)** — the `hooks/` ↔
  `extensions/` counterpart to `check:agent-parity`. Four policies are
  implemented once per host (the audit cadence, the BM error taxonomy, the
  graph guidance, the quality-check message text) and nothing compared them
  until 0.35.0. It cost a live bug: the cadence disagreed by a full sprint for
  every release up to 0.34.0 while BOTH sides were tested, because each guard
  only checked that its own copy was self-consistent. This one is deliberately
  behavioural — comparing two documents is the shape that failed.
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
  commit 972c70d): the `intel` brew/cask ecosystem references, both note
  templates, and the `brew_formula`/`brew_cask` schemas once claimed "the
  formulae.brew.sh JSON API does not expose analytics" and told the skill to
  omit `[popularity]` whenever the Homebrew MCP was down — but that JSON
  response already carries an `analytics` block, so the doc contradicted the
  skill's own (correct) behavior for many releases undetected. `lib/analytics-
  guidance.mjs` exports the canonical seven-file list (README included) plus two checks:
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
  vocab.mjs` exports a canonical five-name vocabulary (Feature Requests, Bugs,
  Upstream Opportunities, Cross-Vendor Inconsistencies, Trend Reviews) and a
  pure `detectInvalidHeadings` membership check. Deliberately
  a MEMBERSHIP check only — it does NOT enforce heading order (some
  conforming files legitimately space sections far apart) and does NOT
  enforce completeness (some conforming files legitimately omit optional
  sections). `UPSTREAM-basic-memory.md` is allowlisted and excluded from the
  check entirely, because it uses an unrelated heading scheme by design
  ("## Latest upstream activity", "## Open items") — rewriting a
  user-maintained tracking file's structure to fit a template would be
  exactly the kind of "changing what you don't understand" this project's
  conventions warn against. `Resolved` was a sixth vocabulary member until
  2026-08-28 and is now deliberately absent: a resolved entry is DELETED, and
  git history is the record, so a `## Resolved` heading failing this check is
  the intent rather than an oversight (see `CLAUDE.md` → Upstream trackers).
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

## Script inventory

One row per file in `scripts/`. Moved here from `CLAUDE.md` so it loads only
when you are actually editing this tree.

| Script | Purpose | Used by |
|--------|---------|---------|
| `audit-scope-leak.sh <bm-root>` | Detect project-specific content (paths, env vars) in cross-project notes | gardener Step 7b |
| `fetch-brew-upstream.sh` (stdin: names) | API-only: fetch upstream version/homepage/deprecated/disabled facts from formulae.brew.sh for a list of formula names piped on stdin; Tier 2 enrichment via gh release timing. **Never accesses `~/basic-memory/`** — the calling agent does BM access via MCP and pipes names here. | gardener Step 5b, `/knowledge-gaps --stale` |
| `fetch-cask-upstream.sh` (stdin: tokens) | API-only: bulk `cask.json` indexed by token; leading comma-segment version, deprecated/disabled, `version=="latest"` → not-in-api. NDJSON-identical contract to brew. | gardener Step 5b, `/knowledge-gaps --stale cask` |
| `fetch-npm-upstream.sh` (stdin: names) | API-only: abbreviated packument per name; `dist-tags.latest`, `.modified` age, latest-version `deprecated`. Scoped names work unencoded. | gardener Step 5b, `/knowledge-gaps --stale npm` |
| `fetch-crate-upstream.sh` (stdin: names) | API-only: crates.io per name; `max_stable_version` + matching `created_at`. Required User-Agent, 1 s rate-limit between calls. | gardener Step 5b, `/knowledge-gaps --stale crate` |
| `fetch-vscode-upstream.sh` (stdin: ids) | API-only: dual-source per `publisher.ext` id — Open VSX (authoritative verdict, `.version`/`.timestamp`) + VS Marketplace `extensionquery` (best-effort `marketplace_version` annotation). | gardener Step 5b, `/knowledge-gaps --stale vscode` |
| `fetch-plugin-upstream.sh` (stdin: `owner/repo[#name]`) | `gh api`-only (no registry exists): resolves a marketplace-hosted identifier's `plugin.json` path live via `marketplace.json`, then reads `.version`. Composite join-back key — `name` in NDJSON output echoes the full input identifier, not a package name. | gardener Step 5b, `/knowledge-gaps --stale plugin` |
| `audit-helpers.sh <subcommand>` | Dispatcher: bm-stats, scope-leak-summary, scope-leak-detail | gardener Step 0.5, 7b |
| `check-hooks.mjs` | Integration tests verifying each hook emits exactly one JSON object | `npm run check:hooks` |
| `check-pi-load.mjs` | Offline Pi smoke test: validates the shared `skills/` tree via Pi's own `loadSkillsFromDir` (error- and collision-level diagnostics fail) and imports the `extensions/` factory. The `node:test` suites for `extensions/` live in `test/` and run via `test:node` (out of `check:*`); `npm test` runs `check` then `test:node`. | `npm run check:pi-load` |
| `check-staleness-contract.mjs` | Fixture tests for the emit↔consume staleness drift-bucket contract (imports `lib/staleness-contract.mjs`) — proves the validator check catches bucket-string drift | `npm run check:contract` |
| `check-version-distance.mjs` | Fixture tests for the semver↔calver version-distance classifier (imports `lib/version-distance.mjs`) — proves the scheme-mismatch guard and version-zero rule hold, plus a source-scan drift guard that every `return '...'` in `classifyVersionDistance` is declared in `VERSION_DISTANCE_CLASSES` (asserting the consumer's derived map against that tuple instead is vacuous — that form shipped and was caught by plant-and-revert) | `npm run check:distance` |
| `check-fourthwall.mjs` | Fixture tests for the fourth-wall rule registry (imports `lib/fourth-wall-rules.mjs`) — every deterministic `detect` fires on a planted violation + stays silent on near-misses; vp-note-quality documents every rule id + its Detection column matches the registry | `npm run check:fourthwall` |
| `check-release-counts.mjs` | Live + fixture check: CLAUDE.md `### Skills/Agents/Hooks (N)` headings, README.md's hooks-count sentence, and CLAUDE.md's schema-count comment anchor all match on-disk counts (imports `lib/release-counts.mjs`) | `npm run check:release-counts` |
| `check-mdast.mjs` | Fixture self-test for `lib/mdast.mjs` `collectScannableText` — proves prose + inline-code is collected while fenced blocks (any depth: tilde, 4-backtick nesting) + frontmatter are skipped (powers `auditToolReferences`) | `npm run check:mdast` |
| `list-installed-plugins.mjs` | CLI for `/knowledge-gaps --global` Step 7c: reads `~/.claude/plugins/*` + `~/.agents/.skill-lock.json`, emits NDJSON `{identifier, title, installedAt, members, sourceResolved}` per installed plugin/skill (file I/O only — resolution in `lib/installed-plugins.mjs`) | `/knowledge-gaps --global` |
| `check-plugin-load-paths.mjs` | Live + fixture check: every bare `${CLAUDE_PLUGIN_ROOT}/...` cross-load path in `skills/**/*.md` prose (imports `lib/plugin-load-paths.mjs`) resolves on disk — catches a moved/renamed shared reference file that remark-validate-links and validate-plugin.mjs's hook-command resolution both miss | `npm run check:plugin-load-paths` |
| `check-portability.mjs` | Warn-only live scan + hard classifier self-test (imports `lib/portability-scan.mjs`): classifies every `${CLAUDE_PLUGIN_ROOT}` ref in skill prose as same-skill (fixable portability debt — breaks under a standalone skills.sh install), cross-skill (accepted — a sibling-skill dependency), or tooling. Orthogonal to `check:plugin-load-paths` (resolves-on-disk vs. standalone-install survivability) | `npm run check:portability` |
| `check-list-installed-plugins.mjs` | Fixture tests for `lib/installed-plugins.mjs` resolver — every owner/repo source shape (`./`, `./sub`, github, git-subdir, unresolved) + skill grouping-by-source | `npm run check:installed-plugins` |
| `check-bm-version-extract.mjs` | Fixture tests for the S2 version extractor (imports `lib/bm-version-extract.mjs`) — covers all 6 priority-ordered patterns + the strict table-row label guard, the semver-range-in-prose non-match, and the channel-mismatch regression; this is the canonical logic mirrored as prose in `staleness-detection.md` S2 and `knowledge-gardener.md` Step 5b-ii | `npm run check:bm-version-extract` |
| `check-npm-triage.mjs` | Fixture tests for the npm staleness sweep's decision logic (imports `lib/npm-triage.mjs`) — the action-class chain, the name normalizer, the completeness gate, and the lexicographic ordering key (`compareRows`, tested by sorting and asserting the id sequence). Unusually, it **pins defects**: a `DEFECT:`-prefixed case asserts the wrong answer the code currently gives, so a remediation commit has to flip a failing assertion rather than silently change behaviour. When a `DEFECT:` case starts failing, that is the fix landing. The five originally pinned are all flipped; the convention stands for the next one | `npm run check:npm-triage` |
| `check-ndjson.mjs` | Fixture tests for `lib/ndjson.mjs`: truncated lines counted not thrown, blank lines skipped without counting as malformed, duplicate ids reported with first-wins, a missing file distinguished from a corrupt one, and the trailing newline **asserted on raw bytes** — a round trip through `readNdjson` cannot see it go missing, since the reader skips blank lines (found by plant-and-revert; `wc -l` is what cares, and the orchestrator verifies every shard write with it) | `npm run check:ndjson` |
| `check-npm-downloads.mjs` | Fixture tests for `lib/npm-downloads.mjs`, the api.npmjs.org response interpreters: chunk boundaries at 127/128/129/256/257, the two response SHAPES told apart (a one-name request gets an UNWRAPPED body, not a keyed map — misread as `downloads-not-returned` before the extraction), and the seven emitted states. Pins the emitted forms **including** the unbounded `downloads-unavailable:<reason>` suffix; the six-bucket collapse is `stateBucket()`'s job in `rank.mjs` and is asserted there, not here | `npm run check:npm-downloads` |
| `check-http-json.mjs` | Fixture tests for `lib/http-json.mjs` against an injected fake fetch: `Retry-After` parsing (both forms, capped), jittered backoff, which statuses retry, and the attempt count in the failure reason | `npm run check:http-json` |
| `check-analytics-guidance.mjs` | Live + fixture check: the two `intel` brew/cask ecosystem references, both note templates, the `brew_formula`/`brew_cask` schemas, and the user-facing `README.md` (imports `lib/analytics-guidance.mjs`) never reintroduce the inverted "JSON API does not expose analytics" claim fixed in v0.31.5, and each still mentions the JSON `analytics` fallback | `npm run check:analytics-guidance` |
| `check-observation-metadata.mjs` | Fixture tests for the observation `Verified:`/`Since:`/`Ownership:` trailer parser (imports `lib/observation-metadata.mjs`) — valid trailers, near-miss non-matches that must not parse (lowercase field names, missing colon, ordinary em-dash prose), and malformed field values (non-ISO date, invalid calendar date, non-version `Since`, unenumerated `Ownership`) | `npm run check:obs-metadata` |
| `check-schema-vocab.mjs` | Fixture tests for the relation-vocabulary malformed-variant drift guard (imports `lib/schema-vocab.mjs`) — picoschema Note-field extraction, `## Relation Vocabulary` bullet-candidate extraction, the space/colon malformed-variant detector (the v0.29.1 bug class), and confirms a well-formed-but-undeclared verb is deliberately left unflagged (that class belongs to `/schema-evolve`'s interactive reconciliation, not this guard) | `npm run check:schema-vocab` |
| `check-upstream-headings.mjs` | Live + fixture check: every `## ` heading in a non-allowlisted `UPSTREAM-*.md` file (imports `lib/upstream-heading-vocab.mjs`) is a member of the canonical vocabulary (Feature Requests, Bugs, Upstream Opportunities, Cross-Vendor Inconsistencies, Trend Reviews) — a membership check only, not order or completeness; `UPSTREAM-basic-memory.md` is allowlisted (genuinely different heading scheme by design) | `npm run check:upstream-headings` |
| `check-ast-grep.mjs` | Runs the `.ast-grep/rules/` bespoke lint suite (via the `@ast-grep/cli` devDependency) over `lib/`+`scripts/`; in CI (`GITHUB_ACTIONS`) passes `--format github` so ast-grep's own native workflow-command annotations cover these findings, the same CI-visible-warnings treatment `validate-plugin.mjs`'s hand-rolled `warn()` gets, with no reimplementation needed. Detect-only — never mutates; see `npm run fix:ast-grep` and `.claude/rules/ast-grep-rules.md` | `npm run check:ast-grep` |
| `list-notes.mjs` | Enumerates every note in a project as NDJSON `{_record:'note', title, permalink, entityId}` plus a terminal `_record:'summary'` sentinel; the corpus side of the link-integrity pipeline, since `buildTitleIndex` needs every note's title AND permalink and nothing else produced that list. Exits non-zero on any partial run. I/O only — argv, envelope validation, paging and the completeness verdict live in `lib/bm-search.mjs` | link-integrity pipeline |
| `list-unresolved-links.mjs` | Enumerates dangling relations as NDJSON `_record:'edge'` rows; `--all` additionally emits resolved edges tagged `resolved`, for the prose-verb spurious detector (a prose-shaped relation verb can land on a real note and then looks healthy in the relation index). Explicit mode, never a widened default. Exits non-zero on any partial run | link-integrity pipeline |
| `check-host-parity.mjs` | Behavioural drift guard between `hooks/` (Claude Code, bash) and `extensions/` (Pi, JS) — the counterpart to `check:agent-parity` for the pair that had none. Runs the real hook as a subprocess and the real JS function in-process rather than comparing two documents: the audit cadence byte-for-byte across a full 4-sprint cycle (sampling two counts is what let an off-by-one ship), and the BM error taxonomy by CORRESPONDENCE, since the two vocabularies genuinely differ — 5 bash tags vs 7 JS categories — so byte-parity would be the wrong assertion. `lib/host-parity.mjs` holds the mapping plus a DECLARED Pi-only list, and the coverage check's two sides are hand-written vs classifier-returned on purpose | `npm run check:host-parity` |
| `check-pool.mjs` | Fixture tests for `lib/pool.mjs`, the bounded worker pool the two shard drivers and `downloads-batch.mjs` now share instead of keeping three hand-written copies of the same loop. Pins the two properties a live sweep cannot show you — a broken concurrency cap still finishes, and a scrambled result order still reconciles — plus the rejection path, since `onError` is a required parameter precisely so a caller cannot inherit a silent drop | `npm run check:pool` |
| `check-bm-search.mjs` | Fixture tests for `lib/bm-search.mjs` — every envelope field required (each "must throw" case is one that previously coerced an unrecognised response into a clean-looking empty page), row shaping for both entity and relation rows incl. the absent-vs-explicit-`null` `to_entity` distinction, the paging loop driven against an injected fake, and the completeness verdict incl. empty-but-complete | `npm run check:bm-search` |
| `check-cohort-lockstep.mjs` | Live + fixture check: the `--stale` cohort configuration table in `staleness-detection.md` and its mirrored table in `knowledge-gardener.md` Step 5b (imports `lib/cohort-table-contract.mjs`) list the same cohort set — line-regex anchored on the shared header-row labels (`Prefix`/`Fetch script`/`Deprecation?`), not a markdown AST (no `remark-gfm` table-parsing dependency installed) | `npm run check:cohort-lockstep` |
| `check-mcp-naming-guidance.mjs` | Live + fixture check: no file in `MCP_NAMING_FILES` (imports `lib/mcp-naming-guidance.mjs`) restates the retired MCP naming rule as live guidance. Deliberately an explicit allowlist rather than a repo-wide scan — a bare hyphen/underscore grep hits Rust crate-name prose and the colon-to-hyphen title migration. Every pattern requires SERVER context for the same reason. A historical qualifier (`used to`, `was wrong`, …) within the preceding 400 chars exempts a match, so the fixed function's own docblock and the design records stay legal | `npm run check:mcp-naming-guidance` |
| `check-agent-parity.mjs` | Drift guard between the canonical `agents/` set and the hand-maintained `agents-pi/` port: recomputes each canonical agent's BODY sha256 and compares it to the port's `portedFrom` frontmatter marker, failing on a missing port or a stale marker. Frontmatter is deliberately outside the hash — only the body is the ported content. Its three early returns each push an error before returning (a missing `agents/`, an unreadable one, and an `agents/` holding zero `.md` files — the vacuous case that made the loop iterate nothing and report success) | `npm run check:agent-parity` |
| `port-agent-frontmatter.mjs <agents/name.md>` | Mechanically translates one canonical agent's frontmatter to the pi-subagents superset (`mcp__*` and capitalized builtins → pi tool names, `model: inherit` dropped, `thinking`/`thinkingLevel`/`max_turns` added). Prints to stdout; never writes | `port-agent-to-pi.mjs`, manual re-ports |
| `port-agent-to-pi.mjs <agents/name.md>` | Full-file port: the frontmatter above plus mechanical body adaptation (tool renames, `mcp__` flattening, `Skill` → "read the skill", `CLAUDE.md` → `AGENTS.md`) and the `portedFrom` marker `check:agent-parity` reads. Output still needs hand review — the body adaptation is mechanical, not semantic | re-porting after a canonical agent changes |

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
