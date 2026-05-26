export const theme = {
  primary: 'cyan',
  active: 'green',
  muted: 'gray',
  danger: 'red',
  border: 'gray',
  selected: 'cyan',
} as const

export type ThemeColor = (typeof theme)[keyof typeof theme]
