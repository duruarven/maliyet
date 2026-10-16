import UIKit
import WebKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = MaliyetViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

final class MaliyetViewController: UIViewController, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate {
    private var webView: WKWebView!
    private var activeID: String?
    private var temporaryDirectory: URL?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 245/255, green: 245/255, blue: 239/255, alpha: 1)
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "exportFile")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        guard let folder = Bundle.main.resourceURL?.appendingPathComponent("Web") else { return }
        webView.loadFileURL(folder.appendingPathComponent("index.html"), allowingReadAccessTo: folder)
        // Remove only stale exports from earlier application launches.
        let cache = FileManager.default.temporaryDirectory.appendingPathComponent("MaliyetExports")
        try? FileManager.default.removeItem(at: cache)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.request.url?.isFileURL == true ? .allow : .cancel)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true,
              let body = message.body as? [String: Any], let id = body["id"] as? String else { return }
        guard activeID == nil, let name = body["filename"] as? String,
              name == (name as NSString).lastPathComponent, !name.hasPrefix("."),
              ["pdf", "csv"].contains((name as NSString).pathExtension),
              let action = body["action"] as? String, ["save", "share"].contains(action),
              let encoded = body["data"] as? String, encoded.count <= 40_000_000,
              let data = Data(base64Encoded: encoded) else {
            reply(id, "error")
            return
        }
        activeID = id
        do {
            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent("MaliyetExports").appendingPathComponent(UUID().uuidString)
            temporaryDirectory = directory
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let url = directory.appendingPathComponent(name)
            try data.write(to: url, options: .atomic)
            if action == "save" {
                let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                picker.delegate = self
                present(picker, animated: true)
            } else {
                let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                sheet.popoverPresentationController?.sourceView = view
                sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
                sheet.completionWithItemsHandler = { [weak self] _, completed, _, error in
                    self?.finish(error == nil ? (completed ? "completed" : "cancelled") : "error")
                }
                present(sheet, animated: true)
            }
        } catch { finish("error") }
    }

    private func reply(_ id: String, _ status: String) {
        guard let bytes = try? JSONSerialization.data(withJSONObject: [id, status]),
              let arguments = String(data: bytes, encoding: .utf8) else { return }
        webView.evaluateJavaScript("NativeExport.complete(...\(arguments))", completionHandler: nil)
    }
    private func finish(_ status: String) {
        if let id = activeID { reply(id, status) }
        activeID = nil
        if let directory = temporaryDirectory { try? FileManager.default.removeItem(at: directory) }
        temporaryDirectory = nil
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) { finish("completed") }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finish("cancelled") }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "Maliyet", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Vazgeç", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "Sıfırla", style: .destructive) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
}
