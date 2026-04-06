# Docker Image Note Template

Use this template when creating new `docker-*` notes with `write_note`. Place
in the `docker/` directory so it resolves `[[docker-*]]` wiki-links
automatically.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

````markdown
---
title: docker-<image>
type: docker_image
url: https://hub.docker.com/_/<image>
# Community images (org/name): url: https://hub.docker.com/r/<org>/<image>
tags: [<domain>, containers]
packages: ["<image>"]
---

# docker-<image>

[`<image>`](https://hub.docker.com/_/<image>) — one-line description from
Docker Hub.

Official: <yes|no> | Pulls: <count> | Last updated: <YYYY-MM-DD>

## Tags

**Recommended tag:** `<image>:<version>-<variant>` — brief rationale

| Tag pattern | Base OS | Size | Notes |
|-------------|---------|------|-------|
| `:<version>` | Debian (bookworm) | ~<N> MB | Full — most compatible |
| `:<version>-slim` | Debian slim | ~<N> MB | Smaller, missing some tools |
| `:<version>-alpine` | Alpine | ~<N> MB | Minimal attack surface |
| `:<version>-bookworm` | Debian 12 | ~<N> MB | Explicit Debian release pin |

Avoid `:latest` in production — it moves with each release.

## Base Layers

OS base: <Alpine|Debian|Ubuntu|distroless>
Runs as: <root|non-root user>
Key included tools: <list any pre-installed tools like bash, curl, etc.>

## Observations

- [security] Non-root user recommended: add `USER <name>` in your Dockerfile
- [size] Alpine variant reduces image size by ~X% but lacks glibc (may break native addons)
- [gotcha] Surprising behavior or common misconfiguration
- [pattern] Typical usage in Dockerfile — `FROM docker-<image> AS builder`

## Relations

- relates_to [[action-<action-that-uses-this-image>]]
- alternative_to [[docker-<alternative-image>]]
````

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the image identifier without tag: `["node"]` or
`["grafana/grafana"]`. One image per note. This is how `schema_validate`
matches notes to the `docker_image` schema.

### `type` value

Always `docker_image` (snake_case). Not `docker-image` or `container_image`.

### Observation categories

| Category | When to use |
|----------|-------------|
| `security` | Root vs non-root, CVEs, image signing, provenance |
| `size` | Image size comparisons between variants |
| `gotcha` | Alpine glibc issues, missing tools, entrypoint quirks |
| `pattern` | Typical Dockerfile usage patterns |
| `compatibility` | Architecture support (amd64/arm64) |
| `performance` | Cold start, layer caching strategies |

### 4-backtick outer fence

This template file uses `````markdown` (4 backticks) as the outer fence
because the note content contains inner ` ``` ` fences (Dockerfile examples).
The same pattern is used in the crates/go/pypi templates in package-intel.

### Docker Hub URL patterns

- Official images: `https://hub.docker.com/_/<name>` (e.g., `/_/node`)
- Community images: `https://hub.docker.com/r/<org>/<name>` (e.g., `/r/grafana/grafana`)

### Relations

- Use `[[action-<owner>-<repo>]]` for GitHub Actions that use this image
- Use `[[docker-<alt>]]` for alternative images in the same category
- Use `[[brew-<formula>]]` if there's a Homebrew formula for the same tool
