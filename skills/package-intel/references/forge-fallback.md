# Forge Fallback — Non-GitHub Repository Hosts

Shared reference for `package-intel` and `tool-intel`. The file lives under
`package-intel/references/`; both skills point here via the full
`${CLAUDE_PLUGIN_ROOT}/skills/package-intel/references/forge-fallback.md` path
— `tool-intel` is a separate skill directory, so it must use this full
plugin-relative path rather than a bare `references/...` path, which would
resolve relative to its own directory instead. This cross-skill reference is an
accepted, documented portability trade-off (see `docs/design/triple-harness-notes.md`).

## Contents

- [When to use this file](#when-to-use-this-file)
- [Codeberg / Forgejo REST API](#codeberg--forgejo-rest-api)
- [sourcehut (git.sr.ht) — Phase 2](#sourcehut-gitsrht--phase-2)
- [tangled.org / AT Protocol forges — deferred (Phase 3)](#tangledorg--at-protocol-forges--deferred-phase-3)
- [Unknown forge fallback](#unknown-forge-fallback)
- [Mirror / canonical-home ambiguity](#mirror--canonical-home-ambiguity)

## When to use this file

Step 2 of either skill resolves a `repository.url` (npm `repository.url`,
crates `crate.repository`, a brew formula `homepage`, an Open VSX `repository`,
etc.). **Parse the host** from that URL and dispatch:

| Host | Forge | Path |
|------|-------|------|
| `github.com` | GitHub | existing path — `gh api`, DeepWiki, `gh-api-fallback.md` (unchanged) |
| `codeberg.org` (or any Forgejo instance) | Forgejo/Gitea | **Codeberg/Forgejo REST API** below |
| `*.sr.ht` (e.g. `git.sr.ht`) | sourcehut | **sourcehut** below (Phase 2) |
| anything else | unknown | **Unknown forge fallback** below |

`owner/repo` extraction is host-agnostic: strip scheme + host, take the first
two path segments. Sourcehut prefixes the owner with `~` (`git.sr.ht/~user/repo`)
— keep the `~` in the URL, strip it when recording `owner` in a note.

`action:` and `gh:` prefixes are **always GitHub** (the identifier encodes a
GitHub `owner/repo`) — skip forge detection for them entirely.

**DeepWiki is GitHub-only.** For any non-GitHub forge, skip the DeepWiki step
(it is a certain miss). The skip is not an error — note it in the Step 6
synthesis ("DeepWiki skipped — repository hosted on `<forge>`, not GitHub").

## Codeberg / Forgejo REST API

Codeberg runs Forgejo, which exposes a Gitea-compatible REST API at `/api/v1/`.
Public repos need no authentication. Use `tavily_extract` (preferred) or `curl`
(fallback). The endpoint shapes and JSON field names mirror the GitHub REST API
almost exactly, so the `gh-api-fallback.md` recovery logic applies with only the
base URL changed.

| Goal | URL |
|------|-----|
| List releases (newest first) | `https://codeberg.org/api/v1/repos/{owner}/{repo}/releases?limit=10` |
| One release by tag | `https://codeberg.org/api/v1/repos/{owner}/{repo}/releases/tags/{tag}` |
| List tags | `https://codeberg.org/api/v1/repos/{owner}/{repo}/tags?limit=20` |
| File contents (base64) | `https://codeberg.org/api/v1/repos/{owner}/{repo}/contents/{path}` |
| Raw file (no base64) | `https://codeberg.org/{owner}/{repo}/raw/branch/{branch}/{path}` |
| Commits on a ref | `https://codeberg.org/api/v1/repos/{owner}/{repo}/commits?sha={ref}&limit=20` |
| Compare two refs | `https://codeberg.org/api/v1/repos/{owner}/{repo}/compare/{base}...{head}` |
| Repository metadata | `https://codeberg.org/api/v1/repos/{owner}/{repo}` |

**Field mappings (Forgejo → GitHub equivalent, identical names):**

- Release: `tag_name`, `name`, `body`, `draft`, `prerelease`, `published_at`.
- Tag: `name` (the tag string), `commit.sha`.
- Contents: `content` (base64), `encoding: "base64"`, `download_url` — decode
  with `base64 -d` exactly as for GitHub.
- Commit: `commit.message` (curate the first line as the subject).

**Changelog recovery** is the same procedure as GitHub: prefer the newest
release `body`; if the registry version is newer than the newest release (a tag
pushed without a Release), recover from `/tags` + `/compare`. The `/tags` list
is **not** semver-sorted — apply the same semver-sort + pre-release-exclusion
rules from `gh-api-fallback.md` ("Recovering a Version/Changelog from Tags").

**Caveats:**

- **TLS quirk.** Codeberg intermittently serves a `*.codeberg.page` wildcard
  certificate, which can fail TLS verification in some clients. If
  `tavily_extract` returns empty for a clearly valid Codeberg API URL, retry
  once; if it fails again, fall back to the **raw file** form
  (`https://codeberg.org/{owner}/{repo}/raw/branch/main/CHANGELOG.md`) — this is
  the path that succeeded for `vscode-mkhl.shfmt` (Codeberg issues #898, #1368).
- **Compare endpoint** uses three dots (`{base}...{head}`) and has **no
  `total_commits` field** — check the length of the returned `commits` array; if
  it looks truncated, fall back to the `/commits?sha={head}` endpoint.
- **Self-hosted Forgejo instances:** replace `codeberg.org` with the instance
  host. Confirm it is Forgejo/Gitea via `GET /api/v1/version` (returns a version
  string like `15.0.0-…+gitea-1.22.0`) before assuming these endpoints.

## sourcehut (git.sr.ht) — Phase 2

sourcehut's API is **GraphQL-only** (`https://git.sr.ht/query`) and requires
OAuth2 authentication, so it is not usable unauthenticated.

**Primary path (unauthenticated):** use `tavily_extract`:

1. `https://git.sr.ht/~{owner}/{repo}/blob/main/CHANGELOG.md` — changelog.
2. `https://git.sr.ht/~{owner}/{repo}` — README/description.
3. Skip DeepWiki (sourcehut repos are not indexed).
4. Note in synthesis: "sourcehut repo — DeepWiki skipped; changelog via Tavily."

**Authenticated path (documented, not called by default):** if a sourcehut
personal access token is available, `POST https://git.sr.ht/query` with
`Authorization: Bearer <token>` (scopes `REPOSITORIES:RO`, `OBJECTS:RO`) and a
GraphQL query against `repository(name:, owner:{username:"~..."})` for
`references`, `log`, and `path(...){ object { ...on Blob { contents } } }`.
This is reference material only — adding a token facility is out of scope.

## tangled.org / AT Protocol forges — deferred (Phase 3)

`tangled.org` (formerly `tangled.sh`) is an ATProto-based code forge; its
public API is not stable as of 2026-05. Forge landscape documented in Basic
Memory (`Tangled - AT Protocol Code Forge`). **Revival trigger:** when
`https://tangled.org/api/v1` (or its successor) exposes a stable
`/repos/{owner}/{repo}/tags`-equivalent endpoint, add a tangled adapter
following the Codeberg pattern above. Until then, tangled URLs fall through to
the unknown-forge fallback.

## Unknown forge fallback

For any host not handled above:

1. `tavily_extract` on `{repository_url}` for the README/description.
2. `tavily_extract` on `{repository_url}/CHANGELOG.md` — many forges serve raw
   files without auth.
3. Skip all `gh` / forge-API calls and DeepWiki.
4. Record `- [gotcha] repository hosted on {host} — no forge adapter; changelog
   sourced via Tavily` in the note observations, so a future refresh knows the
   constraint.

## Mirror / canonical-home ambiguity

Use `repository.url` as authoritative — it is machine-readable; README prose
("development happens on Codeberg, GitHub is a mirror") is not. If the registry
reports GitHub, run the GitHub path; if it reports Codeberg, run the Forgejo
path and skip DeepWiki (the GitHub mirror, if any, may be stale — the canonical
URL is the safer source). Do not second-guess the registry's URL.
