# Homebrew Cask Ecosystem — Registry Resolution

Use this reference file during Step 2 (Fetch registry data) when the detected
ecosystem is `cask`.

## Fetch Cask Metadata

Use `tavily_extract` on the formulae.brew.sh cask JSON API:

```
tavily_extract(
  urls=["https://formulae.brew.sh/api/cask/<name>.json"],
  query="description homepage version artifacts caveats"
)
```

### Key fields from the JSON response

| Field | Description |
|-------|-------------|
| `desc` | One-line description |
| `homepage` | Product homepage (usually vendor website) |
| `version` | Current cask version |
| `artifacts` | What gets installed — apps, binaries, services |
| `caveats` | Post-install notes, licensing, system requirements |
| `depends_on.macos` | macOS version requirements |
| `conflicts_with` | Casks or formulae that cannot coexist |
| `deprecated` | Boolean — if true, flag prominently |
| `disabled` | Boolean — if true, cask can't be installed |
| `auto_updates` | Boolean — if true, the app manages its own updates |

## Resolve GitHub Repository

Casks are typically closed-source GUI apps, so a GitHub repository may not
exist. Check `homepage` — if it links to an open-source project page, extract
`owner/repo`. For proprietary apps (e.g., `cask:zoom`), skip DeepWiki and rely
on Tavily for enrichment.

## System Requirements

The `depends_on.macos` field specifies minimum macOS version requirements.
The `artifacts` field reveals what the cask installs:
- `app: [...]` — macOS .app bundles copied to /Applications
- `binary: [...]` — CLI tools symlinked into PATH
- `pkg: [...]` — macOS .pkg installers (more invasive, harder to uninstall)
- `suite: [...]` — entire app suites

## Auto-updating Casks

If `auto_updates: true`, the installed app checks for updates independently
of Homebrew. This means `brew outdated` won't flag it even when a new version
is available. Note this in a `[gotcha]` observation.
