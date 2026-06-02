// Fixture self-test for lib/mdast.mjs collectScannableText — the prose-vs-fenced
// split that powers validate-plugin.mjs auditToolReferences. Proves the
// migration's actual value: a token in a fenced block (any backtick depth, incl.
// the tilde and 4-backtick-nested cases the old regex masking leaked) or YAML
// frontmatter is NOT collected, while a prose token AND an inline-backtick token
// ARE (a backticked tool name is a real use in this plugin's convention).

import { collectScannableText } from '../lib/mdast.mjs'

let passed = 0
let failed = 0

/**
 * @param {string} name
 * @param {boolean} cond
 */
function check (name, cond) {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}`)
  }
}

/** @param {string} s */
const scan = (s) => collectScannableText(s).join('\n')
const TOKEN = 'mcp__foo__bar'

console.log('\nmdast: collectScannableText prose/inline vs fenced/frontmatter')
check('prose token IS collected', scan(`Call ${TOKEN} to do the thing.`).includes(TOKEN))
check('inline-code token IS collected (backticked tool ref = a use)', scan('Call `' + TOKEN + '` to do the thing.').includes(TOKEN))
check('fenced-block token is NOT collected', !scan('```\n' + TOKEN + '\n```').includes(TOKEN))
check('tilde-fence token is NOT collected', !scan('~~~\n' + TOKEN + '\n~~~').includes(TOKEN))
check('4-backtick nested-fence token is NOT collected (the regex regression)', !scan('````markdown\n```\n' + TOKEN + '\n```\n````').includes(TOKEN))
check('frontmatter token is NOT collected', !scan('---\ntool: ' + TOKEN + '\n---\n\nBody prose.').includes(TOKEN))
check('prose token survives while a fenced one is masked', (() => {
  const segs = scan(`Prose uses ${TOKEN}.\n\n\`\`\`\nmcp__hidden__tool\n\`\`\``)
  return segs.includes(TOKEN) && !segs.includes('mcp__hidden__tool')
})())

console.log(`\n${passed}/${passed + failed} passed`)
if (failed > 0) process.exit(1)
