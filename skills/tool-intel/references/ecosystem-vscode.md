# VSCode Extension Ecosystem — Registry Resolution

Use this reference file during Step 2 (Fetch registry data) when the detected
ecosystem is `vscode`.

> **Canonical version for staleness (`--stale`):** record the **Open VSX**
> `.version` as this note's version (the drift verdict is computed against Open
> VSX, not the VS Marketplace). `scripts/fetch-vscode-upstream.sh` compares
> against the same field, so `/knowledge-gaps --stale` and a subsequent
> `/tool-intel` refresh converge. The Marketplace version is recorded as an
> annotation only.

## Extension Identifier Format

VSCode extensions are identified as `<publisher>.<extension-id>` (dot-separated).
Example: `esbenp.prettier-vscode` where `esbenp` is the publisher and
`prettier-vscode` is the extension ID.

## Primary Source: Open VSX Registry

Open VSX (`open-vsx.org`) is the open-source alternative registry with a
clean REST API. Try it first:

```
tavily_extract(
  urls=["https://open-vsx.org/api/<publisher>/<extension-id>"],
  query="displayName description version license repository"
)
```

### Key fields from Open VSX API response

| Field | Description |
|-------|-------------|
| `displayName` | Human-readable extension name |
| `description` | Short description |
| `version` | Latest version |
| `license` | SPDX license identifier |
| `repository.url` | Source repository URL |
| `homepage` | Extension homepage or docs |
| `categories` | Extension categories |
| `tags` | Searchable tags |
| `downloads` | Total download count |
| `averageRating` | User rating |
| `publishedDate` | Initial publish date |
| `lastUpdated` | Most recent update |

## Fallback: VS Marketplace

If the extension is not on Open VSX (some proprietary extensions are
Microsoft-only), fall back to the VS Marketplace page:

```
tavily_extract(
  urls=["https://marketplace.visualstudio.com/items?itemName=<publisher>.<extension-id>"],
  query="description features requirements configuration settings"
)
```

The Marketplace page is HTML — Tavily will extract the readable content.

## Open VSX Trust Signal

Open VSX is **less curated than the VS Marketplace** — it has shipped malware
(SecureAnnex "These Vibes Are Off"; the GlassWorm self-propagating worm). The
sharper risk is **namespace squatting**: fork-IDEs (Cursor, Windsurf,
Antigravity, Trae, VSCodium, Theia) recommend VS Marketplace extension IDs but
resolve installs against **Open VSX**, so an extension that exists on the
Marketplace but **not** on Open VSX has an *unclaimed, squattable* namespace an
attacker can register and ship malware through.

Record one `[security]` observation capturing where this extension sits on the
4-state trust ladder. Read the fields from the Open VSX API response already
fetched above (`namespaceAccess`, `verified`, `publishedBy.loginName`) and from
whether the Marketplace lookup succeeded:

| State | How to detect | Severity | `[security]` observation |
|-------|---------------|----------|--------------------------|
| **verified-restricted** | on Open VSX, `verified: true` / `namespaceAccess: "restricted"` | none (baseline) | `Open VSX: verified, restricted namespace (publisher <login>) — baseline trust (YYYY-MM-DD)` |
| **public-namespace** | on Open VSX, `namespaceAccess: "public"` | low | `Open VSX: namespace is "public" (unverified) — anyone may publish into <namespace>; prefer a restricted/verified namespace (YYYY-MM-DD)` |
| **marketplace-only** | Open VSX 404 **and** present on VS Marketplace | **medium** | `Open VSX: not published — Marketplace-only (v<mp-version>). Namespace unclaimed/squattable; fork-IDEs (Cursor/Windsurf/Codium) resolve installs against Open VSX, exposing users to namespace takeover (YYYY-MM-DD)` |
| **not-published-anywhere** | Open VSX 404 **and** absent from VS Marketplace | info | `Open VSX: not published; also not found on VS Marketplace — likely renamed/removed/private (YYYY-MM-DD)` |

Always add `relates_to [[Publisher Verification Gradient]]` in `## Relations` —
that hub note carries the cross-ecosystem trust-tier model this signal instances.

> **Out of scope (recorded):** comparing the Open VSX `publishedBy` / namespace
> owner against the *Marketplace* publisher to catch active impersonation
> (a different entity publishing the same ID on each registry) is a higher-value
> but heavier check — it needs Marketplace publisher identity via the unofficial
> `extensionquery` API. Note a cross-registry mismatch if you happen to spot one,
> but the per-note signal above does not require it.

## Resolve GitHub Repository

The `repository.url` field from Open VSX (or from the Marketplace page) gives
the source repository. Extract `owner/repo` for DeepWiki and changelog steps.

> **Forge note:** parse the host first. If it is not `github.com` (e.g.
> `codeberg.org` — as for `mkhl.shfmt` — or `*.sr.ht`), set `repo_forge` and
> follow `../../package-intel/references/forge-fallback.md` per the Step 2
> forge-detection block — `gh`/DeepWiki are GitHub-only.

Note: Many popular extensions are on GitHub (e.g., `prettier/prettier-vscode`,
`microsoft/vscode-eslint`). Some are proprietary (e.g., GitHub Copilot) with
no public source repo.

## Extension Contribution Points

VSCode extensions contribute to the editor via specific points. Note relevant
ones in `## Features`:

| Contribution | What it adds |
|-------------|-------------|
| `languages` | Language syntax support |
| `grammars` | TextMate grammar for highlighting |
| `commands` | Palette commands |
| `menus` | Right-click context menus |
| `keybindings` | Keyboard shortcuts |
| `configuration` | Settings entries under `settings.json` |
| `snippets` | Code snippets |
| `themes` | Color/icon themes |
| `debuggers` | Debug adapter protocol |
| `taskDefinitions` | Task runner integration |

## Companion CLI Tools

Many extensions wrap a CLI tool. Note this as `[requires]` observation:
- `esbenp.prettier-vscode` → requires `prettier` CLI
- `dbaeumer.vscode-eslint` → requires `eslint`
- `rust-lang.rust-analyzer` → requires `rust-analyzer` binary
- `ms-python.python` → requires Python interpreter

The extension won't function (or will degrade) if the companion tool is absent.
