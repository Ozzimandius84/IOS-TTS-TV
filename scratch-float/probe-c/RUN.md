# RUN.md — probe-c, three presses and a wait

Everything here is Osca's Mac and Osca's phone. A Cowork session has no Xcode,
no `xcrun`, no simulator and no WebKit ([[ttstv-where-things-build]]), so what
this folder holds is the spike, the numbers that need no phone, and the exact
shape of the answer to paste back.

**F0 is four questions and this is the only file that can answer them:**
K26a does the WORD keep up · K26b does AUDIO continue · K26c does tapping the
PiP come back on the same WORD ID · K28 does it survive ten minutes away.
K27 (mediaSession) rides along in the same press.

---

## 0 · The audio, once  (10 s)

The probe plays a **real chapter** — `eclogues-en/c001`, 794 words, 263.3 s,
MMS_FA aligned, 0% of its gaps the 350 ms divider. The wav is 12.6 MB and is
**not** committed; link it in:

```
cd "~/Documents/RUNNERS/TTSTV_IOS/IOS TTS TV/scratch-float/probe-c"
ln -sf ~/Documents/RUNNERS/TTSTV/TTSTV/books/eclogues-en/audio/c001.wav audio.wav
```

**Without it the probe still runs, on a virtual clock, and says so — but then
K26b is not answered at all**, because a page with no sound is suspended for a
different reason than a page whose sound was cut.

Then, with no phone at all:

```
node scratch-float/probe-c/test-probe-c.cjs ~/Documents/RUNNERS/TTSTV/TTSTV
node scratch-float/probe-c/drops.mjs        ~/Documents/RUNNERS/TTSTV/TTSTV
```

16 pass / 0 fail, and the drop table of `F0.md` §1. Both already run here.

## 1 · Mobile Safari first  (3 min) — the generous case

If WebKit refuses here it refuses inside Frank too, and you have saved the
build.

```
cd scratch-float/probe-c && python3 -m http.server 8123 --bind 0.0.0.0
```

On the **phone** (same Wi-Fi): Safari → `http://<the Mac's LAN address>:8123/float.html`

Press **1**. The eight-line `FEATURES` block is most of the answer:

| line | if it is false |
|---|---|
| `canvas_captureStream` | road (a) is closed. Stop; the answer is probe-b. |
| `video_requestPictureInPicture` **and** `webkitSupportsPresentationMode` both false/null | the same. |
| `audioWorklet` | the only painter that could survive backgrounding is gone; expect a frozen word. |

Then press **2**, and:

* **leave Safari** (Home, or open another app),
* **wait TEN MINUTES** — this is K28, and a two-minute wait does not answer it,
* come back by **tapping the PiP window** (not the app switcher — the tap is K26c),
* press **3**, press **4** (copy), and paste everything from `=== ANSWER ===`.

While you are away, press the **AirPods**: double-press once, triple-press
once. That is K27 — the `FIRED` list in the answer says which of the twelve
`mediaSession` actions iOS actually delivered, and at which word.

## 2 · The same page inside Frank  (5 min) — the real question

Frank is a WKWebView, not Safari, and its configuration is wry's, not ours.

```
npm run -- tauri ios dev "iPhone 2" --host          # PHONE.md §6c
cp scratch-float/probe-c/{float.html,wordclock.js,timeline.json} shell/
```

Safari → Develop → your phone → Frank (PHONE.md §6d), then in the console:

```js
location.href = "/float.html?audio=/books/eclogues-en/audio/c001.wav"
```

Same three presses, same paste. **A `false` here against a `true` in step 1 is
wry's `WKWebViewConfiguration`, which is a fixable line and not a closed road.**

**Then delete the three files out of `shell/`** — `tools/prebuild.py`'s manifest
check fails the next build if they stay.

## 3 · The one variant worth a second press  (2 min)

Only if step 1 or 2 came back with `paints while away = 0` **and** the PiP window
did open. The automatic sampler may be what stopped, not the page:

```
float.html?mode=manual        # captureStream(0) + track.requestFrame() per word
```

If `paints while away` climbs in `manual` where it was 0 in `auto`, road (a)
lives and the painter is the word clock pushing frames rather than the
compositor pulling them.

---

## What the answer decides

| the answer | what ships |
|---|---|
| `paints while away` climbs, PiP open, `NEVER DRAWN` 0 | **road (a)** — a web float, no Swift, the Mac panel and the phone float share one painter. |
| PiP opens but `paints while away` = 0 in both modes | **road (b)** — `probe-b/`, the native `AVSampleBufferDisplayLayer`, 2 days. The web float becomes the Mac's only. |
| PiP never opens | **road (b)**, and the in-page docked mini-word is the fallback for a phone that refuses both. |

**No Float button lands from this chat either way** — F0 proves the road, Osca picks it.
