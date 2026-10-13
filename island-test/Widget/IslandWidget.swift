/*  The Live Activity: one word. Every time the system asks this extension to
    draw a region, that region's body runs and posts "drew word N" to the app.
    That is the closest an app can get to "the island showed it".  */
import ActivityKit
import SwiftUI
import WidgetKit

@main
struct IslandWidgetBundle: WidgetBundle {
    var body: some Widget { IslandLiveActivity() }
}

@discardableResult
func markDrawn(_ region: String, _ seq: Int) -> Bool {
    CFNotificationCenterPostNotification(
        CFNotificationCenterGetDarwinNotifyCenter(),
        CFNotificationName(IslandSignal.name(region, seq) as CFString),
        nil, nil, true)
    return true
}

/// Wraps a region's content so its body reports the draw.
struct Drawn<Content: View>: View {
    let region: String
    let seq: Int
    let content: Content
    init(_ region: String, _ seq: Int, @ViewBuilder content: () -> Content) {
        self.region = region; self.seq = seq; self.content = content()
    }
    var body: some View {
        let _ = markDrawn(region, seq)
        content
    }
}

struct IslandLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: IslandAttributes.self) { context in
            Drawn("l", context.state.seq) {
                VStack(spacing: 4) {
                    Text(context.state.word)
                        .font(.system(size: 40, weight: .bold))
                        .lineLimit(1).minimumScaleFactor(0.5)
                    Text("\(context.state.phase) · #\(context.state.seq)")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .padding()
            }
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.center) {
                    Drawn("e", context.state.seq) {
                        Text(context.state.word)
                            .font(.system(size: 30, weight: .bold))
                            .lineLimit(1).minimumScaleFactor(0.5)
                    }
                }
            } compactLeading: {
                Text("F").font(.system(size: 15, weight: .bold))
            } compactTrailing: {
                Drawn("c", context.state.seq) {
                    Text(context.state.word)
                        .font(.system(size: 15, weight: .semibold))
                        .lineLimit(1).minimumScaleFactor(0.6)
                        .frame(maxWidth: 96)
                }
            } minimal: {
                Drawn("m", context.state.seq) {
                    Text(String(context.state.word.prefix(2)))
                        .font(.system(size: 13, weight: .bold))
                }
            }
        }
    }
}
