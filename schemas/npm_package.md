---
title: npm-package
type: schema
permalink: main/schema/npm-package
entity: npm_package
version: 1
schema:
  pattern?(array): string, recurring usage patterns and idioms
  gotcha?(array): string, surprising behaviors and common pitfalls
  convention?(array): string, important usage conventions
  benefit?(array): string, advantages and strengths over alternatives
  limitation?(array): string, constraints and known weaknesses
  security?(array): string, CVE status, supply-chain considerations, and advisories
  api?(array): string, key API surface — method signatures, options, return shapes
  relates_to?(array): Note, related knowledge notes
  depends_on?(array): Note, upstream package dependencies
settings:
  validation: warn
---

# npm-package

Schema for npm package entity notes in the `npm/` directory.

Each note documents a single npm package with five-source enrichment
(DeepWiki, Context7, Tavily, Raindrop, Changelog).

## Required Sections

- `## Key APIs` — primary API surface with signatures and descriptions
- `## Observations` — semantic categories: pattern, gotcha, convention, benefit, limitation
- `## Release Highlights` — curated version history (change-type first, linked version)
- `## Security` — CVE status, maintenance level, license
- `## Relations` — wiki-links to related notes and dependencies

## Frontmatter Conventions

- `title: npm:<package-name>` — resolves `[[npm:pkg]]` wiki-links
- `packages: ["<npm-package-name>"]` — exactly one package per entity note
- `tags: [<domain>, <subdomain>]` — broad categorization

## Observations

- [convention] One package per entity note — cross-package knowledge belongs in engineering/ notes
- [convention] Title format `npm:<package-name>` enables automatic wiki-link resolution
- [convention] Release Highlights: change-type first, linked version `([vX.Y.Z](url), date)`
- [convention] Curate aggressively — only changes relevant to our projects, not a changelog mirror
