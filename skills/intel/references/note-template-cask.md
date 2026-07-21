# Homebrew Cask Note Template

Use this template when creating new `cask-*` notes with `write_note`. Place in
the `casks/` directory so it resolves `[[cask-*]]` wiki-links automatically.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

```markdown
---
title: cask-<cask-name>
type: brew_cask
url: https://formulae.brew.sh/cask/<cask-name>
tags: [<domain>, <category>]
packages: ["<cask-name>"]
---

# cask-<cask-name>

[`<cask-name>`](https://formulae.brew.sh/cask/<cask-name>) — one-line
description from the cask's `desc` field.

Homepage: [<vendor-homepage>](<url>) | v<version> | <license>

## About

Brief description of what this GUI application does and who it's for.
Note whether it's open-source or proprietary.

Installs: <app-name>.app to /Applications

## Observations

- [version] <version>
- [pattern] Primary use case and how it fits into the development workflow
- [licensing] License type — free, freemium, paid, open-source
- [requirement] macOS version requirement or architecture limitation
- [gotcha] Auto-updates independently of Homebrew (if `auto_updates: true`)
- [alternative] Alternative casks or web-based tools covering the same need
- [popularity] X installs/30d · Y/90d · Z/365d (Homebrew MCP, YYYY-MM)

## Relations

- alternative_to [[cask-<alternative>]]
- relates_to [[brew-<cli-equivalent>]]
```

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the exact Homebrew cask name: `["warp"]`.
One cask per note. This is how `schema_validate` matches notes to the
`brew_cask` schema.

### `type` value

Always `brew_cask` (snake_case). Not `brew-cask` or `homebrew_cask`.

### Observation categories

| Category | When to use |
|----------|-------------|
| `version` | Current documented cask version — machine-stable slot, one clean leading token |
| `pattern` | Primary use case in the workflow |
| `licensing` | Free, freemium, paid, or open-source |
| `requirement` | macOS version, architecture, or system requirement |
| `gotcha` | Self-updating behavior, installation artifacts, uninstall complexity |
| `alternative` | Alternative tools with similar functionality |
| `performance` | Startup time, memory usage, battery impact |
| `conflict` | Conflicts with other casks or system tools |
| `popularity` | Install counts from Homebrew analytics (MCP or formulae.brew.sh JSON) |
| `agent-leverage` | How a coding agent invokes the tool (dev-tool-adjacent casks only) — MCP server or `--json`/machine-readable CLI; honest-limited when no real surface. Warn-only category, not yet in the schema (see enrichment source g)) |

### Version observation

Emit exactly one **canonical** `[version]` observation as a clean leading
token — e.g. `- [version] 1.39.0` — recording the same value as the header
pipe (`Homepage: … | v<version> | <license>`). This is the machine-stable slot
`/knowledge-gaps --stale cask` reads (Pattern 3), checked before fragile
prose/table extraction. Keep it in sync with the header pipe on every
refresh — `edit_note` with `find_replace` to replace this specific canonical
line in place, never `append` a second one (same discipline as `[popularity]`
below). This canonical line is distinct from any `[version]` lines an
upgrade-haul changelog reel writes as narrative delta history — see the
"Recording targets" section in `SKILL.md` for that separate, unresolved usage
of the same category; do not delete reel entries under this rule.

### Analytics observations

Emit exactly one `[popularity]` observation with the 30/90/365-day install
counts (casks have no `build-error` counter). Source it from
`mcp__homebrew__info` when reachable (stamp `(Homebrew MCP, YYYY-MM)`),
otherwise from the `analytics` block in the formulae.brew.sh cask JSON fetched
in Step 2 (stamp `(formulae.brew.sh API, YYYY-MM-DD)`) — both draw on the same
Homebrew analytics but can diverge via client-cache lag. Only omit when neither
source yields analytics; never fabricate counts.

When updating an existing note that already has a `[popularity]` line,
use `edit_note` with `find_replace` to replace the old line rather than
`append` — install counts change continuously and duplicate lines
accumulate stale data.

### Agent-leverage observations

Run this only for a **dev-tool-adjacent cask** — one whose tags / `desc` /
`caveats` mention CLI/API/developer/terminal, or that ships a companion binary.
A pure consumer GUI cask has no agent-leverage surface; record nothing (this is
not a gap). When it applies, assess *how a coding agent would use the tool* and
record with the `[agent-leverage]` category — a new, warn-only category (not yet
in the schema; a later `/schema-evolve brew_cask` pass formalizes it), verified
via `--help`/man/`API.md`, never inferred. See enrichment source g) for the
probe and honesty gate: one `[agent-leverage]` line for a genuine positive (plus
at most one `[pattern]`, and a `[gotcha]` for any caveat), or one
`[agent-leverage]` line stating the limitation for a surprising negative. When a
finding is recorded, add a `relates_to` link to the `Agent-Tool Leverage — MCP
Server or Machine-Readable CLI, Assessed Per Tool` hub note in `## Relations`.

### Auto-updating casks

If `auto_updates: true` in the cask definition, add a `[gotcha]` observation:
`brew outdated` will not flag this cask even when a new version is available
because the app manages updates itself.

### Relations

- Use `[[brew-<name>]]` for a CLI formula equivalent (e.g., cask:warp → brew-warp might not exist, but cask:docker → brew-docker does)
- Use `[[cask-<alternative>]]` for competing GUI tools in the same category
