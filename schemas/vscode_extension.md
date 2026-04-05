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
  feature?(array): string, notable capabilities beyond the basic description
  relates_to?(array): Note, related extensions or engineering notes
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

## Relation Vocabulary

Preferred relation labels for VSCode extension notes:
- `see also [[vscode-x]]` — related extension in the same space
- `pairs with [[vscode-x]]` — commonly installed together
- `conflicts with [[vscode-x]]` — known incompatibility
- `alternative to [[vscode-x]]` — competes in the same space

## Observations

- [purpose] Schema for VSCode extension notes in the vscode/ directory
- [convention] Activation event scope is the most common `gotcha` — wildcard `*` activators harm editor performance

## Relations

- see also [[schema/brew_formula]] (analogous schema for CLI tools)
