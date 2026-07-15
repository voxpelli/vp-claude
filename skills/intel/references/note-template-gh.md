# GitHub CLI Extension Note Template

Use this template when creating new `gh-*` notes with `write_note`. Place in
the `gh/` directory so it resolves `[[gh-*]]` wiki-links automatically.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

````markdown
---
title: gh-meiji163-gh-notify
type: gh_extension
url: https://github.com/meiji163/gh-notify
version: v1.6.0
runtime_shape: script
discovery_mechanism: PATH-based via gh extension subsystem
host_command: gh
naming_convention: gh-<name>
language: Shell
source: https://github.com/meiji163/gh-notify
tags: [gh-extension, cli, github, ai-bookmarked, notifications, fzf]
packages: ["meiji163/gh-notify"]
---

# gh-meiji163-gh-notify

[`meiji163/gh-notify`](https://github.com/meiji163/gh-notify) — interactive fzf-driven
GitHub notifications viewer that extends `gh` with a triage TUI.

Source: [github.com/meiji163/gh-notify](https://github.com/meiji163/gh-notify) | v1.6.0 | Shell (bash) | MIT

## Commands & Invocation

Install:

```sh
gh extension install meiji163/gh-notify
```

Primary invocations:

| Command | Purpose |
|---------|---------|
| `gh notify` | Open the interactive fzf TUI listing all unread notifications |
| `gh notify -an` | Show all (read + unread) notifications |
| `gh notify -r` | Mark currently selected notification as read |
| `gh notify -p` | Filter to participating-only notifications |
| `gh notify -s <state>` | Filter by state (open, closed, merged) |

The extension shells out to `gh api notifications` and pipes results through `fzf`
with custom keybindings for triage actions (mark read, open in browser, view diff).

## Runtime Dependencies

Mandatory at runtime — the entry script will fail without these on `$PATH`:

- `gh` ≥ 2.0 — host CLI (provides `gh api`)
- `fzf` ≥ 0.30 — interactive fuzzy finder driving the TUI
- `bash` ≥ 4.0 — shebang interpreter (associative arrays used)

Optional, used when present for richer rendering:

- `bat` — syntax-highlighted diff preview
- `delta` — alternative diff renderer

## Platforms

| OS | Architecture | Status |
|----|--------------|--------|
| linux | amd64 / arm64 | supported (bash + fzf available everywhere) |
| darwin | amd64 / arm64 | supported (Homebrew-installable deps) |
| windows | amd64 | unsupported — relies on bash and POSIX tooling; works under WSL |

Because `runtime_shape: script`, there are no precompiled platform-specific
release artifacts — portability is bounded by the dependency set, not by
binary distribution.

## Observations

- [command] `gh notify` — primary entrypoint launching the fzf TUI
- [flag] `-an` shows all notifications including already-read items
- [depends_on] fzf is mandatory; the TUI is the entire feature surface
- [depends_on] bash 4+ required for associative array syntax in the entry script
- [platform] linux and darwin fully supported; windows requires WSL
- [security] Installs from HEAD by default — pin with `gh extension install meiji163/gh-notify@v1.6.0` for reproducibility
- [gotcha] Without fzf installed the script exits with an opaque "command not found" before reaching its own preflight check
- [version] v1.6.0 (2024-02) — last tagged release; main branch may diverge
- [popularity] ~1.4k stars, ~80 forks (GitHub, 2026-05) — top-tier in the gh-extension topic
- [install_mode] Recommended: `gh extension install meiji163/gh-notify`; alternative: manual `git clone` into `~/.local/share/gh/extensions/gh-notify`
- [pattern] Inbox-style triage TUI bolted onto a non-interactive CLI — same shape as `gh dash`, `lazygit`-over-git
- [design] Pure shell entry script — no compilation step, full source readable in one file (~600 lines)
- [source] Canonical repo: https://github.com/meiji163/gh-notify

## Release Highlights

- feature: `--repo` filter to scope notifications to a single repository ([v1.6.0](https://github.com/meiji163/gh-notify/releases/tag/v1.6.0), 2024-02)
- feature: bat/delta integration for diff previews ([v1.4.0](https://github.com/meiji163/gh-notify/releases/tag/v1.4.0), 2023-08)

## Relations

- runs_on [[brew-gh]]
- depends_on [[brew-fzf]]
- pairs_with [[brew-bat]]
- pairs_with [[brew-git-delta]]
- see_also [[gh-dlvhdr-gh-dash]]
<!-- relates_to [[engineering/patterns/extensible-cli-tools]] — pattern note not yet created; uncomment after writing -->
````

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the `owner/repo` path: `["meiji163/gh-notify"]`.
One extension per note. This is how `schema_validate` matches notes to the
`gh_extension` schema.

### `type` value

Always `gh_extension` (snake_case). Not `gh-extension`, `github_cli_extension`,
or `ghext`.

### `runtime_shape` value

One of three values, classified per the ladder in `ecosystem-gh.md`:

- **`binary`** — precompiled release assets per OS/arch
- **`script`** — git-cloned, shebang-dispatched (bash, python, ruby, etc.)
- **`local`** — symlinked dev install via `gh ext install .` (the directory
  in `~/.local/share/gh/extensions/<name>/` is a symlink to the source repo)

Symlink check must run **first** in classification — symlinked dev installs
contain `.git/` too, so the `.git/` heuristic alone would misclassify them
as `script`.

### Required tags

Every gh extension note MUST include these tags in frontmatter:
`gh-extension`, `cli`, `github`, `ai-bookmarked`. Add domain-specific tags
beyond these (e.g. `notifications`, `fzf`, `triage`).

### Observation categories

> **Convention:** observation categories must use underscores to match
> picoschema field names (`[depends_on]` not `[depends-on]`, `[install_mode]`
> not `[install-mode]`) — hyphenated forms fall through to
> `unmatched_observations` in `schema_validate`.

| Category | When to use |
|----------|-------------|
| `command` | Primary subcommands the extension exposes |
| `flag` | Notable flags worth documenting (not exhaustive — defer to README) |
| `depends_on` | Runtime dependencies (binaries, brew formulae) |
| `platform` | OS/arch support — especially gaps |
| `security` | Pin-to-tag risks, supply-chain considerations |
| `gotcha` | Surprising behavior, common misconfigurations |
| `version` | Latest tag, breaking-change notes |
| `popularity` | GitHub stars, forks, topic-search ranking with date stamp |
| `install_mode` | Recommended vs alternative installation paths |
| `pattern` | Recurring usage patterns and CLI-extension idioms |
| `design` | Architectural choices — script vs binary, single-file vs multi-file |
| `source` | Canonical upstream URL |

### 4-backtick outer fence

This template file uses ` ```` ```markdown ```` ` (4 backticks) as the outer
fence because the note content contains inner ` ``` ` fences (sh blocks for
install commands). Same pattern as the action / crates / go / pypi templates.

### Relations

- Use `[[gh-<owner>-<repo>]]` for related or competing extensions
- Use `[[brew-gh]]` to link the host CLI (every gh extension note should
  have this)
- Use `[[brew-<dep>]]` for runtime dependencies tracked as brew formulae
  (fzf, jq, bat, etc.)
- Use `[[action-<owner>-<repo>]]` if the extension wraps or coordinates with
  a GitHub Action
- Comment out forward-references to engineering/pattern notes that don't
  yet exist (e.g. the deferred `engineering/patterns/extensible-cli-tools`
  hub) — uncomment once the target note is created
