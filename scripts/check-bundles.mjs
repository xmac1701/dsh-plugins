#!/usr/bin/env node
/**
 * Validates the DSH bundle contract for every package under packages/:
 * manifest fields, patch rows, locale metadata, icon limits, exported files,
 * and the syntax of the built JavaScript.
 *
 * Run it with `pnpm check`, or `pnpm verify` to typecheck and build first.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PACKAGES_DIR = join(ROOT, 'packages')
const MAX_ICON_BYTES = 256 * 1024
const MAX_DETAIL_BYTES = 1024 * 1024
const ICON_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp'])

const reports = new Map()
const checked = []
const rowIds = new Map()
let errorCount = 0
let warningCount = 0

function add(level, label, message) {
  if (!reports.has(label)) reports.set(label, [])
  reports.get(label).push({ level, message })
  if (level === 'error') errorCount++
  else warningCount++
}

const error = (label, message) => add('error', label, message)
const warn = (label, message) => add('warn', label, message)

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function norm(path) {
  return path.replace(/^\.\//, '')
}

function resolveInside(pkgDir, relPath) {
  const abs = resolve(pkgDir, relPath)
  if (abs !== pkgDir && !abs.startsWith(pkgDir + sep)) return null
  return abs
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

function coveredByFiles(files, target) {
  const wanted = norm(target)
  return files.some((entry) => {
    const pattern = norm(entry)
    if (pattern === wanted) return true
    if (!pattern.includes('*') && wanted.startsWith(pattern + '/')) return true

    const expression = pattern
      .split('*')
      .map((part) => part.replace(/[.+^${}()|[\]\\?]/g, '\\$&'))
      .join('.*')
    return new RegExp(`^${expression}$`).test(wanted)
  })
}

function collectRows(patch) {
  const rows = []
  for (const item of patch) {
    if (!item || typeof item !== 'object') continue
    if (!Array.isArray(item.insert)) continue
    for (const row of item.insert) {
      if (row && typeof row === 'object') rows.push(row)
    }
  }
  return rows
}

function errorLine(stderr) {
  const lines = (stderr || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('at ') && !line.startsWith('Node.js'))
  return lines.find((line) => /Error/.test(line)) ?? lines[0]
}

function checkPackage(pkgDir) {
  const fallbackLabel = relative(ROOT, pkgDir)
  const manifest = readJson(join(pkgDir, 'package.json'))

  if (!manifest) {
    error(fallbackLabel, 'package.json 缺失或不是合法 JSON')
    checked.push({ label: fallbackLabel })
    return
  }

  const label = typeof manifest.name === 'string' && manifest.name ? manifest.name : fallbackLabel
  checked.push({ label })

  // Package identity ------------------------------------------------------
  if (
    typeof manifest.name !== 'string'
    || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(manifest.name)
  ) {
    error(label, 'package.json 的 name 不是合法的 npm 包名')
  }
  if (manifest.type !== 'module') {
    error(label, '需要 "type": "module"：tsup 产物是 ESM')
  }
  if (!manifest.engines?.dsh) {
    warn(label, '建议声明 engines.dsh，DSH 安装和启动时会校验这个版本范围')
  }
  if (manifest.private !== true) {
    warn(label, 'private 不是 true：请确认已经准备发布，否则设回 true')
  }

  // exports ---------------------------------------------------------------
  const exportValue = manifest.exports
  const exportsMap = typeof exportValue === 'string'
    ? { '.': exportValue }
    : (exportValue && typeof exportValue === 'object' ? exportValue : {})

  if (!exportsMap['./locale/*.json']) {
    error(label, 'exports 缺少 "./locale/*.json"')
  }

  const builtFiles = new Set()
  const distTargets = []
  for (const [key, value] of Object.entries(exportsMap)) {
    if (key === './package.json') continue
    const target = exportTarget(value)
    if (!target) {
      error(label, `exports["${key}"] 没有可用的字符串目标`)
      continue
    }
    if (target.includes('*')) {
      if (key === './locale/*.json' && !existsSync(join(pkgDir, 'locale'))) {
        error(label, '导出了 ./locale/*.json 但没有 locale/ 目录')
      }
      continue
    }

    const rel = norm(target)
    const abs = resolveInside(pkgDir, rel)
    if (!abs) {
      error(label, `exports["${key}"] 必须指向包目录内`)
      continue
    }
    if (!existsSync(abs)) {
      if (rel.startsWith('dist/')) warn(label, `缺少构建产物 ${rel}，请运行 pnpm build`)
      else error(label, `exports["${key}"] 指向的文件不存在：${rel}`)
      continue
    }
    if (rel.startsWith('dist/')) distTargets.push(rel)
    if (/\.(?:m?js|cjs)$/.test(rel)) builtFiles.add(abs)
  }

  // Icon ------------------------------------------------------------------
  let iconRel = null
  if (typeof manifest.icon === 'string') {
    iconRel = norm(manifest.icon)
  } else if (exportsMap['./icon']) {
    iconRel = exportTarget(exportsMap['./icon'])
  }

  if (!iconRel) {
    error(label, '缺少图标：提供 ./icon 导出，或 package.json 的 icon 字段')
  } else {
    const abs = resolveInside(pkgDir, iconRel)
    if (!abs) {
      error(label, '图标路径必须留在包目录内')
    } else if (!existsSync(abs)) {
      error(label, `图标不存在：${iconRel}`)
    } else {
      if (statSync(abs).size > MAX_ICON_BYTES) error(label, '图标超过 256 KiB')
      const ext = extname(abs).toLowerCase()
      if (!ICON_EXTENSIONS.has(ext)) error(label, `图标格式不受支持：${ext || '（无扩展名）'}`)
      if (ext === '.svg') {
        const head = readFileSync(abs, 'utf8').slice(0, 400)
        if (!/<svg[\s>]/i.test(head)) error(label, 'SVG 图标缺少 <svg> 根元素')
      }
    }
  }

  // dsh.client ------------------------------------------------------------
  const client = manifest.dsh?.client
  const clientExport = exportsMap['./client']
  if (client && !clientExport) {
    error(label, '声明了 dsh.client 但没有导出 "./client"')
  }
  if (!client && clientExport) {
    warn(label, '导出了 "./client" 但没有声明 dsh.client，页面不会加载它')
  }
  if (client) {
    if (client.platform !== 'web') {
      warn(label, 'dsh.client.platform 目前只支持 "web"')
    }
    if (!Array.isArray(client.inject) || client.inject.some((value) => typeof value !== 'string')) {
      warn(label, 'dsh.client.inject 应为字符串数组')
    }

    const target = exportTarget(clientExport)
    if (target && !target.includes('*')) {
      const abs = resolveInside(pkgDir, norm(target))
      if (abs && existsSync(abs)) {
        const escaped = manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (!new RegExp(`id\\s*:\\s*['"]${escaped}['"]`).test(readFileSync(abs, 'utf8'))) {
          warn(label, `Client 模块的 factory id 应等于包名 ${manifest.name}`)
        }
      }
    }
  }

  // Bundle patch and rows ------------------------------------------------
  const patchRel = manifest.dsh?.bundle?.patch
  if (typeof patchRel !== 'string' || !patchRel) {
    error(label, '缺少 dsh.bundle.patch')
  } else {
    const rel = norm(patchRel)
    const abs = resolveInside(pkgDir, rel)
    if (!abs) {
      error(label, 'dsh.bundle.patch 必须在包目录内')
    } else if (!existsSync(abs)) {
      error(label, `dsh.bundle.patch 指向的文件不存在：${rel}`)
    } else {
      let patch
      try {
        patch = parseYaml(readFileSync(abs, 'utf8'))
      } catch (cause) {
        error(label, `patch 不是合法 YAML：${cause.message}`)
      }

      if (patch !== undefined) {
        if (!Array.isArray(patch)) {
          error(label, 'patch 顶层应该是 YAML 数组')
        } else {
          const rows = collectRows(patch)
          if (rows.length === 0) warn(label, 'patch 没有 insert 任何插件行')

          const localIds = new Set()
          for (const row of rows) {
            if (typeof row.id !== 'string' || !row.id.trim()) {
              error(label, 'patch 行缺少 id')
              continue
            }
            if (localIds.has(row.id)) error(label, `patch 行 id 重复：${row.id}`)
            localIds.add(row.id)

            if (typeof row.name !== 'string' || !row.name.trim()) {
              error(label, `patch 行 ${row.id} 缺少 name`)
            }

            if (rowIds.has(row.id)) {
              warn(label, `row id "${row.id}" 与 ${rowIds.get(row.id)} 重复；后应用的层会覆盖先前的行`)
            } else {
              rowIds.set(row.id, label)
            }
          }
        }
      }
    }
  }

  // Locale metadata -------------------------------------------------------
  const localeDir = join(pkgDir, 'locale')
  const localeFiles = existsSync(localeDir)
    ? readdirSync(localeDir).filter((file) => file.endsWith('.json')).sort()
    : []

  if (localeFiles.length === 0) {
    error(label, '缺少 locale/*.json 显示元数据')
  }
  if (!localeFiles.includes('en.json')) {
    error(label, '缺少 locale/en.json')
  }

  const files = Array.isArray(manifest.files) ? manifest.files.map(norm) : null
  if (!files) warn(label, 'package.json 没有 files 字段：发布时会把整个目录打进包')

  for (const file of localeFiles) {
    const locale = readJson(join(localeDir, file))
    if (!locale) {
      error(label, `locale/${file} 不是合法 JSON`)
      continue
    }

    const meta = locale.meta
    if (!meta || typeof meta !== 'object') {
      error(label, `locale/${file} 缺少 meta 对象`)
      continue
    }
    if (typeof meta.title !== 'string' || !meta.title.trim()) {
      error(label, `locale/${file} 缺少 meta.title`)
    }
    if (typeof meta.description !== 'string' || !meta.description.trim()) {
      error(label, `locale/${file} 缺少 meta.description`)
    } else if (/Replace this description|请把这里替换/.test(meta.description)) {
      warn(label, `locale/${file} 的 meta.description 还是模板占位文案，请改成实际能力`)
    }

    if (meta.detail === undefined) continue

    if (typeof meta.detail !== 'string' || !/\.(?:md|markdown)$/i.test(meta.detail)) {
      error(label, `locale/${file} 的 meta.detail 必须是 .md/.markdown 路径`)
      continue
    }
    const detailAbs = resolveInside(pkgDir, norm(meta.detail))
    if (!detailAbs) {
      error(label, `locale/${file} 的 meta.detail 必须在包目录内`)
    } else if (!existsSync(detailAbs)) {
      error(label, `locale/${file} 的 meta.detail 指向的文件不存在：${meta.detail}`)
    } else {
      if (statSync(detailAbs).size > MAX_DETAIL_BYTES) error(label, '详情文档超过 1 MiB')
      if (files && !coveredByFiles(files, norm(meta.detail))) error(label, `files 未包含详情文档 ${meta.detail}`)
    }
  }

  // files coverage --------------------------------------------------------
  if (files) {
    if (typeof patchRel === 'string' && patchRel && !coveredByFiles(files, norm(patchRel))) {
      error(label, `files 未包含 patch 文件 ${norm(patchRel)}`)
    }
    if (distTargets.length > 0 && !coveredByFiles(files, 'dist')) {
      error(label, 'files 未包含 dist/')
    }
    if (localeFiles.length > 0 && !coveredByFiles(files, 'locale/en.json')) {
      error(label, 'files 未包含 locale/*.json')
    }
    if (iconRel && !coveredByFiles(files, iconRel)) {
      error(label, `files 未包含图标 ${iconRel}`)
    }
  }

  if (!existsSync(join(pkgDir, 'README.md'))) {
    warn(label, '建议提供 README.md：没有 meta.detail 时插件详情页会回退到它')
  }

  // Built JavaScript ------------------------------------------------------
  for (const file of builtFiles) {
    const result = spawnSync(process.execPath, ['--check', file], {
      encoding: 'utf8',
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    })
    if (result.status !== 0) {
      error(label, `${relative(pkgDir, file)} 语法检查失败：${errorLine(result.stderr) ?? '未知错误'}`)
    }
  }
}

const dirs = existsSync(PACKAGES_DIR)
  ? readdirSync(PACKAGES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(PACKAGES_DIR, entry.name))
  : []

if (dirs.length === 0) {
  console.log('packages/ 下还没有插件包。用 pnpm new <name> 创建第一个。')
  process.exit(0)
}

for (const dir of dirs) {
  if (!existsSync(join(dir, 'package.json'))) continue
  checkPackage(dir)
}

if (checked.length === 0) {
  console.log('packages/ 下还没有插件包。用 pnpm new <name> 创建第一个。')
  process.exit(0)
}

for (const entry of checked) {
  const issues = reports.get(entry.label) ?? []
  if (issues.length === 0) {
    console.log(`✔ ${entry.label}`)
    continue
  }
  console.log(`\n${entry.label}`)
  for (const issue of issues) {
    console.log(`  ${issue.level === 'error' ? '✖' : '!'} ${issue.message}`)
  }
}

console.log(`\n${checked.length} 个包：${errorCount} 个错误，${warningCount} 个警告`)
process.exitCode = errorCount > 0 ? 1 : 0
