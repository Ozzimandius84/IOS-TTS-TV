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
/// One word of the stream (run 17): a hundredths stopwatch starting at `t`, in a
/// font whose digits 1-9 are the word with its red letter over a black box
/// (colour layers in the font), and whose 0 is nothing. Nothing before t; from
/// t on, the word covers whatever is stacked below. Layout rule from runs 13-15:
/// lineLimit(1) + fixed-width frame, never fixedSize.
@ViewBuilder
func wordLayer(_ t: Date, font: String, size: CGFloat) -> some View {
    if #available(iOS 18.0, *) {
        Text(TimeDataSource<Date>.currentDate,
             format: SystemFormatStyle.Stopwatch(startingAt: t, showsHours: false,
                                                 maxFieldCount: 4, maxPrecision: .milliseconds(10)))
            .font(.custom(font, size: size))
            .foregroundColor(islandInk)
            .lineLimit(1)
            .frame(width: size * 4.6, alignment: .leading)
    }
}

/// Run 18, right of the camera: the words of Widget/WordList.swift (30 at 3 a
/// second from 15 s), each one layer on the fast clock in its own font. Run 17
/// proved three; this asks whether 30 land on time and each covers the last.
/// Run 21: in "windows" mode the stack starts from the state's windowStart,
/// which the app moves on with an update from the background every 30 s.
func wordsStart(_ context: ActivityViewContext<IslandAttributes>) -> Date {
    context.attributes.mode == "windows" ? context.state.windowStart : context.attributes.start
}

func countingWords(_ start: Date, size: CGFloat) -> some View {
    ZStack(alignment: .leading) {
        ForEach(0..<runWords.count, id: \.self) { i in
            wordLayer(start.addingTimeInterval(runWords[i].at), font: runWords[i].font, size: size)
        }
    }
    .frame(width: size * 4.6, alignment: .leading)
}

/// The same counting font on a stopwatch asking for hundredths (iOS 18's live
/// stopwatch style): if the island redraws it faster than once a second, the
/// word changes in time with speech. If the font does not recognise the
/// stopwatch's format, its digits show instead -- and the pictures tell us the format.
@ViewBuilder
func tenthsClock(_ start: Date, size: CGFloat) -> some View {
    if #available(iOS 18.0, *) {
        // run 14, ONE change on this side vs run 13: the stopwatch starts 15 s in the FUTURE.
        // Expect nothing until 15 s (all zeros), then blocks moving at hundredths.
        // run 16, left: the hundredths stopwatch (future start, proven run 14) in the one-word
        // font -- "truth" should appear at 15.0 s sharp, not a second late like the whole-second timer.
        Text(TimeDataSource<Date>.currentDate,
             format: SystemFormatStyle.Stopwatch(startingAt: start.addingTimeInterval(15), showsHours: false,
                                                 maxFieldCount: 4, maxPrecision: .milliseconds(10)))
            .font(.custom("IslandWord", size: size))
            .foregroundColor(islandInk)
            .lineLimit(1)
            .frame(width: size * 4.6, alignment: .leading)
    } else {
        Text(timerInterval: start...start.addingTimeInterval(3600), countsDown: false, showsHours: false)
            .font(.system(size: size, weight: .semibold).monospacedDigit())
            .foregroundColor(islandInk)
    }
}

struct IslandLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: IslandAttributes.self) { context in
            Group {
                if context.attributes.mode == "clock" || context.attributes.mode == "windows" {
                    VStack(spacing: 6) {
                        countingWords(wordsStart(context), size: 30)
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
                    if context.attributes.mode == "clock" || context.attributes.mode == "windows" {
                        VStack(spacing: 4) {
                            countingWords(wordsStart(context), size: 26)
                            tenthsClock(context.attributes.start, size: 26)
                        }
                    } else {
                        pivotWord(context.state.word, size: 28)
                    }
                }
            } compactLeading: {
                if context.attributes.mode == "clock" || context.attributes.mode == "windows" {
                    // left of the camera: the hundredths stopwatch
                    tenthsClock(context.attributes.start, size: 14)
                } else {
                    Text("F").font(islandFont(13)).foregroundColor(islandInk)
                }
            } compactTrailing: {
                if context.attributes.mode == "clock" || context.attributes.mode == "windows" {
                    // right of the camera: the counting font
                    countingWords(wordsStart(context), size: 14)
                } else {
                    pivotWord(context.state.word, size: 15)
                }
            } minimal: {
                if context.attributes.mode == "clock" || context.attributes.mode == "windows" {
                    countingWords(wordsStart(context), size: 12)
                } else {
                    Text(IslandWord.layout(context.state.word).2)
                        .font(islandFont(15)).foregroundColor(islandRed)
                }
            }
        }
    }
}
