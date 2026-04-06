---
title: reference
type: schema
permalink: main/schema/reference
entity: reference
version: 1
schema:
  source?: string, research provenance
  convention?(array): string, conventions and patterns documented
  pattern?(array): string, key patterns demonstrated
  gotcha?(array): string, common pitfalls and surprising behaviors
  relates_to?(array): Note, related reference docs, packages, or tools
  demonstrates?(array): Note, patterns or packages this reference exemplifies
settings:
  validation: warn
---

# reference

Schema for reference notes — lookup documents you return to during work
to find specific facts (templates, spec tables, command references).

## Boundary Test

Do you return during work to find specific facts? → reference.
Do you read through for understanding? → engineering or concept.

## Conventions

- [convention] Title format: descriptive name (e.g. `reference-node-app-template`)
- [convention] Directory: `references/` for templates, topic directory for spec docs (e.g. `indieweb/`)
- [convention] `source` should note where the reference material originated
- [convention] Reference notes are lookup-optimized — use tables, property lists, and structured formats
- [convention] Relations use `[[prefix-name]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for reference notes:
- `relates to [[reference-x]]` — related reference document
- `demonstrates [[pattern-x]]` — pattern this reference exemplifies
- `relates to [[npm-x]]` — package this reference documents
- `relates to [[engineering-x]]` — engineering topic this reference supports

## Observations

- [purpose] Schema for lookup documents — templates, spec references, command docs
- [convention] Inferred from 6 genuine reference notes (3 templates, 1 spec, 2 CLI docs)
- [distinction] Reference notes are for looking up facts; engineering notes are for learning how

## Relations

- see also [[schema/engineering]] (understanding-focused counterpart)
- see also [[schema/pattern]] (structural insight counterpart)
