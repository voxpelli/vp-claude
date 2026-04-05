---
title: github_action
type: schema
permalink: main/schema/github-action
entity: github_action
version: 1
schema:
  purpose?: string, what the action does and its primary use case
  inputs?(array): string, key input parameters — name, required/optional, default value
  outputs?(array): string, outputs the action produces and what they contain
  permission?(array): string, required GITHUB_TOKEN permissions (e.g. contents: read)
  gotcha?(array): string, common pitfalls, version pinning, supply-chain considerations
  security?(array): string, known CVEs, supply-chain incidents, and security advisories
  version?(array): string, version pinning and update guidance
  usage?(array): string, common workflow patterns and invocation examples
  feature?(array): string, notable capabilities worth knowing
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
- [convention] `inputs` and `outputs` map to the `## Inputs & Outputs` section tool-intel writes
- [convention] `permission` maps to the `## Permissions` section in tool-intel output
- [convention] `security` captures CVEs and supply-chain advisories; distinguish from `gotcha` (usage pitfalls)

## Relations

- see also [[schema/brew_formula]] (analogous schema for CLI tools)
- see also [[schema/docker_image]] (often used together in CI workflows)
