/*  Shared by the test app and its widget extension.

    The widget cannot write a file the app can read without an App Group,
    and a free personal team may not sign one. So the widget says "I drew
    word N" by posting a Darwin notification whose NAME carries N and the
    region it drew; the app listens for every name it could send and writes
    the time it heard each one. Darwin notifications need no entitlement.  */
import ActivityKit
import Foundation

struct IslandAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var word: String
        var seq: Int
        var phase: String
    }
    var title: String
}

enum IslandSignal {
    static let prefix = "com.ttstv.frank.islandtest.r."
    /// c = island compact (the word beside the camera), m = island minimal,
    /// e = island expanded (long press), l = lock screen / banner.
    static let regions = ["c", "m", "e", "l"]
    /// Highest seq the app listens for. The schedule sends 310.
    static let maxSeq = 400
    static func name(_ region: String, _ seq: Int) -> String { "\(prefix)\(region).\(seq)" }
}
