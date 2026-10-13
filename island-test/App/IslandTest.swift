/*  The measurement. Writes Documents/island-log.csv:

        ms,event,seq,phase,detail

    ms is milliseconds since launch on one monotonic clock (CACurrentMediaTime).
      sent      the app called activity.update for word `seq`
      acked     that update call returned
      drawn_X   the widget drew word `seq` in region X (c/m/e/l, see IslandSignal),
                read from the widget's own drawn.csv at the end of the run
      darwin_X  the same, heard as a Darwin notification (run 1 heard none)
      state     the app went background / foreground / locked / unlocked
    Documents/island-done.txt appears when the run is over.  */
import ActivityKit
import AVFoundation
import QuartzCore
import UIKit

private let darwinCallback: CFNotificationCallback = { _, _, name, _, _ in
    guard let cf = name?.rawValue else { return }
    IslandTest.shared.heard(cf as String)
}

final class IslandTest {
    static let shared = IslandTest()

    struct Phase { let name: String; let interval: Double; let seconds: Double }
    static let phases: [Phase] = [
        Phase(name: "1/s", interval: 1.0, seconds: 30),
        Phase(name: "2/s", interval: 0.5, seconds: 30),
        Phase(name: "3/s", interval: 1.0 / 3.0, seconds: 30),
        Phase(name: "4/s", interval: 0.25, seconds: 30),
        Phase(name: "sentence", interval: 4.0, seconds: 40),
    ]
    static let settle = 3.0    // quiet seconds after leaving the app
    static let between = 3.0   // quiet seconds between phases

    static let text = """
    It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife. \
    However little known the feelings or views of such a man may be on his first entering a neighbourhood this truth is \
    so well fixed in the minds of the surrounding families that he is considered the rightful property of some one or \
    other of their daughters.
    """
    static let words = text.split(separator: " ").map(String.init)
    static let sentences = [
        "It is a truth", "However little known", "My dear Mr. Bennet", "Mr. Bennet replied",
        "But it is", "This was invitation", "Why my dear", "What is his name",
        "Is he married", "How so?",
    ]

    private let t0 = CACurrentMediaTime()
    private var activity: Activity<IslandAttributes>?
    private var player: AVAudioPlayer?
    private var started = false
    private let logQ = DispatchQueue(label: "islandtest.log")
    private var handle: FileHandle?
    // touched only on logQ
    private var nSent = 0, nDrawn = 0, phaseNow = "waiting", note = ""

    private var docs: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }

    // MARK: launch (foreground)

    func prepare() {
        let fm = FileManager.default
        try? fm.removeItem(at: docs.appendingPathComponent("island-done.txt"))
        let logURL = docs.appendingPathComponent("island-log.csv")
        fm.createFile(atPath: logURL.path, contents: Data("ms,event,seq,phase,detail\n".utf8))
        handle = try? FileHandle(forWritingTo: logURL)
        handle?.seekToEndOfFile()

        let d = UIDevice.current
        var u = utsname(); uname(&u)
        let machine = withUnsafeBytes(of: &u.machine) { String(decoding: $0.prefix { $0 != 0 }, as: UTF8.self) }
        log("info", detail: "\(machine) iOS \(d.systemVersion)")
        log("info", detail: String(format: "t0 %.4f", t0))
        if let url = IslandSignal.drawnURL {
            try? fm.removeItem(at: url)
            log("info", detail: "shared folder ok")
        } else {
            log("error", detail: "shared folder (app group) not available to the app")
        }
        let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
        log("info", detail: "live activities enabled=\(enabled)")

        // the background-audio half: same pairing Frank uses (Playback + UIBackgroundModes audio)
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            let p = try AVAudioPlayer(contentsOf: toneURL())
            p.numberOfLoops = -1
            p.volume = 0.4
            p.play()
            player = p
            log("info", detail: "audio playing")
        } catch {
            log("error", detail: "audio: \(error.localizedDescription)")
        }

        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let me = Unmanaged.passUnretained(self).toOpaque()
        for r in IslandSignal.regions {
            for s in 0...IslandSignal.maxSeq {
                CFNotificationCenterAddObserver(center, me, darwinCallback,
                                                IslandSignal.name(r, s) as CFString, nil, .deliverImmediately)
            }
        }
        CFNotificationCenterAddObserver(center, me, darwinCallback, IslandSignal.noGroup as CFString, nil, .deliverImmediately)

        for old in Activity<IslandAttributes>.activities {
            Task { await old.end(nil, dismissalPolicy: .immediate) }
        }
        do {
            let first = IslandAttributes.ContentState(word: "ready", seq: 0, phase: "waiting")
            activity = try Activity.request(attributes: IslandAttributes(title: "Island test"),
                                            content: ActivityContent(state: first, staleDate: nil),
                                            pushType: nil)
            log("info", detail: "activity started")
        } catch {
            log("error", detail: "activity: \(error.localizedDescription)")
            logQ.async { self.note = "Could not start the Live Activity: \(error.localizedDescription)\n\nSettings → Island Test → Live Activities must be on." }
        }
    }

    func statusText() -> String {
        logQ.sync {
            var s = "Island test\n\n"
            if !note.isEmpty { return s + note }
            switch phaseNow {
            case "waiting": s += "Swipe up to the home screen now and leave the phone alone for 3 minutes.\n\nThe word beside the camera is the test."
            case "done": s += "Finished. The log is saved."
            default: s += "Running: \(phaseNow)"
            }
            return s + "\n\nsent \(nSent) · drawn \(nDrawn)"
        }
    }

    func appState(_ s: String) { log("state", detail: s) }

    // MARK: the run (background)

    func beginIfReady() {
        guard !started, activity != nil else { return }
        started = true
        let th = Thread { [self] in self.run() }
        th.qualityOfService = .userInitiated
        th.start()
    }

    private func run() {
        var plan: [(at: Double, phase: String)] = []
        var t = Self.settle
        for p in Self.phases {
            let n = Int((p.seconds / p.interval).rounded())
            for i in 0..<n { plan.append((t + Double(i) * p.interval, p.name)) }
            t += p.seconds + Self.between
        }
        let start = CACurrentMediaTime()
        log("run_start", detail: "planned \(plan.count) updates")
        var lastPhase = ""
        var sentenceIx = 0
        for (i, step) in plan.enumerated() {
            let wait = start + step.at - CACurrentMediaTime()
            if wait > 0 { Thread.sleep(forTimeInterval: wait) }
            if step.phase != lastPhase {
                if !lastPhase.isEmpty { log("phase_end", phase: lastPhase) }
                log("phase_start", phase: step.phase)
                lastPhase = step.phase
                logQ.async { self.phaseNow = step.phase }
            }
            let seq = i + 1
            let word: String
            if step.phase == "sentence" {
                word = Self.sentences[sentenceIx % Self.sentences.count]; sentenceIx += 1
            } else {
                word = Self.words[(seq - 1) % Self.words.count]
            }
            send(seq: seq, phase: step.phase, word: word)
        }
        Thread.sleep(forTimeInterval: Self.phases.last!.interval)
        log("phase_end", phase: lastPhase)
        Thread.sleep(forTimeInterval: 4)   // let late draws arrive
        finish()
    }

    private func send(seq: Int, phase: String, word: String) {
        guard let a = activity else { return }
        let state = IslandAttributes.ContentState(word: word, seq: seq, phase: phase)
        log("sent", seq: seq, phase: phase, detail: word)
        logQ.async { self.nSent += 1 }
        Task {
            await a.update(ActivityContent(state: state, staleDate: nil))
            self.log("acked", seq: seq, phase: phase)
        }
    }

    private func finish() {
        log("run_end")
        let last = IslandAttributes.ContentState(word: "done", seq: 0, phase: "done")
        let a = activity
        Task {
            await a?.end(ActivityContent(state: last, staleDate: nil), dismissalPolicy: .immediate)
            self.log("info", detail: "activity ended")
            DispatchQueue.main.async { self.player?.stop() }
            Thread.sleep(forTimeInterval: 2)
            self.mergeDrawn()
            self.logQ.async {
                self.phaseNow = "done"
                try? self.handle?.synchronize()
                try? Data("done\n".utf8).write(to: self.docs.appendingPathComponent("island-done.txt"))
            }
        }
    }

    // MARK: the widget's "drew word N"

    func heard(_ name: String) {
        if name == IslandSignal.noGroup { log("error", detail: "widget cannot open the shared folder"); return }
        guard name.hasPrefix(IslandSignal.prefix) else { return }
        let parts = name.dropFirst(IslandSignal.prefix.count).split(separator: ".")
        guard parts.count == 2, let seq = Int(parts[1]) else { return }
        log("darwin_\(parts[0])", seq: seq)
        logQ.async { self.nDrawn += 1 }
    }

    /// Copies the widget's drawn.csv into the log, on the app's clock.
    private func mergeDrawn() {
        guard let url = IslandSignal.drawnURL else { return }
        guard let text = try? String(contentsOf: url, encoding: .utf8) else {
            log("info", detail: "widget wrote no drawn.csv (it drew nothing)")
            return
        }
        var lines = ""
        var n = 0
        for row in text.split(separator: "\n") {
            let f = row.split(separator: ",")
            guard f.count == 3, let seq = Int(f[1]), let t = Double(f[2]) else { continue }
            lines += "\(Int(((t - t0) * 1000).rounded())),drawn_\(f[0]),\(seq),,\n"
            n += 1
        }
        let all = lines
        logQ.async { self.handle?.write(Data(all.utf8)) }
        log("info", detail: "merged \(n) widget draws")
    }

    // MARK: plumbing

    private func log(_ event: String, seq: Int = -1, phase: String = "", detail: String = "") {
        let ms = Int(((CACurrentMediaTime() - t0) * 1000).rounded())
        let clean = detail.replacingOccurrences(of: ",", with: " ").replacingOccurrences(of: "\n", with: " ")
        let line = "\(ms),\(event),\(seq),\(phase),\(clean)\n"
        logQ.async { self.handle?.write(Data(line.utf8)) }
    }

    /// Two seconds of a quiet 220 Hz tone, a whole number of cycles so it loops without a click.
    private func toneURL() -> URL {
        let sr = 22050, n = sr * 2
        var d = Data()
        func u32(_ v: UInt32) { var x = v.littleEndian; withUnsafeBytes(of: &x) { d.append(contentsOf: $0) } }
        func u16(_ v: UInt16) { var x = v.littleEndian; withUnsafeBytes(of: &x) { d.append(contentsOf: $0) } }
        d.append(contentsOf: Array("RIFF".utf8)); u32(UInt32(36 + n * 2)); d.append(contentsOf: Array("WAVE".utf8))
        d.append(contentsOf: Array("fmt ".utf8)); u32(16); u16(1); u16(1); u32(UInt32(sr)); u32(UInt32(sr * 2)); u16(2); u16(16)
        d.append(contentsOf: Array("data".utf8)); u32(UInt32(n * 2))
        for i in 0..<n {
            let v = sin(2.0 * Double.pi * 220.0 * Double(i) / Double(sr)) * 0.06 * 32767.0
            u16(UInt16(bitPattern: Int16(v)))
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("island-tone.wav")
        try? d.write(to: url)
        return url
    }
}
