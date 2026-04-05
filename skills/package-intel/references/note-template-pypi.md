# PyPI (Python) Package Note Template

Use this template when creating new `pypi-*` notes with `write_note`. Place in
the `pypi/` directory so it resolves `[[pypi-*]]` wiki-links automatically.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

````markdown
---
title: pypi-<name>
type: pypi_package
tags: [<domain>, <subdomain>]
packages: ["<pypi-package-name>"]
---

# pypi-<name>

[`<name>`](https://pypi.org/project/<name>/) — one-line description.

GitHub: [owner/repo](https://github.com/owner/repo) | v<version> | <license>

## Installation

```bash
pip install <name>
```

```toml
# pyproject.toml
[project]
dependencies = [
    "<name>>=<version>",
]
```

## Key APIs

- `module.function(args)` — what it does
- `module.ClassName` — what it represents

## Observations

- [pattern] How it's typically used
- [gotcha] What surprised us or could trip up new users
- [benefit] Why choose this over alternatives
- [limitation] What it can't do or where it breaks down
- [compatibility] Python: <>=X.Y>; typed: <yes/partial/no>
- [convention] Important usage conventions
<!-- No [popularity] — PyPI deprecated download stats -->

## Release Highlights

- breaking: <what changed and migration path> ([v<X>.0.0](release-url), YYYY-MM-DD)
- feature: <capability> ([v<Y>.0.0](release-url), YYYY-MM-DD)
- fix: <what was broken> ([v<Z>.1.0](release-url))

## Security

- Known advisories: <PyPA advisory IDs or "none found">
- Maintenance: active / low-maintenance / unmaintained
- License: <SPDX identifier>
- PyPA: [check advisories](https://osv.dev/list?ecosystem=PyPI&q=<name>)

## Relations

- relates_to [[<Related Note Title>]]
- depends_on [[pypi-<dependency>]]
````

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the exact PyPI package name: `["requests"]`,
`["django"]`. Note: PyPI package names are case-insensitive but conventionally
lowercase with hyphens. Use the canonical name from pypi.org.

### `type` value

Must be `pypi_package` (snake_case).

### Python Version Compatibility

The `requires_python` field (e.g., `>=3.8`) is the Python MSRV equivalent.
Document in `[compatibility]` observations. Also note typing support
(`py.typed` marker file = fully typed).

### Built-in Security Data

The PyPI JSON API (`/pypi/<name>/json`) includes a `vulnerabilities` array from
the Python Packaging Advisory Database. If non-empty, include advisory IDs in
the Security section. Note that `info.downloads` is always `-1` — do not include
download statistics.

### pip vs pyproject.toml

Show both installation forms in `## Installation`. The `pyproject.toml` form
reflects modern Python packaging standards (PEP 517/518/660). Many projects
still use `requirements.txt` — note if relevant.
