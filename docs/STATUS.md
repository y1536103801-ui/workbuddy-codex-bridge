# 交付状态

版本：0.1.0。日期：2026-11-15。设备：Mac mini / arm64 / macOS 27.2。
安装包源码提交：d8c4b9489f326e1922dacd3dd1f1eb496f92f181。

## 已交付

独立账号连接与凭证刷新、动态模型列表、模型选择、Responses 转换、本地设置页、Codex 配置与恢复、带 Node 运行时的一键安装/卸载和登录启动。运行不需要 DeepSeek Harness、OpenCodex 或 Homebrew。

支持目标为 macOS 13.5 及以上，构建了 arm64 与 x64 两种 ZIP。release/manifest.json 和 SHA256SUMS.txt 记录包清单与校验值。实际下载到管理端后，两个 ZIP 的 SHA256 均一致，见 evidence/download-verification.json。

## 验收证据

- 最终 npm run check 退出 0，14/14 测试通过；npm audit --omit=dev 为 0 漏洞。测试覆盖独立凭证导入/刷新、未来模型选择、流式输出/断流、推理历史、普通/自定义工具、输入校验、接口认证、Origin/Host 边界、配置恢复与冲突保护。
- Google Chrome：搜索、选择、应用隔离 Codex 配置、重载保留选择、无匹配结果、模型切换和窄屏无横向溢出通过；桌面和窄屏截图已检查。见 evidence/ui-check.json。
- 中国区 WorkBuddy 当前登录直接连接，取得 30 个模型；GLM-5.3-Flash 工具检测通过。见 evidence/live-catalog.json 和 live-tool-check.json。
- Codex app-server 的 model/list 返回 30 个模型。见 evidence/codex-model-list.json。
- 源码服务：Codex CLI 0.169.0-alpha.11.1 完成读取 input.txt → 创建 result.txt（46）→ DONE，退出码 0。见 evidence/live-codex.json。
- 正式 arm64 ZIP：解压后从安装.command 安装，PATH 中无 Node/Homebrew；自动避开已占端口；原生应用启动器可打开服务；连接账号后 Codex 再次完成读取输入并写出 42，退出码 0；随后恢复原 Codex 配置、清除凭证并成功卸载应用和 LaunchAgent。见 evidence/package-check.json。
- 两种架构安装包的临时签名校验、打包文件凭证检查和独立运行时动态链接检查均通过。内置 Node 二进制最低系统版本为 13.5。

## 验收范围

真实模型任务覆盖 GLM-5.3-Flash；30 个模型是本次账号目录返回数量，不代表全部完成工具验收。每个模型可单独检测。
Intel 包已构建并做静态校验，尚未在 Intel 实机运行。国际区入口已实现，尚无国际区账号真实验收。
安装包使用 ad-hoc 临时签名，尚无 Apple Developer ID 公证；首次打开步骤见安装说明。未发布公共 GitHub 仓库。

最终全量后只有最低系统版本、打包与验收脚本/记录变化；业务源码与已通过的全量一致。后续只做对应安装包验收，未重复业务全量。
