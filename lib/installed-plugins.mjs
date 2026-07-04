import { isKeyWithType } from '@voxpelli/typed-utils'

// Pure resolver for the installed-plugin + installed-skill ground truth that
// `/knowledge-gaps --global` (knowledge-gaps Step 7c) audits against Basic Memory
// coverage. Takes pre-read file CONTENT only — scripts/list-installed-plugins.mjs
// does all file I/O. Mirrors lib/staleness-contract.mjs: pure + fixture-tested
// (scripts/check-list-installed-plugins.mjs).
//
// Identifier scheme (round-trips with `/tool-intel plugin:`/`skill:` and the BM note
// title convention `:`/`/`/`#` -> `-`):
//   - per-plugin source {source:'github',repo}    -> plugin:<repo>             (dedicated repo)
//   - per-plugin source "./…" (local string)      -> plugin:<mkt-repo>[#<name>] (marketplace hosts it; #name dropped if namesake)
//   - per-plugin source {source:'git-subdir',url} -> plugin:<owner>/<repo>#<name> (one repo hosts many — always #name)
//   - unresolvable (no marketplace.json / no entry / unknown shape)
//                                                 -> plugin:<name>@<marketplace>, sourceResolved:false
//   - skills: skill:<owner>/<repo>, grouped by lockfile `source` (many dirs -> one note)
//
// Redundant-disambiguator collapse (LOCAL-STRING BRANCH ONLY): the `#<name>` suffix
// picks one plugin out of a multi-artifact repo. For a local-string source — typically
// a single-plugin self-hosted marketplace — when the marketplace repo's last path
// segment equals <name> (e.g. pbakaus/impeccable#impeccable) the suffix disambiguates
// nothing and is dropped: the title collapses to plugin:<repo> (== the dedicated-repo
// form and the cleaner BM note title), stable regardless of marketplace composition.
// The git-subdir branch ALWAYS keeps #<name>: that repo hosts many plugins, so
// collapsing a namesake member would collide with a sibling or a dedicated-repo homonym.
// KNOWN LIMITATION (bd vp-claude-asmm): a *multi-plugin* local-string marketplace whose
// member is named after the marketplace repo also collapses here — a pathological case
// (needs a sub-plugin named after its repo + a colliding dedicated homonym). Gating the
// collapse on plugin-count was rejected: it would make a normal single-plugin namesake's
// title fragile to upstream marketplace growth. See pluginIdentifier().

/**
 * @typedef InstalledRecord
 * @property {string} identifier - plugin:<owner>/<repo>[#<name>] / skill:<owner>/<repo> (or unresolved fallback).
 *   Unique across the array for well-formed inputs; a local-string namesake colliding with a
 *   separately-installed dedicated-repo plugin of the same owner/repo is the SAME underlying repo
 *   (benign). No runtime dedup is applied (a silent merge would hide audit findings, a hard error
 *   would break the audit's graceful-degradation contract) — consumers computing coverage
 *   denominators dedup by `title` (knowledge-gaps Step 8/9).
 * @property {string} title - BM note title: identifier with `:`/`/`/`#` replaced by `-`
 * @property {string|null} installedAt - ISO timestamp (most recent across a grouped skill), or null
 * @property {string[]} members - skill-dir roster sharing this source (skills); [] for plugins
 * @property {boolean} sourceResolved - false when owner/repo could not be determined
 */

/**
 * A marketplace plugin entry's `source` field — a discriminated union (see the
 * L9-14 identifier-scheme comment). A bare string is a local "./…" source; the
 * object arms carry the repo coordinates.
 *
 * The object arms' payloads are typed OPTIONAL because they arrive from
 * `JSON.parse` (untrusted) — a malformed `{source:'github'}` with no `repo` is
 * possible, so the write sites must `typeof`-guard before use (a missing/non-string
 * payload must fall through to the `sourceResolved:false` fallback, not emit
 * `plugin:undefined` as if resolved).
 *
 * A real `git-subdir` source also carries a `path` field (the plugin's
 * subdirectory within the target repo) alongside `url` — deliberately NOT
 * modeled here. This resolver's only job is the `plugin:<owner>/<repo>#<name>`
 * IDENTIFIER (for BM-note coverage matching), which needs just owner/repo +
 * name; it never fetches repo content, so the subdirectory path has no
 * consumer here. `scripts/fetch-plugin-upstream.sh` (a separate script, used
 * by `--stale plugin`) DOES need and read `path`, since it fetches
 * `plugin.json` from the resolved location.
 *
 * @typedef {{ source: 'github', repo?: string } | { source: 'git-subdir', url?: string } | string} PluginSource
 */

/**
 * One plugin entry inside a marketplace.json `plugins` array (only the fields
 * this resolver reads).
 *
 * @typedef {{ name?: string, source?: PluginSource }} MarketplacePluginEntry
 */

/**
 * Parsed marketplace.json (only the fields read here).
 *
 * @typedef {{ plugins?: MarketplacePluginEntry[] }} MarketplaceFile
 */

/**
 * One record under installed_plugins.json `plugins[<key>]` (only the read field).
 *
 * @typedef {{ installedAt?: unknown }} InstalledPluginRecord
 */

/**
 * Parsed installed_plugins.json (only the fields read here).
 *
 * @typedef {{ plugins?: Record<string, InstalledPluginRecord[]> }} InstalledPluginsFile
 */

/**
 * Parsed known_marketplaces.json (only the nested repo field read here).
 *
 * @typedef {Record<string, { source?: { repo?: string } }>} KnownMarketplacesFile
 */

/**
 * Parsed .skill-lock.json (only the fields read here).
 *
 * @typedef {{ skills?: Record<string, { source?: unknown, installedAt?: unknown }> }} SkillLockFile
 */

/**
 * @param {string} identifier
 * @returns {string}
 */
function toTitle (identifier) {
  return identifier.replaceAll(/[:/#]/g, '-')
}

/**
 * @param {string} url
 * @returns {string|null} owner/repo parsed from a GitHub git URL, or a bare
 *   "owner/repo" shorthand with no domain at all — verified real-world shape
 *   (2026-07-04): databricks/databricks-agent-skills's git-subdir `source`
 *   uses `url: "databricks/databricks-agent-skills"`, which the prior
 *   github.com-anchored regex alone would silently fail to match, falling
 *   through to the unresolved `sourceResolved:false` fallback for a plugin
 *   that WAS actually resolvable.
 */
function ownerRepoFromUrl (url) {
  if (/^[^/\s]+\/[^/\s]+$/.test(url)) return url
  const m = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url)
  return m?.[1] ?? null
}

/**
 * Build a plugin identifier for a LOCAL-STRING source, dropping `#<name>` only when
 * the self-hosted marketplace repo's last path segment equals <name> (a single-plugin
 * repo, e.g. pbakaus/impeccable#impeccable -> plugin:pbakaus/impeccable) — the title
 * then matches the dedicated-repo form and the cleaner BM note title. NOT for git-subdir
 * sources: one repo hosts many plugins there, so always keep #<name> to stay distinct
 * from siblings or a dedicated-repo homonym.
 *
 * Comparison is exact (`repoName === name`) by design — a casing mismatch (`Acme/Acme`
 * vs `acme`) keeps the suffix. Do NOT add `toLowerCase`: over-collapse (fusing two real
 * plugins) is worse than under-collapse (the bare-name fallback still matches).
 *
 * @param {string} repo - owner/repo (caller guarantees the `/`)
 * @param {string} name - plugin name
 * @returns {string} `plugin:<repo>` (namesake) or `plugin:<repo>#<name>`
 */
function pluginIdentifier (repo, name) {
  const repoName = repo.slice(repo.lastIndexOf('/') + 1)
  return repoName === name ? `plugin:${repo}` : `plugin:${repo}#${name}`
}

/**
 * Resolve installed plugins to coverage records.
 *
 * @param {string} installedPluginsContent - ~/.claude/plugins/installed_plugins.json
 * @param {string} knownMarketplacesContent - ~/.claude/plugins/known_marketplaces.json
 * @param {Map<string, string>} marketplaceContents - marketplaceName -> its marketplace.json string
 * @returns {InstalledRecord[]}
 */
export function resolveInstalledPlugins (installedPluginsContent, knownMarketplacesContent, marketplaceContents) {
  const installed = /** @type {InstalledPluginsFile} */ (JSON.parse(installedPluginsContent))
  const known = /** @type {KnownMarketplacesFile} */ (JSON.parse(knownMarketplacesContent))
  /** @type {InstalledRecord[]} */
  const out = []
  for (const [key, records] of Object.entries(installed.plugins ?? {})) {
    // Split on the LAST '@' — plugin names don't contain '@' but be defensive.
    const at = key.lastIndexOf('@')
    const name = at === -1 ? key : key.slice(0, at)
    const marketplace = at === -1 ? '' : key.slice(at + 1)
    const first = Array.isArray(records) ? records[0] : undefined
    const installedAt = isKeyWithType(first, 'installedAt', 'string') ? first.installedAt : null

    /** @type {MarketplacePluginEntry | undefined} */
    let entry
    const mpContent = marketplaceContents.get(marketplace)
    if (mpContent) {
      try {
        const mp = /** @type {MarketplaceFile} */ (JSON.parse(mpContent))
        entry = (mp.plugins ?? []).find((p) => p.name === name)
      } catch { entry = undefined }
    }
    const src = entry?.source

    /** @type {string|undefined} */
    let identifier
    if (typeof src === 'string') {
      // Local source ("./", "./plugin", "./plugins/x") — the marketplace repo hosts it.
      // Require a clean owner/repo SHAPE (exactly one slash, non-empty segments, no
      // whitespace), not just truthiness: a slash-less or malformed value ("a/b/c", "/x",
      // "x/", a stray-space value) would make pluginIdentifier emit a structurally-wrong
      // `plugin:…` marked resolved, silently masking a gap. Malformed shapes fall through
      // to the sourceResolved:false fallback. 3+-segment repos are rejected by design —
      // a local-string identifier is owner/repo only.
      const marketplaceSource = known[marketplace]?.source
      if (isKeyWithType(marketplaceSource, 'repo', 'string') && /^[^/\s]+\/[^/\s]+$/.test(marketplaceSource.repo)) {
        identifier = pluginIdentifier(marketplaceSource.repo, name)
      }
    } else if (src && src.source === 'github' && isKeyWithType(src, 'repo', 'string')) {
      identifier = `plugin:${src.repo}` // dedicated repo — no disambiguator needed
    } else if (src?.source === 'git-subdir' && isKeyWithType(src, 'url', 'string')) {
      const or = ownerRepoFromUrl(src.url)
      if (or) identifier = `plugin:${or}#${name}` // one repo hosts many — always keep #name to stay distinct from siblings / a dedicated-repo homonym
    }
    let sourceResolved = true
    if (!identifier) {
      identifier = `plugin:${key}` // name@marketplace fallback; resolve manually
      sourceResolved = false
    }
    out.push({ identifier, title: toTitle(identifier), installedAt, members: [], sourceResolved })
  }
  return out
}

/**
 * Resolve installed skills.sh bundles, grouped by source repo (many dirs -> one note).
 *
 * @param {string} skillLockContent - ~/.agents/.skill-lock.json
 * @returns {InstalledRecord[]}
 */
export function resolveInstalledSkills (skillLockContent) {
  const lock = /** @type {SkillLockFile} */ (JSON.parse(skillLockContent))
  /** @type {Map<string, { members: string[], installedAt: string|null, resolved: boolean }>} */
  const bySource = new Map()
  for (const [dir, info] of Object.entries(lock.skills ?? {})) {
    const source = isKeyWithType(info, 'source', 'string') ? info.source : undefined
    const resolved = source !== undefined && source.length > 0
    // A dir absent from any source groups under a unique key so it stays name-only.
    const groupKey = resolved && source ? source : `\0${dir}`
    const g = bySource.get(groupKey) ?? { members: [], installedAt: null, resolved }
    g.members.push(dir)
    if (isKeyWithType(info, 'installedAt', 'string') && (!g.installedAt || info.installedAt > g.installedAt)) {
      g.installedAt = info.installedAt
    }
    bySource.set(groupKey, g)
  }
  /** @type {InstalledRecord[]} */
  const out = []
  for (const [groupKey, g] of bySource) {
    const identifier = g.resolved ? `skill:${groupKey}` : `skill:${g.members[0]}`
    out.push({ identifier, title: toTitle(identifier), installedAt: g.installedAt, members: g.members.toSorted(), sourceResolved: g.resolved })
  }
  return out
}
