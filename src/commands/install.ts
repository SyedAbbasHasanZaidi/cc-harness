import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { execa } from 'execa'
import { readManifest } from '../core/manifest.js'
import { addToRegistry, getHarnessInstallPath } from '../core/registry.js'
import { copyDir, ensureDir, fileExists } from '../utils/fs.js'
import { logger } from '../utils/logger.js'

export async function installCommand(source: string): Promise<void> {
  const isLocalPath =
    source.startsWith('./') ||
    source.startsWith('../') ||
    source.startsWith('/') ||
    source.startsWith('~') ||
    (process.platform === 'win32' && /^[A-Za-z]:[/\\]/.test(source))

  if (isLocalPath) {
    await installFromLocalPath(source)
  } else {
    await installFromNpm(source)
  }
}

async function installFromLocalPath(sourcePath: string): Promise<void> {
  const resolvedPath = sourcePath.startsWith('~')
    ? path.join(os.homedir(), sourcePath.slice(1))
    : path.resolve(sourcePath)

  if (!(await fileExists(resolvedPath))) {
    throw new Error(`Local path does not exist: ${resolvedPath}`)
  }

  const manifest = await readManifest(resolvedPath)
  const destPath = getHarnessInstallPath(manifest.name)

  await ensureDir(destPath)
  await copyDir(resolvedPath, destPath)

  await addToRegistry({
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    installPath: destPath,
    installedAt: new Date().toISOString(),
  })

  logger.success(`Installed ${manifest.name} v${manifest.version}`)
}

async function installFromNpm(packageName: string): Promise<void> {
  const tmpDir = path.join(os.tmpdir(), `cc-harness-pack-${Date.now()}`)
  await ensureDir(tmpDir)

  try {
    // Run npm pack to download the tarball
    let packResult: { stdout: string }
    try {
      packResult = await execa('npm', ['pack', packageName, '--pack-destination', tmpDir], {
        cwd: tmpDir,
      })
    } catch (err) {
      throw new Error(`npm pack failed for package "${packageName}": ${String(err)}`)
    }

    // npm pack outputs the tarball filename on the last non-empty line
    const tarball = packResult.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .pop()

    if (!tarball) {
      throw new Error(`npm pack produced no output for package "${packageName}"`)
    }

    const tarballPath = path.join(tmpDir, tarball)

    // Extract tarball
    const extractDir = path.join(tmpDir, 'extracted')
    await ensureDir(extractDir)

    try {
      await execa('tar', ['-xzf', tarballPath, '-C', extractDir], { cwd: tmpDir })
    } catch (err) {
      throw new Error(`Failed to extract tarball: ${String(err)}`)
    }

    // npm pack puts files in a "package" subdirectory
    const packageDir = path.join(extractDir, 'package')
    const harnessSrcDir = (await fileExists(packageDir)) ? packageDir : extractDir

    const manifest = await readManifest(harnessSrcDir)
    const destPath = getHarnessInstallPath(manifest.name)

    await ensureDir(destPath)
    await copyDir(harnessSrcDir, destPath)

    await addToRegistry({
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      installPath: destPath,
      installedAt: new Date().toISOString(),
    })

    logger.success(`Installed ${manifest.name} v${manifest.version}`)
  } finally {
    // Always clean up temp dir, even on failure
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}
