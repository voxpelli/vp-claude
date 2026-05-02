---
title: gh_extension
type: schema
permalink: main/schema/gh-extension
entity: gh_extension
version: 1
schema:
  purpose?: string, what the extension adds to the gh CLI and primary use case
  version?: string, latest released version (tag) on the upstream GitHub repo
  runtime_shape?: string, "binary" (precompiled release assets), "script" (interpreted via shebang), or "local" (symlinked dev install via `gh ext install .`)
  discovery_mechanism?: string, how gh locates the extension on disk; defaults to PATH-based via the gh extension subsystem
  host_command?: string, the host CLI under which the extension is invoked; defaults to "gh"
  naming_convention?: string, repository naming requirement; defaults to "gh-<name>"
  language?: string, primary implementation language (Go, Bash, Python, etc.)
  source?: string, canonical GitHub repository URL — owner/repo IS the identifier
  gotcha?(array): string, common pitfalls — install vs upgrade, shadowed core commands, missing runtime deps
  security?(array): string, supply-chain considerations, pin-to-tag risks, third-party publisher concerns
  pattern?(array): string, recurring usage patterns and integration recipes
  command?(array): string, primary subcommands the extension exposes
  flag?(array): string, notable flags or options worth documenting
  depends_on?(array): string, runtime dependencies required at execution time (binaries, brew formulae, fzf, jq, etc.)
  platform?(array): string, supported OS/arch combinations (linux-amd64, darwin-arm64, windows-amd64)
  install_mode?(array): string, installation methods — `gh extension install`, manual git clone, brew tap
  popularity?(array): string, GitHub stars, fork count, or `gh extension search` ranking with date stamp
  design?(array): string, architectural choices — pure-script vs binary release, single-file vs multi-file
  relates_to?(array): Note, related extensions, the gh formula, or engineering notes
settings:
  validation: warn
---

# gh_extension

Schema for GitHub CLI extension notes — one note per extension in the `gh/` directory.

## Conventions

- [convention] Title format: `gh-<owner>-<repo>` (e.g. `gh-meiji163-gh-notify`, `gh-voxpelli-gh-audit-envs`)
- [convention] Directory: `gh/`
- [convention] Identifier IS the upstream GitHub repo — no separate registry; `owner/repo` is canonical
- [convention] `runtime_shape` distinguishes precompiled `binary` extensions (release assets per OS/arch), `script` extensions (shebang-dispatched bash/python/ruby), and `local` extensions (symlinked dev installs via `gh ext install .`)
- [convention] `host_command` defaults to `gh`; only override if the extension is hosted by a different CLI fork
- [convention] `naming_convention` enforces the upstream rule that the repo name MUST start with `gh-` for `gh extension install` to recognise it
- [convention] `tags` frontmatter must include `gh-extension`, `cli`, `github`, `ai-bookmarked`
- [convention] `security` should note pin-to-tag vs pin-to-commit considerations — `gh extension install` resolves to HEAD by default
- [convention] `gotcha` must address shadowing risk if the extension name collides with a future core `gh` subcommand
- [convention] Relations use `[[gh-owner-repo]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for gh extension notes:
- `see also [[gh-x]]` — related extension in the same space
- `pairs with [[gh-x]]` — commonly installed together
- `alternative to [[gh-x]]` — competes in the same space
- `depends on [[brew-x]]` — runtime dependency on a Homebrew-installed tool
- `runs on [[brew-gh]]` — host CLI this extension extends
- `implements [[action-x]]` — wraps or invokes a related GitHub Action
- `relates to [[engineering/x]]` — links to relevant engineering notes

## Observations

- [purpose] Schema for GitHub CLI extension notes in the gh/ directory
- [convention] Primary commands and flags are documented in the `## Commands & Invocation` prose section AND mirrored as `[command]`/`[flag]` observations for searchability
- [convention] Runtime dependencies appear in BOTH `## Runtime Dependencies` (prose) and as `[depends-on]` observations
- [convention] `runtime_shape` is a frontmatter enum, not an observation — it's a single-value structural fact
- [distinction] `gh_extension` notes describe code that ships independently of `gh` itself; the `brew-gh` note documents the host CLI

## Relations

- see also [[schema/github_action]] (extensions often invoke or wrap actions)
- see also [[schema/brew_formula]] (gh itself is brew-installed; extensions may have brew dependencies)
