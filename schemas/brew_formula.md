---
title: brew_formula
type: schema
permalink: main/schema/brew-formula
entity: brew_formula
version: 1
schema:
  purpose?: string, what the tool does and its primary value proposition
  version?(array): string, current documented formula version (e.g. 1.39.0) — the
    version this note's content reflects; the machine-stable slot
    /knowledge-gaps --stale compares against upstream (Pattern 3, checked before
    fragile prose extraction)
  usage?(array): string, key invocation patterns and binary name if different from
    formula name
  config?: string, configuration file location and key options or env vars
  gotcha?(array): string, common pitfalls, non-obvious behaviour, conflicts
  feature?(array): string, notable capabilities worth knowing beyond basic usage
  pattern?(array): string, usage patterns, integration recipes, and best practices
  convention?(array): string, standard setup conventions and idiomatic configuration choices
  popularity?(array): string, Homebrew install analytics (30/90/365-day counts plus build-error count) with source + date stamp; source from Homebrew MCP or the formulae.brew.sh JSON analytics block, omit only when neither is available
  compatibility?(array): string, version pinning, OS/arch coverage, peer-tool compatibility caveats
  security?(array): string, supply-chain or runtime security considerations
  relates_to?(array): Note, related formula, cask, or engineering notes
  see_also?(array): Note, related tool in the same space
  pairs_with?(array): Note, commonly used together
  depends_on?(array): Note, runtime or build dependency on another brew formula/cask/npm
  used_by?(array): Note, projects or workflows that depend on this formula (inverse of depends_on)
  replaces?(array): Note, this formula supersedes another
  composes_with?(array): Note, designed to compose with another tool (symmetric pairing)
  mitigates_risk_of?(array): Note, this formula mitigates a risk class present in the target (e.g. plaintext-token storage)
  mitigated_by?(array): Note, inverse of mitigates_risk_of — used on the target side
  integrated_into?(array): Note, integrated as a module/extension of the target (e.g. starship's direnv module)
  extended_by?(array): Note, this formula is extended by another tool (e.g. brew-gh extended_by gh-* extensions)
  alternative_to?(array): Note, competes in the same space as another tool (cf. npm_package/service `competes_with` — kept as ecosystem-specific synonyms since "brew formulae are alternatives" reads more naturally than "compete")
  analogue_of?(array): Note, structurally analogous tool in a different ecosystem
  built_with?(array): Note, this formula was built using/with another tool as toolchain
  context_from?(array): Note, this formula's relevance is contextualized by a pattern/concept/history note
  integrates_with?(array): Note, runtime integration with another tool via data flow (distinct from `pairs_with` — integrates implies data exchange, pairs implies CLI composition)
  maintained_by?(array): Note, person or org responsible for upstream maintenance
settings:
  validation: warn
---

# brew_formula

Schema for Homebrew formula notes — one note per formula in the `brew/` directory.

## Conventions

- [convention] Title format: `brew-<formula-name>` (e.g. `brew-ripgrep`)
- [convention] Directory: `brew/`
- [convention] Include a Formula Details table with Version, Homepage, License, Binary (if different from formula name)
- [convention] `purpose` should be one sentence — what problem it solves
- [convention] `usage` should include the binary name when it differs from the formula name (e.g. ripgrep → rg, git-delta → delta, difftastic → difft)
- [convention] `gotcha` entries are the highest-value observations — prioritise real-world surprises over docs
- [convention] Relations use `brew-<name>`, `cask-<name>`, `npm-<name>` wiki-link format (substitute the real name, wrapped in `[[...]]`)
- [convention] `popularity` observations must cite window (30d/90d/365d), source (Homebrew MCP or formulae.brew.sh JSON `analytics` block), and date — both sources draw on the same Homebrew analytics but can diverge (client-cache lag), so stamp which one; omit only when neither yields counts, never fabricate
- [convention] `version` is a single clean leading token (e.g. `- [version] 1.39.0`), kept in sync with the inline header pipe (`Homepage: … | v<version> | <license>`) — both record the same value; under `--stale`'s first-hit-wins extraction the header pipe (Pattern 1) still outranks this observation (Pattern 3) here, so the pipe remains the slot that must be accurate for this cohort (bd `vp-claude-9q7e` flipped that ordering for npm only; brew/cask/vscode still read the pipe first, unchanged here)

## Relation Vocabulary

Preferred relation labels for brew formula notes (use consistently):
- `see_also` — `brew-<name>` — related tool in the same space
- `replaces` — `brew-<name>` — this formula supersedes another
- `runtime_dep_of` — `brew-<name>` — this formula is a declared runtime dependency
- `pairs_with` — `brew-<name>` — commonly used together
- `configured_in` — `dotfiles:modern-cli-stack` — wired into the dotfiles setup
- `layer_1_alias_in` — `dotfiles:modern-cli-stack` — transparent replacement
- `layer_2_nudge_in` — `dotfiles:modern-cli-stack` — hint-only (not alias)
- `relates_to` — `brew-<name>` — related formula, cask, or engineering notes
- `depends_on` — `brew-<name>` — runtime or build dependency

## Observations

- [purpose] Schema for Homebrew formula notes in the brew/ directory
- [convention] Inferred from 27 notes created 2026-03-12; top fields by frequency: purpose (41%), gotcha (41%), config (26%), usage (22%), feature (22%)
- [convention] Relation names were inconsistent in first-generation notes — use the vocabulary above for all new notes

## Relations

- see also [[schema/brew_cask]] (cask variant for GUI apps)
- see also [[dotfiles:modern-cli-stack]] (hub note for documented CLI tools)
- see also [[schema/gh_extension]] (gh CLI extensions are GitHub-distributed companions to brew-installed CLIs like brew-gh)
