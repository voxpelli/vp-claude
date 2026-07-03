// fourth-wall-check.mjs — runtime consumer for lib/fourth-wall-rules.mjs,
// invoked by hooks/post-bm-write-validate.sh (PostToolUse on write_note /
// edit_note). Before this file existed, the deterministic `detect` patterns
// in the fourth-wall registry only ever ran inside the CI fixture test
// (scripts/check-fourthwall.mjs) — never against a real note write. This is
// the write-time guard: read the note text that was just written on stdin,
// run detectFourthWallViolations against it, print the hits as JSON.
//
// Contract:
//   stdin  - the note text to scan (may be empty)
//   stdout - exactly one JSON object: { "violations": [{ id, name, match }] }
//            (empty array when nothing fires, text is empty, or an error
//            occurs while scanning — this script never throws outward)
//   exit   - always 0. This annotates a write via additionalContext, it must
//            never fail or block the calling hook.

import { detectFourthWallViolations } from '../lib/fourth-wall-rules.mjs'

/**
 * @param {NodeJS.ReadableStream} stream
 * @returns {Promise<string>}
 */
async function readStdin (stream) {
  /** @type {Buffer[]} */
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** @type {{ id: string, name: string, match: string }[]} */
let violations = []
try {
  const text = await readStdin(process.stdin)
  violations = text ? detectFourthWallViolations(text) : []
} catch {
  // Degrade to no violations found — a scanning bug must never surface as a
  // hook failure or block the note write it is only meant to annotate.
  violations = []
}

process.stdout.write(JSON.stringify({ violations }))
