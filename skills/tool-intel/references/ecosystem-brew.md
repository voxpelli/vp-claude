# Homebrew Formula Ecosystem — Registry Resolution

Use this reference file during Step 2 (Fetch registry data) when the detected
ecosystem is `brew`.

## Fetch Formula Metadata

Use `tavily_extract` on the formulae.brew.sh JSON API:

```
tavily_extract(
  urls=["https://formulae.brew.sh/api/formula/<name>.json"],
  query="description homepage version license dependencies"
)
```

### Key fields from the JSON response

| Field | Description |
|-------|-------------|
| `desc` | One-line description |
| `homepage` | Project homepage (often GitHub) |
| `versions.stable` | Current stable version |
| `license` | SPDX license identifier |
| `dependencies` | Runtime dependencies (other formulae) |
| `build_dependencies` | Build-time only dependencies |
| `conflicts_with` | Formulae that cannot be installed alongside |
| `caveats` | Post-install notes, path conflicts, shell setup |
| `deprecated` | Boolean — if true, flag prominently |
| `disabled` | Boolean — if true, formula can't be installed |

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
install: 70,654 (30 days), 173,836 (90 days), 438,626 (365 days)
install-on-request: 52,500 (30 days), 120,072 (90 days), 330,758 (365 days)
build-error: 42 (30 days)
```

If the tool call errors, the server is disconnected, or the `==> Analytics`
block is absent, skip this step entirely. Do not retry. Do not emit a
`[popularity]` observation — the formulae.brew.sh JSON API does not expose
analytics, so there is no structured fallback and fabricating counts would
be worse than omitting them.

When analytics are present, extract the numbers and emit exactly one
`[popularity]` observation in Step 6 (Synthesize) using this format:

`[popularity] 70,654 installs/30d · 173,836/90d · 438,626/365d · 42 build errors/30d (Homebrew MCP, YYYY-MM)`

If the response shape does not match a formula (contains `artifacts` but no
`Dependencies` section), the user asked for a formula but received a cask —
note the discrepancy in synthesis and suggest rerunning with `cask:<name>`.

The `Installed (on request)` line is machine-specific and must NOT be
written to the note (notes are cross-machine). Use it only to optionally
surface "you already have this installed" in the synthesis prose shown to
the user.

## Resolve GitHub Repository

The `homepage` field usually points to the project website or GitHub repo.
If `homepage` is not a GitHub URL, check `urls.stable.url` — for GitHub-hosted
projects this is often `https://github.com/<owner>/<repo>/archive/...`.

Extract `owner/repo` for use in the changelog step.

If neither field resolves to GitHub, fall back to:
```
tavily_search(query="<formula-name> homebrew github repository source")
```

## Security Notes

Homebrew formulae are community-maintained. Security considerations:
- Check `deprecated` and `disabled` fields — deprecated formulae may have unpatched issues
- `conflicts_with` entries often indicate incompatible shared libraries
- `caveats` may contain important post-install warnings (e.g., PATH changes, keg-only status)

A formula being "keg-only" means it's not linked into standard paths to avoid
conflicts with macOS system tools — worth noting in `[compatibility]` observations.
