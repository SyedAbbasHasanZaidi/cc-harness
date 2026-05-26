import { promises as fs } from 'fs'
import path from 'path'
import { getRegistryEntry } from '../core/registry.js'
import { readManifest } from '../core/manifest.js'
import { findProjectRoot, readActiveHarness, clearActiveHarness } from '../core/project.js'
import { analyzeClaudeMd, removeClaudeMdBlock } from '../core/claude-md.js'
import { fileExists } from '../utils/fs.js'
import { logger } from '../utils/logger.js'

export interface UnlinkResult {
  projectRoot: string
  unlinkedName: string
  claudeMdAction: 'removed' | 'print-instructions' | 'skipped'
  claudeMdInstructions?: string
}

export async function unlinkCommand(): Promise<UnlinkResult> {
  const projectRoot = await findProjectRoot()
  const activeHarness = await readActiveHarness(projectRoot)

  if (!activeHarness) {
    throw new Error('No harness is currently active in this project.')
  }

  const claudeDir = path.join(projectRoot, '.claude')
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md')

  // Remove harness files from .claude/
  const entry = await getRegistryEntry(activeHarness.name)
  if (entry && (await fileExists(entry.installPath))) {
    const manifest = await readManifest(entry.installPath).catch(() => null)
    if (manifest) {
      if (manifest.files.commands) {
        const srcCommands = path.join(entry.installPath, manifest.files.commands)
        const destCommands = path.join(claudeDir, 'commands')
        await removeHarnessFiles(srcCommands, destCommands)
      }
      if (manifest.files.skills) {
        const srcSkills = path.join(entry.installPath, manifest.files.skills)
        const destSkills = path.join(claudeDir, 'skills')
        await removeHarnessFiles(srcSkills, destSkills)
      }
    }
  }

  // Clear active harness state
  await clearActiveHarness(projectRoot)

  // Handle CLAUDE.md
  const claudeMdStatus = await analyzeClaudeMd(claudeMdPath)
  let claudeMdAction: 'removed' | 'print-instructions' | 'skipped'
  let claudeMdInstructions: string | undefined

  if (!claudeMdStatus.exists) {
    claudeMdAction = 'skipped'
  } else if (claudeMdStatus.hasSentinelBlock && !claudeMdStatus.hasUserContent) {
    // Tool-created file — safe to remove
    const result = await removeClaudeMdBlock(projectRoot)
    claudeMdAction = result === 'removed' ? 'removed' : 'skipped'
    if (claudeMdAction === 'removed') {
      logger.info('Removed CLAUDE.md (was created by cc-harness)')
    }
  } else if (claudeMdStatus.hasSentinelBlock && claudeMdStatus.hasUserContent) {
    // Mixed file — print instructions, never touch it
    claudeMdAction = 'print-instructions'
    claudeMdInstructions =
      `Your CLAUDE.md has user content mixed with the harness block.\n` +
      `Remove this block manually:\n\n` +
      `  <!-- cc-harness:start name="${claudeMdStatus.sentinelName}" version="${claudeMdStatus.sentinelVersion}" -->\n` +
      `  ...\n` +
      `  <!-- cc-harness:end -->`
  } else {
    claudeMdAction = 'skipped'
  }

  logger.success('Unlinked. .claude/ is clean.')

  return {
    projectRoot,
    unlinkedName: activeHarness.name,
    claudeMdAction,
    claudeMdInstructions,
  }
}

async function removeHarnessFiles(srcDir: string, destDir: string): Promise<void> {
  if (!(await fileExists(srcDir)) || !(await fileExists(destDir))) return

  const entries = await fs.readdir(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const destPath = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      await removeHarnessFiles(path.join(srcDir, entry.name), destPath)
    } else if (await fileExists(destPath)) {
      await fs.unlink(destPath)
    }
  }
}
