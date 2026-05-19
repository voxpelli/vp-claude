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
  performance?(array): string, performance characteristics — startup time, memory footprint, battery impact
  popularity?(array): string, Homebrew install analytics (30/90/365-day counts) with date stamp; omit when MCP unavailable
  pattern?(array): string, recurring usage patterns and integration recipes
  security?(array): string, supply-chain or runtime security considerations
  licensing?(array): string, paid/subscription/free model details and renewal/seat caveats
  integration?(array): string, integration surface with other tools or workflows
  tension?(array): string, principle-vs-pragma trade-offs the tool's design accepts
  architecture?(array): string, architectural choices — process model, sandboxing, plugin system, dependency boundaries
  source?(array): string, canonical website / repo / vendor URL with date
  ecosystem?(array): string, ecosystem position and relationship to alternatives
  velocity?(array): string, release cadence and update model (autobump, manual, etc.)
  convention?(array): string, setup conventions worth highlighting (shell completion install, config file locations, etc.)
  alternative?(array): string, prose listing of alternative tools (for specific wiki-linked alternatives, use the alternative_to relation)
  relates_to?(array): Note, related cask, formula, or engineering notes
  depends_on?(array): Note, Homebrew dependencies or required system tools
  used_by?(array): Note, projects or workflows that depend on this cask (inverse of depends_on)
  pairs_with?(array): Note, companion apps commonly used together
  alternative_to?(array): Note, competes in the same space
  replaces?(array): Note, supersedes another cask
  composes_with?(array): Note, designed to compose with another tool (symmetric pairing)
  mitigates_risk_of?(array): Note, this cask mitigates a risk class present in the target (e.g. plaintext-token storage)
  sandboxed_by?(array): Note, this cask runs inside a sandbox provided by the target (e.g. cask-claude-code sandboxed_by npm-@anthropic-ai-sandbox-runtime)
  complemented_by?(array): Note, companion tool with non-overlapping responsibility (e.g. cask-claude-code complemented_by nah)
  documented_in?(array): Note, concept/pattern/security hub note documenting this cask's usage
  see_also?(array): Note, standard or reference relevant to this cask's behavior
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
- [convention] Relations use `brew-<name>`, `cask-<name>` wiki-link format (substitute the real name, wrapped in `[[...]]`)

## Relation Vocabulary

Preferred relation labels for cask notes:
- `pairs_with` — `brew-<name>` — commonly used together
- `replaces` — `cask-<name>` — supersedes another cask
- `alternative_to` — `cask-<name>` — competes in the same space
- `configured_in_dotfiles` — tracked in the dotfiles repo
- `relates_to` — `cask-<name>` — related cask, formula, or engineering notes
- `depends_on` — `brew-<name>` — Homebrew dependency or required system tool

## Observations

- [purpose] Schema for Homebrew cask notes in the casks/ directory
- [convention] Inferred from 2 notes created 2026-03-12; sample too small for reliable frequency data — all fields are optional
- [convention] Licensing model (free/paid/subscription) is the most important gotcha to capture — it's not visible in the formula metadata
- [convention] `popularity` observations must cite window (30d/90d/365d), source (Homebrew MCP), and date — omit entirely when MCP is unavailable rather than fabricating from the JSON API, which does not expose analytics

## Relations

- see also [[schema/brew_formula]] (formula variant for CLI tools)
