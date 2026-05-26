import React from 'react'
import { render } from 'ink'
import { App } from '../ui/App.js'

export async function uiCommand(): Promise<void> {
  const { waitUntilExit } = render(React.createElement(App))
  await waitUntilExit()
}
