---
title: go_module
type: schema
permalink: main/schema/go-module
entity: go_module
version: 1
schema:
  compatibility?: string, minimum Go version and module path (e.g. go 1.21, module
    github.com/x/y)
  pattern?(array): string, recurring usage patterns and idioms
  gotcha?(array): string, surprising behaviors and common pitfalls
  convention?(array): string, important usage conventions
  benefit?(array): string, advantages and strengths over alternatives
  limitation?(array): string, constraints and known weaknesses
  security?(array): string, CVE status, supply-chain considerations, and advisories
  api?(array): string, key API surface — method signatures, options, return shapes
  platform?(array): string, OS/architecture compatibility and lock-in
  history?(array): string, release tags and repo-creation dates
  reference?(array): string, useful pointer to in-repo docs or external sources
  popularity?(array): string, GitHub stars and Go module proxy signals with date stamp
  version?(array): string, current documented module version (e.g. v1.8.1) — the
    version this note's content reflects; the machine-stable slot
    /knowledge-gaps --stale compares against upstream (Pattern 3, checked before
    fragile prose extraction)
  license?: string, OSS license SPDX identifier or "no license" if unlicensed
  author?: string, primary author or maintainer name
  relates_to?(array): Note, related knowledge notes
  depends_on?(array): Note, upstream module dependencies
  used_by?(array): Note, downstream modules or projects that depend on this module
  alternative_to?(array): Note, modules that serve as direct substitutes
  created_by?: Note, primary author or maintainer (typically a person)
  contrasts_with?(array): Note, design alternative or counter-example module
settings:
  validation: warn
---

# go_module

Schema for Go module notes — one note per module in the `go/` directory.

## Conventions

- [convention] Title format: `go-<module-path>` (e.g. `go-github.com-spf13-cobra`)
- [convention] Directory: `go/`
- [convention] Include a Module Details table with Version, Go version floor, License, module path
- [convention] `compatibility` should state the minimum Go version and full module path
- [convention] `pattern` entries are the highest-value observations — real API usage, not docs paraphrase
- [convention] Relations use `[[go-module-path]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for Go module notes:
- `see_also [[go-x]]` — related module in the same space
- `pairs_with [[go-x]]` — commonly used together
- `depends_on [[go-x]]` — declared module dependency
- `alternative_to [[go-x]]` — competes in the same space
- `created_by [[person-x]]` — primary author or maintainer
- `contrasts_with [[go-x]]` — design alternative or counter-example

## Observations

- [purpose] Schema for Go module notes in the go/ directory
- [convention] Module path is the canonical identifier — use full path in title and compatibility field

## Relations

- see also [[schema/npm_package]] (analogous schema for npm packages)
