/*  Island Test -- a throwaway app, deliberately NOT Frank.
    Opens, starts a quiet looping tone and one Live Activity, and waits.
    The timed run starts the moment you leave the app.  */
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private let status = UILabel()

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let w = UIWindow(frame: UIScreen.main.bounds)
        let vc = UIViewController()
        vc.view.backgroundColor = .systemBackground
        status.numberOfLines = 0
        status.textAlignment = .center
        status.font = .systemFont(ofSize: 17)
        status.translatesAutoresizingMaskIntoConstraints = false
        vc.view.addSubview(status)
        NSLayoutConstraint.activate([
            status.centerYAnchor.constraint(equalTo: vc.view.centerYAnchor),
            status.leadingAnchor.constraint(equalTo: vc.view.leadingAnchor, constant: 24),
            status.trailingAnchor.constraint(equalTo: vc.view.trailingAnchor, constant: -24),
        ])
        w.rootViewController = vc
        w.makeKeyAndVisible()
        window = w

        IslandTest.shared.prepare()
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.status.text = IslandTest.shared.statusText()
        }
        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        IslandTest.shared.appState("background")
        IslandTest.shared.beginIfReady()
    }
    func applicationWillEnterForeground(_ application: UIApplication) {
        IslandTest.shared.appState("foreground")
    }
    func applicationProtectedDataWillBecomeUnavailable(_ application: UIApplication) {
        IslandTest.shared.appState("locked")
    }
    func applicationProtectedDataDidBecomeAvailable(_ application: UIApplication) {
        IslandTest.shared.appState("unlocked")
    }
}
