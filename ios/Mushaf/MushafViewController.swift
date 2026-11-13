import UIKit
import WebKit

/// Shows the Mushaf Reader web app full-screen. Its pages, text and fonts come from the published web app, and
/// pages that have been opened stay available offline (the web app's service worker).
final class MushafViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    static let home = URL(string: "https://maazarif.github.io/quran-app/")!
    private var webView: WKWebView!
    private let offline = UIStackView()

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []      // recitation starts from the app's own play button
        config.limitsNavigationsToAppBoundDomains = true          // with WKAppBoundDomains: enables offline pages
        config.websiteDataStore = .default()                      // bookmarks, highlights and settings persist
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never // the page handles the notch itself
        webView.isOpaque = false
        webView.backgroundColor = UIColor(named: "Ground")
        webView.scrollView.backgroundColor = UIColor(named: "Ground")
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        buildOfflineMessage()
        webView.load(URLRequest(url: Self.home))
    }

    /// The app's own pages stay in the app; any other link opens in Safari.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        let own = url.host == Self.home.host && url.path.hasPrefix("/quran-app")
        if own || ["about", "blob", "data"].contains(url.scheme ?? "") || action.targetFrame?.isMainFrame == false {
            return decisionHandler(.allow)
        }
        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }

    /// Links that ask for a new window (target="_blank") open in Safari.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { UIApplication.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { offline.isHidden = true }

    /// No connection the very first time (before anything is saved for offline reading).
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        offline.isHidden = false
    }

    /// If iOS stops the page in the background to free memory, bring it back.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    private func buildOfflineMessage() {
        let title = UILabel(); title.text = "No internet connection"; title.font = .preferredFont(forTextStyle: .headline)
        let body = UILabel(); body.text = "Mushaf needs to connect once to download the Quran text. Pages you open are then kept for reading offline."
        body.numberOfLines = 0; body.textAlignment = .center; body.font = .preferredFont(forTextStyle: .subheadline); body.textColor = .secondaryLabel
        let retry = UIButton(type: .system); retry.setTitle("Try again", for: .normal)
        retry.addAction(UIAction { [weak self] _ in self?.webView.load(URLRequest(url: Self.home)) }, for: .touchUpInside)
        offline.axis = .vertical; offline.spacing = 12; offline.alignment = .center
        [title, body, retry].forEach(offline.addArrangedSubview)
        offline.isHidden = true
        offline.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(offline)
        NSLayoutConstraint.activate([
            offline.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            offline.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor, constant: 16),
            offline.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor, constant: -16),
        ])
    }
}
