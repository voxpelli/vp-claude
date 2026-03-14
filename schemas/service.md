---
title: service
type: schema
permalink: main/schema/service
entity: service
version: 1
schema:
  source: string, research provenance
  status?: string, active or deprecated or dead
  risk?(array): string, risks and concerns
  impact?: string, significance and reach
  adoption?: string, adoption level
  pattern?(array): string, architectural patterns
  note?: string, additional context
  innovation?(array): string, key innovations
  created_by?: Note, person or org that created it
  implements?(array): Note, protocols or standards it implements
  relates_to?(array): Note, related services or notes
  used_by?(array): Note, services or projects that depend on this
  bridges_to?(array): Note, protocols or ecosystems it bridges to
  part_of?: Note, parent ecosystem or platform
settings:
  validation: warn
---

# service

Schema for service notes covering products, platforms, tools, and hosted services.

Each note documents a single service or product — its architecture,
status, and relationships to protocols and ecosystems.

## Conventions

- [convention] Title describes the service and its role (e.g. `Vercel - Edge Deployment Platform`)
- [convention] Directory: organized by domain
- [convention] `source` is required — research provenance
- [convention] `status` should be one of: active, deprecated, dead, maintenance-mode
- [convention] Relations use `[[Title]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for service notes (use consistently):
- `created_by [[Person]]` — person or organization that created it
- `implements [[Protocol]]` — protocols or standards it implements
- `relates_to [[Service]]` — related services
- `used_by [[Service]]` — services or projects that depend on this
- `bridges_to [[Protocol]]` — protocols or ecosystems it bridges to
- `part_of [[Ecosystem]]` — parent ecosystem or platform

## Observations

- [purpose] Schema for service notes — products, platforms, tools, hosted services
- [convention] One note per service — cross-service analysis belongs in concept or milestone notes

## Relations

- see also [[schema/standard]] (for protocols services implement)
- see also [[schema/person]] (for creators)
- see also [[schema/concept]] (for architectural patterns)
