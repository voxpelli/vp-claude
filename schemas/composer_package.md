---
title: composer_package
type: schema
permalink: main/schema/composer-package
entity: composer_package
version: 1
schema:
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

# composer_package

Schema for PHP Composer package notes — one note per package in the `composer/` directory.

## Conventions

- [convention] Title format: `composer-<vendor>/<pkg>` (e.g. `composer-laravel/framework`)
- [convention] Directory: `composer/`
- [convention] Include a Package Details table with Version, PHP version floor, License, Packagist link
- [convention] `gotcha` should always note PHP version requirements and major breaking-change history
- [convention] Relations use `[[composer-vendor/pkg]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for Composer package notes:
- `see also [[composer-x]]` — related package in the same space
- `pairs with [[composer-x]]` — commonly used together
- `depends on [[composer-x]]` — declared Composer dependency
- `alternative to [[composer-x]]` — competes in the same space

## Observations

- [purpose] Schema for PHP Composer package notes in the composer/ directory

## Relations

- see also [[schema/npm_package]] (analogous schema for npm packages)
