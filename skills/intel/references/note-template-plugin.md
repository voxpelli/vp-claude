# Note template: `claude_plugin` (plugin: and skill:)

Shared output template for `/intel plugin:…` and `/intel skill:…`.
Both write a `claude_plugin` note in the `plugins/` directory. Title:
`plugin-<owner>-<repo>` or `skill-<owner>-<repo>` (`:` and `/` and `#` → `-`).

The 4-backtick outer fence below keeps the inner `[category]` observations and
`[[wiki-links]]` from being parsed by remark.

````markdown
---
title: plugin-<owner>-<repo>
type: claude_plugin
url: https://github.com/<owner>/<repo>
tags:
- claude-plugin
- plugin
- claude-code
- <domain tags>
---

# plugin-<owner>-<repo>

One-line description of what the plugin/skill bundle adds and who ships it.

Homepage / repo: [github.com/<owner>/<repo>](https://github.com/<owner>/<repo>) | v<version> | <license> | by <author>

## Components

- skills (N): `<skill-a>`, `<skill-b>`, …
- agents: `<agent>` · hooks: `<events>` · commands: `<n>` · MCP servers: `<n>`

## Observations

- [purpose] What it adds to Claude Code and the primary use case
- [version] <version> (plugin.json) — or tree-SHA + date for a tag-less skill bundle
- [source] github.com/<owner>/<repo>
- [marketplace] <name>@<marketplace> — single-plugin vs aggregating; or skills.sh listing
- [install_mode] /plugin install <name>@<marketplace> · or `npx skills add <owner>/<repo>`
- [security] <trust-ladder state> — see the ladder in ecosystem-plugin.md; allowed-tools grants; unsandboxed scripts
- [components] skills/agents/hooks/commands/MCP it ships
- [author_trust] author identity vs repo owner (stewardship-succession signal)
- [architecture] structural/distribution facts
- [gotcha] hook double-fire, layout non-conformance, version-CLI coupling
- [popularity] install count or stars (with date)

## Relations

- relates_to [[Claude Code Plugin Ecosystem 2026]]
- relates_to [[Publisher Verification Gradient]]
- depends_on [[brew-<cli>]] or [[npm-<pkg>]] — CLI/MCP it requires
- authored_by [[<Person>]]
- alternative_to [[plugin-<other>]]
- part_of [[<marketplace or hub>]]
````

**No wiki-links in observations** — keep all `[[…]]` in `## Relations` only
(BM treats `[[` in an observation as a relation boundary).
