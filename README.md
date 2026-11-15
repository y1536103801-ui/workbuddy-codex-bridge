# WorkBuddy Codex Bridge

在自己的 Mac 上，将 WorkBuddy 账号可用的聊天模型接入 Codex。连接账号、选择模型、应用到 Codex。

独立运行；安装包内置 Node，不需要 DeepSeek Harness、OpenCodex 或 Homebrew。

## 安装与使用

下载对应芯片的发布 ZIP，解压后双击 **安装.command**。也可以直接打开包内的 **WorkBuddy Codex Bridge.app**。

1. 在 WorkBuddy 登录，点击连接当前账号；也支持手动导入完整凭证 JSON。
2. 从实时获取的模型目录选择模型，可以搜索和刷新。
3. 检测工具调用后，点击应用到 Codex，重新打开 Codex 并新建聊天。

[完整安装与卸载说明](docs/INSTALL.zh-CN.md)

## 能力

- 中国区 / 国际区账号入口；当前真实验收覆盖中国区。
- 动态模型目录、搜索、切换，以及独立的工具调用检测结果。
- Responses API → WorkBuddy Chat Completions；流式文本、推理历史、函数工具、自定义工具、工具结果续接、图片输入能力校验、取消与断流报错。
- 独立凭证缓存、到期刷新、本机令牌认证、只监听 loopback。
- Codex 配置备份、应用与恢复；其他程序修改过的字段不会被恢复操作覆盖。
- macOS 登录启动、安装、更新替换和卸载。

单个账号同时处理一个生成请求；忙碌时返回明确错误。模型限流和额度不足直接显示上游原因，不自动重复提交。

当前连接器不提供 OpenAI 托管的 Web Search，也不保存 `previous_response_id` 会话。应用到 Codex 时关闭其内置 Web Search；客户端携带完整历史实现多轮续接。模型的工具能力须实际检测。

## 开发

macOS + Node >=22.19（测试与发行运行时使用 Node 24.22.2）。

```sh
npm ci
npm run check
npm run package
```

`npm run package` 从 nodejs.org 下载固定版本的 Apple 芯片和 Intel 运行时，校验官方 SHA256，再构建各自的 .app 和 ZIP。源码依赖锁定在 package-lock.json；产品运行时无需 npm install。

开发服务：`npm run build` 后运行 `WBCB_HOME=/absolute/test/data WBCB_CODEX_HOME=/absolute/test/codex node dist/cli.mjs serve`。页面访问凭证由应用启动器通过 URL fragment 传递；前端读取后立即移除，不进入 HTTP URL 或日志。

主要目录：src/ 独立连接器；vendor/ 保留许可的复用代码；web/ 本地设置页；scripts/ 构建与安装；test/ 协议、认证和配置测试；evidence/ 脱敏验收摘要。

[当前交付状态](docs/STATUS.md) · [代码来源](docs/PROVENANCE.md)

## 许可证

MIT。复用模块保留原版权声明，见 vendor/workbuddy/LICENSE 与 THIRD_PARTY_NOTICES.txt。发行包另带 Node 和 smol-toml 的许可证。
