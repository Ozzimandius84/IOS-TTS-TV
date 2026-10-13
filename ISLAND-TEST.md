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

It takes about 6 minutes. Stop it with Ctrl-C if nothing has printed for 12 minutes. When it prints **"ON THE PHONE NOW"**, swipe up to the home screen and leave the phone alone for about 3 minutes. The script builds the app, installs and opens it, waits, copies the log back, adds the results table below and commits it.

If the phone has no Dynamic Island, the island columns will read 0 and the lock-screen table is the answer instead.

## Results

Not measured yet. The run appends the tables below this line.
