import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from './theme.js'

interface ClaudeMdModalProps {
  block: string
  onDismiss: () => void
}

export function ClaudeMdModal({ block, onDismiss }: ClaudeMdModalProps): React.ReactElement {
  const [copied, setCopied] = useState(false)

  useInput(async (input, key) => {
    if (input === 'c' || input === 'C') {
      try {
        const { default: clipboardy } = await import('clipboardy')
        await clipboardy.write(block)
        setCopied(true)
      } catch {
        // clipboard may not be available in all environments
      }
    } else if (key.return || input === 'd' || input === 'D' || key.escape) {
      onDismiss()
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.primary}
      paddingX={2}
      paddingY={1}
    >
      <Text bold color={theme.primary}>
        CLAUDE.md already exists
      </Text>
      <Text color={theme.muted}>Paste this block into your CLAUDE.md manually:</Text>
      <Text>{' '}</Text>
      <Box
        borderStyle="single"
        borderColor={theme.border}
        paddingX={1}
        flexDirection="column"
      >
        {block.split('\n').map((line, i) => (
          <Text key={i} color="white">
            {line}
          </Text>
        ))}
      </Box>
      <Text>{' '}</Text>
      <Box flexDirection="row" gap={2}>
        <Text color={copied ? theme.active : theme.primary} bold>
          [c] {copied ? 'Copied!' : 'Copy to clipboard'}
        </Text>
        <Text color={theme.muted}>[Enter/d] Done</Text>
      </Box>
    </Box>
  )
}
