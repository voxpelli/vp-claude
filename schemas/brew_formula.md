---
title: brew_formula
type: schema
permalink: main/schema/brew-formula
entity: brew_formula
version: 1
schema:
  purpose?: string, what the tool does and its primary value proposition
  usage?: string, key invocation patterns and binary name if different from formula name
  config?: string, configuration file location and key options or env vars
  gotcha?(array): string, common pitfalls, non-obvious behaviour, conflicts
  feature?(array): string, notable capabilities worth knowing beyond basic usage
  relates_to?(array): Note, related formula, cask, or engineering notes
settings:
  validation: warn
---

# brew_formula

Schema for Homebrew formula notes — one note per formula in the `brew/` directory.

## Conventions

- [convention] Title format: `brew:<formula-name>` (e.g. `brew:ripgrep`)
- [convention] Directory: `brew/`
- [convention] Include a Formula Details table with Version, Homepage, License, Binary (if different from formula name)
- [convention] `purpose` should be one sentence — what problem it solves
- [convention] `usage` should include the binary name when it differs from the formula name (e.g. ripgrep → rg, git-delta → delta, difftastic → difft)
- [convention] `gotcha` entries are the highest-value observations — prioritise real-world surprises over docs
- [convention] Relations use `[[brew:name]]`, `[[cask:name]]`, `[[npm:name]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for brew formula notes (use consistently):
- `see also [[brew:x]]` — related tool in the same space
- `replaces [[brew:x]]` — this formula supersedes another
- `runtime dep of [[brew:x]]` — this formula is a declared runtime dependency
- `pairs with [[brew:x]]` — commonly used together
- `configured in [[dotfiles:modern-cli-stack]]` — wired into the dotfiles setup
- `Layer 1 alias in [[dotfiles:modern-cli-stack]]` — transparent replacement
- `Layer 2 nudge in [[dotfiles:modern-cli-stack]]` — hint-only (not alias)
- `relates to [[brew:x]]` — related formula, cask, or engineering notes

## Observations

- [purpose] Schema for Homebrew formula notes in the brew/ directory
- [convention] Inferred from 27 notes created 2026-03-12; top fields by frequency: purpose (41%), gotcha (41%), config (26%), usage (22%), feature (22%)
- [convention] Relation names were inconsistent in first-generation notes — use the vocabulary above for all new notes

## Relations

- see also [[schema/brew_cask]] (cask variant for GUI apps)
- see also [[dotfiles:modern-cli-stack]] (hub note for documented CLI tools)
