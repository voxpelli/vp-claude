# Triple-harness harvest notes

Running capture of generalizable findings while making vp-knowledge run as a single-root
Claude Code plugin **+** Pi extension **+** skills.sh bundle. Feeds two downstream targets:
the `claude-plugin-template` co-evolution PR (Wave 4) and, where noted, other voxpelli repos.

## Coexistence — proven empirically (Wave 1 spike, 2026-07-15)

- `pi install <repo-root>` reads the root `package.json` `pi` key and loads `./extensions` +
  `./skills`; `npm run check:plugin` reads `.claude-plugin/` and passes; neither harness trips
  on the other's artifacts. One shared `skills/` tree, no build step, no `../` escape, no copy-dance.
- Pi's global config home derives from `homedir()` → `~/.pi/agent/`. Override `HOME` to fully
  isolate an install/boot for testing (no pollution of the user's real `~/.pi`).
- `PI_OFFLINE=1` boots the agent (loading extensions + skills) without a model call; `PI_TIMING=1`
  prints per-extension import timings. A missing API key stops the run *after* resource loading,
  so the offline boot still surfaces `Failed to load extension` if loading broke.

## Reusable technique — offline skill/extension validation (NOTE FOR voxpelli/ai-meta)

Pi exports `loadSkillsFromDir({ dir, source }) → { skills, diagnostics }` from
`@earendil-works/pi-coding-agent` (`dist/core/skills.js`, re-exported from the package index).
Calling it directly validates any `SKILL.md` tree against **pi's own parser**, offline, no model,
no global state — needing only the pi package (already a peer/devDependency). It returns:
- `skills[]` with parsed `name` + `description`,
- `diagnostics[]` including the real `description exceeds 1024 characters` warning (agentskills.io
  spec limit) — pi flagged our `tool-intel` (1127 chars) unprompted.

This is the CI-portable way to gate a skills tree for Pi/agentskills compatibility, strictly better
than shelling out to a live `pi` process. Worth a general note in `voxpelli/ai-meta` as an
"agent-skill validation without a running agent" technique.

## Codifiable test pattern (→ `scripts/check-pi-load.mjs`, Wave 1.4)

1. `loadSkillsFromDir({ dir: 'skills', source })` → assert expected skill count, collect diagnostics.
2. `await import('../extensions/index.js')` → assert `typeof mod.default === 'function'` (the factory)
   — catches a load-time throw without booting an agent.
3. Wire into `npm run check` via the house `lib/check-harness.mjs` self-test style.

## Generalizable decisions for claude-plugin-template (Wave 4)

- Root `package.json` gains a `pi` key: `{ "extensions": ["./extensions"], "skills": ["./skills"] }`.
  Claude's loader ignores `package.json` entirely, so this is invisible to the Claude side.
- **Never a root `themes/` dir** (Pi parses JSON there as color themes).
- The `pi.skills` path is the SAME `skills/` tree the Claude plugin and skills.sh use — one source of truth.
- **Claude-reachable shared scripts must be node_modules-free.** A Claude marketplace install is a whole-tree
  copy with NO `npm install` and gitignored node_modules, so any script a skill shells into (and its lib
  imports) must import only `node:*` builtins + relative paths. Verify by running it from a node_modules-free
  temp dir. (This was a live bug in the shipped plugin, not hybrid-introduced.)
- **The Pi extension MAY keep runtime deps** (Pi runs `npm install --omit=dev` on `git:` install) — put them
  in `dependencies`, not `devDependencies`. Only the *Claude-reachable* code path has the no-install constraint.
- **Runtime path resolution** in the extension should assume the single-root layout: `extensions/../lib`,
  `extensions/../agents` — one candidate, no dual-probe for a build-copy layout. Import dynamic modules via
  `pathToFileURL(path).href` (a bare absolute path is not a valid import specifier on Windows).
- **MCP tool names**: express Claude↔Pi mapping as a RULE (`mcp__<server>__<tool>` → server hyphens→`_`,
  tool verbatim) + an `mcp`-proxy fallback in injected guidance — never a hand-maintained table (it rots and
  can promise non-existent tools).
- **Verify the extension offline** with `check-pi-load.mjs` (loadSkillsFromDir + factory import) — CI-portable,
  no running agent. Template could ship this as a `check:pi-load` when a plugin adds a Pi extension.

## Pi-core deps: peer AND dev (why the "redundant deps" review flag was a false positive)

`@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` are declared BOTH as `peerDependencies` (`*`)
and `devDependencies` (a pinned range). A reviewer flagged this as redundant; it is not:

- **peerDependency (`*`)** — the Pi HOST provides the real instance at runtime. Pi's loader rewrites an
  extension's `import` of a pi core to the host's own instance (a `VIRTUAL_MODULES` alias table), so the
  extension must NOT bundle or pin its own copy. The peer range declares "whatever the host runs."
- **devDependency (pinned)** — local `tsc` (JSDoc types resolve against the installed package) and
  `node --test` (the extension imports `getAgentDir`, `CONFIG_DIR_NAME`, `loadSkillsFromDir` directly) need a
  concrete version present in the repo.

So the dual declaration is correct: peer for the runtime contract, dev for local type-checking and tests. A
Pi extension's core deps belong in peer (`*`) + dev (a pinned range), never in `dependencies`.

## Accepted portability trade-offs (as of 0.32.7)

0.32.7 ships portability **gates + visibility** (`check:portability`, the D3 description-limit trim) but does
NOT yet convert same-skill references — that scrub is deferred to Wave 3's holistic skill re-extraction (the
package-intel + tool-intel merge rewrites those same lines anyway; relative paths are rename-resilient, so
nothing is lost by waiting). The reference-path resolution rule, verified this cycle (official Claude Code
docs + Agent Skills spec + the vp-git production precedent + Claude Code's per-skill base-directory injection):
a **bare relative `references/x.md` path resolves against the active skill's own directory** in both Claude
Code and a standalone skills.sh install; `${CLAUDE_PLUGIN_ROOT}` (plugin-only) and `${CLAUDE_SKILL_DIR}`
(Claude-Code bash-injection-only) are both undefined under skills.sh.

The `${CLAUDE_PLUGIN_ROOT}` references in the skill tree fall into three buckets (measured by
`check:portability` / `lib/portability-scan.mjs`):

- **Same-skill (25 refs) — fixable, DEFERRED to Wave 3.** A skill referencing its OWN
  `${CLAUDE_PLUGIN_ROOT}/skills/<self>/references/…` file. These break under a standalone skills.sh install
  (undefined variable) and are convertible to a bare `references/…` path that resolves in both harnesses.
  Not done in 0.32.7 (Wave-3-bound skills); `check:portability` reports the count as the outstanding debt.
- **Cross-skill (4 refs) — ACCEPTED, cannot be relative.** A skill referencing a *sibling* skill's file
  (`tool-intel`→`package-intel/references/{forge-fallback,upgrade-haul}.md`,
  `nudge-adoption`→`nudge-sync/references/tip-cache-contract.md`). A bare relative path would resolve against
  the *referrer's* own dir, not the target's, so these MUST keep the full `${CLAUDE_PLUGIN_ROOT}` path — and
  they simply don't resolve under a standalone single-skill install of the referrer (the sibling isn't
  present). This is inherent to a shared reference used across two skills; the shared-reference file headers
  document it. `check:portability` warns on these as the accepted trade-off.
- **Tooling (fenced, prose-scan-invisible) — skills.sh-DEGRADED, documented.** `knowledge-gaps --global`
  shells into `${CLAUDE_PLUGIN_ROOT}/scripts/list-installed-plugins.mjs`. That path lives inside a fenced
  code block, so the prose scanners (`check:plugin-load-paths`, `check:portability`) correctly skip it — it is
  a CLI-invocation example, not a doc cross-reference. Under a standalone skills.sh install the `scripts/`
  tree isn't present, so `--global` degrades. Accepted (do NOT vendor a script copy into the skill dir);
  documented here rather than surfaced as a warning, since it's structurally invisible to prose scanning.
