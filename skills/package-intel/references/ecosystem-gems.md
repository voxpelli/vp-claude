# RubyGems Ecosystem — Registry Resolution

Use this reference file during Step 2 (Resolve repository) when the detected
ecosystem is `gem`.

## Resolve Gem Metadata

RubyGems provides a free, no-auth JSON API:

**Option A — tavily_extract (preferred):**
```
tavily_extract(
  urls=["https://rubygems.org/api/v1/gems/<name>.json"],
  query="source_code_uri repository description version license"
)
```

**Option B — Bash curl (fallback):**
```bash
curl -s "https://rubygems.org/api/v1/gems/<name>.json"
```

## Key Response Fields

From `https://rubygems.org/api/v1/gems/<name>.json`:

| JSON path | Meaning |
|-----------|---------|
| `source_code_uri` | GitHub or source repository URL |
| `homepage_uri` | Project homepage |
| `version` | Latest version string |
| `description` | Longer gem description |
| `info` | Short one-line description |
| `licenses` | Array of SPDX license strings |
| `downloads` | All-time download count |

Extract `owner/repo` from `source_code_uri` for DeepWiki calls. If
`source_code_uri` is empty, try `homepage_uri` (often the same).

## Ruby Version Compatibility

Ruby version requirements live in the gemspec as `required_ruby_version`.
This is NOT in the RubyGems API response — check the GitHub repo or
`tavily_extract` the gem's GitHub repository page to find the `.gemspec` file
or README for compatibility notes.

Note the Ruby MSRV in `[compatibility]` observations.

## Security Advisories

Ruby gems use the Ruby Advisory Database (rubysec.com). For security research
in Step 3c:
```
tavily_search(query="<gem-name> ruby CVE vulnerability rubysec <current-year>")
```

Also check `https://www.rubysec.com/advisories/` for the gem name.

## Gemfile vs gemspec

Note whether the gem is meant for applications (Gemfile) or library development
(gemspec). Application gems often have loose version constraints; library gems
typically pin dependencies more tightly.
