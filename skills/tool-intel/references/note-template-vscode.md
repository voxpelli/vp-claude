# VSCode Extension Note Template

Use this template when creating new `vscode-*` notes with `write_note`. Place
in the `vscode/` directory so it resolves `[[vscode-*]]` wiki-links
automatically.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

```markdown
---
title: vscode-<publisher>.<extension-id>
type: vscode_extension
url: https://marketplace.visualstudio.com/items?itemName=<publisher>.<extension-id>
tags: [<domain>, vscode]
packages: ["<publisher>.<extension-id>"]
---

# vscode-<publisher>.<extension-id>

[`<publisher>.<extension-id>`](https://open-vsx.org/extension/<publisher>/<extension-id>) — one-line description.

Publisher: [<publisher>](https://open-vsx.org/user/<publisher>) | v<version> | <license>

## Features

Brief description of what this extension adds to the editor.

- **<Feature name>**: what it does
- **<Feature name>**: what it does
- Contribution points: <commands|languages|themes|snippets|debuggers>

## Configuration

Key settings (add to `settings.json`):

| Setting | Default | Description |
|---------|---------|-------------|
| `<extension.setting>` | `<default>` | What this controls |

## Observations

- [requires] Companion CLI tool needed: `<tool-name>` (install via `brew install <tool>` or `npm install -g <pkg>`)
- [performance] CPU/memory impact, activation events, startup overhead
- [conflict] Conflicts with: vscode-<other> — reason
- [pattern] How this extension is typically configured in a project

## Relations

- requires [[brew-<companion-cli>]]
- alternative_to [[vscode-<alternative-extension>]]
- relates_to [[npm-<companion-package>]]
```

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the full `publisher.extension-id`: `["esbenp.prettier-vscode"]`.
One extension per note. This is how `schema_validate` matches notes to the
`vscode_extension` schema.

### `type` value

Always `vscode_extension` (snake_case). Not `vscode-extension` or `vs_extension`.

### Observation categories

| Category | When to use |
|----------|-------------|
| `requires` | Companion CLI or runtime the extension needs to function |
| `performance` | Startup time, memory impact, always-on language servers |
| `conflict` | Extensions that shouldn't be installed alongside this one |
| `pattern` | Typical project-level configuration or workspace settings |
| `gotcha` | Non-obvious setup, workspace vs user settings distinction |
| `compatibility` | VS Code version requirements, Cursor/Codium compatibility |
| `alternative` | Extensions with similar functionality |

### Companion CLI tools

Always note if the extension requires an external tool via a `[requires]`
observation. Many extensions silently degrade without it — this is one of the
most common gotchas for new users.

### Open VSX vs VS Marketplace URL

Link to Open VSX when the extension is available there (most popular ones are):
`https://open-vsx.org/extension/<publisher>/<extension-id>`

Fall back to VS Marketplace URL when Open VSX doesn't have it:
`https://marketplace.visualstudio.com/items?itemName=<publisher>.<extension-id>`

### Relations

- Use `[[brew-<formula>]]` for Homebrew-installable companion CLI tools
- Use `[[npm-<pkg>]]` for npm-installable companion tools
- Use `[[vscode-<ext>]]` for conflicting or related extensions
