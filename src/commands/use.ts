import { promises as fs } from 'fs'
import path from 'path'
import { getRegistryEntry, cleanStaleEntries } from '../core/registry.js'
import { readManifest } from '../core/manifest.js'
import { findProjectRoot, readActiveHarness, writeActiveHarness } from '../core/project.js'
import {
  analyzeClaudeMd,
  createClaudeMd,
  buildSentinelBlock,
} from '../core/claude-md.js'
import { copyDir, ensureDir, fileExists } from '../utils/fs.js'
import { logger } from '../utils/logger.js'

export interface UseResult {
  projectRoot: string
  harnessName: string
  harnessVersion: string
  claudeMdAction: 'created' | 'print-block'
  claudeMdBlock?: string
}

export async function useCommand(name: string): Promise<UseResult> {
  // Check for stale registry entries
  const stale = await cleanStaleEntries()
  if (stale.includes(name)) {
    throw new Error(
      `Harness "${name}" was in the registry but its install directory is missing. ` +
        `Run: cc-harness install <source> to reinstall it.`
    )
  }

  const entry = await getRegistryEntry(name)
  if (!entry) {
    throw new Error(
      `Harness "${name}" is not installed. Run: cc-harness list to see installed harnesses.`
    )
  }

  if (!(await fileExists(entry.installPath))) {
    throw new Error(
      `Harness "${name}" install directory is missing: ${entry.installPath}. ` +
        `Run: cc-harness install <source> to reinstall it.`
    )
  }

  const projectRoot = await findProjectRoot()
  const claudeDir = path.join(projectRoot, '.claude')
  await ensureDir(claudeDir)

  // Deactivate any currently active harness
  const activeHarness = await readActiveHarness(projectRoot)
  if (activeHarness && activeHarness.name !== name) {
    await removeHarnessFiles(projectRoot, activeHarness.name)
    logger.info(`Removed previous harness: ${activeHarness.name}`)
  }

  const manifest = await readManifest(entry.installPath)

  // Copy harness files into .claude/
  if (manifest.files.commands) {
    const srcCommands = path.join(entry.installPath, manifest.files.commands)
    const destCommands = path.join(claudeDir, 'commands')
    if (await fileExists(srcCommands)) {
      await copyHarnessDir(srcCommands, destCommands)
    }
  }

  if (manifest.files.skills) {
    const srcSkills = path.join(entry.installPath, manifest.files.skills)
    const destSkills = path.join(claudeDir, 'skills')
    if (await fileExists(srcSkills)) {
      await copyHarnessDir(srcSkills, destSkills)
    }
  }

  // Write active harness state
  await writeActiveHarness(projectRoot, { name: manifest.name, version: manifest.version })

  // Handle CLAUDE.md
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md')
  const claudeMdStatus = await analyzeClaudeMd(claudeMdPath)

  const blockContentPath = path.join(entry.installPath, manifest.claude_md_block)
  const blockContent = await fs.readFile(blockContentPath, 'utf-8')
  const sentinelBlock = buildSentinelBlock(manifest.name, manifest.version, blockContent.trim())

  let claudeMdAction: 'created' | 'print-block'

  if (!claudeMdStatus.exists) {
    await createClaudeMd(projectRoot, manifest.name, manifest.version, blockContent.trim())
    claudeMdAction = 'created'
    logger.info('Created CLAUDE.md with harness block')
  } else {
    claudeMdAction = 'print-block'
  }

  logger.success(`${manifest.name} activated for this project`)

  return {
    projectRoot,
    harnessName: manifest.name,
    harnessVersion: manifest.version,
    claudeMdAction,
    claudeMdBlock: claudeMdAction === 'print-block' ? sentinelBlock : undefined,
  }
}

async function copyHarnessDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest)
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyHarnessDir(srcPath, destPath)
    } else {
      if (await fileExists(destPath)) {
        // Never overwrite user files — warn and skip
        logger.warn(
          `Skipping ${destPath} — file already exists and was not created by cc-harness`
        )
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }
}

async function removeHarnessFiles(projectRoot: string, harnessName: string): Promise<void> {
  const previousEntry = await getRegistryEntry(harnessName)
  if (!previousEntry) return

  const previousManifest = await readManifest(previousEntry.installPath).catch(() => null)
  if (!previousManifest) return

  const claudeDir = path.join(projectRoot, '.claude')

  if (previousManifest.files.commands) {
    const destCommands = path.join(claudeDir, 'commands')
    if (await fileExists(destCommands)) {
      const srcCommands = path.join(previousEntry.installPath, previousManifest.files.commands)
      await removeHarnessFilesFromDir(srcCommands, destCommands)
    }
  }

  if (previousManifest.files.skills) {
    const destSkills = path.join(claudeDir, 'skills')
    if (await fileExists(destSkills)) {
      const srcSkills = path.join(previousEntry.installPath, previousManifest.files.skills)
      await removeHarnessFilesFromDir(srcSkills, destSkills)
    }
  }
}

async function removeHarnessFilesFromDir(srcDir: string, destDir: string): Promise<void> {
  if (!(await fileExists(srcDir)) || !(await fileExists(destDir))) return

  const entries = await fs.readdir(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const destPath = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      await removeHarnessFilesFromDir(path.join(srcDir, entry.name), destPath)
    } else if (await fileExists(destPath)) {
      await fs.unlink(destPath)
    }
  }
}
