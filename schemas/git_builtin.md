---
title: git_builtin
type: schema
permalink: main/schema/git-builtin
entity: git_builtin
version: 1
schema:
  pattern?(array): string, recurring patterns and idioms in how the command is used
  gotcha?(array): string, surprising behaviors, pitfalls, and operational footguns
  convention?(array): string, established conventions for using the command effectively
  comparison?(array): string, "vs X" framings against analogous tools, primitives,
    or post-git alternatives

  stability?(array): string, stability state and lifecycle position (experimental,
    stable, deprecated) and how it has evolved across Git versions
  since?(array): string, version-introduction notes and feature timeline within Git
    core
  bare-repo?(array): string, bare-repository support and worktree-dependency observations
    — whether the command operates without a working tree

  adoption?(array): string, adoption signals from stacking tools, libraries, dotfiles,
    and downstream wrappers
  reference?(array): string, citations and source pointers external to this graph
    (mailing lists, blog posts, release notes)
  security?(array): string, security and supply-chain considerations specific to the
    command
  calibration?(array): string, criteria for whether the note should exist at all (non-obvious
    knowledge vs man-page duplication)

  relates_to(array): Note, related knowledge notes
  uses?(array): Note, primitives, tools, or other git built-ins this command depends on
  depends_on?(array): Note, package dependencies relevant to topic
  succeeded_by?(array): Note, successor command, primitive, or pattern in lineage
  preceded_by?(array): Note, predecessor command, primitive, or pattern in lineage
  references?(array): Note, knowledge notes or specs this references (directional, distinct from `relates_to`)
settings:
  validation: warn
---

# git_builtin

Schema for notes documenting Git built-in subcommands as first-class knowledge entities. Lives in `engineering/git/` and carries the `git-builtin` tag in frontmatter for category discoverability via `search_notes(tags=["git-builtin"])`.

Promoted from the speculative `git-primitive` tag scaffold on 2026-05-26 once three notes (`git-replay`, `git-range-diff`, `git-rerere`) accumulated with two or more recurring observation categories absent from the `engineering` picoschema (`stability`, `since`, `bare-repo`). See `engineering/governance/Git Subcommand Notes — Convention and Promotion Trigger.md` for the full convention.

## Recurring novel observation categories

Three categories distinguish git_builtin notes from generic engineering notes and motivated the schema promotion:

- `[stability]` — lifecycle position (experimental/stable/deprecated) and version-to-version evolution
- `[since]` — version-introduction timeline; callers need to know minimum-Git-version requirements
- `[bare-repo]` — whether the command operates without a working tree, enabling server-side automation

## Frontmatter conventions

Beyond the schema-required fields above, git_builtin notes typically carry:

- `url:` — canonical `git-scm.com/docs/git-<cmd>` documentation URL
- `since_version:` — Git version that introduced the subcommand (e.g. `2.44.0`)
- `stability:` — current state (`experimental` | `stable` | `deprecated`)
- `source:` — provenance stamp (`memory-research`, `tool-intel`, etc.)
- `tags:` — must include `git-builtin`; other tags vary by command domain

## Calibration rule

A git_builtin note must contain at least one piece of non-obvious knowledge absent from official Git docs or a well-known blog post — otherwise it duplicates the man page and earns no place in the graph.

## Observations

- [convention] Notes must conform to the hyphenated man-page naming form for title and filename (`git-replay`, `git-rerere`, `git-interpret-trailers`) — natural-invocation form (`git rebase --update-refs`) only in observation prose
- [convention] Tag scaffold is `git-builtin` (NOT `git-primitive` — git's official taxonomy reserves "primitive" for plumbing commands like `update-ref`/`hash-object`)
- [rule] Promoted from the `git-primitive` tag scaffold on 2026-05-26 after the trigger criteria fired (3 notes + recurring novel categories)
