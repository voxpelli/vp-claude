# GitHub Action Note Template

Use this template when creating new `action-*` notes with `write_note`. Place
in the `actions/` directory so it resolves `[[action-*]]` wiki-links
automatically.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

````markdown
---
title: action-<owner>/<repo>
type: github_action
tags: [<domain>, ci-cd]
packages: ["<owner>/<repo>"]
---

# action-<owner>/<repo>

[`<owner>/<repo>`](https://github.com/<owner>/<repo>) — one-line description
from action.yml `description` field.

Runs: <node20|composite|docker> | v<latest-tag> | <license>

## Inputs & Outputs

**Key inputs:**

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `<input-name>` | yes/no | `<default>` | What this input controls |

**Outputs:**

| Output | Description |
|--------|-------------|
| `<output-name>` | What this output provides |

## Permissions

Required `permissions:` in the calling workflow:

```yaml
permissions:
  <scope>: <read|write>
```

Secrets accessed: `<SECRET_NAME>` — what it's used for

## Observations

- [security] Recommended pinning: use commit SHA instead of tag — `actions/checkout@<sha> # v4.x.x`
- [version] Latest stable: v<N> — breaking changes from v<N-1>: <brief note>
- [gotcha] Surprising behavior or common misconfiguration
- [pattern] Typical usage context in CI workflows

## Release Highlights

- breaking: <what changed and migration path> ([v<N>.0.0](release-url), YYYY-MM-DD)
- feature: <capability> ([v<N>.x.x](release-url), YYYY-MM-DD)

## Relations

- relates_to [[action-<related-action>]]
- relates_to [[docker-<image-it-uses>]]
````

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the `owner/repo` path: `["actions/checkout"]`.
One action per note. This is how `schema_validate` matches notes to the
`github_action` schema.

### `type` value

Always `github_action` (snake_case). Not `github-action` or `gh_action`.

### Observation categories

| Category | When to use |
|----------|-------------|
| `security` | SHA pinning, supply chain risks, token scope concerns |
| `version` | Which version to pin and any breaking changes |
| `gotcha` | Non-obvious behavior, common misconfigurations |
| `pattern` | Typical workflow usage context |
| `permission` | GITHUB_TOKEN scope requirements |
| `performance` | Action execution time, caching strategies |
| `compatibility` | Runner OS requirements (ubuntu/windows/macos) |

### 4-backtick outer fence

This template file uses `````markdown` (4 backticks) as the outer fence
because the note content contains inner ` ``` ` fences (YAML blocks). The
same pattern is used in the crates/go/pypi templates in package-intel.

### Relations

- Use `[[action-<owner>/<repo>]]` for related or dependent actions
- Use `[[docker-<image>]]` if the action uses a Docker container runtime
- Use `[[npm-<pkg>]]` if the action wraps an npm package
