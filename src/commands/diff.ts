import { promises as fs } from 'fs'
import path from 'path'
import { getRegistryEntry } from '../core/registry.js'
import { readManifest } from '../core/manifest.js'
import { findProjectRoot, readActiveHarness } from '../core/project.js'
import { analyzeClaudeMd, buildSentinelBlock } from '../core/claude-md.js'
import { fileExists } from '../utils/fs.js'
import chalk from 'chalk'

export interface DiffResult {
  harnessName: string
  harnessVersion: string
  filesToAdd: string[]
  filesToRemove: string[]
  claudeMdBlock: string
  claudeMdAction: 'would-create' | 'would-print'
  currentActiveHarness: string | null
}

export async function diffCommand(name: string): Promise<DiffResult> {
  const entry = await getRegistryEntry(name)
  if (!entry) {
    throw new Error(
      `Harness "${name}" is not installed. Run: cc-harness list to see installed harnesses.`
    )
  }

  const manifest = await readManifest(entry.installPath)
  const projectRoot = await findProjectRoot()
  const claudeDir = path.join(projectRoot, '.claude')

  const activeHarness = await readActiveHarness(projectRoot)
  const currentActive = activeHarness?.name ?? null

  // Calculate files to add (from the new harness)
  const filesToAdd: string[] = []
  if (manifest.files.commands) {
    const srcCommands = path.join(entry.installPath, manifest.files.commands)
    if (await fileExists(srcCommands)) {
      const files = await listFiles(srcCommands)
      for (const f of files) {
        const rel = path.relative(srcCommands, f)
        const destPath = path.join(claudeDir, 'commands', rel)
        if (!(await fileExists(destPath))) {
          filesToAdd.push(path.join('.claude', 'commands', rel))
        }
      }
    }
  }

  if (manifest.files.skills) {
    const srcSkills = path.join(entry.installPath, manifest.files.skills)
    if (await fileExists(srcSkills)) {
      const files = await listFiles(srcSkills)
      for (const f of files) {
        const rel = path.relative(srcSkills, f)
        const destPath = path.join(claudeDir, 'skills', rel)
        if (!(await fileExists(destPath))) {
          filesToAdd.push(path.join('.claude', 'skills', rel))
        }
      }
    }
  }

  // Calculate files to remove (from the current active harness, if different)
  const filesToRemove: string[] = []
  if (currentActive && currentActive !== name) {
    const prevEntry = await getRegistryEntry(currentActive)
    if (prevEntry && (await fileExists(prevEntry.installPath))) {
      const prevManifest = await readManifest(prevEntry.installPath).catch(() => null)
      if (prevManifest) {
        if (prevManifest.files.commands) {
          const prevSrcCommands = path.join(prevEntry.installPath, prevManifest.files.commands)
          if (await fileExists(prevSrcCommands)) {
            const files = await listFiles(prevSrcCommands)
            for (const f of files) {
              const rel = path.relative(prevSrcCommands, f)
              filesToRemove.push(path.join('.claude', 'commands', rel))
            }
          }
        }
        if (prevManifest.files.skills) {
          const prevSrcSkills = path.join(prevEntry.installPath, prevManifest.files.skills)
          if (await fileExists(prevSrcSkills)) {
            const files = await listFiles(prevSrcSkills)
            for (const f of files) {
              const rel = path.relative(prevSrcSkills, f)
              filesToRemove.push(path.join('.claude', 'skills', rel))
            }
          }
        }
      }
    }
  }

  // CLAUDE.md block
  const blockContentPath = path.join(entry.installPath, manifest.claude_md_block)
  const blockContent = await fs.readFile(blockContentPath, 'utf-8')
  const claudeMdBlock = buildSentinelBlock(manifest.name, manifest.version, blockContent.trim())

  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md')
  const claudeMdStatus = await analyzeClaudeMd(claudeMdPath)
  const claudeMdAction = claudeMdStatus.exists ? 'would-print' : 'would-create'

  return {
    harnessName: manifest.name,
    harnessVersion: manifest.version,
    filesToAdd,
    filesToRemove,
    claudeMdBlock,
    claudeMdAction,
    currentActiveHarness: currentActive,
  }
}

export function printDiff(result: DiffResult): void {
  console.log(`\nDiff for: ${chalk.cyan(result.harnessName)} v${result.harnessVersion}`)

  if (result.currentActiveHarness && result.currentActiveHarness !== result.harnessName) {
    console.log(chalk.yellow(`\n  Replaces active harness: ${result.currentActiveHarness}`))
  }

  if (result.filesToRemove.length > 0) {
    console.log(chalk.red('\n  Files to remove:'))
    for (const f of result.filesToRemove) {
      console.log(chalk.red(`    - ${f}`))
    }
  }

  if (result.filesToAdd.length > 0) {
    console.log(chalk.green('\n  Files to add:'))
    for (const f of result.filesToAdd) {
      console.log(chalk.green(`    + ${f}`))
    }
  }

  if (result.filesToAdd.length === 0 && result.filesToRemove.length === 0) {
    console.log('\n  No file changes.')
  }

  const claudeAction =
    result.claudeMdAction === 'would-create'
      ? chalk.green('  CLAUDE.md: would create with harness block')
      : chalk.yellow('  CLAUDE.md: already exists — would print block for manual paste')

  console.log('\n' + claudeAction)
  console.log('\n  Harness block:\n')
  console.log(result.claudeMdBlock.split('\n').map((l) => `    ${l}`).join('\n'))
  console.log()
}

async function listFiles(dir: string): Promise<string[]> {
  const results: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await listFiles(full)))
    } else {
      results.push(full)
    }
  }
  return results
}
