import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import { promises as fs } from 'fs'
import {
  readRegistry,
  writeRegistry,
  addToRegistry,
  removeFromRegistry,
  getRegistryEntry,
  listRegistry,
  cleanStaleEntries,
  type RegistryEntry,
} from '../src/core/registry.js'

// Override the registry location for tests using environment variable
const TEST_HOME = path.join(os.tmpdir(), `cc-harness-test-${process.pid}`)

// Patch os.homedir for tests
const originalHomedir = os.homedir
beforeEach(async () => {
  await fs.mkdir(path.join(TEST_HOME, '.cc-harnesses'), { recursive: true })
  ;(os as { homedir: () => string }).homedir = () => TEST_HOME
})

afterEach(async () => {
  ;(os as { homedir: () => string }).homedir = originalHomedir
  await fs.rm(TEST_HOME, { recursive: true, force: true })
})

function makeEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    name: 'test-harness',
    version: '1.0.0',
    description: 'Test',
    installPath: path.join(TEST_HOME, '.cc-harnesses', 'test-harness'),
    installedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('readRegistry', () => {
  it('returns empty registry when file does not exist', async () => {
    const reg = await readRegistry()
    expect(reg.harnesses).toEqual({})
  })

  it('reads existing registry', async () => {
    const entry = makeEntry()
    const registryPath = path.join(TEST_HOME, '.cc-harnesses', 'registry.json')
    await fs.writeFile(registryPath, JSON.stringify({ harnesses: { 'test-harness': entry } }))
    const reg = await readRegistry()
    expect(reg.harnesses['test-harness']).toMatchObject({ name: 'test-harness' })
  })
})

describe('writeRegistry', () => {
  it('writes registry and can be read back', async () => {
    const entry = makeEntry()
    await writeRegistry({ harnesses: { 'test-harness': entry } })
    const reg = await readRegistry()
    expect(reg.harnesses['test-harness'].name).toBe('test-harness')
  })
})

describe('addToRegistry', () => {
  it('adds a new entry', async () => {
    const entry = makeEntry()
    await addToRegistry(entry)
    const result = await getRegistryEntry('test-harness')
    expect(result?.name).toBe('test-harness')
    expect(result?.version).toBe('1.0.0')
  })

  it('overwrites an existing entry', async () => {
    await addToRegistry(makeEntry({ version: '1.0.0' }))
    await addToRegistry(makeEntry({ version: '2.0.0' }))
    const result = await getRegistryEntry('test-harness')
    expect(result?.version).toBe('2.0.0')
  })
})

describe('removeFromRegistry', () => {
  it('removes an entry', async () => {
    await addToRegistry(makeEntry())
    await removeFromRegistry('test-harness')
    const result = await getRegistryEntry('test-harness')
    expect(result).toBeUndefined()
  })

  it('does not throw when entry does not exist', async () => {
    await expect(removeFromRegistry('nonexistent')).resolves.not.toThrow()
  })
})

describe('listRegistry', () => {
  it('returns empty array when registry is empty', async () => {
    const list = await listRegistry()
    expect(list).toEqual([])
  })

  it('returns all entries', async () => {
    await addToRegistry(makeEntry({ name: 'a' }))
    await addToRegistry(makeEntry({ name: 'b' }))
    const list = await listRegistry()
    const names = list.map((e) => e.name).sort()
    expect(names).toEqual(['a', 'b'])
  })
})

describe('cleanStaleEntries', () => {
  it('removes entries whose install paths no longer exist', async () => {
    const realEntry = makeEntry({ name: 'real' })
    const fakeEntry = makeEntry({
      name: 'stale',
      installPath: path.join(TEST_HOME, 'nonexistent'),
    })
    // Create real install path
    await fs.mkdir(realEntry.installPath, { recursive: true })
    await addToRegistry(realEntry)
    await addToRegistry(fakeEntry)

    const removed = await cleanStaleEntries()
    expect(removed).toContain('stale')
    expect(removed).not.toContain('real')

    const remaining = await listRegistry()
    expect(remaining.map((e) => e.name)).toContain('real')
    expect(remaining.map((e) => e.name)).not.toContain('stale')
  })

  it('returns empty array when nothing is stale', async () => {
    const entry = makeEntry()
    await fs.mkdir(entry.installPath, { recursive: true })
    await addToRegistry(entry)
    const removed = await cleanStaleEntries()
    expect(removed).toEqual([])
  })
})
