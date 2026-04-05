# Go Module Note Template

Use this template when creating new `go-*` notes with `write_note`. Place in the
`go/` directory.

**Important:** Go module paths contain `/` — replace all slashes with hyphens in
the note title (e.g., `go-github.com-gin-gonic-gin`). Use title-based wiki-links
(see Field Guidelines below).

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

````markdown
---
title: go-<module-path>
type: go_module
tags: [<domain>, <subdomain>]
packages: ["<module-path>"]
---

# go-<module-path>

[`<module-path>`](https://pkg.go.dev/<module-path>) — one-line description.

GitHub: [owner/repo](https://github.com/owner/repo) | v<version> | <license>

## go.mod

```go
require (
    <module-path> v<version>
)

// With major version suffix (v2+):
// require (
//     <module-path>/v<N> v<N>.x.y
// )
```

## Key APIs

- `pkg.FunctionName(args)` — what it does
- `pkg.TypeName` — what it represents

## Observations

- [pattern] How it's typically used
- [gotcha] What surprised us or could trip up new users
- [benefit] Why choose this over alternatives
- [limitation] What it can't do or where it breaks down
- [compatibility] Minimum Go version: <go 1.x>; major version suffix: <v2/none>
- [convention] Important usage conventions
<!-- No [popularity] — Go has no download metric -->

## Release Highlights

- breaking: <what changed> ([v<X>.0.0](release-url), YYYY-MM-DD)
- feature: <capability> ([v<Y>.0.0](release-url), YYYY-MM-DD)
- fix: <what was broken> ([v<Z>.1.0](release-url))

## Security

- Last known CVE: <CVE-ID or "none found">
- Maintenance: active / low-maintenance / unmaintained
- License: <SPDX identifier>

## Relations

- relates_to [[<Related Note Title>]]
- depends_on [[go-owner-repo-dependency]]
````

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the full module path as it appears in `go.mod`:
`["github.com/gin-gonic/gin"]`, `["golang.org/x/net"]`. One module per note.
For major versions, include the suffix: `["github.com/foo/bar/v2"]`.

### `type` value

Must be `go_module` (snake_case).

### Wiki-link form for Go modules

Use title-based wiki-links with all slashes replaced by hyphens:
`[[go-github.com-gin-gonic-gin]]`. This matches the note title directly.

### Major version suffix gotcha

Go modules with v2+ breaking changes use a major version suffix in the import
path. `github.com/foo/bar` and `github.com/foo/bar/v2` are **different modules**
and should have separate notes. Note this clearly in observations:

`- [gotcha] v2+ uses a major version suffix import path: foo/bar/v2 ≠ foo/bar`

### Vanity URLs

Some modules use vanity URLs (`k8s.io/client-go`, `golang.org/x/net`) that
redirect to GitHub. Extract the actual GitHub URL from `pkg.go.dev` for use in
DeepWiki calls.
