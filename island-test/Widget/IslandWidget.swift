/*  The Live Activity: one word, the red pivot letter always in the same
    column, in a fixed-width slot so the island does not grow and shrink.  */
import ActivityKit
import SwiftUI
import WidgetKit

@main
struct IslandWidgetBundle: WidgetBundle {
    var body: some Widget { IslandLiveActivity() }
}

func pivotText(_ piece: String, size: CGFloat) -> Text {
    let (pad, pre, pivot, post) = IslandWord.layout(piece)
    let font = Font.system(size: size, weight: .semibold, design: .monospaced)
    return Text(pad + pre).font(font)
        + Text(pivot).font(font).foregroundColor(.red)
        + Text(post).font(font)
}

struct IslandLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: IslandAttributes.self) { context in
            VStack(spacing: 4) {
                pivotText(context.state.word, size: 34)
                    .frame(width: 34 * 0.62 * CGFloat(IslandWord.columns), alignment: .leading)
                Text("\(context.state.phase) · #\(context.state.seq)")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding()
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.center) {
                    pivotText(context.state.word, size: 28)
                        .frame(width: 28 * 0.62 * CGFloat(IslandWord.columns), alignment: .leading)
                }
            } compactLeading: {
                Text("F").font(.system(size: 13, weight: .bold))
            } compactTrailing: {
                // fixed width: 7 monospaced letters at 15 pt
                pivotText(context.state.word, size: 15)
                    .lineLimit(1)
                    .frame(width: 15 * 0.62 * CGFloat(IslandWord.columns), alignment: .leading)
            } minimal: {
                Text(IslandWord.layout(context.state.word).2)
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundColor(.red)
            }
        }
    }
}
