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
