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
    /// Run 4: when the island's own clock started, and which test this is
    /// ("clock" = the counting font and the tenths stopwatch, no updates at all;
    /// "rates" = runs 1-3, words sent at set rates).
    var start: Date
    var mode: String
}

/// How a word is laid out in the island (Osca, 13 Oct 11:04): long words are
/// broken into short pieces so the island stays small and does not grow and
/// shrink with every word; the pivot letter is red, chosen by Frank's own rule
/// (below), and always sits in the same column, so the eye does not move.
enum IslandWord {
    static let maxPiece = 6      // letters per piece before a word is broken

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

    /// Frank's red-letter rule, the same as TTSTV reader/wordview.js orp() + pivotIndex(),
    /// so it is one rule on every surface: counting letters only, the pivot is
    /// letter 0 / 1 / 2 / 3 / 4 for words of 1 / 2-5 / 6-9 / 10-13 / 14+ letters
    /// ("My" -> y, "Mr." -> r, "He" -> e); punctuation in front is skipped.
    static func isLetter(_ c: Character) -> Bool {
        guard let u = c.unicodeScalars.first?.value else { return false }
        return (u >= 0x41 && u <= 0x5A) || (u >= 0x61 && u <= 0x7A) || (u >= 0xC0 && u <= 0x24F)
            || (u >= 0x30 && u <= 0x39) || u == 0x27
    }
    static func orp(_ w: String) -> Int {
        let letters = w.filter(isLetter).count
        let n = letters > 0 ? letters : w.count
        if n <= 1 { return 0 }
        if n <= 5 { return 1 }
        if n <= 9 { return 2 }
        if n <= 13 { return 3 }
        return 4
    }
    static func pivotIndex(_ w: String) -> Int {
        let chars = Array(w)
        if chars.isEmpty { return 0 }
        let k = orp(w)
        var seen = -1
        for (i, c) in chars.enumerated() where isLetter(c) {
            seen += 1
            if seen == k { return i }
        }
        return min(k, chars.count - 1)
    }

    /// (unused padding, before the pivot, the pivot letter, after it)
    static func layout(_ piece: String) -> (String, String, String, String) {
        let chars = Array(piece)
        guard !chars.isEmpty else { return ("", "", "", "") }
        let p = pivotIndex(piece)
        return ("", String(chars[0..<p]), String(chars[p]), String(chars[(p + 1)...]))
    }
}
