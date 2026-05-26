import { promises as fs } from 'fs'
import path from 'path'
import { fileExists, readJsonFile } from '../utils/fs.js'

export interface ActiveHarness {
  name: string
  version: string
}

export class ProjectRootNotFoundError extends Error {
  constructor(cwd: string) {
    super(
      `Could not find a project root from ${cwd}. ` +
        `Make sure you are inside a project that has a .claude/ directory, package.json, or .git`
    )
    this.name = 'ProjectRootNotFoundError'
  }
}

const ACTIVE_HARNESS_FILE = '.cc-harness-active.json'

export async function findProjectRoot(startDir: string = process.cwd()): Promise<string> {
  let current = path.resolve(startDir)

  while (true) {
    const hasClaudeDir = await fileExists(path.join(current, '.claude'))
    const hasPackageJson = await fileExists(path.join(current, 'package.json'))
    const hasGit = await fileExists(path.join(current, '.git'))

    if (hasClaudeDir || hasPackageJson || hasGit) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      // Reached filesystem root
      throw new ProjectRootNotFoundError(startDir)
    }
    current = parent
  }
}

export async function readActiveHarness(projectRoot: string): Promise<ActiveHarness | null> {
  const activePath = path.join(projectRoot, '.claude', ACTIVE_HARNESS_FILE)
  if (!(await fileExists(activePath))) {
    return null
  }
  try {
    return await readJsonFile<ActiveHarness>(activePath)
  } catch (err) {
    throw new Error(`Failed to read active harness state at ${activePath}: ${String(err)}`)
  }
}

export async function writeActiveHarness(
  projectRoot: string,
  harness: ActiveHarness
): Promise<void> {
  const claudeDir = path.join(projectRoot, '.claude')
  await fs.mkdir(claudeDir, { recursive: true })
  const activePath = path.join(claudeDir, ACTIVE_HARNESS_FILE)
  await fs.writeFile(activePath, JSON.stringify(harness, null, 2) + '\n', 'utf-8')
}

export async function clearActiveHarness(projectRoot: string): Promise<void> {
  const activePath = path.join(projectRoot, '.claude', ACTIVE_HARNESS_FILE)
  if (await fileExists(activePath)) {
    await fs.unlink(activePath)
  }
}
