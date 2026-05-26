import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import {
  analyzeClaudeMd,
  createClaudeMd,
  removeClaudeMdBlock,
  buildSentinelBlock,
  parseSentinelBlock,
  isOnlySentinelContent,
  ClaudeMdGuardrailError,
} from '../src/core/claude-md.js'

const TEST_DIR = path.join(os.tmpdir(), `cc-harness-claude-md-test-${process.pid}`)

beforeEach(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true })
})

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true })
})

function claudeMdPath(): string {
  return path.join(TEST_DIR, 'CLAUDE.md')
}

async function writeFile(content: string): Promise<void> {
  await fs.writeFile(claudeMdPath(), content, 'utf-8')
}

const NAME = 'test-harness'
const VERSION = '1.0.0'
const BLOCK_CONTENT = '## Active Harness\nSome content here.'
const FULL_SENTINEL = buildSentinelBlock(NAME, VERSION, BLOCK_CONTENT)

// ─── parseSentinelBlock ───────────────────────────────────────────────────────

describe('parseSentinelBlock', () => {
  it('parses a valid sentinel block', () => {
    const result = parseSentinelBlock(FULL_SENTINEL)
    expect(result).not.toBeNull()
    expect(result?.name).toBe(NAME)
    expect(result?.version).toBe(VERSION)
    expect(result?.inner).toContain('## Active Harness')
  })

  it('returns null for content with no sentinel', () => {
    expect(parseSentinelBlock('# Regular CLAUDE.md\nSome content')).toBeNull()
  })

  it('returns null for start tag without end tag', () => {
    const partial = `<!-- cc-harness:start name="test" version="1.0.0" -->\nContent without end`
    expect(parseSentinelBlock(partial)).toBeNull()
  })

  it('parses sentinel embedded in larger content', () => {
    const content = `# User content\n\n${FULL_SENTINEL}\n\n## More user content`
    const result = parseSentinelBlock(content)
    expect(result?.name).toBe(NAME)
    expect(result?.version).toBe(VERSION)
  })
})

// ─── isOnlySentinelContent ────────────────────────────────────────────────────

describe('isOnlySentinelContent', () => {
  it('returns true when file contains only sentinel block', () => {
    expect(isOnlySentinelContent(FULL_SENTINEL)).toBe(true)
  })

  it('returns true with trailing newline', () => {
    expect(isOnlySentinelContent(FULL_SENTINEL + '\n')).toBe(true)
  })

  it('returns false when there is user content before sentinel', () => {
    const content = `# My CLAUDE.md\n\n${FULL_SENTINEL}`
    expect(isOnlySentinelContent(content)).toBe(false)
  })

  it('returns false when there is user content after sentinel', () => {
    const content = `${FULL_SENTINEL}\n\n## Extra section`
    expect(isOnlySentinelContent(content)).toBe(false)
  })

  it('returns false when content has no sentinel at all', () => {
    expect(isOnlySentinelContent('# Just a regular file')).toBe(false)
  })
})

// ─── analyzeClaudeMd ─────────────────────────────────────────────────────────

describe('analyzeClaudeMd', () => {
  it('reports non-existence when file does not exist', async () => {
    const result = await analyzeClaudeMd(claudeMdPath())
    expect(result.exists).toBe(false)
    expect(result.hasUserContent).toBe(false)
    expect(result.hasSentinelBlock).toBe(false)
  })

  it('reports pure sentinel file (tool-created)', async () => {
    await writeFile(FULL_SENTINEL + '\n')
    const result = await analyzeClaudeMd(claudeMdPath())
    expect(result.exists).toBe(true)
    expect(result.hasSentinelBlock).toBe(true)
    expect(result.hasUserContent).toBe(false)
    expect(result.sentinelName).toBe(NAME)
    expect(result.sentinelVersion).toBe(VERSION)
  })

  it('reports user content + sentinel (mixed file)', async () => {
    await writeFile(`# My Project\n\nSome notes.\n\n${FULL_SENTINEL}`)
    const result = await analyzeClaudeMd(claudeMdPath())
    expect(result.exists).toBe(true)
    expect(result.hasSentinelBlock).toBe(true)
    expect(result.hasUserContent).toBe(true)
  })

  it('reports user content when file has no sentinel', async () => {
    await writeFile('# My CLAUDE.md\n\nUser content only.')
    const result = await analyzeClaudeMd(claudeMdPath())
    expect(result.exists).toBe(true)
    expect(result.hasSentinelBlock).toBe(false)
    expect(result.hasUserContent).toBe(true)
  })

  it('reports sentinel name and version correctly', async () => {
    const block = buildSentinelBlock('my-harness', '2.3.4', 'content')
    await writeFile(block)
    const result = await analyzeClaudeMd(claudeMdPath())
    expect(result.sentinelName).toBe('my-harness')
    expect(result.sentinelVersion).toBe('2.3.4')
  })
})

// ─── createClaudeMd ──────────────────────────────────────────────────────────

describe('createClaudeMd', () => {
  it('creates CLAUDE.md with sentinel block', async () => {
    await createClaudeMd(TEST_DIR, NAME, VERSION, BLOCK_CONTENT)
    const content = await fs.readFile(claudeMdPath(), 'utf-8')
    expect(content).toContain(`<!-- cc-harness:start name="${NAME}" version="${VERSION}" -->`)
    expect(content).toContain(BLOCK_CONTENT)
    expect(content).toContain('<!-- cc-harness:end -->')
  })

  it('created file reports as tool-created (no user content)', async () => {
    await createClaudeMd(TEST_DIR, NAME, VERSION, BLOCK_CONTENT)
    const status = await analyzeClaudeMd(claudeMdPath())
    expect(status.hasUserContent).toBe(false)
    expect(status.hasSentinelBlock).toBe(true)
  })

  it('refuses to write to ~/.claude/CLAUDE.md', async () => {
    const homeClaudeDir = path.join(os.homedir(), '.claude')
    await expect(createClaudeMd(homeClaudeDir, NAME, VERSION, BLOCK_CONTENT)).rejects.toThrow(
      ClaudeMdGuardrailError
    )
  })

  it('refuses to write to ~/.claude/CLAUDE.md via different path forms', async () => {
    // Use os.homedir() directly to construct the global path
    const globalDir = path.join(os.homedir(), '.claude')
    await expect(createClaudeMd(globalDir, NAME, VERSION, BLOCK_CONTENT)).rejects.toThrow(
      ClaudeMdGuardrailError
    )
  })
})

// ─── removeClaudeMdBlock ─────────────────────────────────────────────────────

describe('removeClaudeMdBlock', () => {
  it('removes CLAUDE.md when it contains only the sentinel block', async () => {
    await createClaudeMd(TEST_DIR, NAME, VERSION, BLOCK_CONTENT)
    const result = await removeClaudeMdBlock(TEST_DIR)
    expect(result).toBe('removed')
    const exists = await fs
      .access(claudeMdPath())
      .then(() => true)
      .catch(() => false)
    expect(exists).toBe(false)
  })

  it('returns skipped when CLAUDE.md does not exist', async () => {
    const result = await removeClaudeMdBlock(TEST_DIR)
    expect(result).toBe('skipped')
  })

  it('returns skipped when CLAUDE.md has no sentinel block', async () => {
    await writeFile('# User content\nNo sentinel here.')
    const result = await removeClaudeMdBlock(TEST_DIR)
    expect(result).toBe('skipped')
  })

  it('returns skipped and NEVER modifies mixed file (user content + sentinel)', async () => {
    const mixedContent = `# User content\n\nImportant notes.\n\n${FULL_SENTINEL}`
    await writeFile(mixedContent)
    const result = await removeClaudeMdBlock(TEST_DIR)
    expect(result).toBe('skipped')
    // File must be completely untouched
    const after = await fs.readFile(claudeMdPath(), 'utf-8')
    expect(after).toBe(mixedContent)
  })

  it('refuses to touch ~/.claude/CLAUDE.md', async () => {
    const globalDir = path.join(os.homedir(), '.claude')
    await expect(removeClaudeMdBlock(globalDir)).rejects.toThrow(ClaudeMdGuardrailError)
  })
})

// ─── buildSentinelBlock ──────────────────────────────────────────────────────

describe('buildSentinelBlock', () => {
  it('wraps content with sentinel tags', () => {
    const block = buildSentinelBlock('my-harness', '1.2.3', 'Inner content')
    expect(block).toContain('<!-- cc-harness:start name="my-harness" version="1.2.3" -->')
    expect(block).toContain('Inner content')
    expect(block).toContain('<!-- cc-harness:end -->')
  })
})
