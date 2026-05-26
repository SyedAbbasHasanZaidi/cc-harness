import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { fileExists } from '../utils/fs.js'

const SENTINEL_START = (name: string, version: string) =>
  `<!-- cc-harness:start name="${name}" version="${version}" -->`
const SENTINEL_END = '<!-- cc-harness:end -->'

export interface ClaudeMdStatus {
  exists: boolean
  hasUserContent: boolean
  hasSentinelBlock: boolean
  sentinelName?: string
  sentinelVersion?: string
}

export class ClaudeMdGuardrailError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClaudeMdGuardrailError'
  }
}

function buildBlock(name: string, version: string, blockContent: string): string {
  return `${SENTINEL_START(name, version)}\n${blockContent}\n${SENTINEL_END}`
}

export function parseSentinelBlock(content: string): {
  name: string
  version: string
  inner: string
} | null {
  const startPattern = /<!-- cc-harness:start name="([^"]+)" version="([^"]+)" -->/
  const startMatch = content.match(startPattern)
  if (!startMatch) return null

  const endIdx = content.indexOf(SENTINEL_END)
  if (endIdx === -1) return null

  const startFull = startMatch[0]
  const startIdx = content.indexOf(startFull)
  const inner = content.slice(startIdx + startFull.length, endIdx).trim()

  return {
    name: startMatch[1],
    version: startMatch[2],
    inner,
  }
}

export function isOnlySentinelContent(content: string): boolean {
  const parsed = parseSentinelBlock(content)
  if (!parsed) return false

  const name = parsed.name
  const version = parsed.version
  const sentinelStart = SENTINEL_START(name, version)
  const stripped = content
    .replace(sentinelStart, '')
    .replace(SENTINEL_END, '')
    .replace(parsed.inner, '')
    .trim()

  return stripped === ''
}

export async function analyzeClaudeMd(claudeMdPath: string): Promise<ClaudeMdStatus> {
  if (!(await fileExists(claudeMdPath))) {
    return { exists: false, hasUserContent: false, hasSentinelBlock: false }
  }

  const content = await fs.readFile(claudeMdPath, 'utf-8')
  const parsed = parseSentinelBlock(content)

  if (!parsed) {
    return { exists: true, hasUserContent: true, hasSentinelBlock: false }
  }

  const onlySentinel = isOnlySentinelContent(content)

  return {
    exists: true,
    hasUserContent: !onlySentinel,
    hasSentinelBlock: true,
    sentinelName: parsed.name,
    sentinelVersion: parsed.version,
  }
}

function assertNotGlobalClaude(claudeMdPath: string): void {
  const globalClaudeMd = path.join(os.homedir(), '.claude', 'CLAUDE.md')
  if (path.resolve(claudeMdPath) === path.resolve(globalClaudeMd)) {
    throw new ClaudeMdGuardrailError(
      'SAFETY: Refusing to write to global ~/.claude/CLAUDE.md. ' +
        'cc-harness never modifies the global Claude configuration.'
    )
  }
}

export async function createClaudeMd(
  projectRoot: string,
  harnessName: string,
  harnessVersion: string,
  blockContent: string
): Promise<void> {
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md')
  assertNotGlobalClaude(claudeMdPath)

  const block = buildBlock(harnessName, harnessVersion, blockContent)
  await fs.writeFile(claudeMdPath, block + '\n', 'utf-8')
}

export async function removeClaudeMdBlock(projectRoot: string): Promise<'removed' | 'skipped'> {
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md')
  assertNotGlobalClaude(claudeMdPath)

  const status = await analyzeClaudeMd(claudeMdPath)

  if (!status.exists || !status.hasSentinelBlock) {
    return 'skipped'
  }

  if (status.hasUserContent) {
    // Has user content mixed in — never touch it
    return 'skipped'
  }

  // File contains ONLY the sentinel block — safe to delete
  await fs.unlink(claudeMdPath)
  return 'removed'
}

export function buildSentinelBlock(
  harnessName: string,
  harnessVersion: string,
  blockContent: string
): string {
  return buildBlock(harnessName, harnessVersion, blockContent)
}
