#!/usr/bin/env node
/**
 * Links a workspace plugin package into a DSH profile through the supported
 * `dsh plugin add` command, or removes it again.
 *
 *   pnpm plugin:add packages/dsh-plugin-hello
 *   pnpm plugin:add hello --profile web
 *   pnpm plugin:remove hello
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PACKAGES_DIR = join(ROOT, 'packages')
const DEFAULT_PROFILE = 'web'

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

function usage() {
  console.log(`用法：
  pnpm plugin:add <包名|目录> [--profile <name>]
  pnpm plugin:remove <包名> [--profile <name>]

  <包名|目录>   dsh-plugin-hello、hello，或 packages/dsh-plugin-hello
  --profile     目标 profile，默认取 $DSH_PROFILE，否则 web

workflow：
  1. 构建：pnpm --filter <包名> build
  2. 安装：pnpm plugin:add <包名>
  3. 在 DSH 的 Plugins 面板启用插件
  4. 卸载：pnpm plugin:remove <包名>（或在 Plugins 面板移除）`)
}

function parseArgs(argv) {
  const positional = []
  let profile = process.env.DSH_PROFILE || DEFAULT_PROFILE

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      usage()
      process.exit(0)
    }
    if (arg === '--profile') {
      const value = argv[++index]
      if (!value) fail('--profile 需要一个 profile 名称')
      profile = value
      continue
    }
    if (arg.startsWith('--profile=')) {
      profile = arg.slice('--profile='.length)
      continue
    }
    if (arg.startsWith('-')) fail(`未知选项：${arg}`)
    positional.push(arg)
  }

  if (positional.length > 3) {
    fail(`多余的参数：${positional.slice(3).join(' ')}`)
  }

  return { command: positional[0], target: positional[1], extra: positional[2], profile }
}

function readManifest(dir) {
  const path = join(dir, 'package.json')
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    fail(`${relative(ROOT, path)} 不是合法 JSON`)
  }
}

function tryFindPackageDir(target) {
  const candidates = [
    resolve(process.cwd(), target),
    resolve(ROOT, target),
  ]
  for (const candidate of candidates) {
    if (readManifest(candidate)) return candidate
  }

  const name = target.startsWith('dsh-plugin-') ? target : `dsh-plugin-${target}`
  const byName = join(PACKAGES_DIR, name)
  if (readManifest(byName)) return byName

  return null
}

function findPackageDir(target) {
  const dir = tryFindPackageDir(target)
  if (dir) return dir

  const available = existsSync(PACKAGES_DIR)
    ? readdirSync(PACKAGES_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(join(PACKAGES_DIR, entry.name, 'package.json')))
        .map((entry) => entry.name)
    : []

  fail(`找不到插件包：${target}${available.length > 0 ? `\n  可选：${available.join('、')}` : '\n  先用 pnpm new <name> 创建'}`)
}

function exportTarget(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    for (const key of ['default', 'import', 'node']) {
      if (typeof value[key] === 'string') return value[key]
    }
  }
  return null
}

function runDsh(args) {
  const result = spawnSync('dsh', args, {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      fail('找不到 dsh 命令。请先安装 DeepSeek Harness CLI，并确认 dsh 在 PATH 中。')
    }
    fail(`执行 dsh 失败：${result.error.message}`)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const { command, target, extra, profile } = parseArgs(process.argv.slice(2))

if (command !== 'add' && command !== 'remove') {
  usage()
  fail(`未知命令：${command ?? '（空）'}`)
}
if (extra) fail(`多余的参数：${extra}`)
if (!target) fail('缺少目标插件')

if (!/^[A-Za-z0-9._-]+$/.test(profile)) {
  fail(`profile 名称不合法：${profile}`)
}

if (command === 'add') {
  const dir = findPackageDir(target)
  const manifest = readManifest(dir)

  if (!manifest.dsh?.bundle?.patch) {
    fail(`${manifest.name} 没有声明 dsh.bundle.patch，不能作为插件包安装。`)
  }

  const entry = exportTarget(manifest.exports?.['.'])
  if (entry && !entry.includes('*')) {
    const entryFile = join(dir, entry.replace(/^\.\//, ''))
    if (!existsSync(entryFile)) {
      fail(`缺少构建产物 ${relative(ROOT, entryFile)}\n  请先运行：pnpm --filter ${manifest.name} build`)
    }
  }

  console.log(`→ dsh plugin --profile ${profile} add ${relative(ROOT, dir)}`)
  runDsh(['plugin', '--profile', profile, 'add', dir])

  console.log(`
✔ ${manifest.name} 已链接到 profile「${profile}」

下一步：
  - 在 DSH 的 Plugins 面板启用该插件（同一个 bundle 可能包含多个插件行）
  - 修改并重新构建后，在 Plugins 面板停用/启用该行即可重新加载；不生效时重启 dsh
  - UI 半区修改后刷新页面
`)
} else {
  const dir = tryFindPackageDir(target)
  const name = dir
    ? (readManifest(dir)?.name ?? target)
    : (target.startsWith('dsh-plugin-') || target.startsWith('@')
        ? target
        : `dsh-plugin-${target}`)

  console.log(`→ dsh plugin --profile ${profile} remove ${name}`)
  runDsh(['plugin', '--profile', profile, 'remove', name])

  console.log(`\n✔ ${name} 已从 profile「${profile}」移除\n`)
}
