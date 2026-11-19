#!/usr/bin/env node
/**
 * Copies the DSH and Cordis version ranges from the root package.json
 * (`dshPlugins`) into every bundle package, so an upgrade is one edit plus
 * `pnpm sync:versions` instead of one edit per package.
 *
 *   pnpm sync:versions
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PACKAGES_DIR = join(ROOT, 'packages')

const rootManifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const dshRange = rootManifest.dshPlugins?.dshRange
const cordisRange = rootManifest.dshPlugins?.cordisRange

if (typeof dshRange !== 'string' || !dshRange) {
  console.error('\n✖ package.json 的 dshPlugins.dshRange 缺失\n')
  process.exit(1)
}

const changed = []

for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue

  const manifestPath = join(PACKAGES_DIR, entry.name, 'package.json')
  if (!existsSync(manifestPath)) continue

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!manifest.dsh?.bundle) continue

  const before = JSON.stringify(manifest)
  manifest.engines = { ...manifest.engines, dsh: dshRange }

  if (typeof cordisRange === 'string' && cordisRange) {
    manifest.peerDependencies = {
      ...manifest.peerDependencies,
      '@deepseek-ai/cordis': cordisRange,
    }
  }

  if (JSON.stringify(manifest) !== before) {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    changed.push(relative(ROOT, manifestPath))
  }
}

const target = `dsh ${dshRange}${typeof cordisRange === 'string' && cordisRange ? `, cordis ${cordisRange}` : ''}`

if (changed.length === 0) {
  console.log(`\n✔ 没有需要同步的插件包（目标范围：${target}）\n`)
} else {
  console.log(`\n✔ 已同步 ${changed.length} 个包到 ${target}\n  ${changed.join('\n  ')}\n`)
  console.log('下一步：pnpm install && pnpm verify\n')
}
