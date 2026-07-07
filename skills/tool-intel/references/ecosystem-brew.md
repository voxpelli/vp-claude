# Homebrew Formula Ecosystem — Registry Resolution

Use this reference file during Step 2 (Fetch registry data) when the detected
ecosystem is `brew`.

## Fetch Formula Metadata

This is a raw JSON registry endpoint, not HTML — fetch it directly via `Bash`
with `curl`+`jq` rather than `tavily_extract`: cheaper (no MCP round-trip),
shape-exact (no HTML-extraction lossiness), and consistent with how
`scripts/fetch-brew-upstream.sh` fetches the equivalent bulk data:

```bash
curl -fsSL --max-time 30 "https://formulae.brew.sh/api/formula/<name>.json" | jq .
```

### Key fields from the JSON response

| Field | Description |
|-------|-------------|
| `desc` | One-line description |
| `homepage` | Project homepage (often GitHub) |
| `versions.stable` | Current stable version |
| `license` | SPDX license identifier |
| `dependencies` | Runtime dependencies (other formulae) |
| `build_dependencies` | Build-time only dependencies |
| `conflicts_with` | Formulae that cannot be installed alongside |
| `caveats` | Post-install notes, path conflicts, shell setup |
| `deprecated` | Boolean — if true, flag prominently |
| `disabled` | Boolean — if true, formula can't be installed |

## Library formulae

Some formulae are **libraries** — mostly installed as a transitive dependency of
other formulae, not run directly (e.g. `tree-sitter`/`libtree-sitter`, `icu4c`,
`openssl@3`). They warrant different note content than a leaf CLI tool: the
"Common Usage" is C-API / linkage rather than flags, and — most importantly — the
note must state **who is actually affected when the library upgrades** without
over-claiming dependents. This branch is triggered by inspecting the Step-2
metadata below; the BM directory, note type, and template are otherwise the
normal `brew/` / `brew_formula` / `note-template-brew.md`.

### Detecting a library formula

Read the metadata already fetched above. Any one strong signal (or several weak
ones) is enough:

- **`caveats` announcing a library/CLI split** — e.g. tree-sitter's "This formula
  now installs only the `tree-sitter` library (`libtree-sitter`). To install the
  CLI tool: `brew install tree-sitter-cli`". The strongest signal.
- **`desc` ending in "library"** (e.g. "Incremental parsing library").
- **Ships no user-facing binary** — installs headers + `lib*.dylib`/`.a` but no
  CLI (aliases like `libtree-sitter`).
- **Low install-on-request ratio** — `analytics.install_on_request ÷
  analytics.install` well below 1 (corroborating, not sole: it means the formula
  is mostly pulled in as a dependency).

### Verifying real dependents (never infer them from technology)

A tool being *built on* the library is a technology fact, NOT a Homebrew
dependency: Rust/Go tools statically vendor C libraries into their own binary and
declare no formula dependency, so `brew upgrade <lib>` does nothing to them. Only
*dynamically-linked* consumers actually depend on the formula. Establish the real
set with the package manager, not domain knowledge:

```bash
brew uses --installed <formula>   # installed formulae that DECLARE a dependency on <formula> (authoritative)
brew deps <consumer>              # does a given formula declare <formula> as a dep?
brew linkage <consumer>           # (or: otool -L <binary>) — the shared libs a built binary actually loads
```

`brew uses --installed <formula>` is the authoritative "who is actually affected"
list. A consumer absent from it but "built on" the library vendors it statically
and is upgrade-independent — record it with a technology verb
(`used_by`/`built_with`, see `note-template-brew.md` → Relations), never
`depends_on`.

### Note conventions for library formulae

In addition to the standard `brew_formula` template:

- **Add an `## Upgrade Impact on Dependents` section** describing how
  `brew upgrade <formula>` affects each class of consumer: *statically-vendored*
  consumers (Rust/Go) are unaffected; *dynamically-linked* consumers track the
  dylib soname (a within-minor upgrade drops in behind the same
  `lib.MAJOR.MINOR.dylib` name with no rebuild; a soname bump requires dependents
  to be rebuilt, which homebrew-core triggers via revision bumps, so a
  whole-system `brew upgrade` stays consistent). Note the separate plugin/grammar
  ABI axis for a runtime that loads compiled plugins. `brew-tree-sitter` is the
  worked exemplar; the reusable mechanics live in the Basic Memory note
  **"Homebrew Library Dependency Impact - Static Vendoring vs Dynamic Linking."**
- **Record a `[pattern]` observation** on the dependency-vs-deliberate nature,
  citing the install-on-request ratio (e.g. "mostly pulled in as a dependency: R
  on-request of N total installs/30d").
- **Use the relation-verb convention** from `note-template-brew.md`: `depends_on`
  only for verified formula dependents; `used_by`/`built_with` for
  static-vendor/technology relationships.

## Fetch Install Analytics (MCP, optional)

Install analytics are available from two sources. The formulae.brew.sh JSON
API fetched in Step 2 includes an `analytics` block —
`analytics.install.{30d,90d,365d}`, `analytics.install_on_request`, and
`analytics.build_error.30d` — so analytics are always obtainable even without
the MCP. When the local Homebrew MCP server is available, `mcp__homebrew__info`
exposes the same counts in human-readable form:

```
mcp__homebrew__info(formula_or_cask="<name>")
```

The parameter is literally `formula_or_cask` — the same tool handles both
formulae and casks. The MCP returns human CLI text (`brew info <name>`
output), not JSON. The relevant block is the `==> Analytics` section:

```
==> Analytics
install: 70,654 (30 days), 173,836 (90 days), 438,626 (365 days)
install-on-request: 52,500 (30 days), 120,072 (90 days), 330,758 (365 days)
build-error: 42 (30 days)
```

If the MCP tool call errors, the server is disconnected, or the `==> Analytics`
block is absent, do not retry — fall back to the `analytics` block in the
Step 2 JSON response (`analytics.install.30d/90d/365d` and
`analytics.build_error.30d`). Never fabricate counts; omit the `[popularity]`
observation only if neither source yields analytics.

The MCP and the JSON API draw on the same Homebrew analytics dataset but can
diverge: the JSON carries a `generated_date`, while `brew info` may serve a
lagging client-side cache (observed 2026-06-11). Always stamp the source and
date of the figures you record.

When analytics are present, extract the numbers and emit exactly one
`[popularity]` observation in Step 6 (Synthesize). Stamp the source —
`(Homebrew MCP, YYYY-MM)` for the MCP, `(formulae.brew.sh API, YYYY-MM-DD)`
for the JSON block — using this format:

`[popularity] 70,654 installs/30d · 173,836/90d · 438,626/365d · 52,500 on-request/30d · 42 build errors/30d (Homebrew MCP, YYYY-MM)`

Include the install-on-request count (`analytics.install_on_request` in the JSON,
or the MCP `install-on-request:` line) as shown. Its ratio to total installs is a
library-vs-tool signal — see the `## Library formulae` section above and the
ratio guidance in `note-template-brew.md`.

If the response shape does not match a formula (contains `artifacts` but no
`Dependencies` section), the user asked for a formula but received a cask —
note the discrepancy in synthesis and suggest rerunning with `cask:<name>`.

The `Installed (on request)` line is machine-specific and must NOT be
written to the note (notes are cross-machine). Use it only to optionally
surface "you already have this installed" in the synthesis prose shown to
the user.

## Third-Party Tap Formulae (`<owner>/<tap>/<formula>`)

Homebrew's core registry (`formulae.brew.sh`) indexes **only**
`homebrew-core`. A two-slash identifier — `brew:<owner>/<tap>/<formula>`
(e.g. `brew:dicklesworthstone/tap/br`) — names a formula distributed through
a **third-party tap**: a separate GitHub repo the user (or `brew tap
<owner>/<tap>`) has added. `formulae.brew.sh` returns 404/empty for these —
that is not "formula not found," it's the expected shape for any tap
formula, so branch here (per SKILL.md Step 0's slash-count dispatch) instead
of retrying the core JSON path.

### Fetch the tap formula (Ruby DSL, no JSON API)

Third-party taps have no JSON API — fetch the formula's Ruby source directly
from the tap repo via `gh api`. GitHub's tap-repo naming convention prefixes
the short tap name with `homebrew-` (`brew tap dicklesworthstone/tap` adds
the repo `dicklesworthstone/homebrew-tap`):

```bash
gh api repos/<owner>/homebrew-<tap>/contents/Formula/<formula>.rb \
  --jq '.content' | base64 -d
```

Most taps shard formulae under `Formula/`; a handful of small/older taps keep
`.rb` files at the repo root instead. If the `Formula/<formula>.rb` path
404s, retry at the repo root before concluding the fetch failed:

```bash
gh api repos/<owner>/homebrew-<tap>/contents/<formula>.rb \
  --jq '.content' | base64 -d
```

If the tap repo itself 404s (`gh api repos/<owner>/homebrew-<tap>` errors),
the identifier is malformed, misspelled, or the tap was deleted/renamed —
report this rather than silently falling back to the core-registry path.

Parse the decoded Ruby source for these fields. Regex-level extraction is
sufficient — a full Ruby parse is not required:

| Field | Pattern | Notes |
|-------|---------|-------|
| `desc` | `desc "..."` | One-line description |
| `homepage` | `homepage "..."` | Upstream project URL — the pivot target for DeepWiki/changelog (below), distinct from the tap repo itself |
| `url` | `url "..."` | Source/binary tarball URL(s); may repeat per-OS/arch inside `on_macos`/`on_linux` blocks — the version is usually embedded in the URL tag or filename |
| `version` | `version "..."` | Only present when the version isn't inferable from `url`; if absent, derive it from the `url` tag/filename, or from `gh api repos/<owner>/homebrew-<tap>/commits?path=Formula/<formula>.rb` (the most recent version-bump commit) |
| `license` | `license "..."` or `license any_of: [...]` | SPDX id(s) declared by the formula — cross-check against upstream below, don't take it as ground truth |
| `depends_on` | `depends_on "..."` (repeatable) | Runtime/build dependencies; a trailing `=> :build` marks a build-only dep |
| `caveats` | `caveats do ... end` block | Post-install notes — often the only install-time documentation a tap formula ships |

### Auto-pivot DeepWiki and the changelog step to the upstream repo

The tap repo (`<owner>/homebrew-<tap>`) is a packaging container, not the
project. Parse `owner/repo` out of the formula's `homepage` field (preferred)
or `url` field, and use **that** repo for Step 3a (DeepWiki) and Step 3d
(changelog) — exactly as the "Resolve GitHub Repository" section below does
for core formulae. Do not run DeepWiki against the tap repo — it holds only
formula definitions, not the tool's source.

**This is an exception to Step 3a's default skip-for-`brew:`/`cask:` rule.**
Step 3a skips DeepWiki for `brew:`/`cask:` on the reasoning that "formulae/
casks rarely have rich repos to analyze" — true for a homebrew-core wrapper
around an existing well-known tool, but not for a third-party-tap formula,
whose upstream repo is often the tool's *entire* source (frequently a small,
young, single-maintainer project exactly like the ones this section's trust
review exists to vet). For any `brew:<owner>/<tap>/<formula>` identifier, run
DeepWiki against the pivoted upstream repo — do not skip it.

### Cross-check the formula's license vs. the upstream repo's actual license

A tap formula's `license` line is maintainer-declared and can drift from the
upstream project's actual license — both precedent notes below hit this in
practice. Verify against the upstream repo (from the pivot above, not the
tap):

```bash
gh api repos/<owner>/<upstream-repo> --jq '.license.spdx_id'
```

If the result differs from the formula's `license` field — including a
`NOASSERTION` from GitHub's license detector on a non-standard or
rider-modified license — record it as a `[trust]` or `[security]`
observation with both values and their source. Precedent notes use both
tags for the same kind of finding (`brew-ataraxy-labs-tap-inspect` files its
FSL-vs-declared-MIT/Apache mismatch as `[trust]`;
`brew-dicklesworthstone-tap-br` files its rider-license mismatch as
`[security]`) — pick whichever reads more naturally for the specific risk
(compliance ambiguity leans `[trust]`; redistribution/attack-surface risk
leans `[security]`) and stay consistent within one note.

### Audit the tap's CI hygiene (SLSA / SHA-256)

List the tap repo's workflows and check for supply-chain hygiene signals:

```bash
gh api repos/<owner>/homebrew-<tap>/contents/.github/workflows --jq '.[].name'
```

A 404 here means no workflow directory at all — note the absence itself as a
`[security]` signal (no CI-based provenance for this tap). When workflows
exist, fetch the release/build workflow content and check for:

- `actions/attest-build-provenance` (or an equivalent) — SLSA build provenance
- Per-platform SHA-256 generation/verification in the release or update step
- A dependency-audit step (`cargo audit`, `npm audit`, etc. — language-dependent)

Record what's present, not only what's missing — supply-chain hygiene is a
spectrum; a small personal tap with strong CI hygiene is a different risk
profile than a large tap with none. `brew-dicklesworthstone-tap-br`'s
`[security]` observations show the shape of a hygiene-positive report (SLSA
attestation + per-platform SHA-256 + `cargo audit` in CI, 8 named workflows).

### Sibling-formula org survey

List the tap's other formulae to gauge whether this is a one-off script or
part of a maintained suite — the same "graveyard vs. flywheel" org-level
trust signal package-intel and tool-intel both use elsewhere:

```bash
gh api repos/<owner>/homebrew-<tap>/contents/Formula --jq '.[].name'
```

Fall back to listing the repo root filtered to `*.rb` for taps that don't use
a `Formula/` subdirectory. Record the sibling formula names/count as a
`[trust]` or `[ecosystem]` observation —
`brew-dicklesworthstone-tap-br`'s `[ecosystem]` observation (the 13-tool
"Dicklesworthstone Stack"/"FrankenSuite") shows the shape.

### Note convention for third-party-tap formulae

- **Title:** `brew-<owner>-<tap>-<formula>`. This is exactly what SKILL.md
  Step 0's general "replace every `:`/`/`/`#` with `-`" title rule already
  produces for the two-slash identifier — no special-casing needed beyond
  parsing the identifier correctly (e.g. `brew:dicklesworthstone/tap/br` →
  `brew-dicklesworthstone-tap-br`).
- **Tags:** always add `third-party-tap` and `trust-review` alongside the
  usual topical tags — these mark the note as warranting periodic
  re-review, since a personal/small-org tap carries a different risk profile
  than homebrew-core.
- **Mandatory observations:** `[installation]` (tap name, build-from-source
  vs. pre-built tarball, alternative install paths such as `cargo
  install`/`go install`/direct binary download), `[trust]` (maintainer
  identity, org size, contributor count, star/velocity trend, the license
  cross-check result), and `[security]` (the "third-party taps bypass
  homebrew-core review" boilerplate line, CI hygiene findings, any
  signed-release/SBOM status).

  **Schema-category note:** `schemas/brew_formula.md` does not currently
  declare `installation` or `trust` as picoschema categories — only
  `security` is declared there. Because the schema's `settings.validation`
  is `warn` (not `error`), writing undeclared `[installation]`/`[trust]`
  categories does not block the write or fail `schema_validate` — it is
  exactly what `brew-dicklesworthstone-tap-br` and
  `brew-ataraxy-labs-tap-inspect` already do today, and both notes validate
  clean. This reference deliberately does **not** add `installation`/`trust`
  to the schema file as part of this fix — that is a separate
  schema-evolution decision (`/schema-evolve brew_formula`, once usage
  frequency crosses the addition threshold) and out of scope here. Prefer
  the existing `security` category for security-flavored findings if you'd
  rather stay fully schema-clean today; `[installation]`/`[trust]` remain
  valid, warn-only categories in the interim.

## Resolve GitHub Repository

The `homepage` field usually points to the project website or GitHub repo.
If `homepage` is not a GitHub URL, check `urls.stable.url` — for GitHub-hosted
projects this is often `https://github.com/<owner>/<repo>/archive/...`.

Extract `owner/repo` for use in the changelog step.

> **Forge note:** parse the host first. If it is not `github.com` (e.g.
> `codeberg.org`, `*.sr.ht`), set `repo_forge` and follow
> `../../package-intel/references/forge-fallback.md` per the Step 2
> forge-detection block — `gh`/DeepWiki are GitHub-only.

If neither field resolves to GitHub, fall back to:
```
tavily_search(query="<formula-name> homebrew github repository source")
```

## Security Notes

Homebrew formulae are community-maintained. Security considerations:
- Check `deprecated` and `disabled` fields — deprecated formulae may have unpatched issues
- `conflicts_with` entries often indicate incompatible shared libraries
- `caveats` may contain important post-install warnings (e.g., PATH changes, keg-only status)

A formula being "keg-only" means it's not linked into standard paths to avoid
conflicts with macOS system tools — worth noting in `[compatibility]` observations.
