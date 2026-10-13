# The word in the Dynamic Island — what is possible (research, 13 Oct 2026)

Follows `ISLAND-TEST.md`. The test found that once you leave the app, the island shows about 4 more words and then freezes until the app is opened again. This note says why, and goes through every way found so far to get a moving word onto the iPhone while Frank is in the background.

## Why it froze — this is a known Apple rule, not our bug

- **Apple blocks it.** An app that keeps itself running in the background by playing audio can't update its own Live Activity from there. Developers have reported exactly what we measured since iOS 16 (2022): it works in the simulator, but on a real phone it stops after 8–11 seconds and catches up when the app is opened. The reports continue on iOS 17 and 18 ([Apple forum](https://developer.apple.com/forums/thread/717701), [another](https://developer.apple.com/forums/thread/716458)).
- **Apple's own engineer says so.** In March 2025 an Apple engineer answered: *"The only supported way [to update from the background] is by using push notifications, unless … your app is in the foreground."* ([Apple forum](https://developer.apple.com/forums/thread/776031))
- **The docs don't spell this out.** Apple's documentation says an app "can update … a Live Activity from your app while it runs in the background — for example, by using BackgroundTasks", and says nothing about audio apps being blocked ([Apple docs](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)).

Our test matches the reports exactly, so no setting in our code will fix it. Every way forward goes around the rule.

## The ways around it

### 1. Picture in Picture keeps the island updating, and is itself a float. Most promising.

- **The island keeps working with PiP open.** The developer who first reported the freeze found that *"if the app is running in the background with background location or Picture-in-picture mode, the app can update live activity"* ([Apple forum](https://developer.apple.com/forums/thread/717701)). So while Frank has a PiP window open, the island may keep moving.
- **PiP can show every word.** It's the small floating video window iOS gives to video apps, and an app can draw anything into it, including the word, at 60 frames a second. This was "road (b)" in the September float spike (`scratch-float/ANSWER.md`), and `scratch-float/probe-b/` is a ready-made test app for it.
- **Apple lets text-only apps use it.** Teleprompter apps on the App Store already put text in PiP over other apps (e.g. [Teleprompter Pro X](https://apps.apple.com/app/id6502788841)).
- **Downside: it's a window over the other app**, which the drafts avoided ("no box over the app you are using"). It can be shrunk and pushed to the screen edge, but not hidden.
- **Unknown: whether the island still updates with PiP open on iOS 26.** That claim comes from one 2022 report. Our test rig can measure it in one run.

### 2. Push updates from a server. Apple's supported route, but not fast enough for words.

- **What it needs:** a server sends each update through Apple's push service.
- **Speed:** priority-10 pushes arrive at once but draw on an hourly allowance. One developer sending one a second ran out in under a minute ([DEV](https://dev.to/hellomisterdev/why-your-ios-live-activity-silently-stops-updating-lmd)). Another got 41 updates in 6 minutes and then nothing for hours, even with Apple's "frequent updates" setting on ([Apple forum](https://developer.apple.com/forums/thread/731715)).
- **The free kind has no timing:** priority-5 pushes don't use the allowance, but Apple delivers them whenever it chooses ([Apple docs](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications)).
- **Cost:** a paid Apple developer account (the free team Frank is signed with can't send pushes), a server that knows exactly where playback is, and a network connection the whole time.
- **Verdict:** too slow and too irregular for a word. It might do roughly one line every few seconds for a while, but not reliably.

### 3. Let the island count by itself. No updates needed, but it can only count.

- **It runs on the phone with no allowance.** Without any updates, a Live Activity can show a running timer (`Text(timerInterval:)`) or a progress bar (`ProgressView(timerInterval:)`). The phone ticks them itself.
- **What it can honestly show:** the chapter's time left and a progress bar. It can't show words.
- **An untested trick:** a custom font whose letter combinations ("ligatures") turn the timer's digits into words, so that "0:07" is drawn as the phrase spoken in second 7. Custom fonts are allowed in Live Activities; whether the island applies ligatures to timer text is unknown.
- **Limits of the trick even if it works:** it changes once a second at most (speech is about 3½ words a second), so it would show a phrase per second, not the word. It would need a font made per chapter. Pausing or seeking would need a real update (one or two, which the allowance may survive).
- **Verdict:** clever and unproven. It's an hour's test with the rig.

### 4. Switch Frank's audio to the "ambient" kind. A known workaround, wrong for Frank.

- **It reportedly lets updates through.** Developers found that changing the audio type from "playback" to "ambient" lets the island update ([Apple forum](https://developer.apple.com/forums/thread/716458)).
- **What it costs Frank:**
  - The ring/silent switch mutes it.
  - It plays underneath other apps' sound.
  - It loses the lock-screen player controls.
  - One developer found the app was killed after a few tens of seconds anyway.
- **Verdict:** no for an audiobook reader, but cheap to confirm with the rig if wanted.

### 5. The "Now Playing" title. Lock screen and long-press only, not the island word.

- **How lyric apps do it:** they write the current line into the track title that the lock screen and Control Centre show (how [NowLyrics](https://github.com/chxhua2k7/NowLyrics) does it).
- **Where it shows:** the compact island for Now Playing is drawn by iOS (cover art and a waveform), so the title would appear only on the lock screen and in the long-pressed island.
- **It's throttled too:** Apple confirms a limit on title changes (strict in CarPlay), and apps log "Application exceeded audio metadata throttle limit" ([Apple forum](https://developer.apple.com/forums/thread/785411)).
- **Verdict:** fine for a sentence or line on the lock screen, not for a word, and not in the compact island.

## What about the lyrics apps that show lines in the island?

Apps like [Lyrical](https://lyricalmusic.app/) and [Pulse](https://apps.apple.com/app/id6755416222) advertise the current lyric line in the Dynamic Island. They don't say how they do it.

- **Why they may escape the rule:** they aren't the app playing the audio (Spotify or Apple Music is), so the audio rule above may not catch them. They need a Spotify login, which suggests a server pushing lines (route 2).
- **Reviews are mixed:** one user said island lyrics stopped working once they left the app ([reviews](https://apps.apple.com/au/app/dynamic-lyrics/id6476125287?see-all=reviews&platform=iphone)).
- **Not proven:** none of this shows anyone doing it by the word.

## Where that leaves the island

- **No documented way exists.** None lets a background audio app put each spoken word into the island.
- **Two undocumented ways can be measured with the rig:**
  - **PiP open:** does the island keep updating while Frank has a PiP window open (route 1)?
  - **Timer font:** does the counting-font trick draw changing text with no updates at all (route 3)?
- **One route certainly shows every word off-app:** PiP itself.

Each test is one run of the existing `island-test/run.sh` (about 7 minutes), with a switch in the test app. Neither touches Frank.

## Sources

- [Live Activity can't be updated by app running in background — Apple Developer Forums](https://developer.apple.com/forums/thread/717701)
- [Live Activity update not working while Playback category in background — Apple Developer Forums](https://developer.apple.com/forums/thread/716458)
- [Live Activity update not working consistently in the background (Apple engineer reply) — Apple Developer Forums](https://developer.apple.com/forums/thread/776031)
- [Live Activity can't be updated by app playing audio — Apple Developer Forums](https://developer.apple.com/forums/thread/724483)
- [Displaying live data with Live Activities — Apple](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)
- [Starting and updating Live Activities with push notifications — Apple](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications)
- [Live Activity push throttling with frequent updates — Apple Developer Forums](https://developer.apple.com/forums/thread/731715)
- [Why your iOS Live Activity silently stops updating — DEV](https://dev.to/hellomisterdev/why-your-ios-live-activity-silently-stops-updating-lmd)
- [MPNowPlayingInfoCenter nowPlayingInfo throttled — Apple Developer Forums](https://developer.apple.com/forums/thread/785411)
- [NowLyrics — GitHub](https://github.com/chxhua2k7/NowLyrics)
- [Lyrical](https://lyricalmusic.app/) · [Pulse — App Store](https://apps.apple.com/app/id6755416222) · [Dynamic-Lyrics reviews — App Store](https://apps.apple.com/au/app/dynamic-lyrics/id6476125287?see-all=reviews&platform=iphone)
- [Teleprompter Pro X (PiP text) — App Store](https://apps.apple.com/app/id6502788841)
- [Live Activities essentials, WWDC26 — Apple](https://developer.apple.com/videos/play/wwdc2026/223/) (nothing new on update limits)

## Bigger picture (Osca, 13 Oct 11:33: "anything else which could solve it?")

Every way of making the island change goes through one of two doors. Either the app sends an update, which Apple freezes for a background audio app, or the phone changes it by itself. The phone changes only one kind of thing by itself: **timers and timer bars**. So the best remaining shot goes through the second door.

### The counting font: the island's own clock draws the words

**How it would work.** The island shows a running timer (`Text(timerInterval:)`). The phone ticks it every second with no update and no allowance. The timer is drawn in a font Frank makes for the chapter. Fonts can swap a run of characters for a single drawing (a "ligature", as "fi" becomes one shape). So in this font "0:07" is drawn as the words spoken in second 7, "0:08" as the words in second 8, and so on. The island shows the timer, and you see the book.

**What it would give:**
- **One change a second.** Speech is about 3½ words a second, so each tick would show the two to four words spoken in that second, in the piece-sized slot already designed, not a single word.
- **Accurate time, coarse words.** The second is exact. Which words fall in it comes from Frank's own word timings.
- **The red letter and font** still apply; the font is ours.
- **No freeze.** It never needs the app to update while you listen. Pause, play and seek each need one real update to restart the timer from the right place. That's a handful, which the allowance survived in our test (it showed about 4).

**What it would need:**
- **A shared folder** between the app and the island, so the island can load the chapter's font. That's an App Group, which the personal team signed without trouble in run 2.
- **A font made per chapter** from the word timings. That's simple font building (Python `fontTools`), and it could run on the Mac or on the phone inside the parser runtime Frank already carries.
- **A 20-minute chapter is 1,200 seconds**, so 1,200 drawn phrases: a font of a few MB.

**Unknowns, in order:**
1. Does the island draw a timer in a custom font at all? Custom fonts are allowed in Live Activities, but nobody has written about using one on a timer.
2. Does it apply the font's ligatures to timer text?
3. Does the timer keep counting when the island is frozen for updates? It should, since that's the point of timers, but it's untested on our phone.

**Test.** One run of the test app with a font built from the test sentence. If (1) and (2) hold, the island shows changing words with no updates for the whole run.

**Verdict:** the only route found where the island itself shows the book moving while you're in another app. Unproven.

### Run 4 result (13 Oct 11:59)

- **Answered yes:** the island's own clock keeps running with no updates, and the hundredths stopwatch is redrawn about 50 times a second.
- **Answered no:** the island draws clock text one character at a time and ignores the font's word-swaps (ligatures), so the clock showed digits, not words. Details in `ISLAND-TEST.md`.
- **What's left:** a way to turn "the clock's digits" into "one word" that doesn't depend on joining characters. The next idea is to have the clocks hide and reveal word pictures rather than swap characters.

### Can the clock tick faster than once a second? (Osca, 11:37: "the stopwatch shows milliseconds")

- **Inside the Clock app,** the stopwatch shows hundredths because the app is in front, drawing itself.
- **In the island,** Apple's own stopwatch shows "a small to-the-second timer", whole seconds only ([MacRumors](https://www.macrumors.com/2024/01/29/ios-17-4-stopwatch-live-activity/)). On an Always-On lock screen, the seconds even stop after the first minute ([iDB](https://www.idownloadblog.com/2024/08/16/ios-18-stopwatch-changes/)).
- **What developers can ask for:** since iOS 18 the public stopwatch and timer text styles take a precision setting (`.stopwatch(startingAt:showsHours:maxFieldCount:maxPrecision:)`), and a "live" time source keeps them ticking inside a Live Activity ([Create with Swift](https://www.createwithswift.com/formatting-time-in-a-text-view-in-swiftui/), [Apple forum](https://developer.apple.com/forums/thread/763273)). Nobody has written about whether the island actually redraws tenths or hundredths. Apple's own island stopwatch showing only seconds suggests it may not.
- **Why it matters:** if the island ticks tenths, the counting font can match "0:07.2", "0:07.3" and so on (blank glyphs for the digits, one drawing per tenth). That's up to 10 changes a second, enough for **one word at a time** in time with the voice. If it only ticks seconds, we're back to a phrase per second.
- **Test:** in the same run as the counting font, show a stopwatch with tenths in the island and record whether the island redraws faster than once a second. The Mac recorder already times every change.

### Smaller or partial options

- **iPhone Live Captions** (Settings → Accessibility) is Apple's own feature. It captions whatever audio the phone plays, Frank included, in a small floating panel over every app. Frank needs no code. But it's a panel, not the island, it transcribes rather than showing Frank's text, and the user has to turn it on. Since iOS 26 it's reported to work in all languages ([HearingTracker](https://forum.hearingtracker.com/t/live-captions-rolled-out-on-ios-26/107488)).
- **Apple Watch:** a watch app can show the word at full speed while the wrist is raised. Not the island.
- **Not allowed:** keeping Frank awake with location or a workout session would unfreeze the island (location is reported to work), but App Review rejects either for a reading app, and both drain the battery.
- **Ask Apple:** a paid developer account includes code-level support requests. Asking whether a background audio app can update its own Live Activity, and filing Feedback, costs nothing but time. The answer since 2022 has been no.
