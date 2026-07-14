import assert from 'node:assert'
import { describe, it } from 'node:test'

import extension, {
  buildGraphGuidance,
  buildMappingGuidance,
  classifyBmError,
  hasVpKnowledgeSkill,
} from '../extensions/index.js'

describe('vp-knowledge-pi extension', () => {
  it('exports a factory function', () => {
    assert.strictEqual(typeof extension, 'function')
  })

  it('hasVpKnowledgeSkill returns false for empty skills', () => {
    assert.strictEqual(hasVpKnowledgeSkill(), false)
    assert.strictEqual(hasVpKnowledgeSkill([]), false)
  })

  it('hasVpKnowledgeSkill returns true for vp-knowledge skills', () => {
    assert.strictEqual(hasVpKnowledgeSkill([{ name: 'package-intel' }]), true)
    assert.strictEqual(hasVpKnowledgeSkill([{ name: 'knowledge-prime' }]), true)
  })

  it('hasVpKnowledgeSkill returns false for unrelated skills', () => {
    assert.strictEqual(hasVpKnowledgeSkill([{ name: 'some-other-skill' }]), false)
  })

  it('buildMappingGuidance contains basic_memory_write_note mapping', () => {
    const guidance = buildMappingGuidance()
    assert.ok(guidance.includes('basic_memory_write_note'))
    assert.ok(guidance.includes('mcp__basic-memory__write_note'))
  })

  it('buildMappingGuidance is a non-empty string', () => {
    const guidance = buildMappingGuidance()
    assert.strictEqual(typeof guidance, 'string')
    assert.ok(guidance.length > 100)
  })

  it('buildGraphGuidance is a non-empty string', () => {
    const guidance = buildGraphGuidance()
    assert.strictEqual(typeof guidance, 'string')
    assert.ok(guidance.length > 100)
  })

  it('classifyBmError categorizes schema violations', () => {
    assert.strictEqual(classifyBmError('schema validation failed'), 'schema-violation')
    assert.strictEqual(classifyBmError('ValidationError: foo'), 'schema-violation')
  })

  it('classifyBmError categorizes missing targets', () => {
    assert.strictEqual(classifyBmError('does not exist'), 'missing-target')
    assert.strictEqual(classifyBmError('No such file'), 'missing-target')
  })

  it('classifyBmError categorizes conflicts', () => {
    assert.strictEqual(classifyBmError('already exists'), 'conflict')
    assert.strictEqual(classifyBmError('duplicate entry'), 'conflict')
  })

  it('classifyBmError categorizes permissions', () => {
    assert.strictEqual(classifyBmError('permission denied'), 'permission')
    assert.strictEqual(classifyBmError('unauthorized'), 'permission')
  })

  it('classifyBmError categorizes transient errors', () => {
    assert.strictEqual(classifyBmError('timeout'), 'transient')
    assert.strictEqual(classifyBmError('ETIMEDOUT'), 'transient')
  })

  it('classifyBmError returns unknown for unrecognized errors', () => {
    assert.strictEqual(classifyBmError('something weird happened'), 'unknown')
  })
})
