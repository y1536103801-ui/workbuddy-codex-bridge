# 来源与修改

WorkBuddy 认证、桌面凭证解密、客户端标识和上游目录/聊天实现来自 corrinehu/dsh-workbuddy-connect（MIT, Copyright 2026 Corrine Hu）的本地 0.8.1-ao-routing.15 分支。保留源码及 vendor/workbuddy/LICENSE。
https://github.com/corrinehu/dsh-workbuddy-connect

该上游的请求协议来自 Sliverkiss/workbuddy2api（MIT, Copyright 2026 Sliverkiss）。许可证声明见 THIRD_PARTY_NOTICES.txt。

原子文件写入工具来自 @deepseek-ai/dsh-atomic-write 0.2.1-rc.2（MIT, Copyright 2026 DeepSeek），以源码静态打包，许可证见 THIRD_PARTY_NOTICES.txt。运行不依赖 DeepSeek Harness。

本项目修改：所有账户缓存路径改为独立 bridgeHome；移除插件宿主和 Harness home 依赖；独立账号连接、Responses 适配、管理界面、Codex 配置与安装器由本项目实现。
