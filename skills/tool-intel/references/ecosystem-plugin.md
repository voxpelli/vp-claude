# Ecosystem reference: Claude Code plugins (`plugin:`)

Fetch + research recipe for `/tool-intel plugin:<owner>/<repo>` (optionally
`#<plugin-name>` to select one plugin from a marketplace that holds several).
A plugin is a git-repo + manifest artifact; its closest analog is `action:`
(git-repo + git tags, no central registry API). Writes a `claude_plugin` note
(see `note-template-plugin.md`).

## Step 2: fetch manifest + version

A marketplace repo holds `.claude-plugin/marketplace.json`; each entry's
`source` resolves to that plugin's own `.claude-plugin/plugin.json`.

```bash
# marketplace manifest (base64-decode the contents API payload)
gh api repos/<owner>/<repo>/contents/.claude-plugin/marketplace.json --jq .content | base64 -d
#   -> the matching plugins[] entry: name, source, version, description, author, keywords
# plugin manifest (path from the entry's source)
gh api repos/<src-owner>/<src-repo>/contents/<path>/.claude-plugin/plugin.json --jq .content | base64 -d
#   -> authoritative version (plugin.json wins over the marketplace entry),
#      dependencies[], and declared component paths (skills/agents/hooks/commands/mcpServers)
```

Extract: `name`, `version`, `description`, `author`, `repository`, `license`,
`keywords`, the declared component surfaces, and the `name@marketplace` install
string. Record components as one `[components]` observation (counts + names) —
individual skills are NOT separate notes. For `[popularity]`, read repo stars
via `gh api repos/<owner>/<repo> --jq .stargazers_count` (date-qualify it).

## Trust ladder (security)

Always record one `[security]` observation on the 4-state ladder and add the
relation `relates_to [[Publisher Verification Gradient]]` (keep the wiki-link in
the note's `## Relations`, not in the observation line):

- **first-party** — Anthropic's official marketplace
- **claimed-community-marketplace** — a named, owner-verifiable community marketplace
- **unverified-third-party = squattable** — `/plugin install` resolves a marketplace name by trust-on-first-use; the name is squattable (the plugin analog of the Open VSX marketplace-only signal for `vscode:`)
- **direct-repo-only** — installed by direct repo path, no marketplace

Also note `allowed-tools` grants (a plugin's skills/agents pre-approve tools) and
any unsandboxed `scripts/` the plugin ships.

## Changelog / version drift

Version is the `plugin.json` `version` field. For the changelog, use the
git-tag fallback in `gh-api-fallback.md` ("Recovering a Version/Changelog from
Tags") — filter `{plugin-name}--v*` tags for monorepo marketplaces, else plain
`vX.Y.Z` tags. DeepWiki applies (it is a GitHub repo) but is conditional, like
`gh:` — only when the repo is well-known enough to be indexed.

`--stale plugin` is supported (since `bd vp-claude-uchu`, reviving the
`vp-claude-5s83` deferral once documented plugin notes exceeded the ~10
revival trigger): there is no central registry API, so drift is resolved by
fetching `plugin.json` directly from GitHub via `gh api` instead of a
registry — see `skills/knowledge-gaps/references/staleness-detection.md`'s
Cohort configuration table and `scripts/fetch-plugin-upstream.sh`.
