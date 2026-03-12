# VSCode Extension Ecosystem — Registry Resolution

Use this reference file during Step 2 (Fetch registry data) when the detected
ecosystem is `vscode`.

## Extension Identifier Format

VSCode extensions are identified as `<publisher>.<extension-id>` (dot-separated).
Example: `esbenp.prettier-vscode` where `esbenp` is the publisher and
`prettier-vscode` is the extension ID.

## Primary Source: Open VSX Registry

Open VSX (`open-vsx.org`) is the open-source alternative registry with a
clean REST API. Try it first:

```
tavily_extract(
  urls=["https://open-vsx.org/api/<publisher>/<extension-id>"],
  query="displayName description version license repository"
)
```

### Key fields from Open VSX API response

| Field | Description |
|-------|-------------|
| `displayName` | Human-readable extension name |
| `description` | Short description |
| `version` | Latest version |
| `license` | SPDX license identifier |
| `repository.url` | Source repository URL |
| `homepage` | Extension homepage or docs |
| `categories` | Extension categories |
| `tags` | Searchable tags |
| `downloads` | Total download count |
| `averageRating` | User rating |
| `publishedDate` | Initial publish date |
| `lastUpdated` | Most recent update |

## Fallback: VS Marketplace

If the extension is not on Open VSX (some proprietary extensions are
Microsoft-only), fall back to the VS Marketplace page:

```
tavily_extract(
  urls=["https://marketplace.visualstudio.com/items?itemName=<publisher>.<extension-id>"],
  query="description features requirements configuration settings"
)
```

The Marketplace page is HTML — Tavily will extract the readable content.

## Resolve GitHub Repository

The `repository.url` field from Open VSX (or from the Marketplace page) gives
the source repository. Extract `owner/repo` for DeepWiki and changelog steps.

Note: Many popular extensions are on GitHub (e.g., `prettier/prettier-vscode`,
`microsoft/vscode-eslint`). Some are proprietary (e.g., GitHub Copilot) with
no public source repo.

## Extension Contribution Points

VSCode extensions contribute to the editor via specific points. Note relevant
ones in `## Features`:

| Contribution | What it adds |
|-------------|-------------|
| `languages` | Language syntax support |
| `grammars` | TextMate grammar for highlighting |
| `commands` | Palette commands |
| `menus` | Right-click context menus |
| `keybindings` | Keyboard shortcuts |
| `configuration` | Settings entries under `settings.json` |
| `snippets` | Code snippets |
| `themes` | Color/icon themes |
| `debuggers` | Debug adapter protocol |
| `taskDefinitions` | Task runner integration |

## Companion CLI Tools

Many extensions wrap a CLI tool. Note this as `[requires]` observation:
- `esbenp.prettier-vscode` → requires `prettier` CLI
- `dbaeumer.vscode-eslint` → requires `eslint`
- `rust-lang.rust-analyzer` → requires `rust-analyzer` binary
- `ms-python.python` → requires Python interpreter

The extension won't function (or will degrade) if the companion tool is absent.
