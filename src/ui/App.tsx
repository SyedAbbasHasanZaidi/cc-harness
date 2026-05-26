import React, { useState, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { HarnessList } from './HarnessList.js'
import { HarnessDetail } from './HarnessDetail.js'
import { ConfirmPrompt } from './ConfirmPrompt.js'
import { ClaudeMdModal } from './ClaudeMdModal.js'
import { theme } from './theme.js'
import { listRegistry, type RegistryEntry } from '../core/registry.js'
import { readManifest, type HarnessManifest } from '../core/manifest.js'
import { findProjectRoot, readActiveHarness } from '../core/project.js'
import { useCommand } from '../commands/use.js'
import { unlinkCommand } from '../commands/unlink.js'
import { diffCommand, printDiff } from '../commands/diff.js'
import { promises as fs } from 'fs'
import path from 'path'

type View = 'list' | 'confirm-activate' | 'confirm-unlink' | 'claude-md-modal' | 'diff'

interface AppState {
  harnesses: RegistryEntry[]
  manifests: Map<string, HarnessManifest>
  activeHarnessName: string | null
  projectRoot: string | null
  selectedIndex: number
  view: View
  claudeMdBlock: string | null
  error: string | null
  loading: boolean
  focusedButton: 'activate' | 'diff' | 'unlink'
}

function countFiles(dir: string): Promise<number> {
  return fs.readdir(dir, { withFileTypes: true, recursive: true })
    .then((entries) => entries.filter((e) => !e.isDirectory()).length)
    .catch(() => 0)
}

export function App(): React.ReactElement {
  const { exit } = useApp()

  const [state, setState] = useState<AppState>({
    harnesses: [],
    manifests: new Map(),
    activeHarnessName: null,
    projectRoot: null,
    selectedIndex: 0,
    view: 'list',
    claudeMdBlock: null,
    error: null,
    loading: true,
    focusedButton: 'activate',
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [entries, projectRoot] = await Promise.all([
          listRegistry(),
          findProjectRoot().catch(() => null),
        ])

        let activeHarnessName: string | null = null
        if (projectRoot) {
          const active = await readActiveHarness(projectRoot)
          activeHarnessName = active?.name ?? null
        }

        const manifests = new Map<string, HarnessManifest>()
        for (const entry of entries) {
          try {
            const manifest = await readManifest(entry.installPath)
            manifests.set(entry.name, manifest)
          } catch {
            // Skip entries with invalid manifests
          }
        }

        setState((s) => ({
          ...s,
          harnesses: entries,
          manifests,
          activeHarnessName,
          projectRoot,
          loading: false,
        }))
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
          loading: false,
        }))
      }
    }
    void loadData()
  }, [])

  const selectedHarness = state.harnesses[state.selectedIndex] ?? null
  const selectedManifest = selectedHarness ? state.manifests.get(selectedHarness.name) ?? null : null

  const [skillCount, setSkillCount] = useState(0)
  const [commandCount, setCommandCount] = useState(0)

  useEffect(() => {
    if (!selectedManifest || !selectedHarness) {
      setSkillCount(0)
      setCommandCount(0)
      return
    }
    const entry = state.harnesses.find((h) => h.name === selectedHarness.name)
    if (!entry) return

    async function loadCounts() {
      if (!selectedManifest || !entry) return
      const [s, c] = await Promise.all([
        selectedManifest.files.skills
          ? countFiles(path.join(entry.installPath, selectedManifest.files.skills))
          : Promise.resolve(0),
        selectedManifest.files.commands
          ? countFiles(path.join(entry.installPath, selectedManifest.files.commands))
          : Promise.resolve(0),
      ])
      setSkillCount(s)
      setCommandCount(c)
    }
    void loadCounts()
  }, [selectedHarness?.name, selectedManifest])

  async function handleActivate() {
    if (!selectedHarness) return
    setState((s) => ({ ...s, view: 'confirm-activate' }))
  }

  async function confirmActivate() {
    if (!selectedHarness) return
    try {
      const result = await useCommand(selectedHarness.name)
      setState((s) => ({
        ...s,
        activeHarnessName: selectedHarness.name,
        view: result.claudeMdAction === 'print-block' && result.claudeMdBlock
          ? 'claude-md-modal'
          : 'list',
        claudeMdBlock: result.claudeMdBlock ?? null,
      }))
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : String(err),
        view: 'list',
      }))
    }
  }

  async function handleUnlink() {
    setState((s) => ({ ...s, view: 'confirm-unlink' }))
  }

  async function confirmUnlink() {
    try {
      await unlinkCommand()
      setState((s) => ({ ...s, activeHarnessName: null, view: 'list' }))
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : String(err),
        view: 'list',
      }))
    }
  }

  async function handleDiff() {
    if (!selectedHarness) return
    try {
      const result = await diffCommand(selectedHarness.name)
      printDiff(result)
      setState((s) => ({ ...s, view: 'list' }))
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  }

  useInput((input, key) => {
    if (state.view !== 'list') return

    if (key.escape || input === 'q') {
      exit()
      return
    }

    if (key.upArrow) {
      setState((s) => ({ ...s, selectedIndex: Math.max(0, s.selectedIndex - 1) }))
    } else if (key.downArrow) {
      setState((s) => ({
        ...s,
        selectedIndex: Math.min(s.harnesses.length - 1, s.selectedIndex + 1),
      }))
    } else if (input === 'a' || input === 'A') {
      if (selectedHarness && selectedHarness.name !== state.activeHarnessName) {
        void handleActivate()
      }
    } else if (input === 'd' || input === 'D') {
      if (selectedHarness) void handleDiff()
    } else if (input === 'u' || input === 'U') {
      if (selectedHarness && selectedHarness.name === state.activeHarnessName) {
        void handleUnlink()
      }
    } else if (key.tab) {
      // Cycle button focus
      setState((s) => {
        const isActive = selectedHarness?.name === s.activeHarnessName
        const buttons: Array<'activate' | 'diff' | 'unlink'> = isActive
          ? ['diff', 'unlink']
          : ['activate', 'diff']
        const currentIdx = buttons.indexOf(s.focusedButton)
        const nextIdx = (currentIdx + 1) % buttons.length
        return { ...s, focusedButton: buttons[nextIdx] }
      })
    } else if (key.return) {
      const btn = state.focusedButton
      if (btn === 'activate' && selectedHarness?.name !== state.activeHarnessName) {
        void handleActivate()
      } else if (btn === 'diff') {
        void handleDiff()
      } else if (btn === 'unlink' && selectedHarness?.name === state.activeHarnessName) {
        void handleUnlink()
      }
    }
  })

  if (state.loading) {
    return <Text color={theme.primary}>Loading...</Text>
  }

  if (state.error) {
    return (
      <Box flexDirection="column">
        <Text color={theme.danger}>Error: {state.error}</Text>
        <Text color={theme.muted}>Press q to quit</Text>
      </Box>
    )
  }

  const projectLabel = state.projectRoot
    ? `project: ${state.projectRoot}`
    : 'no project detected'

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="single" borderColor={theme.border} paddingX={1}>
        <Text bold color={theme.primary}>cc-harness</Text>
        <Text color={theme.muted}>{' · '}{projectLabel}</Text>
      </Box>

      {/* Main panels */}
      <Box flexDirection="row">
        <HarnessList
          harnesses={state.harnesses}
          selectedIndex={state.selectedIndex}
          activeHarnessName={state.activeHarnessName}
          onSelect={(index) => setState((s) => ({ ...s, selectedIndex: index }))}
        />
        <HarnessDetail
          manifest={selectedManifest}
          isActive={selectedHarness?.name === state.activeHarnessName}
          skillCount={skillCount}
          commandCount={commandCount}
          onActivate={() => void handleActivate()}
          onDiff={() => void handleDiff()}
          onUnlink={() => void handleUnlink()}
          focusedButton={state.focusedButton}
          onFocusButton={(btn) => setState((s) => ({ ...s, focusedButton: btn }))}
        />
      </Box>

      {/* Status / prompts */}
      {state.view === 'confirm-activate' && selectedHarness && (
        <ConfirmPrompt
          message={`Activate ${selectedHarness.name}?`}
          onConfirm={() => void confirmActivate()}
          onCancel={() => setState((s) => ({ ...s, view: 'list' }))}
        />
      )}

      {state.view === 'confirm-unlink' && (
        <ConfirmPrompt
          message={`Unlink ${state.activeHarnessName}?`}
          onConfirm={() => void confirmUnlink()}
          onCancel={() => setState((s) => ({ ...s, view: 'list' }))}
        />
      )}

      {state.view === 'claude-md-modal' && state.claudeMdBlock && (
        <ClaudeMdModal
          block={state.claudeMdBlock}
          onDismiss={() => setState((s) => ({ ...s, view: 'list', claudeMdBlock: null }))}
        />
      )}

      {/* Footer */}
      {state.view === 'list' && (
        <Box borderStyle="single" borderColor={theme.border} paddingX={1}>
          <Text color={theme.muted}>
            {'↑↓ navigate · a activate · d diff · u unlink · tab switch button · q quit'}
          </Text>
        </Box>
      )}
    </Box>
  )
}
