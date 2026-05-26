import { listRegistry } from '../core/registry.js'
import { findProjectRoot, readActiveHarness } from '../core/project.js'
import { logger } from '../utils/logger.js'
import chalk from 'chalk'

export interface ListResult {
  harnesses: Array<{
    name: string
    version: string
    description: string
    isActive: boolean
  }>
  activeInProject: string | null
}

export async function listCommand(): Promise<ListResult> {
  const entries = await listRegistry()

  let activeHarness: string | null = null
  try {
    const projectRoot = await findProjectRoot()
    const active = await readActiveHarness(projectRoot)
    activeHarness = active?.name ?? null
  } catch {
    // Not in a project — that's fine for list
  }

  const harnesses = entries.map((entry) => ({
    name: entry.name,
    version: entry.version,
    description: entry.description,
    isActive: entry.name === activeHarness,
  }))

  return { harnesses, activeInProject: activeHarness }
}

export function printList(result: ListResult): void {
  if (result.harnesses.length === 0) {
    logger.info('No harnesses installed. Run: cc-harness install <source>')
    return
  }

  console.log('\nInstalled harnesses:')
  for (const h of result.harnesses) {
    const activeBadge = h.isActive ? chalk.green('  [ACTIVE in this project]') : ''
    const name = h.isActive ? chalk.cyan(h.name) : h.name
    console.log(`  ${name}   ${chalk.gray('v' + h.version)}${activeBadge}`)
  }
  console.log()
}
