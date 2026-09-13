//  ShareViewController.swift -- road two: the row in the share sheet.
//  ---------------------------------------------------------------------
//  C2/K8, 13 September. A share EXTENSION is a separate process with a
//  separate container, so the ONLY supported way for it to hand anything to
//  Frank is an App Group container shared by both binaries. That is the whole
//  cost of this road and it is why `src/inbox.rs` also reads road one
//  ("Copy to Frank", which costs nothing): if a free personal team cannot sign
//  `com.apple.security.application-groups`, this file is dead and the plist
//  road is the answer to K8.
//
//  NO UI, DELIBERATELY. This is not an `SLComposeServiceViewController` with a
//  compose box and a Post button -- a spike is allowed a log line and nothing
//  else, and a sheet a person has to dismiss would be a design decision taken
//  by a spike. A plain `UIViewController` that writes and completes shows the
//  share sheet's own dismissal animation and nothing of ours.
//
//  @objc(ShareViewController) IS LOAD-BEARING. `NSExtensionPrincipalClass` in
//  the generated Info.plist is an Objective-C class name, and a Swift class
//  without this attribute is mangled to `FrankShare.ShareViewController` --
//  which the OS cannot find, and the failure is a share sheet row that does
//  nothing at all with no error anywhere.
//
//  WHY SWIFT HERE AND OBJECTIVE-C IN `src-tauri/ios/`. The rule in
//  `FrankSearch.m` is "the caller is Rust, so export plain C symbols". Here
//  the caller is the OS: it instantiates this class, and nothing in this file
//  ever crosses an FFI boundary. Swift is the shorter, safer language for
//  that, and this target is compiled by Xcode rather than by `build.rs`.

import Foundation
import UIKit
import MobileCoreServices

@objc(ShareViewController)
final class ShareViewController: UIViewController {

    /// The App Group. Written down in four files that must agree --
    /// this one, both `.entitlements`, and `GROUP_ID` in `src/inbox.rs`,
    /// whose `the_group_id_is_the_same_in_every_file` test holds them equal.
    static let group = "group.com.ttstv.frank"

    /// Ours, so ours to name. `src/inbox.rs::GROUP_INBOX`.
    static let inbox = "inbox"

    override func viewDidLoad() {
        super.viewDidLoad()

        guard let root = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: Self.group) else {
            // THE ANSWER K8 EXISTS TO GIVE, if it is this one. nil here means
            // the entitlement is absent or the team could not sign it.
            NSLog("frank-share: no App Group container -- the entitlement is absent or unsigned")
            finish()
            return
        }

        // One folder per share. The id is sortable-by-time first because the
        // inbox is read in name order and a person expects the newest last;
        // the four random characters are there because two shares inside the
        // same second are a thing a person can do.
        let stamp = ISO8601DateFormatter()
        stamp.formatOptions = [.withInternetDateTime]
        let now = stamp.string(from: Date())
        let id = now.replacingOccurrences(of: ":", with: "")
            .replacingOccurrences(of: "-", with: "")
            + "-" + String(UUID().uuidString.prefix(4)).lowercased()
        let dir = root.appendingPathComponent(Self.inbox).appendingPathComponent(id)

        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        let providers = items.flatMap { $0.attachments ?? [] }
        guard !providers.isEmpty else {
            NSLog("frank-share: nothing attached")
            finish()
            return
        }

        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        } catch {
            NSLog("frank-share: could not make \(dir.path) -- \(error.localizedDescription)")
            finish()
            return
        }

        // `loadItem` is asynchronous and there can be more than one attachment
        // (Safari hands a PDF as a file AND its address). Every one is asked
        // for, and the request is completed only when the last has answered --
        // a share extension that returns early is a file that never arrives.
        var note: [String: String] = ["time": now]
        let lock = NSLock()
        let group = DispatchGroup()

        for provider in providers {
            for type in ["com.adobe.pdf", "org.idpf.epub-container", "public.file-url",
                         "public.url", "public.plain-text"] {
                guard provider.hasItemConformingToTypeIdentifier(type) else { continue }
                group.enter()
                provider.loadItem(forTypeIdentifier: type, options: nil) { item, error in
                    defer { group.leave() }
                    if let error = error {
                        NSLog("frank-share: \(type) -- \(error.localizedDescription)")
                        return
                    }
                    lock.lock()
                    defer { lock.unlock() }
                    switch item {
                    case let url as URL where url.isFileURL:
                        // The payload. Written as `.part` and renamed, so the
                        // app never lists a file it is still copying --
                        // `rows_nested` in `src/inbox.rs` keeps the other half
                        // of that rule.
                        let name = url.lastPathComponent
                        let part = dir.appendingPathComponent(name + ".part")
                        let done = dir.appendingPathComponent(name)
                        do {
                            try? FileManager.default.removeItem(at: part)
                            try FileManager.default.copyItem(at: url, to: part)
                            try FileManager.default.moveItem(at: part, to: done)
                            note["kind"] = note["kind"] ?? type
                            note["title"] = note["title"] ?? name
                        } catch {
                            NSLog("frank-share: could not copy \(name) -- \(error.localizedDescription)")
                        }
                    case let url as URL:
                        // A web address, which is a capture in itself: the
                        // article road (C1/P8) starts from exactly this.
                        note["url"] = url.absoluteString
                        note["kind"] = note["kind"] ?? "public.url"
                    case let text as String:
                        let name = "selection.txt"
                        try? text.data(using: .utf8)?
                            .write(to: dir.appendingPathComponent(name))
                        note["kind"] = note["kind"] ?? "public.plain-text"
                        note["title"] = note["title"] ?? name
                    case let data as Data:
                        let name = type == "com.adobe.pdf" ? "shared.pdf" : "shared.bin"
                        try? data.write(to: dir.appendingPathComponent(name))
                        note["kind"] = note["kind"] ?? type
                        note["title"] = note["title"] ?? name
                    default:
                        NSLog("frank-share: \(type) came as something unexpected")
                    }
                }
                // One type per provider: Safari offers a PDF as both
                // `com.adobe.pdf` and `public.file-url`, and taking both would
                // write the same bytes twice under two names.
                break
            }
        }

        group.notify(queue: .main) { [weak self] in
            // The note goes LAST, for the same reason the book door writes its
            // row last: a folder with a `source.json` in it is a finished
            // capture, and a reader that sees one can trust what is beside it.
            if let data = try? JSONSerialization.data(withJSONObject: note, options: [.sortedKeys]) {
                try? data.write(to: dir.appendingPathComponent("source.json"))
            }
            NSLog("frank-share: wrote \(dir.path)")
            self?.finish()
        }
    }

    /// Give the share sheet back. `completeRequest` and not `cancelRequest`:
    /// a cancel makes the host app show the person an error for something that
    /// is not their problem.
    private func finish() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}
