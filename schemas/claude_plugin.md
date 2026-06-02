---
title: claude_plugin
type: schema
permalink: main/schema/claude_plugin
entity: claude_plugin
version: 1
schema:
  purpose?: string, what the plugin adds to Claude Code and its primary use case
  version?: string, latest plugin.json version — the drift-detectable field
  source?: string, canonical GitHub repo (owner/repo) that ships the plugin
  marketplace?(array): string, marketplace(s) it ships in — first-party via /plugin, a named community marketplace, or direct-repo; note single-plugin vs aggregating
  install_mode?(array): string, install methods — /plugin install <name>@<marketplace>, direct .claude/ clone, or npx skills add for the skill subset
  security?(array): string, trust ladder (first-party-Anthropic / claimed-community-marketplace / unverified-third-party=squattable-name / direct-repo-only) plus allowed-tools grant risk and unsandboxed-script risk
  components?(array): string, what the plugin ships — skills (count + names), agents, hooks (which lifecycle events), commands, MCP servers
  author_trust?(array): string, author identity vs repo owner (stewardship-succession signal)
  architecture?(array): string, structural and distribution facts about the plugin
  convention?(array): string, conventions the plugin follows or documents
  gotcha?(array): string, common pitfalls — hook double-fire, layout non-conformance, version-CLI coupling
  pattern?(array): string, recurring plugin-architecture recipes
  design?(array): string, deliberate architectural choices
  popularity?(array): string, install count or GitHub stars with a date stamp
  relates_to?(array): Note, related plugins, ecosystem hubs, or engineering notes
  alternative_to?(array): Note, plugins competing in the same space
  depends_on?(array): Note, CLI binary or MCP server the plugin requires
  authored_by?(array): Note, the plugin's author
  part_of?(array): Note, the marketplace or ecosystem hub it belongs to
  bundles?(array): Note, skill-tooling notes the plugin ships or wraps
settings:
  validation: warn
---

# claude_plugin

Schema for Claude Code plugin notes — one note per plugin (or single-plugin
marketplace). A plugin is a git-repo + manifest artifact (`.claude-plugin/plugin.json`,
optionally a `marketplace.json`) distributed via `/plugin install <name>@<marketplace>`
and versioned by the manifest `version` field.

## Conventions

- [convention] Title format: `plugin-<name>` (or `<marketplace>: <name>` for a marketplace-scoped note); directory: `plugins/`
- [convention] Identifier is the upstream GitHub repo + plugin name — versioning is the `plugin.json` `version` field; absent it, the git commit SHA is the de-facto version
- [convention] `security` records the trust ladder and links `relates_to [[Publisher Verification Gradient]]` — an unverified/third-party marketplace has a squattable name that `/plugin install` resolves by trust-on-first-use, analogous to the Open VSX squattable-namespace signal for `vscode_extension`
- [convention] Individual skills shipped by the plugin are `[components]` observations, NOT separate notes — a per-skill note type would explode cardinality; if a single skill warrants its own note, route it through the npm/pypi/crate package note for the library that ships it
- [convention] `tags` frontmatter should include `claude-plugin`, `plugin`, `claude-code`

## Relation Vocabulary

- `depends_on [[brew-x]]` / `depends_on [[npm-x]]` — CLI binary or MCP server the plugin requires
- `alternative_to [[plugin-x]]` — competing plugin in the same space
- `part_of [[marketplace-or-hub]]` — the marketplace or ecosystem note it belongs to
- `authored_by [[Person]]` — the plugin author (distinct from repo owner; see `author_trust`)
- `relates_to [[engineering/x]]` — ecosystem/mechanics notes (e.g. [[Claude Code Plugin Ecosystem 2026]])

## Observations

- [purpose] Schema for Claude Code plugin notes in the plugins/ directory
- [convention] `version` is a single-value structural fact in frontmatter AND a `[version]` observation for searchability
- [distinction] A `claude_plugin` is closest to `gh_extension` (git-repo + manifest, no central registry) plus the `vscode_extension` trust ladder; unlike package types it has no registry-API version source

## Relations

- see also [[schema/gh_extension]] (closest structural analog — git-repo + manifest, owner/repo identity)
- see also [[schema/vscode_extension]] (donates the publisher trust-ladder pattern)
