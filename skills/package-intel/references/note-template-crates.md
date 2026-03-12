# Rust Crate Note Template

Use this template when creating new `crate:*` notes with `write_note`. Place in
the `crates/` directory so it resolves `[[crate:*]]` wiki-links automatically.

````markdown
---
title: crate:<name>
type: crate_package
tags: [<domain>, <subdomain>]
packages: ["<crate-name>"]
---

# crate:<name>

[`<name>`](https://crates.io/crates/<name>) — one-line description from
crates.io or README.

GitHub: [owner/repo](https://github.com/owner/repo) | v<version> | <license>

## Cargo.toml

```toml
[dependencies]
<name> = "<version>"

# With features:
<name> = { version = "<version>", features = ["<feature>"] }
```

## Key APIs

- `Type::method(args)` — what it does
- `function(args)` — what it does

## Observations

- [pattern] How it's typically used
- [gotcha] What surprised us or could trip up new users
- [benefit] Why choose this over alternatives (e.g., compared to X)
- [limitation] What it can't do or where it breaks down
- [compatibility] MSRV: Rust <version>; edition: <2021/2018>
- [convention] Important usage conventions

## Release Highlights

- breaking: <what changed and migration path> ([v<X>.0.0](release-url), YYYY-MM-DD)
- feature: <capability> ([v<Y>.0.0](release-url), YYYY-MM-DD)
- fix: <what was broken> ([v<Z>.1.0](release-url))

## Security

- Last known advisory: <RUSTSEC-YYYY-NNNN or "none found">
- Maintenance: active / low-maintenance / unmaintained
- License: <SPDX identifier>
- RustSec: [check advisories](https://rustsec.org/packages/<name>.html)

## Relations

- relates_to [[<Related Note Title>]]
- depends_on [[crate:<dependency>]]
````

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the exact crate name as it appears on crates.io:
`["serde"]`, `["tokio"]`. One package per note.

### `type` value

Must be `crate_package` (snake_case). This is how `schema_validate` matches
notes to the crate schema.

### Security advisory IDs

Rust security advisories use RUSTSEC IDs (e.g., `RUSTSEC-2021-0124`), not CVE
IDs (though CVEs may be cross-referenced). Always use the RUSTSEC ID as primary.

### MSRV and Edition

Rust has a Minimum Supported Rust Version (MSRV) convention. Note it in
`[compatibility]` observations. Also note the edition (2018 or 2021) as it
affects compilation requirements.

### Cargo features

If the crate has optional features, list the commonly used ones in the
`## Cargo.toml` snippet. This is often the most practically useful information
for a developer integrating the crate.
