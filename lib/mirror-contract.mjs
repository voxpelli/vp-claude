// Mirror-block contract — enforces that prose blocks deliberately duplicated
// across files stay byte-identical. A mirrored block is delimited by paired
// `<!-- mirror:start <id> -->` / `<!-- mirror:end <id> -->` comments; every file
// carrying the same <id> must hold identical content between its markers. This
// replaces the honor-system "mirrored in X — update both" comments with a CI
// guard (the verify-before-capture block drifted across three skills precisely
// because nothing enforced the duplication), WITHOUT merging the sources — some
// blocks are intentionally inlined per skill rather than externalized.
//
// Pure functions, fixture-tested by scripts/check-mirror.mjs. Explicit
// start/end markers (not inferred block boundaries) keep extraction robust.

/**
 * Extract mirror blocks from one file's content.
 * @param {string} content
 * @returns {Map<string, string>} id → block text (between the markers, exclusive)
 * @throws {Error} if the same id appears twice in ONE file — the per-file Map would
 *   silently overwrite the first block, masking a copy-paste error in the markers.
 */
export function extractMirrorBlocks (content) {
  /** @type {Map<string, string>} */
  const blocks = new Map()
  // The back-reference \1 ties end to the matching start id.
  const re = /<!-- mirror:start (\S+) -->\n([\s\S]*?)\n<!-- mirror:end \1 -->/g
  let m
  while ((m = re.exec(content)) !== null) {
    if (blocks.has(m[1])) {
      throw new Error(`mirror: duplicate id "${m[1]}" in one file — each id may appear at most once per file`)
    }
    blocks.set(m[1], m[2])
  }
  return blocks
}

/**
 * Compare mirror blocks collected across files: every group needs ≥2 members
 * and all members must be byte-identical.
 * @param {{ file: string, id: string, text: string }[]} collected
 * @returns {string[]} one error per lonely or divergent group
 */
export function compareMirrorGroups (collected) {
  /** @type {Map<string, { file: string, text: string }[]>} */
  const byId = new Map()
  for (const { file, id, text } of collected) {
    const arr = byId.get(id) ?? []
    arr.push({ file, text })
    byId.set(id, arr)
  }
  /** @type {string[]} */
  const errors = []
  for (const [id, members] of byId) {
    if (members.length < 2) {
      errors.push(`mirror group "${id}" has only ${members.length} member (${members.map((x) => x.file).join(', ')}) — a mirror needs 2+, or the marker is stale`)
      continue
    }
    const [first, ...rest] = members
    for (const mem of rest) {
      if (mem.text !== first.text) {
        errors.push(`mirror group "${id}" diverged: ${first.file} vs ${mem.file} — re-sync the block (it carries mirror:start/end markers)`)
      }
    }
  }
  return errors
}
