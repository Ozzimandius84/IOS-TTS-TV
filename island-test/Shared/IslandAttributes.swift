/*  Shared by the test app and its widget extension.

    Runs 1 and 2 (13 Oct) showed the widget's own code cannot report what it
    drew: Osca SAW the word change, yet neither a Darwin notification nor a
    file in a shared App Group folder ever arrived. So "shown" is now measured
    from outside -- the Mac records the phone's screen over the cable
    (recorder/record.swift) and times every change in the island.  */
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

/// How a word is laid out in the island (Osca, 13 Oct 11:04): long words are
/// broken into short pieces so the island stays small and does not grow and
/// shrink with every word; the pivot letter is red (Frank's one-word view,
/// 42%) and always sits in the same column, so the eye does not move.
enum IslandWord {
    static let maxPiece = 6      // letters per piece before a word is broken
    static let pivotColumn = 2   // 0-based column the red letter sits in
    static let columns = 7       // fixed width of the island word, in letters

    /// "acknowledged" -> ["acknow-", "ledged"]; words of 7 letters or fewer stay whole.
    static func pieces(_ word: String) -> [String] {
        let chars = Array(word)
        if chars.count <= maxPiece + 1 { return [word] }
        let n = Int((Double(chars.count) / Double(maxPiece)).rounded(.up))
        let size = Int((Double(chars.count) / Double(n)).rounded(.up))
        var out: [String] = []
        var i = 0
        while i < chars.count {
            let j = min(chars.count, i + size)
            out.append(String(chars[i..<j]) + (j < chars.count ? "-" : ""))
            i = j
        }
        return out
    }

    /// (left padding, before the pivot, the pivot letter, after it)
    static func layout(_ piece: String) -> (String, String, String, String) {
        let chars = Array(piece)
        guard !chars.isEmpty else { return ("", "", "", "") }
        let letters = chars.last == "-" ? chars.count - 1 : chars.count
        let p = min(max(letters - 1, 0), Int(Double(letters) * 0.42))
        let pad = String(repeating: " ", count: max(0, pivotColumn - p))
        return (pad, String(chars[0..<p]), String(chars[p]), String(chars[(p + 1)...]))
    }
}
