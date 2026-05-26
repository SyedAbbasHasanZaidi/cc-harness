import React from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from './theme.js'
import type { RegistryEntry } from '../core/registry.js'

interface HarnessListProps {
  harnesses: RegistryEntry[]
  selectedIndex: number
  activeHarnessName: string | null
  onSelect: (index: number) => void
}

export function HarnessList({
  harnesses,
  selectedIndex,
  activeHarnessName,
  onSelect,
}: HarnessListProps): React.ReactElement {
  useInput((_input, key) => {
    if (key.upArrow && selectedIndex > 0) {
      onSelect(selectedIndex - 1)
    } else if (key.downArrow && selectedIndex < harnesses.length - 1) {
      onSelect(selectedIndex + 1)
    }
  })

  if (harnesses.length === 0) {
    return (
      <Box flexDirection="column" width={24} borderStyle="single" borderColor={theme.border} paddingX={1}>
        <Text bold color={theme.primary}>INSTALLED HARNESSES</Text>
        <Text color={theme.muted}>No harnesses installed.</Text>
        <Text color={theme.muted}>Press i to install.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width={24} borderStyle="single" borderColor={theme.border} paddingX={1}>
      <Text bold color={theme.primary}>INSTALLED HARNESSES</Text>
      {harnesses.map((h, i) => {
        const isSelected = i === selectedIndex
        const isActive = h.name === activeHarnessName
        const prefix = isSelected ? '▶ ' : '  '
        const nameColor = isSelected ? theme.selected : undefined
        return (
          <Box key={h.name}>
            <Text color={nameColor}>
              {prefix}
              {h.name}
              {isActive ? <Text color={theme.active}> ●</Text> : null}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
