import React from 'react'
import { Box, Text } from 'ink'
import { theme } from './theme.js'
import { ActiveBadge } from './ActiveBadge.js'
import type { HarnessManifest } from '../core/manifest.js'

interface HarnessDetailProps {
  manifest: HarnessManifest | null
  isActive: boolean
  skillCount: number
  commandCount: number
  onActivate: () => void
  onDiff: () => void
  onUnlink: () => void
  focusedButton: 'activate' | 'diff' | 'unlink'
  onFocusButton: (btn: 'activate' | 'diff' | 'unlink') => void
}

export function HarnessDetail({
  manifest,
  isActive,
  skillCount,
  commandCount,
  onActivate,
  onDiff,
  onUnlink,
  focusedButton,
  onFocusButton,
}: HarnessDetailProps): React.ReactElement {
  if (!manifest) {
    return (
      <Box flexGrow={1} borderStyle="single" borderColor={theme.border} paddingX={1}>
        <Text color={theme.muted}>Select a harness to view details.</Text>
      </Box>
    )
  }

  function ActionButton({
    label,
    btnKey,
    onPress,
    disabled,
  }: {
    label: string
    btnKey: 'activate' | 'diff' | 'unlink'
    onPress: () => void
    disabled?: boolean
  }): React.ReactElement {
    const isFocused = focusedButton === btnKey
    const color = disabled ? theme.muted : isFocused ? theme.selected : undefined
    return (
      <Box marginRight={1}>
        <Text
          color={color}
          bold={isFocused}
          underline={isFocused}
          onPress={disabled ? undefined : onPress}
        >
          [{label}]
        </Text>
      </Box>
    )
  }

  return (
    <Box flexGrow={1} flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1}>
      <Text bold color={theme.primary}>{manifest.name}</Text>
      <Text color={theme.muted}>v{manifest.version}{manifest.author ? ` · by ${manifest.author}` : ''}</Text>
      <Text>{' '}</Text>
      <Text>{manifest.description}</Text>
      <Text>{' '}</Text>
      <Text>{'Skills:    '}<Text bold>{skillCount}</Text></Text>
      <Text>{'Commands:  '}<Text bold>{commandCount}</Text></Text>
      <Text>{' '}</Text>
      {isActive ? <ActiveBadge /> : <Text color={theme.muted}>Not active in this project</Text>}
      <Text>{' '}</Text>
      <Box flexDirection="row">
        <ActionButton
          label="Activate"
          btnKey="activate"
          onPress={onActivate}
          disabled={isActive}
        />
        <ActionButton label="Diff" btnKey="diff" onPress={onDiff} />
        {isActive && (
          <ActionButton label="Unlink" btnKey="unlink" onPress={onUnlink} />
        )}
      </Box>
      <Text>{' '}</Text>
      <Text color={theme.muted} dimColor>
        tab switch button · enter press · a activate · d diff · u unlink
      </Text>
    </Box>
  )
}
