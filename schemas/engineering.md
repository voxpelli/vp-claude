---
title: engineering
type: schema
permalink: main/schema/engineering
entity: engineering
version: 1
schema:
  pattern?(array): string, recurring patterns and idioms
  gotcha?(array): string, surprising behaviors and pitfalls
  convention?(array): string, established conventions
  rule?(array): string, mandatory rules and constraints
  distinction?(array): string, important conceptual distinctions

  limitation?(array): string, known constraints
  principle?(array): string, guiding principles

  tip?(array): string, practical tips and shortcuts

  lesson?(array): string, lessons learned from real-world experience
  anti-pattern?(array): string, approaches to avoid and why

  decision?(array): string, architectural and design decisions with rationale
  comparison?(array): string, "vs X" framings against analogous tools or approaches in adjacent domains
  adoption?(array): string, adoption signals from ecosystem usage and downstream wrappers

  relates_to(array): Note, related knowledge notes
  extends?(array): Note, parent notes this note specializes or builds upon
  depends_on?(array): Note, package dependencies relevant to topic
  references?(array): Note, knowledge notes or specs this references (directional, distinct from `relates_to`)
  documents?(array): Note, protocols/services/projects this note documents
  informs?(array): Note, knowledge notes whose direction this informs
  informed_by?(array): Note, knowledge notes that informed this note
  inspired_by?(array): Note, prior art or ideas that influenced this note
  inspired?(array): Note, downstream notes this influenced
  has_spoke?(array): Note, spoke notes under this hub (hub-and-spoke topology)
  hub_for?(array): Note, hub note this is a spoke of (inverse of `has_spoke`)
  bridges_to?(array): Note, parallel or analogous concept in another domain
  succeeded_by?(array): Note, successor pattern or technology in lineage
  preceded_by?(array): Note, predecessor pattern or technology in lineage
settings:
  validation: warn
---

# engineering

Schema for engineering knowledge notes in the `engineering/` directory tree.

These notes capture cross-project, technology-focused knowledge organized
by domain (fastify, frontend, database, testing, tooling, agents).

## Subdirectories

| Directory | Topics |
|-----------|--------|
| `engineering/agents/` | Orchestration, workflow, Basic Memory tools |
| `engineering/database/` | Query patterns, migrations, PostgreSQL |
| `engineering/fastify/` | Plugin patterns, lifecycle, error handling |
| `engineering/frontend/` | Web components, CSS, dark mode, SSR, a11y |
| `engineering/testing/` | Test conventions, infrastructure, coverage |
| `engineering/tooling/` | Linter config, build pipelines, knip |

## Frontmatter Conventions

- `packages: [...]` — npm packages whose APIs/behavior are documented (or `[]` for meta notes)
- `tags: [<domain>, ...]` — broad categorization for discoverability

## Observations

- [convention] Notes must be project-independent — no absolute file paths, table names, or project-specific config
- [convention] Vendor package names (e.g., `@yikesable/fastify-saas-auth`) are fine since they're real npm packages
- [convention] Use concrete code examples, not abstract principles
- [distinction] Engineering notes span multiple packages; npm entity notes cover one package each
