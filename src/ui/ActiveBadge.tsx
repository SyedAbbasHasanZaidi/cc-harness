import React from 'react'
import { Text } from 'ink'
import { theme } from './theme.js'

export function ActiveBadge(): React.ReactElement {
  return (
    <Text color={theme.active} bold>
      {'● ACTIVE IN THIS PROJECT'}
    </Text>
  )
}
