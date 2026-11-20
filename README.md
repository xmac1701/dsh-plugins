# DSH 插件 monorepo

用 pnpm workspace 管理多个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件的模板仓库。每个插件包（通常位于 `packages/dsh-plugin-*`）都是一个可以单独安装到 DSH profile 的 **bundle**：`package.json` 声明 `dsh.bundle.patch`，补丁把插件行插入 profile 的配置层，TypeScript 源码由 tsup 构建到 `dist/`。

## 目录

```
.
├── packages/                    # 插件包（pnpm workspace）
│   └── fast-model-selector/     # dsh-plugin-fast-model-selector：两列快速模型选择器
├── templates/
│   ├── host/                    # 只有 Host 半区的模板
│   └── ui/                      # 带 Web Client 半区的模板
├── scripts/
│   ├── create-plugin.mjs        # pnpm new：从模板生成插件包
│   ├── check-bundles.mjs        # pnpm check：校验 bundle 约定
│   ├── plugin.mjs               # pnpm plugin:add / plugin:remove
│   └── sync-dsh-version.mjs     # pnpm sync:versions：同步版本范围
├── pnpm-workspace.yaml          # workspace、catalog、allowBuilds
├── tsconfig.base.json           # 各包共享的 TypeScript 配置
├── package.json                 # 工具链、脚本、DSH 版本范围
└── pnpm-lock.yaml
```

## 环境要求

- Node.js >= 22.18（tsup 9 的要求）
- pnpm 12（`packageManager` 已固定为 12.10.1）
- DeepSeek Harness CLI：`dsh --version` 应满足根 `package.json` 中 `dshPlugins.dshRange` 的范围（当前为 `0.2.2-rc.5`）

## 快速开始

```sh
pnpm install
pnpm new hello-world                 # Host 插件 → packages/dsh-plugin-hello-world
pnpm new hello-ui --template ui      # 带 Web UI 的插件 → packages/dsh-plugin-hello-ui

pnpm install                         # 新包的依赖来自 catalog
pnpm build
pnpm plugin:add packages/dsh-plugin-hello-world
```

`plugin:add` 内部执行 `dsh plugin --profile <profile> add <绝对路径>`，把包以 `link:` 方式装进 profile。默认 profile 取 `$DSH_PROFILE`，没有则用 `web`。装好后在 DSH Web 的 **Plugins** 面板启用对应的 bundle / 插件行。

随后修改 `locale/*.json` 的标题描述、`icon.svg`、`src/` 下的代码，再 `pnpm build` 重新构建。

## 命令

| 命令 | 说明 |
| --- | --- |
| `pnpm new <name> [--template host\|ui]` | 从模板生成 `packages/dsh-plugin-<name>` |
| `pnpm build` | 递归构建所有插件包（tsup，输出 `dist/`） |
| `pnpm dev` | 递归并行运行各包的 `tsup --watch` |
| `pnpm typecheck` | 递归执行 `tsc -p tsconfig.json` |
| `pnpm check` | 校验所有包的 manifest、patch、locale、图标、exports、files 和构建产物 |
| `pnpm verify` | `typecheck` + `build` + `check` |
| `pnpm plugin:add <包名\|目录> [--profile <name>]` | 构建完成后链接到 DSH profile |
| `pnpm plugin:remove <包名> [--profile <name>]` | 从 profile 移除 |
| `pnpm sync:versions` | 把根配置的版本范围同步到所有插件包 |

## 包的结构

```
packages/dsh-plugin-hello/
├── package.json          # name/exports/files、dsh.bundle、dsh.client、engines.dsh
├── cordis.patch.yml      # bundle 的配置层：insert 插件行
├── tsup.config.ts        # 构建到 dist/，所有裸导入保持 external
├── tsconfig.json
├── src/
│   ├── index.ts          # Host 半区（在 Node 中由 Cordis 加载）
│   └── client.ts         # Client 半区（ui 模板才有，注册到插槽）
├── locale/
│   ├── en.json           # meta.title / meta.description
│   └── zh.json
├── icon.svg              # 插件图标（<= 256 KiB，Plugin Manager 读取）
└── README.md             # 未声明 meta.detail 时作为插件详情页内容
```

约定：

- 包名统一为 `dsh-plugin-<name>`；生成器会拒绝非法名称。
- `package.json` 必须有 `"type": "module"`、`exports`、`files`、`dsh.bundle.patch` 和 `engines.dsh`。
- UI 插件的 `dsh.client` 声明 `platform`、`immediately`、`inject`；Client 模块 factory 的 `id` **必须等于包名**。
- 图标、locale、patch 和运行时产物都要出现在 `files` 中；本地链接安装会直接使用检出目录，`files` 不影响本地加载，但发布时决定打包内容。
- 详情页：只有准备了一张预览图时才声明 `meta.detail`；否则省略，Plugin Manager 会回退到 `README.md`。
- `cordis.patch.yml` 的行 id 要跨包唯一：后应用的层会按 id 覆盖整行，且覆盖会替换整个 `config`。

## 开发循环

**Host 半区**（`src/index.ts`）：Node 中由 DSH 直接 import 构建后的 `dist/index.js`。

```sh
pnpm --filter dsh-plugin-hello dev   # 持续构建
```

重新构建后，在 **Plugins** 面板把该插件行停用再启用（触发 profile recomposition，链接包中已变化的文件会被重新导入），或重启 `dsh`。HMR 默认 `root: []`，不会自动监听源码；Plugins 操作和配置变更造成的 recomposition 才会加载变化过的文件。

**Client 半区**（`src/client.ts`，ui 模板）：浏览器按 `dsh.client` 清单加载 `dist/client.js`。重新构建后刷新页面；如果仍是旧内容，重启 `dsh`。

## 依赖规则

- **DSH 运行时包**（`@deepseek-ai/cordis`、`@deepseek-ai/dsh-tools` 等）：同时写进 `peerDependencies` 和 `devDependencies`。运行时使用 DSH 安装里的实例，workspace 里的副本只服务类型检查和独立测试。模板里 devDependency 使用 `"catalog:"`。
- **无状态工具**（如 `@deepseek-ai/schemastery`）和普通第三方库：放 `dependencies`。
- **插件之间共享代码**：新建不带 `dsh.bundle` 的普通包（例如 `packages/shared`），在插件里用 `"workspace:*"` 引用。构建时 `skipNodeModulesBundle: true` 会把它保持为外部依赖，链接安装后从插件自己的 `node_modules` 解析。
- `tsup.config.ts` 里的 `external: [/^@deepseek-ai\//]` 和 `skipNodeModulesBundle: true` 防止把宿主的包重复打包。

## 版本与升级

根 `package.json` 的 `dshPlugins` 是版本范围的单一来源：

- `dshRange` → 各包的 `engines.dsh`（DSH 安装/启动时校验，不满足会拒绝加载）
- `cordisRange` → 各包的 `peerDependencies['@deepseek-ai/cordis']`

`pnpm-workspace.yaml` 的 `catalog` 决定实际安装的版本（`@deepseek-ai/cordis`、`@deepseek-ai/schemastery`），各包的 `devDependencies`/`dependencies` 用 `"catalog:"` 引用。

升级 DSH 后：

1. 修改根 `package.json` 的 `dshPlugins` 和 `pnpm-workspace.yaml` 的 `catalog`；
2. `pnpm sync:versions` 同步到所有包；
3. `pnpm install && pnpm verify`。

## 安装、打包与发布

- 本地安装：`pnpm plugin:add packages/dsh-plugin-hello`，或在 Web 的 **Plugins** 面板用 **Add plugin** 选择包目录。链接安装**不会**替插件安装依赖，插件的 `dependencies` 由本仓库的 `pnpm install` 提供，所以先跑 `pnpm install`。
- 只看配置层：`dsh --profile web --dump-config` 会打印包含该 bundle 的合成结果。
- 打包检查：`pnpm --filter dsh-plugin-hello pack`，产物应包含 `dist/`、`cordis.patch.yml`、`locale/`、`icon.svg`；打包时 `"catalog:"` 会替换成 catalog 里的具体版本。
- 发布前：把 `private` 改为 `false`，确认 `engines.dsh` 覆盖目标 DSH 版本，并按目标 registry 检查 `files`。
- 卸载：`pnpm plugin:remove dsh-plugin-hello`，或在 Plugins 面板移除。

## 校验内容

`pnpm check` 对每个包检查：

- `package.json`：合法包名、`type: module`、`engines.dsh`、`private`
- `cordis.patch.yml`：合法 YAML、insert 行有 `id`/`name`、包内 id 不重复、跨包 id 重复告警
- `exports`：`./locale/*.json`、`./icon`（或顶层 `icon`），以及目标的实际存在
- `dsh.client`：`platform`、`inject`，且 `./client` 导出与 factory id 和包名一致
- `locale/*.json`：`meta.title` / `meta.description`，`meta.detail` 的文件存在性与大小
- 图标：存在、位于包内、格式受支持、<= 256 KiB、SVG 有根元素
- `files`：覆盖 patch、`dist/`、locale、图标、详情文档
- 构建产物：`node --check` 语法检查；未构建时提示先 `pnpm build`

## 排错

| 现象 | 处理 |
| --- | --- |
| `ERR_PNPM_IGNORED_BUILDS` | `pnpm-workspace.yaml` 的 `allowBuilds` 已允许 esbuild；新增带 install 脚本的依赖时运行 `pnpm approve-builds` |
| 安装后 Plugins 面板看不到插件 | 确认包有 `dsh.bundle.patch`、`engines.dsh` 满足当前 DSH，且 `dsh plugin add` 已把 bundle 写进 profile；必要时重启 `dsh` |
| 改了 Host 代码不生效 | 重新 `pnpm build`，在 Plugins 面板停用/启用该行；仍不生效则重启 `dsh` |
| 改了 UI 不生效 | 刷新页面；确认 `dsh.client` 和 `./client` 导出正确，重新构建 |
| 详情页没有内容 | 没有 `meta.detail` 时显示 `README.md`；确认 README 存在且 `files` 包含它 |
| 图标不显示 | 确认 `./icon` 导出、格式为 SVG/PNG/JPEG/WebP、大小 <= 256 KiB，SVG 能解码 |

## 参考

- 已安装 DSH 的插件开发文档：`docs/user/develop/`（位于 DSH 安装目录，例如 `$DSH_INSTALL_DIR/docs/user/develop/`）
- dsh-doc skill 的 `references/host-plugin.md`、`references/ui-plugin.md`、`references/plugin-details.md`
- `dsh plugin --help`
