# __TITLE__

__DESCRIPTION__

## 功能

启用后，插件在对话输入框下方的 composer dock 中绘制一个占位图形，用来确认 Client 半区已经加载。替换 `src/client.ts` 中的 `Decoration` 即可改成真正的 UI。

## 位置

- Client 模块 id：`__PACKAGE__`（必须与包名一致）
- 注册插槽：`conversation.composer.dock`
- 依赖的 Client 包：`@deepseek-ai/dsh-client-ui-conversation`

## 开发

```sh
pnpm install
pnpm build
pnpm plugin:add packages/__PACKAGE__
```

修改 `src/client.ts` 后重新构建并刷新页面；修改 Host 半区后重新构建，再在 Plugins 面板停用/启用该插件（或重启 DSH）。
