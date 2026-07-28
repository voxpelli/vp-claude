# npm Ecosystem — Registry Resolution

Use this reference file during Step 2 (Resolve repository) when the detected
ecosystem is `npm`.

> **Canonical version for staleness (`--stale`):** record npm's
> `dist-tags.latest` as this note's version. `scripts/fetch-npm-upstream.sh`
> compares against the same field, so `/knowledge-gaps --stale` and a
> subsequent `/intel` refresh converge on the same value.

## Resolve GitHub Repository

```bash
npm view <package-name> repository.url 2>/dev/null
```

This returns the full git URL (e.g., `https://github.com/owner/repo.git`).
Extract `owner/repo` for use in DeepWiki and changelog steps.

> **Forge note:** parse the host first. If it is not `github.com` (e.g.
> `codeberg.org`, `*.sr.ht`), set `repo_forge` and follow `forge-fallback.md`
> per the Step 2 forge-detection block — `gh`/DeepWiki are GitHub-only.

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
`homepage`, `bugs.url`, `time.created` (first-publish timestamp — needed by the
download-window check below), `bin` (the CLI-distribution signal the
agent-leverage check gates on — an object `name→path` or a bare string;
absent ⇒ library-only, skip the check).

## Download Stats

The npm downloads API provides weekly download counts. Fetch alongside
the `npm view` call — the data is at a separate endpoint. This is a raw JSON
registry endpoint, not HTML — fetch it directly via `Bash` with `curl`+`jq`
rather than `tavily_extract`: cheaper (no MCP round-trip) and shape-exact (no
HTML-extraction lossiness):

```bash
curl -fsSL --max-time 30 "https://api.npmjs.org/downloads/point/last-week/<package-name>" | jq '.downloads'
```

For scoped packages, URL-encode the scope:
`https://api.npmjs.org/downloads/point/last-week/%40scope%2Fname`

The response is JSON: `{"downloads": <integer>, "start": "...", "end": "...", "package": "..."}`.
Extract `.downloads`. If the call fails or returns `null`, skip the popularity
observation silently.

**A zero can mean the window predates publication.** The endpoint answers for a
fixed trailing week regardless of when the package first shipped, so a
just-published package returns e.g.
`{"downloads":0,"start":"2026-07-18","end":"2026-07-24"}` for a package
published on 2026-07-26 — a window entirely before it existed. Recording "0
downloads/week" from that reads as "nobody uses it" when it measures nothing.
Compare `.end` against `.time.created` from the `npm view --json` call above
(note this needs the whole downloads object, not the `jq '.downloads'`
projection); if the window closes before publication, skip the observation or
state the window explicitly rather than the bare count.

Format for the `[popularity]` observation: `Xk downloads/week` or
`X.XM downloads/week (npm, YYYY-MM)`. Thresholds: raw number below 10k,
`Xk` for 10k–999k, `X.XM` for 1M+.

## Scoped Packages

Scoped packages (e.g., `@fastify/postgres`, `@types/node`) are always npm
regardless of the `/` in their name. Treat the full `@scope/name` as the
package identifier. Pass the full name to `npm view` with quotes if needed:

```bash
npm view "@fastify/postgres" repository.url 2>/dev/null
```
