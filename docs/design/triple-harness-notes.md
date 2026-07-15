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
- (more to come as Waves proceed)
