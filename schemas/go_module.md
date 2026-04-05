---
title: go_module
type: schema
permalink: main/schema/go-module
entity: go_module
version: 1
schema:
  compatibility?: string, minimum Go version and module path (e.g. go 1.21, module github.com/x/y)
  pattern?(array): string, recurring usage patterns and idioms
  gotcha?(array): string, surprising behaviors and common pitfalls
  convention?(array): string, important usage conventions
  benefit?(array): string, advantages and strengths over alternatives
  limitation?(array): string, constraints and known weaknesses
  relates_to?(array): Note, related knowledge notes
  depends_on?(array): Note, upstream module dependencies
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
- `see also [[go-x]]` — related module in the same space
- `pairs with [[go-x]]` — commonly used together
- `depends on [[go-x]]` — declared module dependency
- `alternative to [[go-x]]` — competes in the same space

## Observations

- [purpose] Schema for Go module notes in the go/ directory
- [convention] Module path is the canonical identifier — use full path in title and compatibility field

## Relations

- see also [[schema/npm_package]] (analogous schema for npm packages)
