/*  Island Test, the Mac half: record the iPhone's screen over the cable (the
    same feed QuickTime's "Movie Recording -> iPhone" uses) and write down,
    for every frame, how much the strip where the Dynamic Island sits changed.

        record <out dir> [max seconds]

    <out dir>/screen.csv      wall_seconds,diff   one row per frame
    <out dir>/info.txt        device, frame size, the strip measured
    <out dir>/full-start.png  one whole frame, to check the island is in the picture
    <out dir>/frames/<ms>.png   the island strip, whenever it changed (<= 10 a second)
                              and once every 2 s otherwise -- named by wall ms

    No window, no Dock icon; Terminal may ask once for Camera access, which is
    how macOS guards any screen feed from a plugged-in phone.  */
import AVFoundation
import CoreImage
import CoreMediaIO
import Foundation
import ImageIO
import UniformTypeIdentifiers

setvbuf(stdout, nil, _IOLBF, 0)
let args = CommandLine.arguments
guard args.count >= 2 else { print("usage: record <out dir> [max seconds]"); exit(2) }
let outDir = URL(fileURLWithPath: args[1])
let maxSeconds = args.count > 2 ? (Double(args[2]) ?? 600) : 600
let framesDir = outDir.appendingPathComponent("frames")
try? FileManager.default.createDirectory(at: framesDir, withIntermediateDirectories: true)

// 1. let iOS devices appear as capture devices (what QuickTime does on launch)
var prop = CMIOObjectPropertyAddress(
    mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyAllowScreenCaptureDevices),
    mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
    mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
var allow: UInt32 = 1
CMIOObjectSetPropertyData(CMIOObjectID(kCMIOObjectSystemObject), &prop, 0, nil,
                          UInt32(MemoryLayout<UInt32>.size), &allow)

// 2. camera permission (asked once, for Terminal)
let sem = DispatchSemaphore(value: 0)
var granted = false
AVCaptureDevice.requestAccess(for: .video) { g in granted = g; sem.signal() }
sem.wait()
guard granted else {
    print("record: no Camera permission for Terminal -- System Settings > Privacy & Security > Camera > Terminal on, then run again")
    exit(3)
}

// 3. find the phone (it can take a few seconds to show up)
var device: AVCaptureDevice?
let deadline = Date().addingTimeInterval(20)
while device == nil && Date() < deadline {
    RunLoop.current.run(until: Date().addingTimeInterval(0.5))
    device = AVCaptureDevice.devices(for: .muxed).first
}
guard let phone = device else {
    print("record: no phone screen feed found (is it plugged in by cable and unlocked?)")
    exit(4)
}

final class Recorder: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    let csv: FileHandle
    let ci = CIContext()
    var prev: [Int32] = []
    var lastSave = 0.0
    var savedFull = false
    var frames = 0

    init(_ dir: URL) {
        let url = dir.appendingPathComponent("screen.csv")
        FileManager.default.createFile(atPath: url.path, contents: Data("wall,diff\n".utf8))
        csv = try! FileHandle(forWritingTo: url)
        csv.seekToEndOfFile()
    }

    func save(_ img: CIImage, _ url: URL) {
        guard let cg = ci.createCGImage(img, from: img.extent),
              let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)
        else { return }
        CGImageDestinationAddImage(dest, cg, nil)
        CGImageDestinationFinalize(dest)
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sb: CMSampleBuffer, from c: AVCaptureConnection) {
        let wall = Date().timeIntervalSince1970
        guard let pb = CMSampleBufferGetImageBuffer(sb) else { return }
        CVPixelBufferLockBaseAddress(pb, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pb, .readOnly) }
        let w = CVPixelBufferGetWidth(pb), h = CVPixelBufferGetHeight(pb)
        let bpr = CVPixelBufferGetBytesPerRow(pb)
        guard let base = CVPixelBufferGetBaseAddress(pb)?.assumingMemoryBound(to: UInt8.self) else { return }

        // the island's strip: top 0.8%..6.5% of the screen, middle 84% of the width (run 3's 60% cut the end of the word off)
        let y0 = Int(Double(h) * 0.008), y1 = Int(Double(h) * 0.065)
        let x0 = Int(Double(w) * 0.08), x1 = Int(Double(w) * 0.92)
        var cur = [Int32]()
        cur.reserveCapacity(((y1 - y0) / 3 + 1) * ((x1 - x0) / 3 + 1))
        var y = y0
        while y < y1 {
            var x = x0
            let row = base + y * bpr
            while x < x1 {
                let p = row + x * 4
                cur.append(Int32(p[0]) + Int32(p[1]) + Int32(p[2]))
                x += 3
            }
            y += 3
        }
        var diff = 0.0
        if prev.count == cur.count {
            var s: Int64 = 0
            for i in 0..<cur.count { s += Int64(abs(cur[i] - prev[i])) }
            diff = Double(s) / Double(cur.count)
        }
        prev = cur
        csv.write(Data(String(format: "%.4f,%.3f\n", wall, diff).utf8))
        frames += 1

        let full = CIImage(cvPixelBuffer: pb)
        if !savedFull {
            savedFull = true
            save(full, outDir.appendingPathComponent("full-start.png"))
            try? "phone frame \(w)x\(h); strip x \(x0)-\(x1) y \(y0)-\(y1)\n"
                .write(to: outDir.appendingPathComponent("info.txt"), atomically: true, encoding: .utf8)
        }
        if (diff > 1.0 && wall - lastSave > 0.1) || wall - lastSave > 2.0 {
            lastSave = wall
            // CIImage's origin is bottom-left
            let strip = full.cropped(to: CGRect(x: x0, y: h - y1, width: x1 - x0, height: y1 - y0))
            save(strip, framesDir.appendingPathComponent(String(format: "%.0f.png", wall * 1000)))
        }
    }
}

let session = AVCaptureSession()
do {
    let input = try AVCaptureDeviceInput(device: phone)
    guard session.canAddInput(input) else { print("record: cannot use the phone feed"); exit(5) }
    session.addInput(input)
} catch {
    print("record: \(error.localizedDescription)"); exit(5)
}
let output = AVCaptureVideoDataOutput()
output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
output.alwaysDiscardsLateVideoFrames = true
let recorder = Recorder(outDir)
output.setSampleBufferDelegate(recorder, queue: DispatchQueue(label: "record"))
guard session.canAddOutput(output) else { print("record: cannot read frames"); exit(5) }
session.addOutput(output)
session.startRunning()
print("record: recording \(phone.localizedName)")
signal(SIGTERM) { _ in exit(0) }
signal(SIGINT) { _ in exit(0) }
RunLoop.current.run(until: Date().addingTimeInterval(maxSeconds))
print("record: stopped after \(Int(maxSeconds)) s")
