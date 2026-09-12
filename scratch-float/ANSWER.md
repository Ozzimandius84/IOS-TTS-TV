# The float — the spike's answer, 6 September 2026

Osca, 5 Sep: *"the very small overlay is for phones — like YouTube does — listen
along, do another thing."* The question is only whether Frank's one-word view can
stay on screen when the phone goes to another app.

---

## 1 · The number the whole thing turns on  (measured, no phone)

`node scratch-float/test-wordclock.cjs` — 5 passed, 0 failed, against
`books/poems timings/c002.json` + `chapters/c002.txt`, 240 MMS_FA-aligned words,
91.564 s, **0% of its gaps are the even 350 ms divider** (91.6% of the corpus's
20,615 gaps are, so a stub book would have flattered every road here).

| a float repainted at | words it actually shows | never drawn |
|---|---|---|
| 60 Hz — `CADisplayLink`, road (b) | 240 / 240 | 0 |
| 30 Hz — `captureStream`, road (a) | 240 / 240 | 0 |
| 10 Hz | 239 / 240 | 1 (0.4%) |
| 4 Hz | 199 / 240 | 41 (17.1%) |
| 1 Hz — a Now Playing write, road (c) | 92 / 240 | **148 (61.7%)** |

Gaps between consecutive words: min **40 ms**, p05 80 ms, median **281 ms** —
**3.56 words/s typically, 25 words/s at the floor.** Across all three books with
timings the aligned median is 281 ms and the p01 61 ms; the Pace driver at
900 wpm (job 22c) asks for 15/s on top.

**So: any road that repaints at video rate loses nothing, and a road that writes
to the lock screen once a second is not a word display.** That is not an opinion
about `MPNowPlayingInfoCenter`, it is arithmetic on the book.

## 2 · The thing that is missing from all three, and is missing today

`src-tauri/gen/apple/project.yml` and the generated `frank_iOS/Info.plist` contain
**no `UIBackgroundModes` at all**, and no `AVAudioSession` call exists anywhere in
`src-tauri` (`grep`, 0 hits). An iOS app with neither is suspended within seconds
of going to the background and its WKWebView's `<audio>` stops with it.

**Frank's audio does not currently survive leaving the app** — so "listen along,
do another thing" is blocked before any float is drawn. Every road below needs
the same two lines first, and they are the same two lines:

* `UIBackgroundModes: [audio]` in `project.yml`, then `xcodegen` (PHONE.md §6e)
* `AVAudioSession.sharedInstance().setCategory(.playback)` + `setActive(true)`
  at launch — ~15 lines of Swift, because Tauri has no API for it

Neither is a provisioning entitlement. **A free personal team can sign both** —
`RUN.md` step 4 is the only thing that can confirm it, and the simulator cannot,
because a simulator build is not signed at all.

## 3 · The three roads

**(a) `<video>` fed by `canvas.captureStream()`, entered with PiP.**
Two WebKit behaviours have to hold and nobody in this project controls either:
iOS must allow PiP on a *MediaStream-backed* video (Safari has historically
wanted a real media resource), and the painter must keep running once Frank is
not the front app. `requestAnimationFrame` is suspended when the page is hidden
and timers are throttled hard, so the honest painter is the audio clock —
`probe-web.html` counts all three separately (`raf_frames_while_away`,
`timer_ticks_while_away`, `timeupdates_while_away`) precisely so the failure is
legible rather than "it froze". **If PiP opens and the painter is suspended, the
result is a floating box with one frozen word, which is worse than no float.**
Cost if the probe is all green: **1 day.** Cost if it is not: the day is spent
and the answer is road (b) anyway.

**(b) native `AVPictureInPictureController` over an `AVSampleBufferDisplayLayer`,
from a Swift Tauri plugin.** No WebKit involved: the frames are drawn in
CoreGraphics and enqueued by a `CADisplayLink`, which the audio background mode
keeps alive. `probe-b/` is a standalone 260-line app that answers this in ten
minutes without touching Frank. Needs the deployment target moved **14.0 → 15.0**
(`ContentSource(sampleBufferDisplayLayer:)` is iOS 15) — no practical cost in
2026. Uses the plain sample-buffer content source, **not**
`AVPictureInPictureVideoCallLayer`, so it needs only the `audio` background mode
and never `voip`, which App Review rejects for an app that is not a phone.
Cost: **2 days** on top of §2.

**(c) no float — background audio and Now Playing, the word as the title.**
§2 alone, plus `navigator.mediaSession.metadata` from the page (which WebKit
forwards to Now Playing once the audio session is right). Cost: **0.5 day**, and
it is the same 0.5 day roads (a) and (b) already need. Per §1 the *word* on the
lock screen will be wrong 62% of the time — so ship it with the **line** or the
**sentence** as the title, not the word, and let the float carry the word.

## 4 · The recommendation for the 13th

**Build (c)'s half tomorrow because every road needs it; make (b) the float; run
(a)'s probe first only because it is twenty minutes and would save a day.**

| day | |
|---|---|
| **6 Sep, tonight** | `RUN.md`, four presses, ~25 min. The `FEATURES` table settles (a) in five seconds; `bg frames` settles (b) in ten minutes; step 4 settles the free team. |
| **7 Sep** | §2 — background mode + audio session + Now Playing. **0.5 day. This is road (c) finished**, and Frank stops losing its audio at the app switcher. |
| **8–10 Sep** | road (b): the Swift plugin, `probe-b`'s `FloatProbe` moved behind a Tauri command. **Built 10 Sep** — the lane's own date. |
| **11 Sep** | buffer. If (b) was refused on the phone, this is the day the in-page docked mini-word (day-5's route b, only while Frank is open) goes in instead. |
| **12 Sep** | pressed on Osca's phone — the lane's own date. |

**Why not (a) as the product**: it can only be disproved on a device, and if it
is disproved it is disproved around the 11th, with the fallback unbuilt. (b)
fails, if it fails, on the *first* run of `probe-b`, tonight.

**The design point that decides whether (b) is nice or horrible.** Do not send a
Tauri command per word — that is 3.56/s typical and 25/s at the floor, over a
JSON IPC bridge, forever. Send the chapter's word list and its starts **once**
(a few KB), then `audio.currentTime` at **4 Hz** as a drift correction, and let
Swift run its own `CADisplayLink` clock between those. Four messages a second
instead of two and a half thousand a chapter, and the word is still exact —
`wordclock.js`'s `indexAt` and `FloatProbe.indexAt` are deliberately the same
rule so both ends agree on which word that is.

## 5 · What this spike did not answer

* Nothing here has been compiled or run on a simulator. No Xcode, no `xcrun`,
  no `swiftc` in a Cowork session; `probe-b`'s Swift has never seen a compiler.
* Whether wry's `WKWebViewConfiguration` sets `allowsInlineMediaPlayback` /
  `allowsPictureInPictureMediaPlayback` — `RUN.md` steps 1 and 2 answer it by
  difference rather than by reading Tauri's source.
* What the float looks like. That is a `design/reader/` question and §6 of the
  report is where it is asked, not this folder.
