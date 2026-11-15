# 交付状态

候选版本：0.1.0。主开发设备：Mac mini / arm64。日期：2026-11-15。

已实现独立账号连接与凭证刷新、动态模型列表、模型选择、Responses 转换、本地设置页、Codex 配置与恢复、带运行时的安装/卸载与登录启动。

真实验收：中国区 WorkBuddy 当前登录可直接连接，取得 30 个模型；GLM-5.3-Flash 工具检测通过，Codex CLI 0.169.0-alpha.11.1 完成读取 input.txt → 创建 result.txt（46）→ DONE，退出码 0。见 evidence/live-catalog.json、live-tool-check.json、live-codex.json。

Google Chrome 检查通过：登录状态、搜索、选择、应用隔离 Codex 配置、重载保留选择、无匹配结果、切换模型；桌面和窄屏截图已检查。见 evidence/ui-check.json。

接下来对冻结源码运行最终检查、构建 arm64/x64 安装包，并在独立目录验收正式安装包。所有真实配置变更均限于项目 .private/codex。

公开发行前尚需 Apple Developer ID 签名/公证，以及 Intel 实机和国际区账号验收。当前没有这些证据。
