---
title: pattern
type: schema
permalink: main/schema/pattern
entity: pattern
version: 1
schema:
  pattern(array): string, structural elements, recurring sub-patterns, named variants
  tradeoff?(array): string, design tensions; when this pattern costs more than it saves
  insight?(array): string, non-obvious analytical conclusions
  precedent?(array): string, historical instances or prior art
  history?(array): string, origin, evolution, independent reinvention across domains
  theoretical?(array): string, grounding in formal theory
  counter-position?(array): string, opposing philosophies that sharpen understanding
  alternative?(array): string, alternative approaches with different tradeoff profiles
  convention?(array): string, established conventions around applying this pattern
  gotcha?(array): string, misapplication risks and failure modes
  principle?(array): string, guiding principles the pattern embodies
  benefit?(array): string, concrete advantages
  limitation?(array): string, applicability boundaries
  anti-pattern?(array): string, inversions or misapplications to avoid
  decision?(array): string, architectural decisions the pattern drives
  relates_to?(array): Note, related patterns and concepts
  has_instance?(array): Note, concrete instances of this abstract pattern
  instance_of?(array): Note, abstract pattern this note instantiates
  applied_to?(array): Note, contexts where applied
  implemented_by?(array): Note, concrete implementations
  part_of?(array): Note, parent hub or family
settings:
  validation: warn
---

# pattern

Schema for pattern notes — cross-domain structural insights with explicit
tradeoffs, precedents, and analytical depth.

## Boundary Test

Does the note describe a *transferable structural insight* with explicit
tradeoffs? → pattern. Does it describe *how to do X in tech Y*? → engineering.

## Conventions

- [convention] Title format: descriptive name (e.g. `tolerance-trap`, `worse-is-better`)
- [convention] Directory: `engineering/patterns/` (colocated with engineering, distinguished by type)
- [convention] `pattern` is the only required field — at least one structural element
- [convention] `tradeoff` entries are the highest-value observations — when the pattern hurts matters as much as when it helps
- [convention] `precedent` should cite concrete historical instances, not abstract references
- [convention] Relations use `[[pattern-name]]`, `[[concept-name]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for pattern notes:
- `relates to [[pattern-x]]` — related pattern in the same analytical space
- `has instance [[concept-x]]` — concrete instance of this abstract pattern
- `instance of [[pattern-x]]` — abstract pattern this note instantiates
- `applied to [[engineering-x]]` — engineering context where applied
- `implemented by [[npm-x]]` — concrete implementation in a package
- `part of [[pattern-x]]` — parent hub or pattern family

## Observations

- [purpose] Schema for cross-domain structural insight notes with tradeoff analysis
- [convention] Inferred from 6 notes typed pattern; rich analytical fields (tradeoff, precedent, counter-position) that engineering schema lacks
- [distinction] Pattern notes document transferable structural insights; engineering notes document domain-specific how-to knowledge

## Relations

- see also [[schema/engineering]] (domain-specific knowledge counterpart)
- see also [[schema/concept]] (conceptual movements and ideas)
