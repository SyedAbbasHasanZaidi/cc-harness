import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

const TEST_BASE = path.join(os.tmpdir(), `cc-harness-use-unlink-${process.pid}`)
const TEST_HOME = path.join(TEST_BASE, 'home')
const TEST_PROJECT = path.join(TEST_BASE, 'project')

// ─── Module mocking setup ─────────────────────────────────────────────────────
// We mock os.homedir so registry writes go to our test home
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>()
  return {
    ...actual,
    default: {
      ...actual,
      homedir: () => TEST_HOME,
    },
  }
})

// Mock process.cwd to return our test project
vi.mock('../src/core/project.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/project.js')>()
  return {
    ...actual,
    findProjectRoot: async () => TEST_PROJECT,
  }
})

import { useCommand } from '../src/commands/use.js'
import { unlinkCommand } from '../src/commands/unlink.js'
import { installCommand } from '../src/commands/install.js'
import { readActiveHarness } from '../src/core/project.js'
import { analyzeClaudeMd } from '../src/core/claude-md.js'

// Path to our sample harness for testing
const SAMPLE_HARNESS = path.join(process.cwd(), 'sample-harness')

async function setupSampleHarness(): Promise<void> {
  const harnessDir = path.join(TEST_BASE, 'test-harness-src')
  await fs.mkdir(path.join(harnessDir, 'commands'), { recursive: true })
  await fs.mkdir(path.join(harnessDir, 'skills'), { recursive: true })

  await fs.writeFile(
    path.join(harnessDir, 'cc-harness.json'),
    JSON.stringify({
      name: 'test-harness',
      version: '0.1.0',
      description: 'A test harness',
      files: { commands: 'commands/', skills: 'skills/' },
      claude_md_block: 'claude-block.md',
    })
  )
  await fs.writeFile(path.join(harnessDir, 'claude-block.md'), '## Test Harness\nContent here.')
  await fs.writeFile(path.join(harnessDir, 'commands', 'review.md'), '# Review command')
  await fs.writeFile(path.join(harnessDir, 'skills', 'coding.md'), '# Coding skill')

  return installCommand(harnessDir)
}

beforeEach(async () => {
  await fs.mkdir(TEST_HOME, { recursive: true })
  await fs.mkdir(path.join(TEST_PROJECT, '.claude'), { recursive: true })
  await fs.mkdir(path.join(TEST_HOME, '.cc-harnesses'), { recursive: true })
  await setupSampleHarness()
})

afterEach(async () => {
  vi.clearAllMocks()
  await fs.rm(TEST_BASE, { recursive: true, force: true })
})

// ─── use command ──────────────────────────────────────────────────────────────

describe('useCommand', () => {
  it('activates a harness and copies files', async () => {
    const result = await useCommand('test-harness')
    expect(result.harnessName).toBe('test-harness')
    expect(result.harnessVersion).toBe('0.1.0')
    expect(result.claudeMdAction).toBe('created')

    // Files should be copied
    const commandsExist = await fs
      .access(path.join(TEST_PROJECT, '.claude', 'commands', 'review.md'))
      .then(() => true)
      .catch(() => false)
    expect(commandsExist).toBe(true)

    const skillsExist = await fs
      .access(path.join(TEST_PROJECT, '.claude', 'skills', 'coding.md'))
      .then(() => true)
      .catch(() => false)
    expect(skillsExist).toBe(true)
  })

  it('writes active harness state', async () => {
    await useCommand('test-harness')
    const active = await readActiveHarness(TEST_PROJECT)
    expect(active?.name).toBe('test-harness')
    expect(active?.version).toBe('0.1.0')
  })

  it('creates CLAUDE.md when it does not exist', async () => {
    const result = await useCommand('test-harness')
    expect(result.claudeMdAction).toBe('created')

    const claudeMdPath = path.join(TEST_PROJECT, 'CLAUDE.md')
    const status = await analyzeClaudeMd(claudeMdPath)
    expect(status.exists).toBe(true)
    expect(status.hasSentinelBlock).toBe(true)
    expect(status.hasUserContent).toBe(false)
  })

  it('prints block when CLAUDE.md already exists with user content', async () => {
    const claudeMdPath = path.join(TEST_PROJECT, 'CLAUDE.md')
    await fs.writeFile(claudeMdPath, '# Existing user content\n\nImportant notes.')

    const result = await useCommand('test-harness')
    expect(result.claudeMdAction).toBe('print-block')
    expect(result.claudeMdBlock).toContain('cc-harness:start')

    // CLAUDE.md must NOT be modified
    const content = await fs.readFile(claudeMdPath, 'utf-8')
    expect(content).toBe('# Existing user content\n\nImportant notes.')
  })

  it('throws when harness is not installed', async () => {
    await expect(useCommand('nonexistent')).rejects.toThrow('not installed')
  })
})

// ─── unlink command ───────────────────────────────────────────────────────────

describe('unlinkCommand', () => {
  it('removes harness files and clears active state', async () => {
    await useCommand('test-harness')
    const result = await unlinkCommand()

    expect(result.unlinkedName).toBe('test-harness')

    const active = await readActiveHarness(TEST_PROJECT)
    expect(active).toBeNull()

    // Files should be removed
    const commandsExist = await fs
      .access(path.join(TEST_PROJECT, '.claude', 'commands', 'review.md'))
      .then(() => true)
      .catch(() => false)
    expect(commandsExist).toBe(false)
  })

  it('removes tool-created CLAUDE.md', async () => {
    await useCommand('test-harness')
    const result = await unlinkCommand()
    expect(result.claudeMdAction).toBe('removed')

    const claudeMdPath = path.join(TEST_PROJECT, 'CLAUDE.md')
    const exists = await fs
      .access(claudeMdPath)
      .then(() => true)
      .catch(() => false)
    expect(exists).toBe(false)
  })

  it('prints instructions for mixed CLAUDE.md', async () => {
    // Create a CLAUDE.md with user content, then activate harness to add sentinel
    const claudeMdPath = path.join(TEST_PROJECT, 'CLAUDE.md')
    await fs.writeFile(claudeMdPath, '# User content\n\nImportant.')

    await useCommand('test-harness') // won't modify CLAUDE.md — prints block
    // Manually add the sentinel to simulate mixed content
    const current = await fs.readFile(claudeMdPath, 'utf-8')
    const sentinel =
      '<!-- cc-harness:start name="test-harness" version="0.1.0" -->\n## Harness\n<!-- cc-harness:end -->'
    await fs.writeFile(claudeMdPath, current + '\n\n' + sentinel)

    const result = await unlinkCommand()
    expect(result.claudeMdAction).toBe('print-instructions')
    expect(result.claudeMdInstructions).toContain('manually')

    // File must be untouched
    const after = await fs.readFile(claudeMdPath, 'utf-8')
    expect(after).toContain('User content')
    expect(after).toContain('cc-harness:start')
  })

  it('throws when no harness is active', async () => {
    await expect(unlinkCommand()).rejects.toThrow('No harness is currently active')
  })
})

// ─── Full integration: install → use → unlink → clean ─────────────────────────

describe('integration: install → use → unlink', () => {
  it('leaves .claude/ clean after the full cycle', async () => {
    await useCommand('test-harness')

    // Verify harness is active
    const activeBeforeUnlink = await readActiveHarness(TEST_PROJECT)
    expect(activeBeforeUnlink?.name).toBe('test-harness')

    await unlinkCommand()

    // Active state cleared
    const activeAfterUnlink = await readActiveHarness(TEST_PROJECT)
    expect(activeAfterUnlink).toBeNull()

    // Commands and skills removed
    const commandFile = path.join(TEST_PROJECT, '.claude', 'commands', 'review.md')
    const skillFile = path.join(TEST_PROJECT, '.claude', 'skills', 'coding.md')

    const commandExists = await fs
      .access(commandFile)
      .then(() => true)
      .catch(() => false)
    const skillExists = await fs
      .access(skillFile)
      .then(() => true)
      .catch(() => false)

    expect(commandExists).toBe(false)
    expect(skillExists).toBe(false)
  })
})
