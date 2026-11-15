# 使用说明

适用于 macOS 13 及以上。Apple 芯片下载 arm64，Intel 下载 x64。安装包已包含 Node 运行时。

1. 解压安装包，双击“安装.command”，或打开 WorkBuddy Codex Bridge.app。程序会安装到 ~/Applications，并打开设置页面。
2. 在 WorkBuddy 登录账号，回到设置页点击“连接已登录的 WorkBuddy”。也可以在“手动导入账号凭证”中粘贴完整 JSON（accessToken、refreshToken、uid、expiresAt，以及账号适用的 enterpriseId/domain）。
3. 从实时获取的模型列表选择模型。点击“检测工具调用”会发起一次短模型请求并使用账号额度。
4. 点击“应用到 Codex”。重新打开 Codex，并新建聊天。切换模型后再次点击“应用到 Codex”。

此版本采用本地临时签名，尚无 Apple Developer ID 公证。若 macOS 拦截首次打开，请在 Finder 右键打开，或在“系统设置 → 隐私与安全性”允许本次打开。无需关闭 Gatekeeper。

数据保存在 ~/Library/Application Support/WorkBuddy Codex Bridge，目录仅当前用户可读。服务只监听 127.0.0.1；默认端口 13246，首次安装遇到占用会自动选择后续空闲端口。WorkBuddy 凭证仅在本机用于访问 WorkBuddy；聊天内容发送给对应 WorkBuddy 服务。用户明确连接之前不会读取登录凭证。

应用到 Codex 会备份并更新 ~/.codex/config.toml（或 CODEX_HOME）。更新保留其他配置值，但 TOML 注释会在重写时移除；原始文本备份在数据目录 codex-config.original.toml。设置页可恢复接入前的模型/提供商设置。如果这些字段后来被其他程序修改，恢复会停止并指出字段，避免覆盖。

模型列表表示账号目录返回的模型。“工具检测通过”只代表该模型完成了短工具调用；不是全部模型能力的认证。未检测的模型也可以选择。账号区域可选中国区和国际区；当前真实验收覆盖中国区。

软件会刷新即将过期的凭证；若 WorkBuddy 撤销登录或刷新失败，请重新登录并连接。额度耗尽或模型限流时，页面/聊天会显示上游原因；不会自动重复提交生成。

重新打开设置：在 ~/Applications 打开 WorkBuddy Codex Bridge.app。
卸载：运行安装包中的“卸载.command”。程序先恢复其管理的 Codex 配置，再删除应用和登录启动项；账号数据保留以供恢复，需要清除凭证时先在设置页点击“断开账号”。
