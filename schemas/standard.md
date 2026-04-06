---
title: standard
type: schema
permalink: main/schema/standard
entity: standard
version: 1
schema:
  source: string, research provenance
  status?: string, W3C or lifecycle status
  design?(array): string, key design decisions
  adoption?: string, adoption level
  limitation?(array): string, known limitations
  security?(array): string, security considerations
  evolution?: string, how it evolved
  trend?(array): string, current adoption and ecosystem trends
  pattern?(array): string, recurring implementation patterns
  innovation?(array): string, key innovations
  relates_to?(array): Note, related knowledge notes
  extends?: Note, protocol this extends
  complements?: Note, complementary standard or protocol
  lesson_for?: Note, what this standard teaches lessons about
  extended_by?(array): Note, protocols that extend this
  succeeded?: Note, protocol this replaced
  used_by?(array): Note, services and tools using this protocol
  implemented_by?(array): Note, implementations of this protocol
  part_of?: Note, parent movement or stack
settings:
  validation: warn
---

# standard

Schema for protocol and standard notes.

Each note documents a single protocol, specification, or standard — covering
its design, status, adoption, and relationships to other standards.

## Conventions

- [convention] Title matches the protocol name (e.g. `HTTP/2`, `OAuth 2.0`, `ActivityPub`)
- [convention] Directory: organized by domain
- [convention] `source` is required — research provenance (e.g. "Researched 2026-03-14 via Tavily, DeepWiki")
- [convention] `status` should use W3C lifecycle terms where applicable (Recommendation, Note, Editor's Draft)
- [convention] Relations use `[[Title]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for standard notes (use consistently):
- `part_of [[Movement]]` — parent movement or stack
- `extends [[Protocol]]` — this standard builds on another
- `extended_by [[Protocol]]` — another standard extends this one
- `succeeded [[Protocol]]` — this standard replaced an older one
- `used_by [[Service]]` — services implementing this standard
- `implemented_by [[Implementation]]` — concrete implementations
- `relates_to [[Standard]]` — related standards or concepts

## Observations

- [purpose] Schema for protocol and standard notes covering W3C specs, IETF standards, and community protocols
- [convention] One note per protocol or standard — cross-protocol analysis belongs in milestone or concept notes

## Relations

- see also [[schema/concept]] (for movements and philosophies)
- see also [[schema/milestone]] (for historical analyses)
- see also [[schema/service]] (for implementations)
