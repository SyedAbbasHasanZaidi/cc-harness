import os from 'os'
import path from 'path'
import { ensureDir, fileExists, readJsonFile, writeJsonFile } from '../utils/fs.js'

export interface RegistryEntry {
  name: string
  version: string
  description: string
  author?: string
  installPath: string
  installedAt: string
}

export interface Registry {
  harnesses: Record<string, RegistryEntry>
}

function registryDir(): string {
  return path.join(os.homedir(), '.cc-harnesses')
}

function registryPath(): string {
  return path.join(registryDir(), 'registry.json')
}

export function getHarnessInstallPath(name: string): string {
  return path.join(registryDir(), name)
}

export async function readRegistry(): Promise<Registry> {
  const rPath = registryPath()
  if (!(await fileExists(rPath))) {
    return { harnesses: {} }
  }
  try {
    return await readJsonFile<Registry>(rPath)
  } catch (err) {
    throw new Error(`Failed to read registry at ${rPath}: ${String(err)}`)
  }
}

export async function writeRegistry(registry: Registry): Promise<void> {
  await ensureDir(registryDir())
  try {
    await writeJsonFile(registryPath(), registry)
  } catch (err) {
    throw new Error(`Failed to write registry: ${String(err)}`)
  }
}

export async function addToRegistry(entry: RegistryEntry): Promise<void> {
  const registry = await readRegistry()
  registry.harnesses[entry.name] = entry
  await writeRegistry(registry)
}

export async function removeFromRegistry(name: string): Promise<void> {
  const registry = await readRegistry()
  delete registry.harnesses[name]
  await writeRegistry(registry)
}

export async function getRegistryEntry(name: string): Promise<RegistryEntry | undefined> {
  const registry = await readRegistry()
  return registry.harnesses[name]
}

export async function listRegistry(): Promise<RegistryEntry[]> {
  const registry = await readRegistry()
  return Object.values(registry.harnesses)
}

export async function cleanStaleEntries(): Promise<string[]> {
  const registry = await readRegistry()
  const removed: string[] = []

  for (const [name, entry] of Object.entries(registry.harnesses)) {
    if (!(await fileExists(entry.installPath))) {
      delete registry.harnesses[name]
      removed.push(name)
    }
  }

  if (removed.length > 0) {
    await writeRegistry(registry)
  }

  return removed
}
