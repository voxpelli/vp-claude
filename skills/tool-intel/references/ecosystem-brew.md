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
