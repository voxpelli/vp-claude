# RubyGems Note Template

Use this template when creating new `gem-*` notes with `write_note`. Place in
the `gems/` directory so it resolves `[[gem-*]]` wiki-links automatically.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

````markdown
---
title: gem-<name>
type: ruby_gem
url: https://rubygems.org/gems/<gem-name>
tags: [<domain>, <subdomain>]
packages: ["<gem-name>"]
---

# gem-<name>

[`<name>`](https://rubygems.org/gems/<name>) — one-line description.

GitHub: [owner/repo](https://github.com/owner/repo) | v<version> | <license>

## Gemfile

```ruby
# Gemfile
gem '<name>', '~> <version>'

# With groups:
group :development, :test do
  gem '<name>', '~> <version>'
end
```

## Key APIs

- `ClassName.method(args)` — what it does
- `module_method(args)` — what it does

## Observations

- [pattern] How it's typically used
- [gotcha] What surprised us or could trip up new users
- [benefit] Why choose this over alternatives
- [limitation] What it can't do or where it breaks down
- [compatibility] Ruby: <>=X.Y>; Rails: <X.Y+ / standalone>
- [convention] Important usage conventions
- [popularity] XM total downloads (RubyGems, YYYY-MM)

## Release Highlights

- breaking: <what changed and migration path> ([v<X>.0.0](release-url), YYYY-MM-DD)
- feature: <capability> ([v<Y>.0.0](release-url), YYYY-MM-DD)
- fix: <what was broken> ([v<Z>.1.0](release-url))

## Security

- Last known advisory: <CVE-ID or "none found">
- Maintenance: active / low-maintenance / unmaintained
- License: <SPDX identifier>
- RubySec: [check advisories](https://www.rubysec.com/advisories/?gem=<name>)

## Relations

- relates_to [[<Related Note Title>]]
- depends_on [[gem-<dependency>]]
````

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the exact gem name as it appears on RubyGems:
`["rails"]`, `["devise"]`, `["sidekiq"]`. One gem per note.

### `type` value

Must be `ruby_gem` (snake_case).

### Ruby Version Compatibility

The `required_ruby_version` field in the gemspec sets the MSRV. This is often
NOT returned by the RubyGems API — check the gem's GitHub repo or gemspec.
Document in `[compatibility]` observations.

### Rails Compatibility

Many gems are Rails-specific or have Rails integration. Note the compatible Rails
version range in `[compatibility]`. Rails upgrades often require gem updates.

### Gemfile version constraints

Ruby uses `~>` (pessimistic version constraint, meaning "compatible with"):
- `~> 2.0` means `>= 2.0` AND `< 3.0`
- `~> 2.0.0` means `>= 2.0.0` AND `< 2.1.0`

Document the recommended constraint form in `[convention]` observations.

### Gemfile.lock vs Gemfile

For application gems, Gemfile.lock pins exact versions. For library gems
(gemspecs), dependencies are declared with `add_dependency`. Note whether
the gem is intended for application or library use.
