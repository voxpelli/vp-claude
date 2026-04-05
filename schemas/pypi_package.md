---
title: pypi_package
type: schema
permalink: main/schema/pypi-package
entity: pypi_package
version: 1
schema:
  compatibility?: string, minimum Python version and platform requirements (e.g. Python ≥3.9, CPython only)
  pattern?(array): string, recurring usage patterns and idioms
  gotcha?(array): string, surprising behaviors and common pitfalls
  convention?(array): string, important usage conventions
  benefit?(array): string, advantages and strengths over alternatives
  limitation?(array): string, constraints and known weaknesses
  relates_to?(array): Note, related knowledge notes
  depends_on?(array): Note, upstream package dependencies
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
- `see also [[pypi-x]]` — related package in the same space
- `pairs with [[pypi-x]]` — commonly used together
- `depends on [[pypi-x]]` — declared package dependency
- `alternative to [[pypi-x]]` — competes in the same space

## Observations

- [purpose] Schema for Python PyPI package notes in the pypi/ directory
- [convention] py3.8/3.9 differences are real — always record minimum Python version

## Relations

- see also [[schema/npm_package]] (analogous schema for npm packages)
