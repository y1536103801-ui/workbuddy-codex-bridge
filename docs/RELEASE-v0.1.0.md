# WorkBuddy Codex Bridge v0.1.0

首个公开版本：在 Mac 上连接 WorkBuddy 账号、选择账号可用的聊天模型，并接入 Codex。安装包内置 Node，无需安装 DeepSeek Harness、OpenCodex 或 Homebrew。

## 下载与安装

- Apple 芯片（M 系列）：下载 **WorkBuddy-Codex-Bridge-0.1.0-macOS-arm64.zip**。
- Intel：下载 **WorkBuddy-Codex-Bridge-0.1.0-macOS-x64.zip**，尚未进行 Intel 实机验收；需要另行准备支持 Intel 的 Codex 客户端。
- 系统要求：**macOS 13.5+**。

解压 → 双击“安装.command” → 在设置页连接已登录的 WorkBuddy → 选择模型并检测工具调用 → 点击“应用到 Codex” → 重开 Codex并新建聊天。

[图文步骤与排错](https://github.com/y1536103801-ui/workbuddy-codex-bridge#readme) · [完整安装说明](https://github.com/y1536103801-ui/workbuddy-codex-bridge/blob/main/docs/INSTALL.zh-CN.md)

安装包目前采用 ad-hoc 临时签名，尚无 Apple Developer ID 公证。首次打开被拦截时，请按 README 中的 Finder/隐私与安全性步骤允许本次打开，无需关闭 Gatekeeper。

## 已验证

- 14 项自动测试通过。
- Apple 芯片安装包完成安装、原生启动、直接连接中国区 WorkBuddy、Codex CLI 读写文件、配置恢复和卸载。
- 验收账号获取 30 个模型；GLM-5.3-Flash 完成真实工具任务。模型目录并非所有模型的工具验收结果。
- 两种架构安装包通过文件清单、签名、凭证排除及 SHA256 校验。

国际区账号、Intel 实机和 Codex 桌面完整交互尚无独立验收。首版每个账号同时处理一个生成请求，配置会关闭 Codex 内置的 OpenAI Web Search。

## 产物与源码对应

安装包源码为 `d8c4b9489f326e1922dacd3dd1f1eb496f92f181`。本次公开发布新增 README 和发布文档，程序代码与该提交一致，安装包复用已经验收的相同字节。

`SHA256SUMS.txt` 用于核对两个安装 ZIP，`manifest.json` 记录大小、哈希和构建版本。GitHub 自动提供的 Source code 是源码，不是安装包。

MIT 开源。账号凭证保存在用户自己的 Mac，模型请求直接发送至 WorkBuddy。
