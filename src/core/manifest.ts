import path from 'path'
import { readJsonFile } from '../utils/fs.js'

export interface HarnessFiles {
  commands?: string
  skills?: string
}

export interface HarnessManifest {
  name: string
  version: string
  description: string
  author?: string
  files: HarnessFiles
  claude_md_block: string
}

export class ManifestValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestValidationError'
  }
}

export async function readManifest(harnessDir: string): Promise<HarnessManifest> {
  const manifestPath = path.join(harnessDir, 'cc-harness.json')
  let raw: unknown
  try {
    raw = await readJsonFile<unknown>(manifestPath)
  } catch (err) {
    throw new ManifestValidationError(
      `Could not read cc-harness.json at ${manifestPath}: ${String(err)}`
    )
  }
  return validateManifest(raw)
}

export function validateManifest(raw: unknown): HarnessManifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new ManifestValidationError('cc-harness.json must be a JSON object')
  }

  const obj = raw as Record<string, unknown>

  if (typeof obj['name'] !== 'string' || !obj['name']) {
    throw new ManifestValidationError('cc-harness.json: "name" must be a non-empty string')
  }
  if (typeof obj['version'] !== 'string' || !obj['version']) {
    throw new ManifestValidationError('cc-harness.json: "version" must be a non-empty string')
  }
  if (typeof obj['description'] !== 'string') {
    throw new ManifestValidationError('cc-harness.json: "description" must be a string')
  }
  if (typeof obj['claude_md_block'] !== 'string' || !obj['claude_md_block']) {
    throw new ManifestValidationError(
      'cc-harness.json: "claude_md_block" must be a non-empty string (path to markdown file)'
    )
  }

  if (typeof obj['files'] !== 'object' || obj['files'] === null) {
    throw new ManifestValidationError('cc-harness.json: "files" must be an object')
  }

  const files = obj['files'] as Record<string, unknown>
  if (files['commands'] !== undefined && typeof files['commands'] !== 'string') {
    throw new ManifestValidationError('cc-harness.json: "files.commands" must be a string')
  }
  if (files['skills'] !== undefined && typeof files['skills'] !== 'string') {
    throw new ManifestValidationError('cc-harness.json: "files.skills" must be a string')
  }

  return {
    name: obj['name'] as string,
    version: obj['version'] as string,
    description: obj['description'] as string,
    author: typeof obj['author'] === 'string' ? obj['author'] : undefined,
    files: {
      commands: typeof files['commands'] === 'string' ? files['commands'] : undefined,
      skills: typeof files['skills'] === 'string' ? files['skills'] : undefined,
    },
    claude_md_block: obj['claude_md_block'] as string,
  }
}
