/*  Shared by the test app and its widget extension.

    How the widget tells the app "I drew word N":
    1. (run 2, the one that counts) it appends a line to drawn.csv in a shared
       App Group folder -- `region,seq,machSeconds`. mach time (CACurrentMediaTime)
       is one clock for every process on the phone, so the app can line it up
       with its own log exactly.
    2. (run 1's road, kept as a cross-check) a Darwin notification whose NAME
       carries the region and N. Run 1 (13 Oct 10:43) heard none of these.  */
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
    static let group = "group.com.ttstv.frank.islandtest"
    static let drawnFile = "drawn.csv"
    static let prefix = "com.ttstv.frank.islandtest.r."
    /// c = island compact (the word beside the camera), m = island minimal,
    /// e = island expanded (long press), l = lock screen / banner.
    static let regions = ["c", "m", "e", "l"]
    /// Highest seq the app listens for. The schedule sends 310.
    static let maxSeq = 400
    static func name(_ region: String, _ seq: Int) -> String { "\(prefix)\(region).\(seq)" }
    /// Posted by the widget if it cannot open the shared folder.
    static let noGroup = "com.ttstv.frank.islandtest.nogroup"

    static var drawnURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
            .appendingPathComponent(drawnFile)
    }
}
