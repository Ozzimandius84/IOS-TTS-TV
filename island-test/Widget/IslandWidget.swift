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
    // run 13, ONE change on this side: the timer starts 15 s in the FUTURE.
    // Same font, same frame. Words appearing from 15 s = a future start is fine.
    Text(timerInterval: start.addingTimeInterval(15)...start.addingTimeInterval(255), countsDown: false, showsHours: false)
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
        // run 13, ONE change on this side: the block font instead of the digit font.
        // Same clock, same start, same frame. Blocks appearing = block fonts draw.
        Text(TimeDataSource<Date>.currentDate,
             format: SystemFormatStyle.Stopwatch(startingAt: start, showsHours: false,
                                                 maxFieldCount: 4, maxPrecision: .milliseconds(10)))
            .font(.custom("IslandDiagC", size: size))
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
                if context.attributes.mode == "clock" {
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
                    if context.attributes.mode == "clock" {
                        VStack(spacing: 4) {
                            countingWords(context.attributes.start, size: 26)
                            tenthsClock(context.attributes.start, size: 26)
                        }
                    } else {
                        pivotWord(context.state.word, size: 28)
                    }
                }
            } compactLeading: {
                if context.attributes.mode == "clock" {
                    // left of the camera: the hundredths stopwatch
                    tenthsClock(context.attributes.start, size: 14)
                } else {
                    Text("F").font(islandFont(13)).foregroundColor(islandInk)
                }
            } compactTrailing: {
                if context.attributes.mode == "clock" {
                    // right of the camera: the counting font
                    countingWords(context.attributes.start, size: 14)
                } else {
                    pivotWord(context.state.word, size: 15)
                }
            } minimal: {
                if context.attributes.mode == "clock" {
                    countingWords(context.attributes.start, size: 12)
                } else {
                    Text(IslandWord.layout(context.state.word).2)
                        .font(islandFont(15)).foregroundColor(islandRed)
                }
            }
        }
    }
}
