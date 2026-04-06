---
title: person
type: schema
permalink: main/schema/person
entity: person
version: 1
schema:
  source: string, research provenance
  role?: string, what they are known for
  impact?: string, achievements and influence
  insight?(array): string, notable quotes or ideas
  pattern?(array): string, working patterns
  connection?(array): string, cross-person contextual links and biographical connections
  influence?(array): string, intellectual or technical influence on the field
  note?: string, additional context
  created?(array): Note, projects or protocols they created
  founded?: Note, organization or movement they founded
  maintains?(array): Note, projects they actively maintain
  part_of?: Note, organization or movement they belong to
  works_with?(array): Note, collaborators or related people
  enables?(array): Note, projects or standards they enabled
  influenced_by?(array): Note, people or movements that shaped their thinking
  influences?(array): Note, people, projects, or movements they influenced
  relates_to?(array): Note, related notes
settings:
  validation: warn
---

# person

Schema for person notes.

Each note documents a single person — their role, contributions,
and relationships to projects, protocols, and movements.

## Conventions

- [convention] Title format: `Name - Brief Descriptor` (e.g. `Linus Torvalds - Linux Creator`)
- [convention] Directory: organized by domain
- [convention] `source` is required — research provenance; other fields are optional
- [convention] `role` should be a concise phrase describing their primary contribution
- [convention] Relations use `[[Title]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for person notes (use consistently):
- `created [[Project]]` — projects or protocols they created
- `founded [[Movement]]` — organization or movement they founded
- `maintains [[Project]]` — projects they actively maintain
- `part_of [[Organization]]` — organization they belong to
- `works_with [[Person]]` — collaborators
- `enables [[Project]]` — projects or standards they enabled

## Observations

- [purpose] Schema for person notes documenting key figures and their contributions
- [convention] One note per person — biographical details and contribution history

## Relations

- see also [[schema/service]] (for projects people created)
- see also [[schema/standard]] (for protocols people authored)
