---
paths:
  - ".ast-grep/**"
  - "sgconfig.yml"
---

# ast-grep structural lint rules

`.ast-grep/rules/` holds bespoke [ast-grep](https://ast-grep.github.io/) YAML
rules enforcing house conventions over `lib/`+`scripts/` source — both
`language: javascript` (the original four) and `language: bash` (three more,
added for the `scripts/fetch-<eco>-upstream.sh` script family). `sgconfig.yml`
at the repo root declares `ruleDirs` (auto-discovery for `ast-grep scan`/`ast-grep
test` with no `--rule`/`--config` flag needed) and `testConfigs` (test-fixture
location for `ast-grep test`). A rule's own `language:` field scopes it to
matching files automatically — `ast-grep scan lib/ scripts/` runs every rule
against both dirs and each rule only fires on files of its declared language,
so JS and bash rules coexist in the same `ruleDirs` with no manual routing.

This is a **different category** from the drift-guard family in
`scripts-and-validation.md` — that file's own framing is "assert agreement
between two surfaces at check time rather than trust prose" (doc ↔ disk, emit ↔
consume). These rules are single-surface source lints — bespoke, project-authored
code-quality rules closer in spirit to a custom eslint rule set than to a drift
guard. That's why they get their own rule file rather than folding into that one.

## Rule inventory

| Rule id | Catches | Severity | Fixable | Grounded in |
|---------|---------|----------|---------|-------------|
| `no-commonjs-require` | `require(...)` calls | error | no — unsafe to auto-rewrite (import hoisting/placement differs too much from a blind rewrite) | CLAUDE.md MUST: ESM-only |
| `no-identifier-shadow-call` | `const $NAME = $NAME(...)` | error | no — same reasoning as above; the correct replacement name is caller-specific | CLAUDE.md NEVER: `const isAdmin = isAdmin(request)` shadowing |
| `no-jsdoc-object-typedef` | `@typedef {object} Name` followed by `@property` tags | warning | **yes** — surgical `transform.replace` removes just `{object} ` | project memory: `feedback_jsdoc_typedef_object.md` |
| `no-jsdoc-any-type` | `@param`/`@returns`/`@type`/`@property {any}`/`{any[]}` | warning | no — not attempted; the correct narrower type is context-specific | CLAUDE.md SHOULD: prefer `unknown` over `any` |
| `no-inline-jsdoc-import` | an inline `import('mod').Type` inside a JSDoc `/**` block (a use-site: `@param`/`@returns`/`@type`/`@property`/`@satisfies`), where the hoisted `/** @import { Type } from 'mod' */` form is preferred. **Excludes** `@typedef {import(...)}` (a type ALIAS / cross-module re-export — the inline import IS the definition) and a `x is import(...).T` type-predicate position (the hoisted `@import` doesn't resolve there on the TS/JSDoc toolchain) | warning | no — a correct fix needs a SECOND edit (the top-level `@import`) ast-grep's node-local `fix` can't make; the `transform` surfaces the matched `$MOD`/`$TYP` into the message instead | the `/** @import { Type } from 'mod' */` (TS ≥5.5) convention preferred over inline `import()` in JSDoc types |
| `bash-require-set-euo-pipefail` (bash) | a `program` root lacking `set -euo pipefail` anywhere | error | no — the right placement (after the shebang) is a one-line human fix, not worth automating | universal convention across every `scripts/*.sh` worker (verified: all 7 existing scripts already comply) |
| `no-jq-raw-interpolation` (bash) | a `jq`-named command whose double-quoted program string contains both `{` and a `$var` expansion — i.e. JSON built by string interpolation instead of `--arg`/`--argjson` | warning | no — the safe rewrite needs a human to name the `--arg` binding | every `fetch-<eco>-upstream.sh` `emit()` helper's own established `jq -cn --arg ... '{...}'` convention (see `scripts-and-validation.md`'s Script conventions) |
| `fetch-upstream-no-basic-memory-path` (bash, scoped via `files: scripts/fetch-*-upstream.sh`) | a literal `basic-memory` path reference (quoted or bare) | error | no | the documented "NEVER touches `~/basic-memory/`" contract on every `fetch-<eco>-upstream.sh` header comment |
| `no-execsync-template-literal` | `execSync()` with a dynamically-constructed command string (template literal with interpolation or string concatenation) as the first argument | warning | no — the safe rewrite to `execFileSync(bin, [args…], opts)` is context-specific | CLAUDE.md/scripts-and-validation.md: prefer execFileSync over shell-spawning execSync |
| `no-unguarded-sync-fs` | synchronous filesystem calls (`mkdirSync`, `copyFileSync`, `rmSync`, `writeFileSync`, `readFileSync`, etc.) outside a try/catch body | warning | no — the correct error-handling strategy is context-specific | CLAUDE.md/scripts-and-validation.md: guard sync fs calls against uncaught throws |

The three bash rules' `kind:`/`regex:` shapes were derived from `ast-grep run
--pattern '<snippet>' --lang bash --debug-query=ast` on real safe/unsafe
snippets, not guessed — tree-sitter-bash's kind names for quoting forms
(`word` unquoted, `string` double-quoted with `simple_expansion` children,
`raw_string` single-quoted with no expansion possible at all) are the load-
bearing distinction between `no-jq-raw-interpolation`'s safe and unsafe cases.
`bash-require-set-euo-pipefail` anchors on `kind: program` (the whole-file
root node) with a negated `has:` — the only way to express "this file is
missing X anywhere" in ast-grep's match-a-node model, since there's no
first-class "absence across the file" rule type. This was independently
confirmed against ast-grep's own source and docs (2026-07-04): no open issue
proposes a file-level assertion rule type, and `has`+`stopBy: end` (negated at
the root here) is the documented building-block pattern, not a workaround.

`no-jq-raw-interpolation` is NOT redundant with `shellcheck` (also run in this
repo's `check:sh`): ShellCheck's `checkSingleQuotedVariables` (SC2016)
explicitly whitelists `jq` calls, with a maintainer source comment reading
"could also check that user provides --arg" — an acknowledged, never-shipped
gap. No SC-numbered rule exists for "jq program built via raw shell-variable
interpolation instead of `--arg`/`--argjson`." This project's rule fills that
specific gap rather than duplicating existing coverage.

All three were verified against the real `scripts/*.sh` corpus before being
trusted (zero unexpected findings) — see `no-jsdoc-any-type`'s CI-visible
warnings for the pre-existing JS findings unrelated to this addition.

Severity determines CI behavior directly (verified empirically, not assumed):
`ast-grep scan` exits 1 if any `severity: error` finding exists, exits 0 if only
`severity: warning` findings exist. `error` is reserved for mechanically
unambiguous house rules (MUST/NEVER); `warning` for heuristics (SHOULD) or
patterns with legitimate exceptions — the same `error()`/`warn()` split
`scripts-and-validation.md` documents for `validate-plugin.mjs`, just enforced
by ast-grep's own severity field instead of a hand-rolled harness.

## Adding a new rule

Follow the bundled `ast-grep` skill's own workflow (Step 1–5: understand the
query, write example code, write the rule, test against a snippet, then run
against real code) rather than writing a rule blind:

1. Write `.ast-grep/rules/<id>.yml` (`id`, `language: javascript` or `bash`,
   `message` citing the CLAUDE.md/memory/scripts-and-validation.md source,
   `severity`, `rule`; add `files: [<glob>]` when the convention applies to
   only a subset of files under `lib/`/`scripts/`, not the whole dir).
2. Scaffold a test: `ast-grep new test <id> -y` (requires `.ast-grep/rule-tests/`
   to already exist and `testConfigs` in `sgconfig.yml` to point at it).
3. Fill in `valid:`/`invalid:` snippet lists in the generated
   `.ast-grep/rule-tests/<id>-test.yml`.
4. `ast-grep test --update-all` to accept the generated snapshot baseline as
   correct (review the diff first — this is what makes the test meaningful,
   not vacuous). `ast-grep test` (no flag) thereafter fails on any drift from
   that accepted baseline.
5. `ast-grep scan lib/ scripts/` to confirm real-world behavior — a rule that
   only passes its own synthetic fixture but never checked against actual
   source can still be subtly wrong (wrong `kind`, unintended overlap with a
   legitimate pattern).

## Testing mechanics (`ast-grep test`)

Snapshot-based, not boolean pass/fail: a `valid:`/`invalid:` list per rule id,
compared against an accepted baseline stored in
`.ast-grep/rule-tests/__snapshots__/`. For a rule with a `fix:`, the snapshot
also captures the fixed output — so `ast-grep test` doubles as a regression
test for the fix itself, not just the match. This is the idiomatic ast-grep-
native equivalent of the `check-fourthwall.mjs`-style "prove the detector fires
on a planted violation and stays silent on the correct form" pattern used
elsewhere in this repo — reached for here via the tool's own test runner
instead of a reinvented JS harness, per this project's platform-proximity
preference (trust the platform, distrust layers on top).

## Fixing (`fix:` field mechanics)

`transform`-based surgical fixes are possible even for rules matching inside a
JSDoc comment, which tree-sitter treats as one opaque leaf token with no
further AST structure — the key is binding the comment to a metavariable via a
bare `pattern: $C` (constrained further by `kind`/`regex`), then using
`transform.<NAME>.replace: {source: $C, replace: <regex>, by: <string>}` to
regex-surgery just that metavariable's text, with `fix: $<NAME>` referencing
the transformed result. A rule using only `kind`+`regex` (no `pattern`) binds
no metavariable at all, so `fix:` on such a rule could only replace the whole
matched node — unsafe for anything but a single, universally-correct
replacement. Verified empirically against the real CLI (2026-07-04) rather
than assumed from ast-grep's docs, since the bundled `ast-grep` skill's own
`references/rule_reference.md` documents rule *matching* only, not `fix`/
`transform` mechanics at all.

## CI vs. dev-run split

- `npm run check:ast-grep` (`scripts/check-ast-grep.mjs`) — live scan of real
  `lib/`+`scripts/` source. **Detect-only, never mutates.** In CI
  (`GITHUB_ACTIONS` set), passes `--format github` so ast-grep's own native
  workflow-command output (`::error`/`::warning` with `file=`/`line=`) becomes
  PR-visible annotations directly — no need to reimplement the GitHub-escaping
  helper `validate-plugin.mjs` hand-rolls for its own `warn()`/`error()` calls.
  Locally (no `GITHUB_ACTIONS`), the default rich diagnostic view (source
  preview) is kept instead of raw workflow-command syntax.
- `npm run check:ast-grep-test` (`ast-grep test`) — rule-correctness self-test,
  wired into `npm run check` (`run-p check:*`) alongside every other check.
- `npm run fix:ast-grep` (`ast-grep scan --update-all lib/ scripts/`) —
  applies any auto-fixable finding. **Deliberately excluded from `check:*`** —
  a check step must only detect, never mutate a working tree out from under
  CI or an uncommitted local diff. Reachable via the top-level `npm run fix`
  (`run-s fix:*` — sequential, not parallel, so that if a second fixer is ever
  added it can't race the first one's writes to the same files).

## Toolchain

`@ast-grep/cli` is a devDependency (registers both the `ast-grep` and `sg`
binaries) rather than a separate CI-provisioning step, unlike `shfmt`'s manual
pinned-version `curl` install in `.github/workflows/ci.yml` — `ast-grep` ships
an official npm package, `shfmt` does not, so the existing `npm install` CI
step already provisions it for both `check:ast-grep` and `check:ast-grep-test`
with nothing else to wire up.

## Extraction possibilities

The four original JS rules are not vp-knowledge-specific — each enforces a
house JS convention documented independently of this project (ESM-only and
identifier-shadowing from the user's global CLAUDE.md; the JSDoc conventions
from project memory), so all four would carry unchanged to any other voxpelli
JS project. The three bash rules split differently: `bash-require-set-euo-
pipefail` and `no-jq-raw-interpolation` are equally universal (any bash
project wants fail-fast scripts and injection-safe jq construction — neither
references vp-knowledge by name), but `fetch-upstream-no-basic-memory-path` is
genuinely project-specific — it encodes THIS project's own documented
`fetch-<eco>-upstream.sh` script-family contract, not a general convention,
and would need rewriting (or dropping) to travel to another project. This
project's convention for documenting a cross-project extraction candidate is a
`## Extraction candidate — <package-name>` section with an
`[extraction-candidate]`-tagged observation, placed on the *source* project's
own Basic Memory note (established precedent: `npm-list-dependents-cli`'s
`## Extraction candidate — @voxpelli/ndjson` section) — not duplicated here.
See `plugin-voxpelli-vp-claude-vp-knowledge`'s `## Extraction candidate —
@voxpelli/ast-grep-rules` section for the current state of that possibility
(not yet extracted — the `@voxpelli/eslint-config` precedent
suggests waiting for a second consuming project first; the bash rules would
be a partial extraction, not all-or-nothing, given the split above).
