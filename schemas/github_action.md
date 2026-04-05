---
title: github_action
type: schema
permalink: main/schema/github-action
entity: github_action
version: 1
schema:
  purpose?: string, what the action does and its primary use case
  gotcha?(array): string, common pitfalls, version pinning, supply-chain considerations
  security?(array): string, known CVEs, supply-chain incidents, and security advisories
  version?(array): string, version pinning and update guidance
  usage?(array): string, common workflow patterns and invocation examples
  pattern?(array): string, workflow patterns, integration recipes, and best practices
  relates_to?(array): Note, related actions or engineering notes
settings:
  validation: warn
---

# github_action

Schema for GitHub Actions notes — one note per action in the `actions/` directory.

## Conventions

- [convention] Title format: `action-<owner>/<repo>` (e.g. `action-actions/checkout`)
- [convention] Directory: `actions/`
- [convention] Include an Action Details table with Version pinned (SHA or tag), marketplace link
- [convention] `permission` should list all required `permissions:` keys and their values (read/write)
- [convention] `gotcha` must include version pinning guidance — SHA pinning vs tag pinning tradeoffs
- [convention] Supply-chain risk level should be noted in `gotcha` for third-party actions
- [convention] Relations use `[[action-owner/repo]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for GitHub Action notes:
- `see also [[action-x]]` — related action in the same space
- `pairs with [[action-x]]` — commonly used in the same workflow
- `alternative to [[action-x]]` — competes in the same space
- `relates to [[engineering/x]]` — links to relevant engineering notes

## Observations

- [purpose] Schema for GitHub Actions notes in the actions/ directory
- [convention] Input parameters and outputs are documented in the `## Inputs & Outputs` prose section — not as observation tags (fields removed in schema v2 after 0% usage across 19 notes)
- [convention] Required permissions are documented in the `## Permissions` prose section — not as observation tags (same rationale)
- [convention] `security` captures CVEs and supply-chain advisories; distinguish from `gotcha` (usage pitfalls)
- [convention] `pattern` captures workflow integration recipes and best practices — distinct from `usage` (invocation mechanics) and `gotcha` (pitfalls)

## Relations

- see also [[schema/brew_formula]] (analogous schema for CLI tools)
- see also [[schema/docker_image]] (often used together in CI workflows)
