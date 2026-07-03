---
title: ruby_gem
type: schema
permalink: main/schema/ruby-gem
entity: ruby_gem
version: 1
schema:
  pattern?(array): string, recurring usage patterns and idioms
  gotcha?(array): string, surprising behaviors and common pitfalls
  convention?(array): string, important usage conventions
  benefit?(array): string, advantages and strengths over alternatives
  limitation?(array): string, constraints and known weaknesses
  popularity?(array): string, RubyGems download counts with date stamp
  version?(array): string, current documented gem version (e.g. 7.1.3) — the
    version this note's content reflects; the machine-stable slot
    /knowledge-gaps --stale compares against upstream (Pattern 3, checked before
    fragile prose extraction)
  relates_to?(array): Note, related knowledge notes
  depends_on?(array): Note, upstream gem dependencies
  used_by?(array): Note, downstream consumers of this gem (inverse of depends_on)
  alternative_to?(array): Note, gems that serve as direct substitutes
settings:
  validation: warn
---

# ruby_gem

Schema for Ruby gem notes — one note per gem in the `gems/` directory.

## Conventions

- [convention] Title format: `gem-<name>` (e.g. `gem-rails`, `gem-sidekiq`)
- [convention] Directory: `gems/`
- [convention] Include a Gem Details table with Version, Ruby version floor, License, RubyGems link
- [convention] `gotcha` should always note Ruby version requirements and major API breaks between major versions
- [convention] Relations use `[[gem-name]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for gem notes:
- `see_also [[gem-x]]` — related gem in the same space
- `pairs_with [[gem-x]]` — commonly used together
- `depends_on [[gem-x]]` — declared gem dependency
- `alternative_to [[gem-x]]` — competes in the same space

## Observations

- [purpose] Schema for Ruby gem notes in the gems/ directory

## Relations

- see also [[schema/npm_package]] (analogous schema for npm packages)
