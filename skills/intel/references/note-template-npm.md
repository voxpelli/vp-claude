# npm Package Note Template

Use this template when creating new `npm-*` notes with `write_note`. Place in the
`npm/` directory so it resolves `[[npm-*]]` wiki-links automatically.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

````markdown
---
title: npm-<package-name>
type: npm_package
url: https://www.npmjs.com/package/<npm-package-name>
tags: [<domain>, <subdomain>]
packages: ["<npm-package-name>"]
---

# npm-<package-name>

[`<pkg>`](https://www.npmjs.com/package/<pkg>) — one-line description from
npm or README.

GitHub: [owner/repo](https://github.com/owner/repo) | v<version> | <license>

## Key APIs

- `functionName(args)` — what it does
- `anotherFunction(args)` — what it does

## Observations

- [version] <version>
- [pattern] How it's typically used / how we use it
- [gotcha] What surprised us or could trip up new users
- [benefit] Why choose this over alternatives
- [limitation] What it can't do or where it breaks down
- [convention] Important usage conventions
- [popularity] XM downloads/week (npm, YYYY-MM)

## Release Highlights

- breaking: <what changed and migration path> ([vX.0.0](release-url), YYYY-MM-DD)
- feature: <capability> ([vY.0.0](release-url), YYYY-MM-DD) [PR #N](pr-url)
- fix: <what was broken> ([vZ.1.0](release-url)) [#issue](issue-url)

## Security

- Last known CVE: <CVE-ID or "none found">
- Maintenance: active / low-maintenance / unmaintained
- License: <SPDX identifier>

## Relations

- relates_to [[<Related Note Title>]]
- depends_on [[npm-<dependency>]]
````

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the exact npm package name: `["@fastify/postgres"]`.
One package per note. This is how `schema_validate` matches notes to the
`npm_package` schema.

### Observation categories

Use whatever category fits. Common ones for npm packages:

| Category | When to use |
|----------|-------------|
| `pattern` | How the package is typically used |
| `gotcha` | Surprising behavior, common mistakes |
| `benefit` | Why choose this package |
| `limitation` | What it can't do |
| `convention` | Important usage conventions |
| `compatibility` | Version/platform compatibility notes |
| `performance` | Performance characteristics |
| `security` | Security considerations |
| `agent-leverage` | How a coding agent invokes the package's CLI (packages that ship a `bin` only) — MCP server or `--json`/machine-readable flag; recorded only for a genuine positive or a narrowly-scoped surprising negative, doc-sourced positives stamped with provenance. Declared category (`validation: warn`) — see enrichment-package.md's Agent-leverage surface check |

### Release Highlights

Curate — don't mirror the full changelog. Focus on:
- Breaking changes with migration paths
- Features the user's projects would use
- Fixes for bugs that affected the user's code

Always link to the release page or PR.

### Agent-leverage observations

For a package that distributes a CLI (npm `bin` present), enrichment-package.md's
**Agent-leverage surface check** assesses *how a coding agent would invoke it* and
records — if any — an `[agent-leverage]` line (declared category, `validation:
warn`). See that file for the full three-way procedure (live-probe when the binary
resolves / primary-source doc-fallback with provenance / skip). In short: record
only a genuine positive or a narrowly-scoped surprising negative; an ordinary
library or no-CLI-surface package gets no line; when the binary isn't installed
locally a `--json`/MCP surface is taken **only** from primary doc text
(registry/README/homepage), stamped `(documented in <source>, not live-verified as
of YYYY-MM-DD)` — never a DeepWiki/Context7 summary, never inferred. Cross-link a
finding to the `Agent-Tool Leverage — MCP Server or Machine-Readable CLI, Assessed
Per Tool` hub note in `## Relations`; on refresh, `find_replace` the existing line
in place.
