# Docker Ecosystem — Registry Resolution

Use this reference file during Step 2 (Fetch registry data) when the detected
ecosystem is `docker`.

## Official vs Community Images

| Image form | Identifier | Docker Hub API path |
|------------|-----------|---------------------|
| Official (no org) | `docker:node` | `library/node` |
| Community (with org) | `docker:grafana/grafana` | `grafana/grafana` |

Official images (maintained by Docker and the upstream project) use the
`library/<name>` namespace in the API but are referenced without `library/`
in Dockerfiles.

## Non-Hub Registries — Skip Docker Hub API

If the image uses a non-Docker-Hub registry prefix, skip the Docker Hub API
and fall back to Tavily:

| Registry prefix | Skip API? | Fallback |
|-----------------|-----------|---------|
| `gcr.io/` | Yes | `tavily_search("<image> container image security")` |
| `ghcr.io/` | Yes | GitHub repo page |
| `quay.io/` | Yes | `tavily_search("<image> quay container")` |
| `registry.k8s.io/` | Yes | Kubernetes docs |
| No prefix (Docker Hub) | No | Use API below |

## Docker Hub API: Repository Metadata

```
tavily_extract(
  urls=["https://hub.docker.com/v2/repositories/<namespace>/<name>/"],
  query="description full_description star_count pull_count"
)
```

For official images, `<namespace>` is `library`. Response fields:

| Field | Description |
|-------|-------------|
| `description` | Short description |
| `full_description` | Full README (markdown) |
| `star_count` | Stars |
| `pull_count` | Total pulls |
| `last_updated` | ISO timestamp of last push |
| `is_official` | Boolean |
| `is_automated` | Boolean — built from GitHub |

## Docker Hub API: Tags

```
tavily_extract(
  urls=["https://hub.docker.com/v2/repositories/<namespace>/<name>/tags/?page_size=10"],
  query="name last_updated digest"
)
```

Tag naming patterns to document in `## Tags`:
- `:latest` — most recent stable (avoid in production)
- `:<version>` — pinned version (e.g., `:22`)
- `:<version>-alpine` — Alpine Linux base (~5 MB, minimal attack surface)
- `:<version>-slim` — Debian slim (~60 MB, more compatible)
- `:<version>-bookworm` / `:<version>-bullseye` — Debian release codename (most compatible)

## Resolve GitHub Repository

Check `full_description` for a GitHub link. For official images, the source
Dockerfile repo is often at `github.com/docker-library/<name>`. For community
images, look in the Docker Hub description or `tavily_search("<org>/<image>
docker github source")`.

Use the GitHub repo for DeepWiki and changelog steps.

## Security Considerations

Docker image security covers several dimensions:
- **Base OS CVEs**: Alpine has fewer CVEs by default; Debian-based images are
  larger but more battle-tested
- **Image provenance**: Official images are signed and audited; community images
  vary — check `is_official`
- **Non-root user**: Check if the image runs as root by default (security risk)
- **Secrets in layers**: Warn if Dockerfile practices bake in secrets
