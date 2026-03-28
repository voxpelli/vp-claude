# Composer (PHP) Package Note Template

Use this template when creating new `composer:*` notes with `write_note`. Place
in the `composer/` directory so it resolves `[[composer:*]]` wiki-links.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

````markdown
---
title: composer:<vendor>/<package>
type: composer_package
tags: [<domain>, <subdomain>]
packages: ["<vendor>/<package>"]
---

# composer:<vendor>/<package>

[`<vendor>/<package>`](https://packagist.org/packages/<vendor>/<package>) —
one-line description.

GitHub: [owner/repo](https://github.com/owner/repo) | v<version> | <license>

## composer.json

```json
{
    "require": {
        "<vendor>/<package>": "^<version>"
    }
}
```

## Key APIs

- `Namespace\ClassName::method()` — what it does
- `function_name()` — what it does

## Observations

- [pattern] How it's typically used
- [gotcha] What surprised us or could trip up new users
- [benefit] Why choose this over alternatives
- [limitation] What it can't do or where it breaks down
- [compatibility] PHP: <>=X.Y>; framework: <Laravel X / Symfony X / standalone>
- [convention] Important usage conventions (PSR standards, etc.)

## Release Highlights

- breaking: <what changed and migration path> ([v<X>.0.0](release-url), YYYY-MM-DD)
- feature: <capability> ([v<Y>.0.0](release-url), YYYY-MM-DD)
- fix: <what was broken> ([v<Z>.1.0](release-url))

## Security

- Last known advisory: <CVE-ID or "none found">
- Maintenance: active / low-maintenance / unmaintained
- License: <SPDX identifier>
- FriendsOfPHP: [check advisories](https://github.com/FriendsOfPHP/security-advisories)

## Relations

- relates_to [[<Related Note Title>]]
- depends_on [[composer:<vendor>/<dependency>]]
````

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the full `vendor/package` name as it appears on
Packagist: `["laravel/framework"]`, `["symfony/console"]`. One package per note.

### `type` value

Must be `composer_package` (snake_case).

### PHP Version Compatibility

PHP version requirements (`require.php` in composer.json) are the MSRV equivalent.
Always document in `[compatibility]` observations. PHP 8.0+ is currently standard;
note if a package still supports 7.4 or requires 8.1+.

### PSR Standards

Many Composer packages implement PSR (PHP Standard Recommendation) interfaces.
Note relevant PSRs in `[convention]` observations — e.g., `[convention] Implements
PSR-7 (HTTP Message Interface)`.

### Framework vs Standalone

Note whether the package is framework-specific (Laravel, Symfony) or standalone.
Framework-specific packages often have framework-version compatibility matrices.
