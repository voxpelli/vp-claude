---
title: concept
type: schema
permalink: main/schema/concept
entity: concept
version: 1
schema:
  source: string, research provenance
  pattern?(array): string, recurring patterns
  trend?(array): string, current trends
  philosophy?: string, guiding philosophy
  gap?(array): string, identified gaps
  note?: string, additional context
  risk?(array): string, risks or concerns
  part_of?: Note, parent movement or category
  relates_to?(array): Note, related concepts or notes
  complements?: Note, complementary concept
  contrasts_with?: Note, contrasting approach
  includes?(array): Note, sub-concepts or components
settings:
  validation: warn
---

# concept

Schema for concept notes covering movements, strategies, philosophies, and patterns.

Each note documents a single concept — its philosophy, patterns, trends,
and relationships to other ideas and projects.

## Conventions

- [convention] Title describes the concept clearly (e.g. `Twelve-Factor App`, `Event Sourcing - CQRS Pattern`)
- [convention] Directory: organized by domain
- [convention] `source` is required — research provenance
- [convention] Relations use `[[Title]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for concept notes (use consistently):
- `part_of [[Movement]]` — parent movement or category
- `relates_to [[Concept]]` — related concepts
- `complements [[Concept]]` — complementary idea
- `contrasts_with [[Concept]]` — contrasting approach
- `includes [[Component]]` — sub-concepts or components

## Observations

- [purpose] Schema for concept notes — movements, strategies, philosophies, design patterns
- [convention] One note per concept — historical analysis belongs in milestone notes

## Relations

- see also [[schema/standard]] (for protocols)
- see also [[schema/milestone]] (for historical events and analyses)
- see also [[schema/service]] (for implementations)
