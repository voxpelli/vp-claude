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

## Fetch Install Analytics (MCP, optional)

The JSON API does not expose install analytics. When the local Homebrew MCP
server is available, call `mcp__homebrew__info` to pick them up:

```
mcp__homebrew__info(formula_or_cask="<name>")
```

The parameter is literally `formula_or_cask` — the same tool handles both
formulae and casks. The MCP returns human CLI text (`brew info <name>`
output), not JSON. The relevant block is the `==> Analytics` section:

```
==> Analytics
install: 12,840 (30 days), 38,120 (90 days), 142,903 (365 days)
install-on-request: 12,840 (30 days), 38,120 (90 days), 142,903 (365 days)
```

Casks have `==> Analytics` but no `build-error` line (casks don't build).

If the tool call errors, the server is disconnected, or the `==> Analytics`
block is absent, skip this step entirely. Do not retry. Do not emit a
`[popularity]` observation — there is no structured fallback in the JSON
API.

When analytics are present, extract the numbers and emit exactly one
`[popularity]` observation in Step 6 (Synthesize) using this format:

`[popularity] 12,840 installs/30d · 38,120/90d · 142,903/365d (Homebrew MCP, YYYY-MM)`

If the response shape does not match a cask (contains `Dependencies` but no
`artifacts`), the user asked for a cask but received a formula — note the
discrepancy in synthesis and suggest rerunning with `brew:<name>`.

The `Installed (on request)` line is machine-specific and must NOT be
written to the note (notes are cross-machine). Use it only to optionally
surface "you already have this installed" in the synthesis prose shown to
the user.

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
