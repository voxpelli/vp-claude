---
title: pypi_package
type: schema
permalink: main/schema/pypi-package
entity: pypi_package
version: 1
schema:
  compatibility?: string, minimum Python version and platform requirements (e.g. Python
    ≥3.9, CPython only)
  pattern?(array): string, recurring usage patterns and idioms
  gotcha?(array): string, surprising behaviors and common pitfalls
  convention?(array): string, important usage conventions
  benefit?(array): string, advantages and strengths over alternatives
  limitation?(array): string, constraints and known weaknesses
  popularity?(array): string, PyPI download counts (pepy.tech / pypistats) with date stamp
  agent-leverage?(array): string, how a coding agent best invokes this package's CLI (only packages that ship a console script — a library-only package gets no entry) — an MCP-native path or a machine-readable --json/--format flag, verified via a live probe when the binary resolves locally or explicit primary-source doc text (PyPI/README/homepage) otherwise, stamped with source + date, never inferred; recorded only for a genuine positive or a narrowly-scoped surprising negative
  version?(array): string, current documented package version (e.g. 2.32.3) —
    the version this note's content reflects; the machine-stable slot
    /knowledge-gaps --stale compares against upstream (Pattern 3, checked before
    fragile prose extraction)
  relates_to?(array): Note, related knowledge notes
  depends_on?(array): Note, upstream package dependencies
  used_by?(array): Note, downstream consumers of this package (inverse of depends_on)
  alternative_to?(array): Note, packages that serve as direct substitutes
settings:
  validation: warn
---

# pypi_package

Schema for Python PyPI package notes — one note per package in the `pypi/` directory.

## Conventions

- [convention] Title format: `pypi-<name>` (e.g. `pypi-requests`, `pypi-pydantic`)
- [convention] Directory: `pypi/`
- [convention] Include a Package Details table with Version, Python version floor, License, PyPI link
- [convention] `compatibility` should state the minimum Python version and any platform/runtime constraints (CPython only, etc.)
- [convention] `gotcha` should note Python 2 vs 3 differences where relevant, and major API breaks between versions
- [convention] Relations use `[[pypi-name]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for PyPI package notes:
- `see_also [[pypi-x]]` — related package in the same space
- `pairs_with [[pypi-x]]` — commonly used together
- `depends_on [[pypi-x]]` — declared package dependency
- `alternative_to [[pypi-x]]` — competes in the same space

## Observations

- [purpose] Schema for Python PyPI package notes in the pypi/ directory
- [convention] py3.8/3.9 differences are real — always record minimum Python version

## Relations

- see also [[schema/npm_package]] (analogous schema for npm packages)
