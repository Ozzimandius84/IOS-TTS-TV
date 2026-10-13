/*  The Live Activity: one word, the red pivot letter always in the same
    column, in a fixed-width slot so the island does not grow and shrink.
    Font as the play-bar drafts draw it (Osca 13 Oct 11:16: the monospace was wrong).
    Run 4 (mode clock): the island's own timer drawn in the counting font right of
    the camera, a hundredths stopwatch left of it -- no updates from the app at all.  */
import ActivityKit
import SwiftUI
import WidgetKit

@main
struct IslandWidgetBundle: WidgetBundle {
    var body: some Widget { IslandLiveActivity() }
}

/// The play-bar drafts' island word (TTSTV design/playbar/playbar-drafts.html):
/// Frank's serif (Iowan Old Style) at 600, warm white #f3efe6, pivot #ff6a5e.
/// The letters before the pivot sit right-aligned in a fixed box and the ones
/// after it left-aligned in another, so the red letter never moves.
let islandInk = Color(red: 0xf3 / 255.0, green: 0xef / 255.0, blue: 0xe6 / 255.0)
let islandRed = Color(red: 1.0, green: 0x6a / 255.0, blue: 0x5e / 255.0)

func islandFont(_ size: CGFloat) -> Font { Font.custom("Iowan Old Style", size: size).weight(.semibold) }

func pivotWord(_ piece: String, size: CGFloat) -> some View {
    let (_, pre, pivot, post) = IslandWord.layout(piece)
    return HStack(spacing: 0) {
        Text(pre).foregroundColor(islandInk)
            .frame(width: size * 1.4, alignment: .trailing)
        Text(pivot).foregroundColor(islandRed)
        Text(post).foregroundColor(islandInk)
            .frame(width: size * 2.6, alignment: .leading)
    }
    .font(islandFont(size))
    .lineLimit(1)
}

// MARK: run 4 -- the island's own clock, with no updates from the app

/// The counting font (font/IslandCount.ttf, built by font/build_font.py): the
/// running clock "0:07" is drawn as the ONE word spoken at 7 s, its red letter on
/// a fixed column. iOS ticks the clock itself, so the word moves with no update.
/// Width: the font gives every word the same advance, 4.6 x the font size.
func countingWords(_ start: Date, size: CGFloat) -> some View {
    Text(timerInterval: start...start.addingTimeInterval(240), countsDown: false, showsHours: false)
        .font(.custom("IslandCount", size: size))
        .foregroundColor(islandInk)
        .lineLimit(1)
        .frame(width: size * 4.6, alignment: .leading)
}

/// The same counting font on a stopwatch asking for hundredths (iOS 18's live
/// stopwatch style): if the island redraws it faster than once a second, the
/// word changes in time with speech. If the font does not recognise the
/// stopwatch's format, its digits show instead -- and the pictures tell us the format.
@ViewBuilder
func tenthsClock(_ start: Date, size: CGFloat) -> some View {
    if #available(iOS 18.0, *) {
        Text(TimeDataSource<Date>.currentDate,
             format: SystemFormatStyle.Stopwatch(startingAt: start, showsHours: false,
                                                 maxFieldCount: 4, maxPrecision: .milliseconds(10)))
            .font(.custom("IslandCount", size: size))
            .foregroundColor(islandInk)
            .lineLimit(1)
            .frame(width: size * 4.6, alignment: .leading)
    } else {
        Text(timerInterval: start...start.addingTimeInterval(3600), countsDown: false, showsHours: false)
            .font(.system(size: size, weight: .semibold).monospacedDigit())
            .foregroundColor(islandInk)
    }
}

// MARK: run 5 -- words shown by the island's own switches, no clock visible

/// An invisible switch: a live timer drawn in the gate font (font/IslandGate.ttf),
/// which is a solid block while any digit is non-zero and nothing at all-zero.
/// `after`: counts up from `t` -> solid only once `t` has passed.
/// `before`: counts down to `t` -> solid only until `t`.
@ViewBuilder
func gate(after t: Date?, before u: Date?, size: CGFloat) -> some View {
    if #available(iOS 18.0, *) {
        if let t {
            Text(TimeDataSource<Date>.currentDate,
                 format: SystemFormatStyle.Timer(countingUpIn: t..<t.addingTimeInterval(36000), showsHours: false,
                                                 maxFieldCount: 4, maxPrecision: .milliseconds(10)))
                .font(.custom("IslandGate", size: size))
                .fixedSize()
        } else if let u {
            Text(TimeDataSource<Date>.currentDate,
                 format: SystemFormatStyle.Timer(countingDownIn: u.addingTimeInterval(-36000)..<u, showsHours: false,
                                                 maxFieldCount: 4, maxPrecision: .milliseconds(10)))
                .font(.custom("IslandGate", size: size))
                .fixedSize()
        }
    } else {
        Color.white
    }
}

/// Every word stacked in one place; each one masked by its own two switches, so
/// only the word whose moment it is can be seen. The clocks are never shown.
func wordStream(_ a: IslandAttributes, size: CGFloat) -> some View {
    ZStack(alignment: .leading) {
        ForEach(Array(a.words.enumerated()), id: \.offset) { i, w in
            let t0 = a.wordStart.addingTimeInterval(Double(i) / a.wps)
            let t1 = a.wordStart.addingTimeInterval(Double(i + 1) / a.wps)
            // run 7: no masks (run 6: a timer mask draws nothing). Each word is ERASED
            // by two timers drawn over it (destination-out): one solid until its
            // start, one solid from its end -- so it shows only between them.
            pivotWord(w, size: size)
                .overlay(alignment: .leading) {
                    gate(after: nil, before: t0, size: size).foregroundColor(.black).blendMode(.destinationOut)
                }
                .overlay(alignment: .leading) {
                    gate(after: t1, before: nil, size: size).foregroundColor(.black).blendMode(.destinationOut)
                }
                .compositingGroup()
        }
    }
    .frame(width: size * 4.6, alignment: .leading)
}

/// Diagnostics, left of the camera (run 7). Three dots, no masks anywhere:
///  white -- nothing over it: the island is drawing;
///  green -- erased by a timer drawn over it UNTIL 15 s after launch (appears at 15 s);
///  blue  -- erased by a timer drawn over it FROM 25 s after launch (vanishes at 25 s).
/// (Run 6's red dot, hidden by a timer MASK, never drew at all.)
func gateDots(_ a: IslandAttributes) -> some View {
    HStack(spacing: 4) {
        Circle().fill(Color.white).frame(width: 8, height: 8)
        Circle().fill(Color.green).frame(width: 8, height: 8)
            .overlay(alignment: .leading) {
                gate(after: nil, before: a.start.addingTimeInterval(15), size: 10)
                    .foregroundColor(.black).blendMode(.destinationOut)
            }
            .compositingGroup()
        Circle().fill(Color.blue).frame(width: 8, height: 8)
            .overlay(alignment: .leading) {
                gate(after: a.start.addingTimeInterval(25), before: nil, size: 10)
                    .foregroundColor(.black).blendMode(.destinationOut)
            }
            .compositingGroup()
    }
}

struct IslandLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: IslandAttributes.self) { context in
            Group {
                if context.attributes.mode == "words" {
                    wordStream(context.attributes, size: 30)
                } else if context.attributes.mode == "clock" {
                    VStack(spacing: 6) {
                        countingWords(context.attributes.start, size: 30)
                        tenthsClock(context.attributes.start, size: 30)
                    }
                } else {
                    VStack(spacing: 4) {
                        pivotWord(context.state.word, size: 34)
                        Text("\(context.state.phase) · #\(context.state.seq)")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
            .activityBackgroundTint(.black)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.center) {
                    if context.attributes.mode == "words" {
                        wordStream(context.attributes, size: 26)
                    } else if context.attributes.mode == "clock" {
                        VStack(spacing: 4) {
                            countingWords(context.attributes.start, size: 26)
                            tenthsClock(context.attributes.start, size: 26)
                        }
                    } else {
                        pivotWord(context.state.word, size: 28)
                    }
                }
            } compactLeading: {
                if context.attributes.mode == "words" {
                    gateDots(context.attributes)
                } else if context.attributes.mode == "clock" {
                    // left of the camera: the hundredths stopwatch
                    tenthsClock(context.attributes.start, size: 14)
                } else {
                    Text("F").font(islandFont(13)).foregroundColor(islandInk)
                }
            } compactTrailing: {
                if context.attributes.mode == "words" {
                    wordStream(context.attributes, size: 15)
                } else if context.attributes.mode == "clock" {
                    // right of the camera: the counting font
                    countingWords(context.attributes.start, size: 14)
                } else {
                    pivotWord(context.state.word, size: 15)
                }
            } minimal: {
                if context.attributes.mode == "words" {
                    gateDots(context.attributes)
                } else if context.attributes.mode == "clock" {
                    countingWords(context.attributes.start, size: 12)
                } else {
                    Text(IslandWord.layout(context.state.word).2)
                        .font(islandFont(15)).foregroundColor(islandRed)
                }
            }
        }
    }
}
