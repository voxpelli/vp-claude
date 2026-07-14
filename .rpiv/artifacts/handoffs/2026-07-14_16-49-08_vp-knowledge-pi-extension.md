---
date: 2026-07-14T16:49:08+0200
author: Pelle Wessman
commit: 8b0a81e
branch: main
repository: vp-claude
topic: "vp-knowledge-pi Pi Extension Implementation"
tags: [pi-extension, agent-sync, settings-ui, testing]
status: complete
last_updated: 2026-07-14T16:49:08+0200
last_updated_by: Pelle Wessman
type: feature_development
---

# Handoff: vp-knowledge-pi Extension + Agent Sync + Settings UI

## Task(s)
1. ✅ **Pi extension foundation** — build script, MCP mapping, session hooks
2. ✅ **ast-grep hardening rules** — shell injection + unguarded sync fs
3. ✅ **Agent sync engine** — manifest-tracked sha256 sync with smart gate
4. ✅ **Settings UI** — `/vp-knowledge-settings` TUI with 4 toggles
5. ✅ **Update command** — `/vp-knowledge-update-agents` forced sync
6. 🔄 **Tests for new modules** — config.js, agent-sync.js (next step)
7. ⏳ **Release-please workflow** — automated versioning and npm publish
8. ⏳ **Live test** — `pi install git:github.com/voxpelli/vp-claude`

## Critical References
- `pi-package/extensions/index.js` — main extension factory (session hooks, tool_result handler, commands)
- `pi-package/extensions/agent-sync.js` — manifest+sha256 sync engine (based on rpiv-pi pattern)
- `pi-package/extensions/config.js` — JSON config loader with defaults and atomic writes
- `pi-package/extensions/settings-command.js` — `/vp-knowledge-settings` TUI
- `pi-package/extensions/update-agents-command.js` — `/vp-knowledge-update-agents` command

## Recent Changes
- `pi-package/extensions/index.js:155-183` — session_start with config-gated sync + once-per-process latch
- `pi-package/extensions/index.js:282-332` — tool_result with config-gated fourthWall + schemaValidate
- `pi-package/extensions/index.js:318` — schema permalink skip (`*/schema/*`)
- `pi-package/extensions/agent-sync.js` — full sync engine (new file)
- `pi-package/extensions/config.js` — config loader (new file)
- `pi-package/extensions/settings-command.js` — TUI settings (new file)
- `pi-package/extensions/update-agents-command.js` — update command (new file)
- `pi-package/package.json` — added `@earendil-works/pi-tui` peer+dev dep, dropped Node 20
- `.github/workflows/test.yml` — node-versions: 22,24

## Learnings
- **Plugin self-maintenance vs user features**: Claude Code `post-file-edit.sh` uses `${CLAUDE_PLUGIN_ROOT}` to scope shfmt/schema-sync to the plugin's OWN files. Pi has no equivalent path scoping, so these were removed from the Pi extension entirely. They remain as shell hooks for Claude Code.
- **Dual skills paths**: `["./skills", "../skills"]` — npm uses build copy, git uses repo root. Pi's `loadSkills` skips missing dirs with a warning.
- **Pi-tui SettingsList**: Has `updateValue(id, newValue)` method (not `setItems()`). Constructor signature: `(items, maxVisible, theme, onChange, onCancel, options?)`.
- **Type coverage**: Cast `JSON.parse` results to `unknown` first, then narrow with `typeof` checks, to avoid implicit `any`.
- **Config atomic writes**: tmp file + `renameSync` for POSIX atomicity within `~/.pi`.
- **Peer deps for runtime contract, dev deps for types**: `@earendil-works/pi-tui` is both peer (runtime) and dev (types) dependency.

## Artifacts
- `.rpiv/artifacts/` — none created in this session
- Research agent outputs (6 agents) — review findings summarized in conversation
- `pi-package/` — full extension overlay (12 source files)

## Action Items & Next Steps
1. **Write tests** for `config.js` (loadConfig, saveConfig, deepMerge, partial config handling) and `agent-sync.js` (first-run copy, smart gate, forced overwrite, error collection)
2. **Set up release-please** workflow for automated npm publish
3. **Live test** `pi install git:github.com/voxpelli/vp-claude` with `directTools: true`
4. **Research agent recommendations** (optional):
   - Add `isStaleCtxError` guards around `pi.sendMessage()` calls
   - Cache `loadConfig()` result, invalidate on save
   - Add `session_tree` handler for branch navigation state reconstruction
   - Emit cross-extension events after agent sync

## Other Notes
- **Build script**: `pi-package/build.mjs` copies `skills/`, `agents/`, `lib/`, `schemas/`, selected `scripts/` into the package before npm publish. Run via `npm run build` or `prepublishOnly`.
- **All gates pass**: tsc, eslint, knip, type-coverage 100% (1151/1151), node --test (20/20), installed-check
- **Node engines**: `^22.13.0 || >=24` (dropped Node 20)
- **Config path**: `~/.pi/agent/extensions/vp-knowledge.json`
- **Manifest path**: `~/.pi/agent/agents/.vp-knowledge-managed.json`
- **AGENTS.md bead rules**: Use `bd` for task tracking, not TodoWrite. Session completion requires `git push`.
