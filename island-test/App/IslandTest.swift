/*  The phone half of the measurement. Writes Documents/island-log.csv:

        ms,event,seq,phase,detail

    ms is milliseconds since launch (CACurrentMediaTime); an `info` line
    "wall <unix seconds>" says what wall-clock time ms=0 was, so the Mac's
    screen recording can be lined up with it.
      sent      the app called activity.update for piece `seq`
      acked     that update call returned
      content   ActivityKit reported the activity's content changed to `seq`
      state     the app went background / foreground / locked / unlocked
    Documents/island-done.txt appears when the run is over.  */
import ActivityKit
import AVFoundation
import QuartzCore
import UIKit

final class IslandTest {
    static let shared = IslandTest()

    struct Phase { let name: String; let interval: Double; let seconds: Double }
    /// Slowest first (run 2's island froze ~30 s in and the later steps
    /// inherited it), with 10 s of rest between steps to see if it recovers.
    static let phases: [Phase] = [
        Phase(name: "sentence", interval: 4.0, seconds: 40),
        Phase(name: "1/s", interval: 1.0, seconds: 30),
        Phase(name: "2/s", interval: 0.5, seconds: 30),
        Phase(name: "3/s", interval: 1.0 / 3.0, seconds: 30),
        Phase(name: "4/s", interval: 0.25, seconds: 30),
    ]
    static let settle = 3.0    // quiet seconds after leaving the app
    static let between = 10.0  // quiet seconds between steps

    static let text = """
    It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife. \
    However little known the feelings or views of such a man may be on his first entering a neighbourhood this truth is \
    so well fixed in the minds of the surrounding families that he is considered the rightful property of some one or \
    other of their daughters.
    """
    /// The words, long ones broken into pieces -- one piece per update.
    static let pieces = text.split(separator: " ").flatMap { IslandWord.pieces(String($0)) }
    static let sentenceStarts = ["It", "However", "My", "Mr.", "But", "This", "Why", "What", "Is", "How"]

    private let t0 = CACurrentMediaTime()
    private var activity: Activity<IslandAttributes>?
    private var player: AVAudioPlayer?
    private var started = false
    /// "clock" (run 4, the default): the island runs its own timer in the counting
    /// font and a hundredths stopwatch, and the app sends NO updates.
    /// "rates" (runs 1-3): pass `rates` as a launch argument.
    let mode: String = {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("rates") { return "rates" }
        if args.contains("clock") { return "clock" }
        if args.contains("words") { return "words" }
        return "diag"    // run 10, the default: the island's drawing rules
    }()
    /// Run 5: the island shows the words by its own switches at 3 a second, from 20 s after launch.
    static let wordLead = 20.0, wordsPerSecond = 3.0, wordCount = 30   // run 6: 30 (run 5's 90 got the activity dismissed)
    private var clockStart = Date()
    private let logQ = DispatchQueue(label: "islandtest.log")
    private var handle: FileHandle?
    // touched only on logQ
    private var nSent = 0, phaseNow = "waiting", note = ""

    private var docs: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }

    // MARK: launch (foreground)

    func prepare() {
        let fm = FileManager.default
        try? fm.removeItem(at: docs.appendingPathComponent("island-done.txt"))
        let logURL = docs.appendingPathComponent("island-log.csv")
        fm.createFile(atPath: logURL.path, contents: Data("ms,event,seq,phase,detail\n".utf8))
        handle = try? FileHandle(forWritingTo: logURL)
        handle?.seekToEndOfFile()

        let wallAtT0 = Date().timeIntervalSince1970 - (CACurrentMediaTime() - t0)
        log("info", detail: String(format: "wall %.4f", wallAtT0))
        var u = utsname(); uname(&u)
        let machine = withUnsafeBytes(of: &u.machine) { String(decoding: $0.prefix { $0 != 0 }, as: UTF8.self) }
        log("info", detail: "\(machine) iOS \(UIDevice.current.systemVersion)")
        log("info", detail: "live activities enabled=\(ActivityAuthorizationInfo().areActivitiesEnabled)")

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

        for old in Activity<IslandAttributes>.activities {
            Task { await old.end(nil, dismissalPolicy: .immediate) }
        }
        do {
            let first = IslandAttributes.ContentState(word: "ready", seq: 0, phase: "waiting")
            clockStart = Date()
            log("info", detail: String(format: "mode %@ clock_start %.4f", mode, clockStart.timeIntervalSince1970))
            var attrs = IslandAttributes(title: "Island test", start: clockStart, mode: mode)
            if mode == "words" {
                attrs.words = Array(Self.pieces.prefix(Self.wordCount))
                attrs.wordStart = clockStart.addingTimeInterval(Self.wordLead)
                attrs.wps = Self.wordsPerSecond
                log("info", detail: String(format: "word_window %.3f %.3f",
                                           Self.wordLead, Self.wordLead + Double(Self.wordCount) / Self.wordsPerSecond))
            }
            let a = try Activity.request(attributes: attrs,
                                         content: ActivityContent(state: first, staleDate: nil),
                                         pushType: nil)
            activity = a
            log("info", detail: "activity started")
            Task {
                for await c in a.contentUpdates { self.log("content", seq: c.state.seq, phase: c.state.phase) }
            }
            Task {
                for await s in a.activityStateUpdates { self.log("info", detail: "activity state \(s)") }
            }
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
            case "waiting": s += "Swipe up to the home screen now and leave the phone alone for about 3 minutes.\n\nDon't tap the island -- it opens this app."
            case "done": s += "Finished. The log is saved."
            default: s += "Running: \(phaseNow)"
            }
            return s + "\n\nsent \(nSent)"
        }
    }

    func appState(_ s: String) { log("state", detail: s) }

    // MARK: the run (background)

    func beginIfReady() {
        guard !started, activity != nil else { return }
        started = true
        let th = Thread { [self] in
            if self.mode == "clock" { self.runClock() } else if self.mode == "words" || self.mode == "diag" { self.runWords() } else { self.run() }
        }
        th.qualityOfService = .userInitiated
        th.start()
    }

    /// Run 4: send nothing; just stay alive (the tone keeps playing) while the
    /// island's own timer ticks, then end. The font covers 240 s from launch.
    private func runClock() {
        log("run_start", detail: "clock: no updates will be sent")
        // run 18: the widget shows RunWords.count words at RunWords.perSecond from RunWords.lead s
        log("info", detail: String(format: "word_window %.3f %.3f",
                                   RunWords.lead, RunWords.lead + Double(RunWords.count) / RunWords.perSecond))
        log("phase_start", phase: "clock")
        logQ.async { self.phaseNow = "clock" }
        let endAt = clockStart.addingTimeInterval(225)
        // run 19: stay until the words are over (+10 s), at most 225 s
        let wanted = clockStart.addingTimeInterval(RunWords.lead + Double(RunWords.count) / RunWords.perSecond + 10)
        Thread.sleep(until: min(endAt, wanted))
        log("phase_end", phase: "clock")
        finish()
    }

    /// Run 5: send nothing; stay alive until the word window is over, noting every 5 s
    /// whether the tone is still playing (run 4's app went quiet 5 s in).
    private func runWords() {
        log("run_start", detail: "\(mode): no updates will be sent")
        log("phase_start", phase: "words")
        logQ.async { self.phaseNow = "words" }
        let endAt = clockStart.addingTimeInterval(Self.wordLead + Double(Self.wordCount) / Self.wordsPerSecond + 10)
        while Date() < endAt {
            Thread.sleep(forTimeInterval: 5)
            let playing = DispatchQueue.main.sync { self.player?.isPlaying ?? false }
            log("alive", detail: "tone playing=\(playing)")
        }
        log("phase_end", phase: "words")
        finish()
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
        var sentenceIx = 0, pieceIx = 0
        for (i, step) in plan.enumerated() {
            if step.phase != lastPhase, !lastPhase.isEmpty {
                // the phase ends one interval after its last update
                let prev = Self.phases.first(where: { $0.name == lastPhase })!
                let endAt = start + plan[i - 1].at + prev.interval - CACurrentMediaTime()
                if endAt > 0 { Thread.sleep(forTimeInterval: endAt) }
                log("phase_end", phase: lastPhase)
            }
            let wait = start + step.at - CACurrentMediaTime()
            if wait > 0 { Thread.sleep(forTimeInterval: wait) }
            if step.phase != lastPhase {
                log("phase_start", phase: step.phase)
                lastPhase = step.phase
                logQ.async { self.phaseNow = step.phase }
            }
            let word: String
            if step.phase == "sentence" {
                word = Self.sentenceStarts[sentenceIx % Self.sentenceStarts.count]; sentenceIx += 1
            } else {
                word = Self.pieces[pieceIx % Self.pieces.count]; pieceIx += 1
            }
            send(seq: i + 1, phase: step.phase, word: word)
        }
        Thread.sleep(forTimeInterval: Self.phases.last!.interval)
        log("phase_end", phase: lastPhase)
        Thread.sleep(forTimeInterval: 3)
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
            self.logQ.async {
                self.phaseNow = "done"
                try? self.handle?.synchronize()
                try? Data("done\n".utf8).write(to: self.docs.appendingPathComponent("island-done.txt"))
            }
        }
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
