#!/usr/bin/env node
import { Command } from 'commander'

const program = new Command()
program
  .name('cc-harness')
  .description('Package manager and activation layer for Claude Code harnesses')
  .version('0.1.0')

program
  .command('install <source>')
  .description('Install a harness from npm package name or local path')
  .action((source: string) => {
    console.log(`[install] not yet implemented — source: ${source}`)
  })

program
  .command('use <name>')
  .description('Activate a harness for the current project')
  .action((name: string) => {
    console.log(`[use] not yet implemented — name: ${name}`)
  })

program
  .command('unlink')
  .description('Deactivate the current project harness')
  .action(() => {
    console.log('[unlink] not yet implemented')
  })

program
  .command('list')
  .description('List all installed harnesses')
  .action(() => {
    console.log('[list] not yet implemented')
  })

program
  .command('diff <name>')
  .description('Show what activating a harness would change')
  .action((name: string) => {
    console.log(`[diff] not yet implemented — name: ${name}`)
  })

program
  .command('ui')
  .description('Launch the interactive TUI')
  .action(() => {
    console.log('[ui] not yet implemented')
  })

program.parse()
