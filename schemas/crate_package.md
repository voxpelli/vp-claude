---
title: crate_package
type: schema
permalink: main/schema/crate-package
entity: crate_package
version: 1
schema:
  compatibility: string, MSRV and edition requirements
  pattern?(array): string, idiomatic usage patterns and key API examples
  gotcha?(array): string, common pitfalls, non-obvious behaviour, compile errors
  benefit?(array): string, design rationale — why use this over alternatives
  convention?(array): string, project-specific usage conventions and import patterns
  limitation?(array): string, known constraints, no_std caveats, feature-flag requirements
  relates_to?(array): Note, related crates or engineering notes
  depends_on?(array): Note, declared crate dependencies
settings:
  validation: warn
---

# crate_package

Schema for Rust crate notes — one note per crate in the `crates/` directory.

## Conventions

- [convention] Title format: `crate-<crate-name>` (e.g. `crate-serde`, `crate-anyhow`)
- [convention] Directory: `crates/`
- [convention] Include a Crate Details table with Version, MSRV, License, crates.io link
- [convention] `compatibility` should always state MSRV and whether the project's rust-version satisfies it
- [convention] `pattern` entries are the highest-value observations — real API usage, not just docs paraphrase
- [convention] `convention` entries are project-specific — how this project actually uses the crate
- [convention] `gotcha` entries should note compile errors, surprising trait requirements, and feature flag traps
- [convention] Relations use `[[crate-name]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for crate notes:
- `see also [[crate-x]]` — related crate in the same space
- `pairs with [[crate-x]]` — commonly used together (e.g. anyhow + thiserror)
- `depends on [[crate-x]]` — declared dependency
- `alternative to [[crate-x]]` — competes in the same space
- `application pattern in [[engineering/x]]` — links to a patterns note using this crate

## Observations

- [purpose] Schema for Rust crate notes in the crates/ directory
- [convention] Inferred from 5 notes; top fields by frequency: pattern (100%), gotcha (100%), compatibility (100%), benefit (80%), convention (80%)
- [convention] `compatibility` is required — MSRV drift is a common source of breakage; always record it explicitly
- [convention] Distinguish `pattern` (idiomatic API usage) from `convention` (this project's specific choices)

## Relations

- see also [[schema/brew_formula]] (analogous schema for Homebrew tools)
