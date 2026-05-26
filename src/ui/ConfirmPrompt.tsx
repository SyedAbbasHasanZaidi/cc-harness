import React from 'react'
import { Text, useInput } from 'ink'

interface ConfirmPromptProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmPrompt({ message, onConfirm, onCancel }: ConfirmPromptProps): React.ReactElement {
  useInput((input) => {
    if (input === 'y' || input === 'Y') {
      onConfirm()
    } else if (input === 'n' || input === 'N' || input === '') {
      onCancel()
    }
  })

  return (
    <Text>
      {message}{' '}
      <Text color="cyan">(y/n)</Text>
    </Text>
  )
}
