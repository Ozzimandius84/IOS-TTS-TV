# Island test — how fast can the Dynamic Island show a changing word?

**Question.** The play-bar drafts (TTSTV `design/playbar/playbar-drafts.html`, commit 0c5d294) show the word being spoken in the Dynamic Island when you leave Frank. Apple slows down Live Activity updates and publishes no number. This test measures it on Osca's iPhone.

## The answer (run 3, 13 Oct 11:11, whole 4½-minute recording checked)

**Once you leave the app, iOS shows about 4 more words in the island and then stops. It stays frozen until you open the app again.** The rate makes no difference: even one word every 4 s froze after 4 words. Nothing an app sends from the background gets past this.

What happened, from the recording of the screen and the phone's own log, five seconds at a time:

| when (s after launch) | what you did | island changes seen |
|---|---|---|
| 13 | left the app | — |
| 16–28 | away | 4 words (one every 4 s), then **nothing** |
| 28–64 | away | **0** (the app sent 6 more) |
| 64–73 | opened it twice | 3: it caught up |
| 73–193 | away | **0 for 2 minutes** (the app sent 250 more) |
| 193–197 | opened it | 5: it caught up (a burst of old words, then live at 4 a second while open) |
| 197–262 | away | **0** |
| 262–270 | opened it | 15: caught up again |

- **The app is not the problem.** It sent all 310 updates on time, and every one was accepted in under 15 ms.
- **The words are held back, not lost.** ActivityKit's own record shows them held and then released in one burst at the moment you opened the app, which is the "catches up" you saw.
- **While the app is open, the island keeps up with 4 words a second.** It's only while you're away, which is the moment the drafts use it, that it freezes.

So the island can't follow the spoken word when the update comes from the app itself. Even once per sentence doesn't hold for more than about 15 seconds.

Not tested: updates sent by Apple's push service from a server. That needs a paid developer account and a server, and Apple says those have a budget too.

Pictures: `island-test/results/island-22s-moving.png` shows a live word. `island-test/results/island-100s-frozen.png` shows the same word still there 80 s later while the app sent 120 more.

## What was built (current version, run 3)

A tiny throwaway app, **Island Test**, in `island-test/` — not Frank.

- **Kept apart from Frank.** It is its own Xcode project with its own id (`com.ttstv.frank.islandtest`). Frank's `project.yml` never mentions it, `phone.sh` never builds it, and nothing in Frank uses it, so it can't ship with Frank by mistake. Nothing else in either repo was touched.
- **On opening**, it plays a quiet looping tone (the same background-audio setup Frank uses) and starts one Live Activity that shows a single word.
- **When you leave the app**, it updates the word from the app itself, with no server involved. Slowest first, with 10 s of rest between steps to see whether the island recovers:
  - once every 4 s for 40 s (standing in for "once per sentence");
  - then 1, 2, 3 and 4 a second for 30 s each.
  - That makes 310 updates in about 3½ minutes.
- **How the word looks in the island** (Osca, 13 Oct 11:04 and 11:18):
  - The word sits in a fixed-width slot, so the island no longer grows and shrinks with each word.
  - Words longer than seven letters are broken into pieces of up to six, for example "acknow-" then "ledged".
  - It uses the drafts' font, Iowan Old Style. Run 3 used a monospace, which was wrong.
  - The red letter follows **Frank's own rule, copied from `reader/wordview.js`**: letter 1, 2, 3, 4 or 5 (counting letters only) for words of 1, 2–5, 6–9, 10–13 and 14+ letters, so "My" → y, "Mr." → r, "He" → e. Run 3 used an invented rule, which was wrong. It always sits in the same column.
- **How "shown" is measured.** The Mac records the phone's screen over the cable, the same feed QuickTime uses, with `island-test/recorder/record.swift`. It writes down how much the island's strip of the screen changed in every frame and saves a picture of the strip each time it changes. A burst of changing frames counts as one change, which is what a person sees as "the word moved". The phone's log carries its wall-clock time, so the two line up.
- **Also logged on the phone:** every update sent, when the call returned, and when ActivityKit says the activity's content changed.

## How to run it

From the `IOS TTS TV` folder, with the iPhone **plugged in by cable** and unlocked:

```
bash island-test/run.sh
```

- It takes about 7 minutes. Stop it with Ctrl-C if nothing has printed for 14 minutes.
- The first time, the Mac may ask whether Terminal may use the Camera. Click Allow: that is the phone's screen feed.
- When it prints **"ON THE PHONE NOW"**, swipe up to the home screen and leave the phone alone. **Don't tap the island**: tapping it opens the app, and the island is hidden while the app is open.
- The script builds the app, records the screen, copies the log back, adds the results table below and commits it.

## Results

### Run 1 (13 Oct 10:43): measured nothing about the island

The app side worked. On an iPhone running iOS 26.6.1 with Live Activities on, the tone played, the activity started, and all 310 updates were sent and accepted. Each update call returned in about 2 ms and the slowest took 7 ms.

The other half failed: **the app heard nothing back from the widget, not even once.** So the zeros in the tables below mean "not measured", not "the island showed nothing". The widget was built and embedded correctly. Either its signals (Darwin notifications) never reach the app, or it never drew. This log alone can't tell the two apart.

The app was also opened four times during the run (at 128 s, 138 s, 187 s and 201 s), which affects the 4-per-second and once-per-sentence steps.

What changed for run 2: the widget now writes every word it draws to a file in a folder shared with the app (an App Group), stamped on the phone's single clock. At the end of the run the app copies that file into its log. The old signal is kept as a cross-check. If Osca's personal team can't sign an App Group, the build stops and says so in `island-test/results/build.log`.

The run-1 tables follow, kept unedited.

### Run 1 raw output — 13 Oct 2026 10:46

### Dynamic Island (word beside the camera)

| rate | sent | shown | median gap between shown words | longest gap | median delay sent → shown |
|---|---|---|---|---|---|
| 1 per second | 30 | 0 (0%) | – | 32.99 s | – |
| 2 per second | 60 | 0 (0%) | – | 33.01 s | – |
| 3 per second | 90 | 0 (0%) | – | 32.99 s | – |
| 4 per second | 120 | 0 (0%) | – | 33.01 s | – |
| 1 per sentence (every 4 s) | 10 | 0 (0%) | – | 40.00 s | – |

### Lock screen / banner view

| rate | sent | shown | median gap between shown words | longest gap | median delay sent → shown |
|---|---|---|---|---|---|
| 1 per second | 30 | 0 (0%) | – | 32.99 s | – |
| 2 per second | 60 | 0 (0%) | – | 33.01 s | – |
| 3 per second | 90 | 0 (0%) | – | 32.99 s | – |
| 4 per second | 120 | 0 (0%) | – | 33.01 s | – |
| 1 per sentence (every 4 s) | 10 | 0 (0%) | – | 40.00 s | – |

Update calls returned: 310 of 310, median 2.0 ms, slowest 7 ms.
Draw calls by region:   (c island compact, m island minimal, e island expanded, l lock screen)

Phase windows (s since launch): 1/s 21.3–54.3, 2/s 54.3–87.3, 3/s 87.3–120.3, 4/s 120.3–153.3, sentence 153.3–193.3
App state changes: 18.3s background, 127.9s foreground, 131.9s background, 138.4s foreground, 142.1s background, 186.8s foreground, 189.3s background, 201.0s foreground

```
    0.0s  info iPhone iOS 26.6.1
    0.0s  info live activities enabled=true
    0.8s  info audio playing
    0.9s  info activity started
   18.3s  run_start planned 310 updates
  197.3s  run_end
  197.3s  info activity ended
```

### Run 2 (13 Oct 11:00): the widget can't report back; Osca saw the island freeze

**The widget can't say what it drew.** It had a shared folder this time (the log says "shared folder ok"), yet it wrote nothing into it, and again no signal arrived. Osca, though, **saw the word change in the island** in both runs. So the widget does draw, but its code can't report anything on this phone, and the phone can't measure itself. Run 3 measures the screen from the Mac instead.

**What Osca saw (13 Oct 11:04), which is the first real result:**

- The word moved at first, then **stopped moving after about 30 seconds**.
- When he opened the app it "kind of caught up", then stopped again once he left.
- The app kept sending throughout: all 310 updates were accepted within 15 ms each. So iOS takes the updates and stops putting them on screen. This looks like Apple's throttle on an app updating from the background.
- The island **expanded and contracted a lot**, because each word has a different width. Run 3 fixes the width.
- There was no red letter. Run 3 adds it.

Runs 1 and 2 both started at 1 word a second, so the freeze hit inside the first step and every later step inherited it. Run 3 starts slowest and rests 10 s between steps.

### Run 2 raw output — 13 Oct 2026 11:03

**No widget draws were recorded, so this run measured nothing about the island.** The info lines at the bottom say whether the widget could not write its file or never drew at all.

### Dynamic Island (word beside the camera)

| rate | sent | shown | median gap between shown words | longest gap | median delay sent → shown | app open during it |
|---|---|---|---|---|---|---|
| 1 per second | 30 | 0 (0%) | – | 33.00 s | – | no |
| 2 per second | 60 | 0 (0%) | – | 33.00 s | – | no |
| 3 per second | 90 | 0 (0%) | – | 33.00 s | – | 3 s |
| 4 per second | 120 | 0 (0%) | – | 33.00 s | – | no |
| 1 per sentence (every 4 s) | 10 | 0 (0%) | – | 40.00 s | – | 2 s |

### Lock screen / banner view

| rate | sent | shown | median gap between shown words | longest gap | median delay sent → shown | app open during it |
|---|---|---|---|---|---|---|
| 1 per second | 30 | 0 (0%) | – | 33.00 s | – | no |
| 2 per second | 60 | 0 (0%) | – | 33.00 s | – | no |
| 3 per second | 90 | 0 (0%) | – | 33.00 s | – | 3 s |
| 4 per second | 120 | 0 (0%) | – | 33.00 s | – | no |
| 1 per sentence (every 4 s) | 10 | 0 (0%) | – | 40.00 s | – | 2 s |

Update calls returned: 310 of 310, median 2.0 ms, slowest 15 ms.
Draw calls by region:   (c island compact, m island minimal, e island expanded, l lock screen)
Darwin notifications heard (cross-check): none

Phase windows (s since launch): 1/s 9.3–42.3, 2/s 42.3–75.3, 3/s 75.3–108.3, 4/s 108.3–141.3, sentence 141.3–181.3
App state changes: 6.3s background, 88.1s foreground, 91.5s background, 176.9s foreground, 179.4s background, 184.7s foreground, 187.5s background, 188.6s foreground, 190.3s background

```
    0.0s  info iPhone18 3 iOS 26.6.1
    0.0s  info t0 415242.3581
    0.0s  info shared folder ok
    0.0s  info live activities enabled=true
    0.1s  info audio playing
    0.2s  info activity started
    6.3s  run_start planned 310 updates
  185.3s  run_end
  185.3s  info activity ended
  187.3s  info widget wrote no drawn.csv (it drew nothing)
```

### Run on the phone, screen recorded — 13 Oct 2026 11:16

| rate | sent | changes seen in the island | median gap | longest gap | first froze (still > 2 s) | ActivityKit said updated | app open during it |
|---|---|---|---|---|---|---|---|
| 1 per sentence (every 4 s) | 10 | 4 (40%) | 4.30 s | 40.1 s | after 8 s | 9 | no |
| 1 per second | 30 | 3 (10%) | 61.38 s | 120.6 s | after 0 s | 8 | 3 s |
| 2 per second | 60 | 0 (0%) | – | 0.0 s | never | 10 | no |
| 3 per second | 90 | 0 (0%) | – | 0.0 s | never | 16 | no |
| 4 per second | 120 | 13 (10%) | 0.91 s | 58.4 s | after 0 s | 22 | 4 s |

Screen frames recorded: 16108; change threshold 1.0. Gaps include about 0.1 s of cable-mirroring lag, the same for every word.
Changes seen during the 10 s rests (should be 0 or 1 -- a late catch-up shows here): after sentence: 0, after 1/s: 0, after 2/s: 0, after 3/s: 0
App state changes: 13.1s background, 64.7s foreground, 66.9s background, 70.5s foreground, 72.5s background, 193.3s foreground, 197.3s background, 262.8s foreground, 265.1s background

```
    0.0s  info wall 1791886311.6219
    0.0s  info iPhone18 3 iOS 26.6.1
    0.0s  info live activities enabled=true
    0.1s  info audio playing
    0.1s  info activity started
    0.1s  info activity state active
   13.1s  run_start planned 310 updates
  266.0s  run_end
  266.0s  info activity ended
  266.1s  info activity state dismissed
```
