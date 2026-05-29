---
title: vscode_extension
type: schema
permalink: main/schema/vscode-extension
entity: vscode_extension
version: 1
schema:
  purpose?: string, what the extension does and primary value
  config?: string, key settings and their defaults (workspace vs user scope)
  gotcha?(array): string, performance impact, conflicts, activation triggers
  convention?(array): string, important usage conventions
  pattern?(array): string, recurring usage patterns and idioms
  feature?(array): string, notable capabilities beyond the basic description
  popularity?(array): string, Marketplace install counts and ratings with date stamp
  security?(array): string, supply-chain / publisher-verification / Open VSX trust signals
  relates_to?(array): Note, related extensions or engineering notes
  used_by?(array): Note, projects or teams using this extension
  alternative_to?(array): Note, extensions that serve as direct substitutes
settings:
  validation: warn
---

# vscode_extension

Schema for VSCode extension notes — one note per extension in the `vscode/` directory.

## Conventions

- [convention] Title format: `vscode-<publisher>.<ext>` (e.g. `vscode-esbenp.prettier-vscode`)
- [convention] Directory: `vscode/`
- [convention] Include an Extension Details table with Version, Publisher, Marketplace link
- [convention] `config` should cover workspace vs user scope settings and their defaults
- [convention] `gotcha` should note activation events — extension activating on every file type can hurt startup time
- [convention] Relations use `[[vscode-publisher.ext]]` wiki-link format
- [convention] `security` captures the Open VSX trust ladder (verified-restricted / public-namespace / marketplace-only=squattable / not-published-anywhere); a Marketplace-only extension has an unclaimed namespace that fork-IDEs (Cursor/Windsurf/Codium) resolve installs against — record the state with a date stamp

## Relation Vocabulary

Preferred relation labels for VSCode extension notes:
- `relates_to [[vscode-x]]` — related extension in the same space
- `pairs_with [[vscode-x]]` — commonly installed together
- `conflicts_with [[vscode-x]]` — known incompatibility
- `alternative_to [[vscode-x]]` — competes in the same space

## Observations

- [purpose] Schema for VSCode extension notes in the vscode/ directory
- [convention] Activation event scope is the most common `gotcha` — wildcard `*` activators harm editor performance

## Relations

- see also [[schema/brew_formula]] (analogous schema for CLI tools)
