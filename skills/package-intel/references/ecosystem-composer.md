# Composer (PHP) Ecosystem — Registry Resolution

Use this reference file during Step 2 (Resolve repository) when the detected
ecosystem is `composer`.

## Package Name Format

Composer packages always have a `vendor/package` format (e.g., `laravel/framework`,
`symfony/console`, `guzzlehttp/guzzle`). Both parts are required — there are no
unscoped Composer packages.

## Resolve Package Metadata

Packagist provides a JSON API at `packagist.org`:

**Option A — tavily_extract (preferred):**
```
tavily_extract(
  urls=["https://packagist.org/packages/<vendor>/<package>.json"],
  query="repository description downloads version license"
)
```

**Option B — Bash curl (fallback):**
```bash
curl -s "https://packagist.org/packages/<vendor>/<package>.json"
```

**Note:** Packagist responses are cached for ~12 hours. The response may not
reflect the absolute latest release.

## Key Response Fields

From `https://packagist.org/packages/<vendor>/<package>.json`:

| JSON path | Meaning |
|-----------|---------|
| `package.repository` | GitHub URL (e.g., `https://github.com/vendor/repo`) |
| `package.description` | Short package description |
| `package.downloads.total` | All-time install count |
| `package.versions` | Map of version → metadata |

Extract `package.downloads.total` (all-time integer) for the `[popularity]`
observation. Format as `XM total installs (Packagist, YYYY-MM)`.

The `package.versions` map uses Composer version strings including `dev-main`
and `dev-master`. Find the latest stable version by looking for the highest
non-`dev-` version key.

## PHP Version Compatibility

PHP version requirements are in the `require.php` field of each version entry.
Note MSRV (minimum supported PHP version) in the `[compatibility]` observation.

## Security Advisories

PHP packages use the FriendsOfPHP Security Advisories database. For security
research in Step 3c:
```
tavily_search(query="<vendor/package> composer CVE security advisory <current-year>")
```

Also check: `https://github.com/FriendsOfPHP/security-advisories`
