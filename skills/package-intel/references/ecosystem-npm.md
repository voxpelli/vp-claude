# npm Ecosystem — Registry Resolution

Use this reference file during Step 2 (Resolve repository) when the detected
ecosystem is `npm`.

## Resolve GitHub Repository

```bash
npm view <package-name> repository.url 2>/dev/null
```

This returns the full git URL (e.g., `https://github.com/owner/repo.git`).
Extract `owner/repo` for use in DeepWiki and changelog steps.

If `npm view` fails (package not found, network error, or returns empty), fall
back to:

```
tavily_search(query="<package-name> npm github repository")
```

## Fields Available via npm view

For richer metadata in one call:

```bash
npm view <package-name> --json 2>/dev/null
```

Useful fields: `version`, `description`, `license`, `repository.url`,
`homepage`, `bugs.url`.

## Scoped Packages

Scoped packages (e.g., `@fastify/postgres`, `@types/node`) are always npm
regardless of the `/` in their name. Treat the full `@scope/name` as the
package identifier. Pass the full name to `npm view` with quotes if needed:

```bash
npm view "@fastify/postgres" repository.url 2>/dev/null
```
