---
title: project
type: schema
permalink: main/schema/project
entity: project
version: 1
schema:
  status(enum): [idea, labs, active, maintained, archived], project lifecycle stage
  owner?: Note, person or entity that owns the project
  repo?: string, GitHub repository (owner/repo format)
  domain?: string, production domain if deployed
  architecture?(array): string, technical architecture and design decisions
  feature?(array): string, key features and capabilities
  risk?(array): string, risks and concerns
  revenue?: string, revenue model or monetization approach
  competitive?(array): string, competitive landscape observations
  testing?(array): string, test strategy and infrastructure
  decision?(array): string, key architectural or product decisions
  product?: string, product positioning or value proposition
  synergy?(array): string, integration points with sibling projects
  evidence?(array): string, market evidence or validation signals
  product_of?: Note, person or organization that created it
  part_of?: Note, parent ecosystem or product family
  implements?(array): Note, protocols or standards it implements
  built_with?(array): Note, key framework or library dependencies
  depends_on?(array): Note, vendor or internal package dependencies
  complements?(array): Note, sibling projects with complementary scope
  relates_to?(array): Note, related notes
settings:
  validation: warn
---

# project

Schema for project notes — things you own and build, at any lifecycle stage
from idea through active development to archived.

## Boundary Test

Do you own and build it (or plan to)? Does it have a repo or codebase
(actual or planned)? -> project.
Is it an external product/platform you document or evaluate? -> service.

## Conventions

- [convention] Title format: descriptive name (e.g. `Varsel - Sovereign WebSub Notification Hub`)
- [convention] Directory: `projects/`
- [convention] `status` is required — lifecycle stage (idea, labs, active, maintained, archived)
- [convention] Relations use `[[Title]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for project notes (use consistently):
- `product_of [[Person]]` — person or organization that created it
- `part_of [[Ecosystem]]` — parent ecosystem or product family
- `implements [[Standard]]` — protocols or standards it implements
- `built_with [[Package]]` — key framework or library dependencies
- `depends_on [[Package]]` — vendor or internal package dependencies
- `complements [[Project]]` — sibling projects with complementary scope
- `relates_to [[Note]]` — related notes

## Observations

- [purpose] Schema for project notes — things you own and build at any lifecycle stage
- [convention] One note per project — cross-project analysis belongs in concept notes
- [distinction] Project = you are the builder/owner; Service = you are the consumer/observer

## Relations

- see also [[schema/service]] (for external products you consume)
- see also [[schema/standard]] (for protocols projects implement)
- see also [[schema/person]] (for project creators)
