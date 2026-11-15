# WorkBuddy Codex Bridge

主工作树在 Mac mini。主 Agent 负责集成。中文沟通，结论绑定版本与证据。
- 范围：独立 macOS WorkBuddy → Codex 连接器，动态模型选择，内置运行时一键安装。
- 运行时不依赖 Harness、OpenCodex 或用户安装 Node。不得读取其账号池。
- 仅在用户点击连接后读取当前 WorkBuddy 登录，手动导入保存在项目自己的私有数据目录。
- 正式安装默认 ~/Applications/WorkBuddy Codex Bridge.app；数据 ~/Library/Application Support/WorkBuddy Codex Bridge。
- npm run check 是交付前全量入口；npm run package 在候选冻结后执行。
- 开发先跑受影响 node --test 文件，最终只跑一次有效全量；检查在 Mac mini。
- 测试用 WBCB_HOME、WBCB_CODEX_HOME 隔离；禁止修改真实 Codex 配置或现有服务来跑测试。
- 凭证不得进入 Git、安装包、网页响应或日志；证据只记录摘要。
- 状态来源 docs/STATUS.md；第三方修改记录 docs/PROVENANCE.md。
- 遵守当前用户 ANTI-ARMOR v5.0：简洁中文、具体未知、无套话、无未经请求反驳，不报告无关未改范围。
