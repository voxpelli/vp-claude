---
title: brew_cask
type: schema
permalink: main/schema/brew-cask
entity: brew_cask
version: 1
schema:
  purpose?: string, what the app does and its primary value proposition
  config?: string, configuration file location and key settings
  feature?(array): string, notable capabilities worth knowing
  gotcha?(array): string, common pitfalls — licensing model, OS requirements, conflicts,
    caveats
  perf?(array): string, performance characteristics — startup time, memory footprint, battery impact
  relates_to?(array): Note, related cask, formula, or engineering notes
  depends_on?(array): Note, Homebrew dependencies or required system tools
  pairs_with?(array): Note, companion apps commonly used together
settings:
  validation: warn
---

# brew_cask

Schema for Homebrew cask notes — one note per cask in the `casks/` directory.

## Conventions

- [convention] Title format: `cask-<cask-name>` (e.g. `cask-ghostty`)
- [convention] Directory: `casks/`
- [convention] Include a Cask Details table with Version, Homepage, Type (free/paid/subscription), macOS minimum
- [convention] `gotcha` should always note licensing model (free/paid/subscription) and macOS version floor
- [convention] `feature` entries should cover capabilities beyond the basic description
- [convention] Relations use `[[brew-name]]`, `[[cask-name]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for cask notes:
- `pairs with [[brew-x]]` — commonly used together
- `replaces [[cask-x]]` — supersedes another cask
- `alternative to [[cask-x]]` — competes in the same space
- `configured in dotfiles` — tracked in the dotfiles repo
- `relates to [[cask-x]]` — related cask, formula, or engineering notes
- `depends on [[brew-x]]` — Homebrew dependency or required system tool

## Observations

- [purpose] Schema for Homebrew cask notes in the casks/ directory
- [convention] Inferred from 2 notes created 2026-03-12; sample too small for reliable frequency data — all fields are optional
- [convention] Licensing model (free/paid/subscription) is the most important gotcha to capture — it's not visible in the formula metadata

## Relations

- see also [[schema/brew_formula]] (formula variant for CLI tools)
