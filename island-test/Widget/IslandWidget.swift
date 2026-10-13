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

/// A live stopwatch from `t` drawn in one of the run-8 fonts. Before `t` it
/// reads all zeros, which every one of those fonts draws as nothing.
@available(iOS 18.0, *)
func liveClock(_ t: Date, font: String, size: CGFloat, color: Color) -> some View {
    Text(TimeDataSource<Date>.currentDate,
         format: SystemFormatStyle.Stopwatch(startingAt: t, showsHours: false,
                                             maxFieldCount: 4, maxPrecision: .milliseconds(10)))
        .font(.custom(font, size: size))
        .foregroundColor(color)
        .fixedSize()
}

/// Run 8: every word is three live clocks starting at its own moment -- a black
/// block (covers the word before it), the ink of the word strip, its red letters
/// -- shifted so the slot-wide window shows only this word. Newest on top.
/// No masks, no erasing: runs 6 and 7 showed the island allows neither.
@ViewBuilder
func wordStream(_ a: IslandAttributes, size: CGFloat) -> some View {
    let slot = size * 4.6
    if #available(iOS 18.0, *) {
        ZStack(alignment: .topLeading) {
            ForEach(0..<a.words.count, id: \.self) { i in
                let t0 = a.wordStart.addingTimeInterval(Double(i) / a.wps)
                ZStack(alignment: .topLeading) {
                    liveClock(t0, font: "IslandGate", size: size, color: .black)
                    liveClock(t0, font: "IslandStrip", size: size, color: islandInk)
                        .offset(x: -CGFloat(i) * slot)
                    liveClock(t0, font: "IslandStripRed", size: size, color: islandRed)
                        .offset(x: -CGFloat(i) * slot)
                }
                .frame(width: slot, height: size * 1.3, alignment: .topLeading)
                .clipped()
            }
        }
        .frame(width: slot, height: size * 1.3, alignment: .topLeading)
    }
}

/// Diagnostic, left of the camera (run 8): a white dot, and a white square drawn
/// by a stopwatch that starts 15 s after launch in the block font -- it should
/// APPEAR at 15 s (proves a clock that has not started yet draws nothing).
func gateDots(_ a: IslandAttributes) -> some View {
    HStack(spacing: 4) {
        Circle().fill(Color.white).frame(width: 8, height: 8)
        if #available(iOS 18.0, *) {
            liveClock(a.start.addingTimeInterval(15), font: "IslandGate", size: 8, color: .white)
                .frame(width: 10, height: 10, alignment: .topLeading)
                .clipped()
        }
    }
}

// MARK: run 11 -- the diagnostic again, with clocks that have ALREADY started

/// Run 10 drew nothing at all -- not even run 4's own font -- and the only thing
/// it shared with runs 5-9 is that every clock started in the FUTURE. Run 4's
/// clock had already started. So now every clock starts at launch (a countdown
/// runs from launch to a later moment), except E, which keeps a future start to
/// confirm that rule.
@available(iOS 18.0, *)
func countdown(from a: Date, to b: Date, font: String, size: CGFloat, color: Color) -> some View {
    Text(TimeDataSource<Date>.currentDate,
         format: SystemFormatStyle.Timer(countingDownIn: a..<b, showsHours: false,
                                         maxFieldCount: 4, maxPrecision: .milliseconds(10)))
        .font(.custom(font, size: size))
        .foregroundColor(color)
        .fixedSize()
}

/// Left of the camera: A = run 4's font, stopwatch from launch (should run);
/// E = the same, but starting 15 s after launch (expected: never drawn).
@ViewBuilder
func diagLeft(_ a: IslandAttributes) -> some View {
    if #available(iOS 18.0, *) {
        HStack(spacing: 6) {
            liveClock(a.start, font: "IslandCount", size: 9, color: .white)
            liveClock(a.start.addingTimeInterval(15), font: "IslandCount", size: 9, color: .yellow)
        }
    }
}

/// Right of the camera, all from a countdown that runs from launch to 25 s after:
/// D (white blocks) = the countdown drawn in the block font: blocks until 25 s, then nothing;
/// M (white dot)    = a dot MASKED by that countdown: there until 25 s, then gone;
/// X (pink dot)     = a dot ERASED by that countdown drawn over it: hidden until 25 s, then appears.
@ViewBuilder
func diagRight(_ a: IslandAttributes) -> some View {
    let end = a.start.addingTimeInterval(25)
    if #available(iOS 18.0, *) {
        HStack(spacing: 8) {
            countdown(from: a.start, to: end, font: "IslandDiagC", size: 9, color: .white)
            Circle().fill(Color.white).frame(width: 8, height: 8)
                .mask(alignment: .trailing) {
                    countdown(from: a.start, to: end, font: "IslandDiagC", size: 14, color: .white)
                }
            Circle().fill(Color.pink).frame(width: 8, height: 8)
                .overlay(alignment: .trailing) {
                    countdown(from: a.start, to: end, font: "IslandDiagC", size: 14, color: .black)
                        .blendMode(.destinationOut)
                }
                .compositingGroup()
        }
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
                if context.attributes.mode == "diag" {
                    diagLeft(context.attributes)
                } else if context.attributes.mode == "words" {
                    gateDots(context.attributes)
                } else if context.attributes.mode == "clock" {
                    // left of the camera: the hundredths stopwatch
                    tenthsClock(context.attributes.start, size: 14)
                } else {
                    Text("F").font(islandFont(13)).foregroundColor(islandInk)
                }
            } compactTrailing: {
                if context.attributes.mode == "diag" {
                    diagRight(context.attributes)
                } else if context.attributes.mode == "words" {
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
