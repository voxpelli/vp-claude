# GitHub CLI Extension Ecosystem — Registry Resolution

Use this reference file during Step 2 (Fetch registry data) when the detected
ecosystem is `gh`.

## Identifier Format

Input pattern: `gh:<owner>/<repo>` (e.g. `gh:meiji163/gh-notify`).

Normalisation rules — apply in order before any tool calls:

1. Strip the `gh:` prefix.
2. If the remainder starts with `https://github.com/`, strip that prefix.
3. If the remainder ends with `.git`, strip that suffix.
4. If the remainder contains an `@<version>` suffix, strip everything from `@` onward.
5. The result MUST contain exactly one `/` — if not, error out with:
   `gh: ecosystem requires owner/repo form (got "<input>"); example: gh:meiji163/gh-notify`.
6. Split on `/` to extract `<owner>` and `<repo>`.
7. The BM title is `gh-<owner>-<repo>` (replace the `/` with `-`, preserve any
   `-` already in the repo name — `gh-notify` stays `gh-notify`).

## No Formal Registry API

GitHub CLI extensions have no dedicated registry. Discovery is entirely
de-facto:

- The `gh-extension` GitHub topic — repos opting in for marketplace-style
  visibility.
- `gh extension search` — built-in search command (added cli/cli#7438) that
  queries GitHub for repos matching `<query> in:name topic:gh-extension`.
- Manual install via `gh extension install <owner>/<repo>` — works for any
  repo whose name starts with `gh-`, regardless of topic membership.

The authoritative source is the GitHub repo itself. Owner/repo IS the
identifier — there is no separate package name to resolve.

## Required Fields to Extract

| Field | Source | How to obtain |
|-------|--------|---------------|
| `version` | Latest GitHub release tag | `gh release list --repo <owner>/<repo> --limit 1` |
| `runtime_shape` | Local install + release assets | See "Detecting `runtime_shape`" below |
| `language` | GitHub API repo metadata | `gh repo view <owner>/<repo> --json primaryLanguage` |
| `source` | Constructed | `https://github.com/<owner>/<repo>` |
| Primary commands | README | `tavily_extract(urls=["https://github.com/<owner>/<repo>/blob/main/README.md"], query="usage commands subcommands flags")` |
| Runtime dependencies | README + repo files | Look for "Requirements", "Prerequisites", "Dependencies" sections; for script extensions also inspect the entry script's shebang and external command invocations |

The entry script is conventionally named `gh-<repo-name-without-gh-prefix>`
at the repo root for script extensions (e.g. the entry script for
`meiji163/gh-notify` is `gh-notify`). For binary extensions, the entry
binary follows the same naming convention but is delivered via release
assets.

## How to Find the Upstream GitHub Repo

The repo IS the identifier — `owner/repo` from the parsed input maps
directly to `https://github.com/<owner>/<repo>`. No homepage lookup or URL
indirection required, unlike `brew:` (where `homepage` may point elsewhere)
or `npm:` (where `repository.url` may be missing).

## Detecting `runtime_shape`

Apply this classification ladder in order — first match wins:

1. **Symlink check FIRST.** If the extension is locally installed:
   ```sh
   find ~/.local/share/gh/extensions/<name>/ -maxdepth 0 -type l
   ```
   Returns the path → `runtime_shape: local` (symlinked dev install via
   `gh ext install .`). Skip remaining steps. **This check must run before
   any release-asset inspection** — symlinked dev installs contain `.git/`
   too, so the `.git/` heuristic alone misclassifies them as `script`.

2. **Zero releases → `script`.**
   ```sh
   gh release list --repo <owner>/<repo> --limit 5
   ```
   If the call returns zero releases → `runtime_shape: script` (the only
   way to install is `gh extension install` cloning HEAD; no precompiled
   binaries exist).

3. **Cross-platform binary assets → `binary`.** Inspect the latest release:
   ```sh
   gh release view <tag> --repo <owner>/<repo> --json assets
   ```
   If asset names match precompiled-binary patterns —
   `<name>-<os>-<arch>` or `<name>_<os>_<arch>` where `<os>` is one of
   `linux`/`darwin`/`windows` and `<arch>` is one of
   `amd64`/`arm64`/`386`/`x86_64` — and there are 3+ such variants →
   `runtime_shape: binary`.

4. **Source-archive only → `script`.** If the only release assets are
   source archives (`.tar.gz`/`.zip` named after the tag, no OS/arch
   suffix) → `runtime_shape: script`.

5. **Mixed → `binary` with caveat.** One binary + source archives: treat
   as `binary` and document the partial-platform coverage as a
   `[platform]` observation.

The `gh extension install` command itself uses steps 2-5 internally to
decide between downloading a release binary and falling back to a git
clone — mirroring its decision keeps notes aligned with installer
behaviour.

## Source Behaviour for `gh:`

| Source | Default | Reason |
|--------|---------|--------|
| DeepWiki | **conditional** — only if `gh release list --repo <owner>/<repo>` returns ≥ 1 release | Alpha bash repos (e.g. `gh-notify`) aren't indexed; DeepWiki returns "Repository not found". A non-empty release list is a reliable proxy for "well-known enough to be indexed". Mirrors `/people-intel`'s conditional DeepWiki pattern. |
| Tavily | ✅ on | Always useful for security/CVE/recent-changes queries |
| Raindrop | ✅ on | User-curated bookmarks may include the extension |
| Readwise | ✅ on | Personal highlights & deep-read articles |
| Changelog | ✅ on | `gh release list --repo <owner>/<repo> --limit 10` |
| Context7 | ❌ skip | npm-biased library documentation index; no value for gh CLI extensions |
| Homebrew MCP | ❌ skip | gh extensions are not distributed via Homebrew |

## Security Notes

`gh extension install` resolves to HEAD by default — equivalent to
`pin-to-branch` for actions. Note in `[security]` observations:

- Whether the upstream tags releases at all (untagged extensions are
  HEAD-only — every install pulls latest commit, no rollback path).
- Publisher trust level: official `cli/` org, well-known maintainer, or
  third-party.
- For `runtime_shape: binary` extensions, whether release artifacts are
  signed or checksummed.

Pin to a specific tag with `gh extension install <owner>/<repo>@<tag>` for
reproducible installs.

## Common Misclassifications

- **`cli/gh-extension-precompile` is a GitHub Action, not a `gh` extension.**
  Substring matching on `gh-extension` is unsafe; the canonical signal is
  an `gh ext install owner/repo` invocation, not a repo name pattern.
