---
title: docker_image
type: schema
permalink: main/schema/docker-image
entity: docker_image
version: 1
schema:
  purpose?: string, what the image is for and primary use case
  tags?: string, tag strategy — key variant tags (alpine, slim, version pinning)
  config?: string, key environment variables, mount points, and exposed ports
  gotcha?(array): string, common pitfalls, size/security, pinning vs latest
  feature?(array): string, notable capabilities or base layer choices
  relates_to?(array): Note, related images or engineering notes
settings:
  validation: warn
---

# docker_image

Schema for Docker image notes — one note per image in the `docker/` directory.

## Conventions

- [convention] Title format: `docker:<image>` (e.g. `docker:node`, `docker:postgres`)
- [convention] Directory: `docker/`
- [convention] Include an Image Details table with Registry, maintained-by, base OS, Docker Hub link
- [convention] `tags` should document the variant tag strategy — alpine/slim vs full, version pinning approach
- [convention] `gotcha` must address the `latest` tag risk and recommend pinned versions for production
- [convention] `config` should list key `ENV`, `VOLUME`, and `EXPOSE` values from the official Dockerfile
- [convention] Relations use `[[docker:name]]` wiki-link format

## Relation Vocabulary

Preferred relation labels for Docker image notes:
- `see also [[docker:x]]` — related image in the same space
- `base layer for [[docker:x]]` — this image is used as FROM in another
- `pairs with [[action:x]]` — commonly used together in CI
- `alternative to [[docker:x]]` — competes in the same space

## Observations

- [purpose] Schema for Docker image notes in the docker/ directory
- [convention] `tags` maps to the `## Tags` section tool-intel writes
- [convention] Always note whether the image has an official Docker Hub presence vs third-party registry

## Relations

- see also [[schema/github_action]] (often used together in CI workflows)
