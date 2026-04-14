# Person Note Template

Use this template when creating new person notes with `write_note`. Place in
the `people/` directory by default, or a domain-specific directory if the
person clearly belongs to a cluster.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

````markdown
---
title: <Full Name> - <Brief Descriptor>
type: person
url: <personal-site or most authoritative URL>
tags: [<domain>, <subdomain>]
role: <concise phrase — primary contribution or role>
source: people-intel (<date>)
---

# <Full Name> - <Brief Descriptor>

[One-sentence bio: what they are known for, current role/affiliation.]

## Observations

- [role] <current role and affiliation>
- [impact] <achievements and field influence>
- [contribution] <specific work: book, spec, project, talk>
- [insight] "<direct quote or core idea>"
- [pattern] <thinking or working pattern>
- [influence] <who or what shaped them / who they shaped>
- [connection] <biographical context, career arc, affiliations>
- [raindrop] <bookmarked article by or about them, with context>
- [readwise] <highlighted passage from their writing, with context>
- [source] Researched <date> via people-intel (<sources consulted>)

## Relations

- created [[<Project or Standard they created>]]
- maintains [[<Project they actively maintain>]]
- founded [[<Organization or Movement>]]
- part_of [[<Organization or Movement>]]
- works_with [[<Collaborator - Descriptor>]]
- relates_to [[<Related Note>]]
````

## Field Guidelines

### Title format

`<Full Name> - <Brief Descriptor>` where the descriptor is a concise phrase
(3-8 words) capturing the person's primary contribution. The descriptor comes
from Tavily bio synthesis or the existing note title.

Examples:
- `Linus Torvalds - Linux Creator`
- `Tim Berners-Lee - World Wide Web Inventor`
- `Grace Hopper - Computer Science Pioneer and COBOL Creator`

### Observation categories

Use whatever category fits. Common ones for person notes:

| Category | When to use |
|----------|-------------|
| `role` | Current and past roles/positions |
| `impact` | Achievements, influence on the field |
| `contribution` | Specific works: books, specs, projects, talks |
| `insight` | Direct quotes or core ideas (use quotation marks) |
| `pattern` | Thinking/working patterns revealed by their work |
| `influence` | Intellectual lineage — who shaped them, who they shaped |
| `connection` | Biographical context, career arcs, affiliations |
| `controversy` | Legitimate disagreements or criticisms (sourced) |
| `raindrop` | Bookmarked articles by or about the person |
| `readwise` | Highlighted passages from their writing |
| `source` | Research provenance (always include) |

### Relation vocabulary

Use the person schema's declared verbs:

| Verb | When to use |
|------|-------------|
| `created` | Projects or protocols they created |
| `founded` | Organizations or movements they founded |
| `maintains` | Projects they actively maintain |
| `part_of` | Organizations they belong to |
| `works_with` | Collaborators |
| `enables` | Projects or standards they enabled |
| `relates_to` | General related notes |

### Fourth-wall checklist (condensed)

Before writing, verify:

1. Every sentence is about the **person**, not the knowledge graph
2. No claims about "X has no presence in Raindrop/BM"
3. No "Connection to the Knowledge Graph" sections
4. Lede sentence says what the person IS, not where they fit in coverage
5. Export test: would someone unfamiliar with BM understand every paragraph?
