import { Command } from 'commander'
import { installCommand } from './commands/install.js'
import { useCommand } from './commands/use.js'
import { unlinkCommand } from './commands/unlink.js'
import { listCommand, printList } from './commands/list.js'
import { diffCommand, printDiff } from './commands/diff.js'
import { uiCommand } from './commands/ui.js'
import { logger } from './utils/logger.js'

const program = new Command()
program
  .name('cc-harness')
  .description('Package manager and activation layer for Claude Code harnesses')
  .version('0.1.0')

program
  .command('install <source>')
  .description('Install a harness from npm package name or local path')
  .action(async (source: string) => {
    try {
      await installCommand(source)
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

program
  .command('use <name>')
  .description('Activate a harness for the current project')
  .action(async (name: string) => {
    try {
      const result = await useCommand(name)
      if (result.claudeMdAction === 'print-block' && result.claudeMdBlock) {
        logger.warn('CLAUDE.md already exists — paste this block into it manually:\n')
        console.log(result.claudeMdBlock)
      }
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

program
  .command('unlink')
  .description('Deactivate the current project harness')
  .action(async () => {
    try {
      const result = await unlinkCommand()
      if (result.claudeMdAction === 'print-instructions' && result.claudeMdInstructions) {
        logger.warn(result.claudeMdInstructions)
      }
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

program
  .command('list')
  .description('List all installed harnesses')
  .action(async () => {
    try {
      const result = await listCommand()
      printList(result)
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

program
  .command('diff <name>')
  .description('Show what activating a harness would change')
  .action(async (name: string) => {
    try {
      const result = await diffCommand(name)
      printDiff(result)
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

program
  .command('ui')
  .description('Launch the interactive TUI')
  .action(async () => {
    try {
      await uiCommand()
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

program.parse()
