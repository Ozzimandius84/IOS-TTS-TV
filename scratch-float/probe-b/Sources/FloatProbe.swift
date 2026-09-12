/*  FloatProbe.swift -- road (b): a native picture-in-picture window painting
    ONE WORD, fed by an AVSampleBufferDisplayLayer, while the app is in the
    background and audio keeps playing.

    What it answers, and nothing else:
      1. does AVPictureInPictureController start at all here
         (`isPictureInPictureSupported`, and the delegate's failedToStart)
      2. does the layer keep taking frames once the app is BACKGROUNDED
         -- the number printed every second is `enqueued while background`,
         and that number is the road
      3. what it costs in Info.plist -- UIBackgroundModes: [audio], and
         AVAudioSession .playback. No provisioning entitlement, so a free
         personal team should sign it; the SIMULATOR cannot prove that half
         (it signs nothing), which is why step 4 of RUN.md is the real phone.

    Everything is printed with print(); read it in Xcode's console.
*/
import UIKit
import AVKit
import AVFoundation
import CoreMedia

struct Word: Decodable { let t: Double; let e: Double; let w: String }
struct Timeline: Decodable { let words: Int; let span: Double; let timeline: [Word] }

final class FloatProbe: NSObject, AVPictureInPictureControllerDelegate,
                        AVPictureInPictureSampleBufferPlaybackDelegate {

    let displayLayer = AVSampleBufferDisplayLayer()
    private var pip: AVPictureInPictureController?
    private var player: AVAudioPlayer?
    private var link: CADisplayLink?
    private var starts: [Double] = []
    private var words: [String] = []
    private var lastIndex = -2
    private var t0 = CACurrentMediaTime()

    /* the counters that are the measurement */
    private(set) var enqueuedForeground = 0
    private(set) var enqueuedBackground = 0
    private(set) var wordsForeground = 0
    private(set) var wordsBackground = 0
    private var background = false
    var onWord: ((String, Int) -> Void)?

    // MARK: - the timeline (the same timeline.json the web probe uses)
    func loadTimeline() {
        guard let u = Bundle.main.url(forResource: "timeline", withExtension: "json"),
              let d = try? Data(contentsOf: u),
              let tl = try? JSONDecoder().decode(Timeline.self, from: d) else {
            print("[b] NO timeline.json in the bundle"); return
        }
        starts = tl.timeline.map { $0.t }
        words  = tl.timeline.map { $0.w }
        print("[b] timeline \(tl.words) words, \(tl.span)s, \(String(format: "%.3f", Double(tl.words)/tl.span)) w/s")
    }

    /// last word whose start <= s -- the same rule as wordclock.js `indexAt`
    private func indexAt(_ s: Double) -> Int {
        var lo = 0, hi = starts.count - 1, ans = -1
        while lo <= hi { let mid = (lo + hi) / 2
            if starts[mid] <= s { ans = mid; lo = mid + 1 } else { hi = mid - 1 } }
        return ans
    }

    // MARK: - audio (so the app has a reason to run in the background at all)
    func startAudio() {
        let s = AVAudioSession.sharedInstance()
        do {
            try s.setCategory(.playback, mode: .spokenAudio, options: [])
            try s.setActive(true)
            print("[b] AVAudioSession .playback active — category=\(s.category.rawValue)")
        } catch { print("[b] AVAudioSession FAILED \(error)") }
        // 12 s of a quiet 220 Hz tone, built here so the probe ships no media
        let rate = 8000.0, secs = 12.0, n = Int(rate * secs)
        var pcm = Data(capacity: 44 + n * 2)
        func le32(_ v: UInt32) -> Data { withUnsafeBytes(of: v.littleEndian) { Data($0) } }
        func le16(_ v: UInt16) -> Data { withUnsafeBytes(of: v.littleEndian) { Data($0) } }
        pcm.append("RIFF".data(using: .ascii)!); pcm.append(le32(UInt32(36 + n*2)))
        pcm.append("WAVEfmt ".data(using: .ascii)!); pcm.append(le32(16)); pcm.append(le16(1))
        pcm.append(le16(1)); pcm.append(le32(UInt32(rate))); pcm.append(le32(UInt32(rate*2)))
        pcm.append(le16(2)); pcm.append(le16(16)); pcm.append("data".data(using: .ascii)!)
        pcm.append(le32(UInt32(n*2)))
        for i in 0..<n { pcm.append(le16(UInt16(bitPattern: Int16(sin(2 * .pi * 220 * Double(i) / rate) * 6000)))) }
        do { player = try AVAudioPlayer(data: pcm); player?.numberOfLoops = -1; player?.play()
             print("[b] tone playing") } catch { print("[b] AVAudioPlayer FAILED \(error)") }
    }

    // MARK: - the frames
    private func frame(_ text: String) -> CMSampleBuffer? {
        let w = 320, h = 180
        var pb: CVPixelBuffer?
        CVPixelBufferCreate(kCFAllocatorDefault, w, h, kCVPixelFormatType_32BGRA,
            [kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary] as CFDictionary, &pb)
        guard let px = pb else { return nil }
        CVPixelBufferLockBaseAddress(px, [])
        defer { CVPixelBufferUnlockBaseAddress(px, []) }
        guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(px), width: w, height: h,
                bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(px),
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue |
                            CGBitmapInfo.byteOrder32Little.rawValue) else { return nil }
        ctx.setFillColor(UIColor.black.cgColor); ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
        UIGraphicsPushContext(ctx); ctx.translateBy(x: 0, y: CGFloat(h)); ctx.scaleBy(x: 1, y: -1)
        let size = min(CGFloat(64), CGFloat(520) / CGFloat(max(4, text.count)))
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: size, weight: .bold), .foregroundColor: UIColor.white]
        let s = NSAttributedString(string: text, attributes: attrs)
        let r = s.size()
        s.draw(at: CGPoint(x: (CGFloat(w) - r.width)/2, y: (CGFloat(h) - r.height)/2))
        UIGraphicsPopContext()

        var fmt: CMFormatDescription?
        CMVideoFormatDescriptionCreateForImageBuffer(allocator: kCFAllocatorDefault,
            imageBuffer: px, formatDescriptionOut: &fmt)
        guard let f = fmt else { return nil }
        var timing = CMSampleTimingInfo(duration: .invalid,
            presentationTimeStamp: CMClockGetTime(CMClockGetHostTimeClock()),
            decodeTimeStamp: .invalid)
        var sb: CMSampleBuffer?
        CMSampleBufferCreateReadyWithImageBuffer(allocator: kCFAllocatorDefault, imageBuffer: px,
            formatDescription: f, sampleTiming: &timing, sampleBufferOut: &sb)
        if let sb = sb,
           let arr = CMSampleBufferGetSampleAttachmentsArray(sb, createIfNecessary: true) {
            let d = unsafeBitCast(CFArrayGetValueAtIndex(arr, 0), to: CFMutableDictionary.self)
            CFDictionarySetValue(d,
                Unmanaged.passUnretained(kCMSampleAttachmentKey_DisplayImmediately).toOpaque(),
                Unmanaged.passUnretained(kCFBooleanTrue).toOpaque())
        }
        return sb
    }

    // MARK: - the loop. A CADisplayLink, NOT requestAnimationFrame: the point
    // of the native road is that this keeps firing when the app is not front.
    func start() {
        displayLayer.videoGravity = .resizeAspect
        loadTimeline(); startAudio()
        t0 = CACurrentMediaTime()
        let l = CADisplayLink(target: self, selector: #selector(tick))
        l.preferredFramesPerSecond = 30
        l.add(to: .main, forMode: .common)
        link = l

        print("[b] isPictureInPictureSupported = \(AVPictureInPictureController.isPictureInPictureSupported())")
        guard AVPictureInPictureController.isPictureInPictureSupported() else {
            print("[b] ROAD (b) CLOSED on this device/simulator"); return }
        let src = AVPictureInPictureController.ContentSource(
            sampleBufferDisplayLayer: displayLayer, playbackDelegate: self)
        let c = AVPictureInPictureController(contentSource: src)
        c.delegate = self
        c.canStartPictureInPictureAutomaticallyFromInline = true   // the YouTube behaviour
        pip = c
        NotificationCenter.default.addObserver(self, selector: #selector(bg),
            name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(fg),
            name: UIApplication.willEnterForegroundNotification, object: nil)
    }

    @objc private func bg() { background = true; print("[b] --- BACKGROUND at \(counters())") }
    @objc private func fg() { print("[b] --- FOREGROUND at \(counters())"); background = false }

    func counters() -> String {
        "fg frames \(enqueuedForeground), bg frames \(enqueuedBackground), " +
        "fg words \(wordsForeground), bg words \(wordsBackground), " +
        "pip=\(pip?.isPictureInPictureActive == true)"
    }

    @objc private func tick() {
        let t = (player?.currentTime).map { Double($0) } ?? (CACurrentMediaTime() - t0)
        let i = indexAt(t.truncatingRemainder(dividingBy: max(1, starts.last ?? 1)))
        let word = i < 0 ? "—" : words[i]
        if i != lastIndex { lastIndex = i
            if background { wordsBackground += 1 } else { wordsForeground += 1 }
            onWord?(word, i) }
        guard displayLayer.isReadyForMoreMediaData, let sb = frame(word) else { return }
        displayLayer.enqueue(sb)
        if background { enqueuedBackground += 1 } else { enqueuedForeground += 1 }
    }

    func startPiP() {
        guard let c = pip else { return print("[b] no controller") }
        print("[b] possible=\(c.isPictureInPicturePossible) active=\(c.isPictureInPictureActive)")
        c.startPictureInPicture()
    }

    // MARK: - delegate
    func pictureInPictureControllerDidStartPictureInPicture(_ c: AVPictureInPictureController) {
        print("[b] DID START  \(counters())") }
    func pictureInPictureController(_ c: AVPictureInPictureController,
        failedToStartPictureInPictureWithError e: Error) { print("[b] FAILED TO START \(e)") }
    func pictureInPictureControllerDidStopPictureInPicture(_ c: AVPictureInPictureController) {
        print("[b] DID STOP  \(counters())") }

    // MARK: - sample-buffer playback delegate (required)
    func pictureInPictureController(_ c: AVPictureInPictureController, setPlaying playing: Bool) {
        playing ? player?.play() : player?.pause(); print("[b] setPlaying \(playing)") }
    func pictureInPictureControllerTimeRangeForPlayback(_ c: AVPictureInPictureController)
        -> CMTimeRange { CMTimeRange(start: .negativeInfinity, duration: .positiveInfinity) }
    func pictureInPictureControllerIsPlaybackPaused(_ c: AVPictureInPictureController) -> Bool {
        !(player?.isPlaying ?? false) }
    func pictureInPictureController(_ c: AVPictureInPictureController,
        didTransitionToRenderSize size: CMVideoDimensions) {
        print("[b] render size \(size.width)x\(size.height)") }
    func pictureInPictureController(_ c: AVPictureInPictureController,
        skipByInterval i: CMTime, completion: @escaping () -> Void) { completion() }
}
