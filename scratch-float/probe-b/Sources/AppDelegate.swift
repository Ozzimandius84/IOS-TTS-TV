/*  The whole app: one word, one button, and the counters. No storyboard.
    Press START, then PiP, then the Home indicator -- and read the console.  */
import UIKit
import AVKit

@main final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    let probe = FloatProbe()
    private let word = UILabel(), stats = UILabel()

    func application(_ a: UIApplication, didFinishLaunchingWithOptions o: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let w = UIWindow(frame: UIScreen.main.bounds)
        let vc = UIViewController()
        vc.view.backgroundColor = .systemBackground

        word.font = .systemFont(ofSize: 44, weight: .bold)
        word.textAlignment = .center; word.text = "—"
        stats.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        stats.numberOfLines = 0; stats.textAlignment = .center

        // the PiP source layer, on screen so you can see it before it detaches
        let host = UIView(); host.backgroundColor = .black
        host.layer.addSublayer(probe.displayLayer)
        host.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([host.widthAnchor.constraint(equalToConstant: 320),
                                     host.heightAnchor.constraint(equalToConstant: 180)])

        let start = UIButton(type: .system), pip = UIButton(type: .system)
        start.setTitle("1 · start audio + frames", for: .normal)
        pip.setTitle("2 · enter PiP", for: .normal)
        start.addAction(UIAction { [weak self] _ in self?.probe.start(); start.isEnabled = false }, for: .touchUpInside)
        pip.addAction(UIAction { [weak self] _ in self?.probe.startPiP() }, for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [word, host, start, pip, stats])
        stack.axis = .vertical; stack.spacing = 14; stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        vc.view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: vc.view.centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: vc.view.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: vc.view.trailingAnchor, constant: -16)])

        probe.onWord = { [weak self] w, _ in self?.word.text = w }
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let s = self else { return }
            s.stats.text = s.probe.counters()
            print("[b] 1s \(s.probe.counters())")
        }
        w.rootViewController = vc; w.makeKeyAndVisible(); window = w
        probe.displayLayer.frame = CGRect(x: 0, y: 0, width: 320, height: 180)
        return true
    }
}
