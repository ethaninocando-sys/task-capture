// Task Capture for Mac: a tiny menu-bar app.
// Press ⌥Space anywhere → a floating window with the add-task form pops up.
// Add or Cancel → it hides and you're back in the app you were using.
//
// The form itself is the website (https://task-capture.vercel.app/?popup=1), so it stays in sync
// with the web app automatically. To point it somewhere else while testing:
//   defaults write app.taskcapture.mac url "http://localhost:5173/?popup=1"
// and to go back to normal:
//   defaults delete app.taskcapture.mac url

import Carbon.HIToolbox
import Cocoa
import ServiceManagement
import WebKit

let defaultURL = "https://task-capture.vercel.app/?popup=1"
let fullAppURL = "https://task-capture.vercel.app/"

/// A window that can take keyboard focus even though it has no title bar.
final class PopupPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSWindowDelegate {
    private var panel: PopupPanel!
    private var webView: WKWebView!
    private var statusItem: NSStatusItem!
    private var hotKeyRef: EventHotKeyRef?
    private var loadFailed = false

    private var pageURL: URL {
        let saved = UserDefaults.standard.string(forKey: "url")
        return URL(string: saved ?? defaultURL) ?? URL(string: defaultURL)!
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory) // menu bar only, no Dock icon
        buildPanel()
        buildMenuBarIcon()
        registerHotKey()
        enableStartAtLoginOnFirstRun()
    }

    /// taskcapture://add opens the popup (handy for Shortcuts, Stream Deck, etc.). taskcapture://close hides it.
    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls where url.scheme == "taskcapture" {
            if url.host == "close" { hidePopup() } else { showPopup() }
        }
    }

    // MARK: Floating window

    private func buildPanel() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // remembers your sign-in between launches
        config.userContentController.add(self, name: "taskCapture")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground") // no white flash while loading
        webView.load(URLRequest(url: pageURL))

        panel = PopupPanel(
            contentRect: NSRect(x: 0, y: 0, width: 560, height: 640),
            styleMask: [.titled, .fullSizeContentView, .closable],
            backing: .buffered,
            defer: false
        )
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.standardWindowButton(.closeButton)?.isHidden = true
        panel.standardWindowButton(.miniaturizeButton)?.isHidden = true
        panel.standardWindowButton(.zoomButton)?.isHidden = true
        panel.isMovableByWindowBackground = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.hidesOnDeactivate = true // click another app → it goes away
        panel.isReleasedWhenClosed = false
        panel.backgroundColor = NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
                ? NSColor(srgbRed: 0.082, green: 0.082, blue: 0.082, alpha: 1)
                : NSColor(srgbRed: 0.965, green: 0.961, blue: 0.949, alpha: 1)
        }
        panel.delegate = self
        panel.contentView = webView
    }

    @objc func togglePopup() {
        if panel.isVisible && NSApp.isActive { hidePopup() } else { showPopup() }
    }

    private func showPopup() {
        if loadFailed || webView.url == nil {
            loadFailed = false
            webView.load(URLRequest(url: pageURL))
        }
        // Center on the screen your mouse is on.
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) } ?? NSScreen.main
        if let visible = screen?.visibleFrame {
            let size = panel.frame.size
            panel.setFrameOrigin(NSPoint(x: visible.midX - size.width / 2, y: visible.midY - size.height / 2 + visible.height * 0.08))
        }
        NSApp.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)
        panel.makeFirstResponder(webView)
        webView.evaluateJavaScript("window.taskCaptureReset && window.taskCaptureReset()", completionHandler: nil)
    }

    private func hidePopup() {
        panel.orderOut(nil)
        NSApp.hide(nil) // hands focus back to the app you were using
    }

    // Messages from the web page ("close" after Add/Cancel/Esc).
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "close": hidePopup()
        case "openApp": openFullApp()
        default: break
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { loadFailed = true }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { loadFailed = true }

    // Links that leave the popup (e.g. "Open full app") open in your normal browser.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.targetFrame == nil, let url = action.request.url {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // MARK: Menu bar icon

    private func buildMenuBarIcon() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "checkmark.square", accessibilityDescription: "Task Capture")
            button.image?.isTemplate = true
        }
        let menu = NSMenu()
        menu.addItem(withTitle: "Quick add  (⌥Space)", action: #selector(togglePopup), keyEquivalent: "")
        menu.addItem(withTitle: "Open Task Capture", action: #selector(openFullApp), keyEquivalent: "")
        menu.addItem(.separator())
        let login = NSMenuItem(title: "Start at login", action: #selector(toggleStartAtLogin(_:)), keyEquivalent: "")
        login.state = SMAppService.mainApp.status == .enabled ? .on : .off
        menu.addItem(login)
        menu.addItem(withTitle: "Reload", action: #selector(reload), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Task Capture", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        for item in menu.items where item.action != #selector(NSApplication.terminate(_:)) { item.target = self }
        statusItem.menu = menu
    }

    @objc func openFullApp() {
        hidePopup()
        NSWorkspace.shared.open(URL(string: fullAppURL)!)
    }

    @objc func reload() {
        webView.load(URLRequest(url: pageURL))
    }

    @objc func toggleStartAtLogin(_ sender: NSMenuItem) {
        do {
            if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            } else {
                try SMAppService.mainApp.register()
            }
        } catch {
            NSLog("Start at login change failed: \(error)")
        }
        sender.state = SMAppService.mainApp.status == .enabled ? .on : .off
    }

    private func enableStartAtLoginOnFirstRun() {
        let key = "didSetUpStartAtLogin"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        UserDefaults.standard.set(true, forKey: key)
        try? SMAppService.mainApp.register()
    }

    // MARK: ⌥Space

    private func registerHotKey() {
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let selfPointer = Unmanaged.passUnretained(self).toOpaque()
        InstallEventHandler(GetApplicationEventTarget(), { _, _, userData in
            guard let userData else { return noErr }
            let delegate = Unmanaged<AppDelegate>.fromOpaque(userData).takeUnretainedValue()
            DispatchQueue.main.async { delegate.togglePopup() }
            return noErr
        }, 1, &eventType, selfPointer, nil)

        let hotKeyID = EventHotKeyID(signature: OSType(0x5443_4150), id: 1) // "TCAP"
        let status = RegisterEventHotKey(UInt32(kVK_Space), UInt32(optionKey), hotKeyID, GetApplicationEventTarget(), 0, &hotKeyRef)
        if status != noErr {
            NSLog("Could not register ⌥Space (another app may be using it). Status: \(status)")
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
