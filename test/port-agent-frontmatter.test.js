import assert from 'node:assert'
import { describe, it } from 'node:test'

import { parseFrontmatter } from '../scripts/port-agent-frontmatter.mjs'

/**
 * Wrap a frontmatter block the way a real agent file carries it.
 *
 * @param {string} block
 * @returns {string}
 */
const doc = (block) => `---\n${block}\n---\n\nBody text.\n`

describe('port-agent-frontmatter parseFrontmatter', () => {
  it('a bare `tools:` heading a block list captures the list', () => {
    // The regression. The regex required whitespace after the colon, so the
    // canonical YAML form for a list-valued key never matched, the branch that
    // opens a list never fired, and the whole list vanished. Porting
    // agents/raindrop-gardener.md emitted an agent with no tools at all — the
    // exact zero-tool failure agents-pi/ exists to prevent.
    const parsed = parseFrontmatter(doc([
      'name: raindrop-gardener',
      'tools:',
      '  - mcp__raindrop__find_tags',
      '  - mcp__raindrop__find_bookmarks',
    ].join('\n')))
    assert.ok(parsed)
    assert.deepStrictEqual(parsed.frontmatter['tools'], [
      'mcp__raindrop__find_tags',
      'mcp__raindrop__find_bookmarks',
    ])
  })

  it('an inline `key: value` still parses', () => {
    const parsed = parseFrontmatter(doc('name: x\nmodel: sonnet'))
    assert.ok(parsed)
    assert.strictEqual(parsed.frontmatter['name'], 'x')
    assert.strictEqual(parsed.frontmatter['model'], 'sonnet')
  })

  it('a bare URL is not read as a key', () => {
    // The over-match the first fix introduced: `/^([\w-]+):(.*)$/` matches
    // `https://example.com` as key `https`, and a spurious key flushes any
    // pending list — silently truncating it.
    const parsed = parseFrontmatter(doc([
      'name: x',
      'tools:',
      '  - Read',
      'https://example.com',
      '  - Bash',
    ].join('\n')))
    assert.ok(parsed)
    assert.ok(!('https' in parsed.frontmatter), 'a URL must not register as a key')
    // But note what this does NOT fix: any line that is neither a list item nor
    // a key flushes the pending list, so `Bash` is still dropped. That is the
    // parser being conservative about malformed frontmatter rather than the
    // regex mis-firing — a stray line ends the list either way. Asserted here so
    // the limitation is pinned rather than assumed away; ROADMAP #13 carries it.
    assert.deepStrictEqual(parsed.frontmatter['tools'], ['Read'])
  })

  it('a key with no value and no list stays empty rather than swallowing the next key', () => {
    const parsed = parseFrontmatter(doc('name: x\ntools:\ncolor: green'))
    assert.ok(parsed)
    assert.strictEqual(parsed.frontmatter['color'], 'green')
    assert.deepStrictEqual(parsed.frontmatter['tools'], [])
  })

  it('returns null when there is no frontmatter', () => {
    assert.strictEqual(parseFrontmatter('no frontmatter here\n'), null)
  })
})
