# Homebrew Formula Note Template

Use this template when creating new `brew-*` notes with `write_note`. Place in
the `brew/` directory so it resolves `[[brew-*]]` wiki-links automatically.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

```markdown
---
title: brew-<formula-name>
type: brew_formula
url: https://formulae.brew.sh/formula/<formula-name>
tags: [<domain>, <category>]
packages: ["<formula-name>"]
---

# brew-<formula-name>

[`<formula-name>`](https://formulae.brew.sh/formula/<formula-name>) — one-line
description from the formula's `desc` field.

Homepage: [<project-homepage>](<url>) | v<version> | <license>

## Common Usage

- `<formula-name> --flag` — what this flag does
- `<formula-name> subcommand` — what this subcommand does
- Key config file: `~/.config/<name>` or environment variable `<NAME>`

## Observations

- [version] <version>
- [pattern] How this tool is typically used in development workflows
- [gotcha] Surprising behavior, common mistakes (e.g., keg-only, PATH conflicts)
- [conflict] Conflicts with: brew-<other> — reason for conflict
- [compatibility] macOS version requirements or architecture notes
- [convention] Important shell setup or post-install steps from `caveats`
- [popularity] X installs/30d · Y/90d · Z/365d · R on-request/30d · N build errors/30d (Homebrew MCP, YYYY-MM)

## Relations

- depends_on [[brew-<runtime-dep>]]
- alternative_to [[cask-<gui-equivalent>]]
```

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the exact Homebrew formula name: `["ripgrep"]`.
One formula per note. This is how `schema_validate` matches notes to the
`brew_formula` schema.

### `type` value

Always `brew_formula` (snake_case). Not `brew-formula` or `homebrew_formula`.

### Observation categories

| Category | When to use |
|----------|-------------|
| `version` | Current documented formula version — machine-stable slot, one clean leading token |
| `pattern` | How the tool is typically used |
| `gotcha` | Surprising behavior — keg-only, PATH issues, caveats |
| `conflict` | Conflicts with other formulae or system tools |
| `compatibility` | macOS version, architecture (arm64/x86_64), or Rosetta notes |
| `convention` | Setup steps required after install (shell completions, PATH) |
| `performance` | Speed or resource characteristics |
| `security` | Security considerations for the tool itself |
| `alternative` | Alternative formulae or casks covering the same need |
| `popularity` | Install counts from Homebrew analytics (MCP or formulae.brew.sh JSON) |

### Version observation

Emit exactly one **canonical** `[version]` observation as a clean leading
token — e.g. `- [version] 1.39.0` — recording the same value as the header
pipe (`Homepage: … | v<version> | <license>`). This is the machine-stable slot
`/knowledge-gaps --stale brew` reads (Pattern 3), checked before fragile
prose/table extraction. Keep it in sync with the header pipe on every
refresh — `edit_note` with `find_replace` to replace this specific canonical
line in place, never `append` a second one (same discipline as `[popularity]`
below). This canonical line is distinct from any `[version]` lines an
upgrade-haul changelog reel writes as narrative delta history — see the
"Recording targets" section in `SKILL.md` for that separate, unresolved usage
of the same category; do not delete reel entries under this rule.

### Analytics observations

Emit exactly one `[popularity]` observation with the 30/90/365-day install
counts and the 30-day build-error count. Source it from `mcp__homebrew__info`
when reachable (stamp `(Homebrew MCP, YYYY-MM)`), otherwise from the
`analytics` block in the formulae.brew.sh JSON fetched in Step 2 (stamp
`(formulae.brew.sh API, YYYY-MM-DD)`) — both draw on the same Homebrew
analytics but can diverge via client-cache lag. Only omit when neither source
yields analytics; never fabricate counts.

Also record the **install-on-request** count in the same `[popularity]` line
(e.g. `… · R on-request/30d · …`) — from `mcp__homebrew__info`'s
`install-on-request:` line or the JSON `analytics.install_on_request` block. The
**ratio** `on-request ÷ install` is a library-vs-tool signal: near 1 means the
formula is deliberately installed (a leaf tool); far below 1 means it is mostly
pulled in as a transitive dependency (a library). In the low-ratio case add one
`[pattern]` observation noting it (e.g. "mostly pulled in as a dependency: R
on-request of N total installs/30d"). Do NOT confuse the aggregate
`install_on_request` analytics field with the per-host `Installed (on request)`
line `mcp__homebrew__info` prints for the local machine — that per-host line is
machine-specific and must never be written to a note.

When updating an existing note that already has a `[popularity]` line,
use `edit_note` with `find_replace` to replace the old line rather than
`append` — install counts change continuously and duplicate lines
accumulate stale data.

### Keg-only formulae

If the formula is "keg-only" (not linked to standard paths), document this as a
`[gotcha]` observation and note the manual linking command from `caveats`.

### Relations

- Use `[[brew-<dep>]]` for Homebrew formula dependencies
- Use `[[cask-<name>]]` for a cask that provides the GUI equivalent
- Use `[[npm-<pkg>]]` or other ecosystem links if the tool is related to packages

**Relation-verb convention — a dependency claim is load-bearing; verify it, never infer it.** A tool being *built on* a library (a technology fact) is NOT the same as *depending on* its Homebrew formula (a packaging fact): Rust/Go tools statically vendor C libraries into their own binary and declare no formula dependency. Pick the verb by what the package manager reports, not by domain knowledge:

- `depends_on [[brew-<lib>]]` — ONLY a real Homebrew dependency. Confirm with `brew deps <formula>` (does this formula declare it) or `brew uses --installed <lib>` (does `<lib>` list this formula as a dependent). Never write `depends_on` off "X is built on Y."
- `built_with [[brew-<lib>]]` (consumer→library) / `used_by [[brew-<consumer>]]` (library→consumer) — a *technology* relationship where the consumer embeds/vendors the library rather than declaring a formula dependency. Prefer these declared verbs (both are in the `brew_formula` schema) over inventing `built_on`/`uses`.

For a library formula (mostly a transitive dependency), see the `## Library formulae` section in `ecosystem-brew.md` for the full detection + `brew uses`/`deps`/`linkage` verification procedure and the required "Upgrade Impact on Dependents" note section.
