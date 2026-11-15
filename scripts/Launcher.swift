import AppKit
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let resources = Bundle.main.resourceURL!
let task = Process()
task.executableURL = resources.appendingPathComponent("node")
task.arguments = [resources.appendingPathComponent("cli.mjs").path, "launch"]
let pipe = Pipe()
task.standardError = pipe
task.standardOutput = FileHandle.nullDevice
DispatchQueue.global().async {
    do {
        try task.run()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        task.waitUntilExit()
        if task.terminationStatus != 0 {
            let message = String(data: data, encoding: .utf8) ?? "请重新打开应用。"
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.messageText = "WorkBuddy Codex Bridge 启动失败"
                alert.informativeText = message
                alert.addButton(withTitle: "好")
                NSApp.activate(ignoringOtherApps: true)
                alert.runModal()
                NSApp.terminate(nil)
            }
        } else { DispatchQueue.main.async { NSApp.terminate(nil) } }
    } catch {
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = "无法启动连接器"
            alert.informativeText = error.localizedDescription
            alert.runModal()
            NSApp.terminate(nil)
        }
    }
}
app.run()
