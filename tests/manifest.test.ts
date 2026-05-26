import { describe, it, expect } from 'vitest'
import { validateManifest, ManifestValidationError } from '../src/core/manifest.js'

describe('validateManifest', () => {
  const validManifest = {
    name: 'test-harness',
    version: '1.0.0',
    description: 'A test harness',
    author: '@test',
    files: {
      commands: 'commands/',
      skills: 'skills/',
    },
    claude_md_block: 'claude-block.md',
  }

  it('accepts a valid manifest', () => {
    const result = validateManifest(validManifest)
    expect(result.name).toBe('test-harness')
    expect(result.version).toBe('1.0.0')
    expect(result.description).toBe('A test harness')
    expect(result.author).toBe('@test')
    expect(result.files.commands).toBe('commands/')
    expect(result.files.skills).toBe('skills/')
    expect(result.claude_md_block).toBe('claude-block.md')
  })

  it('accepts manifest without author', () => {
    const { author: _a, ...withoutAuthor } = validManifest
    const result = validateManifest(withoutAuthor)
    expect(result.author).toBeUndefined()
  })

  it('accepts manifest without files.commands', () => {
    const m = { ...validManifest, files: { skills: 'skills/' } }
    const result = validateManifest(m)
    expect(result.files.commands).toBeUndefined()
    expect(result.files.skills).toBe('skills/')
  })

  it('accepts manifest without files.skills', () => {
    const m = { ...validManifest, files: { commands: 'commands/' } }
    const result = validateManifest(m)
    expect(result.files.skills).toBeUndefined()
  })

  it('rejects null', () => {
    expect(() => validateManifest(null)).toThrow(ManifestValidationError)
  })

  it('rejects non-object', () => {
    expect(() => validateManifest('string')).toThrow(ManifestValidationError)
  })

  it('rejects missing name', () => {
    const { name: _n, ...noName } = validManifest
    expect(() => validateManifest(noName)).toThrow(ManifestValidationError)
  })

  it('rejects empty name', () => {
    expect(() => validateManifest({ ...validManifest, name: '' })).toThrow(ManifestValidationError)
  })

  it('rejects non-string name', () => {
    expect(() => validateManifest({ ...validManifest, name: 123 })).toThrow(ManifestValidationError)
  })

  it('rejects missing version', () => {
    const { version: _v, ...noVersion } = validManifest
    expect(() => validateManifest(noVersion)).toThrow(ManifestValidationError)
  })

  it('rejects missing description', () => {
    const { description: _d, ...noDesc } = validManifest
    expect(() => validateManifest(noDesc)).toThrow(ManifestValidationError)
  })

  it('rejects missing claude_md_block', () => {
    const { claude_md_block: _c, ...noBlock } = validManifest
    expect(() => validateManifest(noBlock)).toThrow(ManifestValidationError)
  })

  it('rejects empty claude_md_block', () => {
    expect(() => validateManifest({ ...validManifest, claude_md_block: '' })).toThrow(
      ManifestValidationError
    )
  })

  it('rejects null files', () => {
    expect(() => validateManifest({ ...validManifest, files: null })).toThrow(
      ManifestValidationError
    )
  })

  it('rejects non-string files.commands', () => {
    expect(() =>
      validateManifest({ ...validManifest, files: { commands: 123, skills: 'skills/' } })
    ).toThrow(ManifestValidationError)
  })

  it('rejects non-string files.skills', () => {
    expect(() =>
      validateManifest({ ...validManifest, files: { commands: 'commands/', skills: 99 } })
    ).toThrow(ManifestValidationError)
  })
})
