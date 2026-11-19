#!/usr/bin/env node
/**
 * Creates a new plugin package from templates/host or templates/ui.
 *
 *   pnpm new hello-world
 *   pnpm new hello-ui --template ui
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PACKAGES_DIR = join(ROOT, 'packages')
const TEMPLATES_DIR = join(ROOT, 'templates')
const TEXT_EXTENSIONS = new Set(['.json', '.md', '.yml', '.yaml', '.ts', '.js', '.svg', '.txt'])

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

function usage() {
  console.log(`用法：pnpm new <name> [--template host|ui]

  <name>             插件名，不带 dsh-plugin- 前缀，例如 hello-world
  --template host    只有 Host 半区的插件包（默认）
  --template ui      带 Web Client 半区的插件包

生成 packages/dsh-plugin-<name>，模板来自 templates/<template>/。
创建后运行 pnpm install，再按输出的下一步构建和安装。`)
}

function parseArgs(argv) {
  const positional = []
  let template = 'host'

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      usage()
      process.exit(0)
    }
    if (arg === '--template') {
      const value = argv[++index]
      if (!value) fail('--template 需要一个值：host 或 ui')
      template = value
      continue
    }
    if (arg.startsWith('--template=')) {
      template = arg.slice('--template='.length)
      continue
    }
    if (arg.startsWith('-')) fail(`未知选项：${arg}`)
    positional.push(arg)
  }

  return { rawName: positional[0], template }
}

function toTitle(shortName) {
  const words = shortName.split('-').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function render(text, replacements) {
  let output = text
  for (const [key, value] of replacements) output = output.split(key).join(value)
  return output
}

function copyTemplate(sourceDir, targetDir, replacements) {
  mkdirSync(targetDir, { recursive: true })

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name)
    const target = join(targetDir, entry.name)

    if (entry.isDirectory()) {
      copyTemplate(source, target, replacements)
      continue
    }
    if (!entry.isFile()) continue

    if (TEXT_EXTENSIONS.has(extname(entry.name))) {
      writeFileSync(target, render(readFileSync(source, 'utf8'), replacements))
    } else {
      copyFileSync(source, target)
    }
  }
}

function collectFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(path))
    else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name))) files.push(path)
  }
  return files
}

const { rawName, template } = parseArgs(process.argv.slice(2))

if (!rawName) {
  usage()
  fail('缺少插件名')
}

if (template !== 'host' && template !== 'ui') {
  fail(`未知模板：${template}（可选 host、ui）`)
}

const shortName = rawName.replace(/^dsh-plugin-/, '')
if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(shortName)) {
  fail('插件名只能包含小写字母、数字和连字符，且必须以字母开头、以字母或数字结尾')
}

const packageName = `dsh-plugin-${shortName}`
const targetDir = join(PACKAGES_DIR, packageName)
const templateDir = join(TEMPLATES_DIR, template)

if (!existsSync(join(templateDir, 'package.json'))) {
  fail(`模板目录不完整：${relative(ROOT, templateDir)}`)
}
if (existsSync(targetDir)) {
  fail(`${relative(ROOT, targetDir)} 已存在，请换一个名字或删除该目录`)
}

const rootManifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const ranges = rootManifest.dshPlugins ?? {}
const title = toTitle(shortName)
const isUi = template === 'ui'

const replacements = [
  ['__DESCRIPTION_ZH__', isUi
    ? `Web UI 插件 ${shortName}。请把这里替换成插件绘制的内容和出现位置。`
    : `Host 插件 ${shortName}。请把这里替换成插件在 DSH 中提供的能力。`],
  ['__DESCRIPTION__', isUi
    ? `Web UI plugin ${shortName}. Replace this description with what the plugin draws and where it appears in DSH.`
    : `Host plugin ${shortName}. Replace this description with the capability this plugin adds in DSH.`],
  ['__PACKAGE__', packageName],
  ['__TITLE__', title],
  ['__NAME__', shortName],
  ['__DSH_RANGE__', ranges.dshRange ?? '>=0.2.2-rc.5 <0.3.0'],
  ['__CORDIS_RANGE__', ranges.cordisRange ?? '~4.1.0'],
]

copyTemplate(templateDir, targetDir, replacements)

const unresolved = collectFiles(targetDir).flatMap((file) => {
  const matches = readFileSync(file, 'utf8').match(/__[A-Z0-9_]+__/g) ?? []
  return matches.map((match) => `${relative(ROOT, file)}: ${match}`)
})
if (unresolved.length > 0) {
  fail(`模板里还有未替换的占位符：\n  ${unresolved.join('\n  ')}`)
}

console.log(`
✔ 已创建 ${relative(ROOT, targetDir)}（模板：${template}）

下一步：
  pnpm install
  pnpm --filter ${packageName} build
  pnpm plugin:add packages/${packageName}

然后在 DSH 的 Plugins 面板启用它。修改代码后运行 pnpm build 重新构建。
`)
