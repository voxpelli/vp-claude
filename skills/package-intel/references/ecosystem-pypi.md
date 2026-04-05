# PyPI (Python) Ecosystem — Registry Resolution

Use this reference file during Step 2 (Resolve repository) when the detected
ecosystem is `pypi`.

## Resolve Package Metadata

PyPI provides a free, no-auth JSON API:

**Option A — tavily_extract (preferred):**
```
tavily_extract(
  urls=["https://pypi.org/pypi/<name>/json"],
  query="repository description version license homepage"
)
```

**Option B — Bash curl (fallback):**
```bash
curl -s "https://pypi.org/pypi/<name>/json"
```

## Key Response Fields

From `https://pypi.org/pypi/<name>/json`:

| JSON path | Meaning |
|-----------|---------|
| `info.project_urls.Source` | GitHub or source repository URL |
| `info.project_urls.Homepage` | Project homepage (may differ from source) |
| `info.version` | Latest version string |
| `info.license` | License string (SPDX or free-form) |
| `info.summary` | One-line description |
| `info.requires_python` | Python version requirement (e.g., `>=3.8`) |
| `vulnerabilities` | Array of known security advisories (built-in!) |

**Important:** `info.downloads` is always `-1` — PyPI deprecated download stats.
Do NOT attempt to show download counts from this API. Omit the `[popularity]`
observation entirely for PyPI packages.

## Built-in Security Data

The `vulnerabilities` array in the API response contains known advisories from
the Python Packaging Advisory Database (PyPA). If this array is non-empty, report
each advisory's `id`, `details`, and `fixed_in` version. No separate security
search is needed for known PyPA advisories, but still run:

```
tavily_search(query="<package-name> python CVE vulnerability <current-year>")
```

...to catch broader CVE databases that PyPA may not have indexed yet.

## Python Version Range

Extract `info.requires_python` and note it in `[compatibility]` observations.
Common patterns: `>=3.8`, `>=3.9,<4`, `~=3.10`. This is the MSRV equivalent
for Python packages.

## GitHub Repository

`info.project_urls.Source` usually contains the GitHub URL. Extract owner/repo
for DeepWiki calls. If absent, try `info.project_urls.Repository` or
`info.home_page`.
