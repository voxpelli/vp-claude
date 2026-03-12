# Go Module Ecosystem — Registry Resolution

Use this reference file during Step 2 (Resolve repository) when the detected
ecosystem is `go`.

## Go Module Path Conventions

Go module paths ARE the repository identifier. Examples:
- `github.com/gin-gonic/gin` — hosted on GitHub, owner=`gin-gonic`, repo=`gin`
- `golang.org/x/net` — Go standard library extension
- `k8s.io/client-go` — vanity URL, check `pkg.go.dev` for actual repo

For GitHub-hosted modules, the owner/repo is directly in the path.

## Module Path Encoding (Uppercase Letters)

The Go module proxy uses "module path encoding" for uppercase letters. Convert
each uppercase letter to `!` followed by the lowercase letter:

- `github.com/Azure/foo` → `github.com/!azure/foo` in proxy URLs
- `github.com/BurntSushi/toml` → `github.com/!burnt!sushi/toml`

Only needed for proxy.golang.org URLs — use the original path everywhere else.

## Resolve Module Metadata

**Option A — Go proxy (version + timestamp only):**
```
tavily_extract(
  urls=["https://proxy.golang.org/<encoded-module-path>/@latest"],
  query="version timestamp"
)
```
This returns `{"Version": "v1.2.3", "Time": "..."}` — no description or license.

**Option B — pkg.go.dev (description + documentation, preferred):**
```
tavily_extract(
  urls=["https://pkg.go.dev/<module-path>"],
  query="module description license readme repository"
)
```
pkg.go.dev shows the module overview, imports, license, and links to the source repo.

**Option C — GitHub repo (if module path starts with `github.com/`):**
Extract owner/repo directly from the module path and use:
```
tavily_extract(
  urls=["https://github.com/<owner>/<repo>"],
  query="readme description license"
)
```

## Major Version Suffix

Go modules with breaking changes use a major version suffix: `github.com/foo/bar/v2`,
`github.com/foo/bar/v3`. Note this in the `## go.mod` snippet section. The
`/v2` suffix is part of the module path and must be included in note title and
wiki-links.

## Wiki-Link Safety for Go Modules

Go module paths contain `/` slashes which can complicate wiki-links. Use the
path-based wiki-link form instead of the title form:

- **Preferred** (path-based): `[[go/github.com/gin-gonic/gin]]`
- **Alternative** (title): `[[go:github.com/gin-gonic/gin]]` — valid but complex

Both forms resolve to the same note. Recommend path-based in the note template.
