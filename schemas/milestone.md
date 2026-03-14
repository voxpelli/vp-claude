---
title: milestone
type: schema
permalink: main/schema/milestone
entity: milestone
version: 1
schema:
  source: string, research provenance
  lesson?(array): string, lessons learned
  pattern?(array): string, recurring patterns
  evolution?: string, how things evolved
  failure?(array): string, what failed and why
  turning-point?: string, pivotal moments
  era?: string, time period characterization
  anti-pattern?(array): string, approaches to avoid
  precedent?(array): string, historical precedents
  proven?: string, validated approaches
  note?: string, additional context
  part_of?: Note, parent era or movement
  preceded?(array): Note, what this led to
  context_for?: Note, what this provides context for
  lesson_for?: Note, what this teaches lessons about
  relates_to?(array): Note, related notes
  contrasts_with?(array): Note, contrasting events or analyses
  informs?(array): Note, notes this analysis informs
settings:
  validation: warn
---

# milestone

Schema for milestone notes covering historical analyses, events, turning points, and critiques.

Each note documents a single historical event, era analysis, or critical
examination — capturing lessons, patterns, and their significance.

## Conventions

- [convention] Title describes the event or analysis (e.g. `Node.js Fork 2014 - The io.js Split`)
- [convention] Directory: organized by domain
- [convention] `source` is required — research provenance
- [convention] Include dates or date ranges in titles where applicable
- [convention] Relations use `[[Title]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for milestone notes (use consistently):
- `part_of [[Era]]` — parent era or movement
- `preceded [[Event]]` — what this led to
- `context_for [[Analysis]]` — what this provides context for
- `lesson_for [[Topic]]` — what this teaches lessons about
- `relates_to [[Note]]` — related notes
- `contrasts_with [[Event]]` — contrasting events
- `informs [[Note]]` — notes this analysis informs

## Observations

- [purpose] Schema for milestone notes — historical events, era analyses, critiques, turning points
- [convention] One note per event or analysis — broader concepts belong in concept notes

## Relations

- see also [[schema/concept]] (for movements and philosophies)
- see also [[schema/person]] (for key figures)
- see also [[schema/standard]] (for protocols that emerged)
