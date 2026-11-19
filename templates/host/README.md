# __TITLE__

__DESCRIPTION__

## 功能

启用后，插件在激活时把配置中的 `message` 写入 DSH 日志，用于确认 Host 半区已经加载。

## 配置

`cordis.patch.yml` 的 `__NAME__` 行支持以下配置：

| 键 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `message` | string | `Hello from __PACKAGE__` | 激活时写入 DSH 日志的文本 |

## 开发

```sh
pnpm install
pnpm build
pnpm plugin:add packages/__PACKAGE__
```

修改 `src/index.ts` 后重新构建，再在 Plugins 面板停用/启用该插件（或重启 DSH）加载新代码。
