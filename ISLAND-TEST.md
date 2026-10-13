# Island test — how fast can the Dynamic Island show a changing word?

**Question.** The play-bar drafts (TTSTV `design/playbar/playbar-drafts.html`, commit 0c5d294) show the word being spoken in the Dynamic Island when you leave Frank. Apple slows down Live Activity updates and publishes no number. This test measures it on Osca's iPhone.

## What was built

A tiny throwaway app, **Island Test**, in `island-test/` — not Frank.

- It is its own Xcode project with its own id (`com.ttstv.frank.islandtest`). Frank's `project.yml` never mentions it, `phone.sh` never builds it, and nothing in Frank uses it, so it can't ship with Frank by mistake. Nothing else in either repo was touched.
- On opening, it plays a quiet looping tone (with the same background-audio setup Frank uses) and starts one Live Activity that shows a single word.
- **When you leave the app** (swipe up to the home screen), it begins the timed run and updates the word from the app itself, with no server involved:
  - 1 word a second for 30 s, then 2, 3 and 4 a second for 30 s each (3 s of quiet between each step)
  - then one update every 4 s for 40 s, standing in for "one update per sentence".
  - That makes 310 updates in about 3 minutes.
- **Logged on the phone** to `Documents/island-log.csv`:
  - every update the app sends, and when that call returns;
  - every time the widget actually draws a word, split by where it was drawn: the island's word beside the camera, the island's small and expanded views, and the lock screen.
  - Without a shared app group (which a free developer team may not be able to sign), the widget can't write a file the app can read. Instead, each time it draws word N it sends the app a system-wide notice with N in its name, and the app writes down the time.
- **What "shown" means here.** It means the widget drew that word for the island. An app can't see the screen itself, so this is as close to "the island showed it" as the phone allows. If the island skips or merges updates, those words are never drawn, and that is what the test counts.

## How to run it

From the `IOS TTS TV` folder, with the iPhone plugged in and unlocked:

```
bash island-test/run.sh
```

It takes about 6 minutes. Stop it with Ctrl-C if nothing has printed for 12 minutes. When it prints **"ON THE PHONE NOW"**, swipe up to the home screen and leave the phone alone for about 3 minutes. **Don't tap the island during the run**: tapping it opens the app, and while the app is open the island is hidden. The script builds the app, installs and opens it, waits, copies the log back, adds the results table below and commits it.

If the phone has no Dynamic Island, the island columns will read 0 and the lock-screen table is the answer instead.

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

### Run on the phone — 13 Oct 2026 11:03

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
