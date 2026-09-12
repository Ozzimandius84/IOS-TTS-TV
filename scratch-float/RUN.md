# RUN.md — the float spike, four presses

Everything here is Osca's Mac. Nothing in this folder has been built, run, or
put on a simulator: a Cowork session has no Xcode, no `xcrun`, no `swiftc` and
no simulator (`ttstv-where-things-build`). What it has is the smallest thing
that answers each road and the numbers that need no phone.

Total: **~25 minutes**, and it settles the 10 Sep build.

---

## 0 · No phone needed — the number every road has to hit  (30 s, already run)

```
cd "~/Documents/RUNNERS/TTSTV_IOS/IOS TTS TV"
node scratch-float/test-wordclock.cjs
python3 scratch-float/wordrate.py ~/Documents/RUNNERS/TTSTV/TTSTV
```

Ran in the bridge VM, 5 passed / 0 failed. The result is in `ANSWER.md` §1 and
it is the fact the whole decision turns on: **the word changes 3.56 times a
second typically and 25 times a second at the floor**, so a float that can only
be repainted once a second shows 62% fewer words than the book has.

---

## 1 · Road (a) — web PiP, in mobile Safari first  (5 min)

Safari is the generous case. If it refuses here, it refuses inside Frank too.

```
cd scratch-float && python3 -m http.server 8123 --bind 0.0.0.0
```
then on the **simulator**: Safari → `http://<the Mac's LAN address>:8123/probe-web.html`

Press **1**, then **2**, then send the app to the background (Home / swipe up),
count ten, come back, press **4**.

**Paste the block after `=== ANSWER ===`.** The `FEATURES` object at the top is
most of the answer on its own — if `canvas_captureStream`, `webkitSupports_pip`
or `webkitSetPresentationMode` is `false`/`null`, road (a) is closed and you can
stop. If PiP does open, the line that decides it is `away`:

| field | what it means |
|---|---|
| `audio_kept_playing: true` | the sound survived leaving the app |
| `raf_frames_while_away` | 0 = requestAnimationFrame was suspended (expected) |
| `timer_ticks_while_away` | 0 = the whole page was suspended, so the word froze |
| `timeupdates_while_away` | > 0 = the audio clock kept the painter alive — road (a) lives |
| `paints_while_away` | 0 with a PiP window open = **a frozen word in a floating box** |

## 2 · Road (a) again — inside Frank  (5 min)

The real question, because Frank is a WKWebView and not Safari.

```
npm run -- tauri ios dev "iPhone 2" --host        # PHONE.md §6c
cp scratch-float/probe-web.html scratch-float/wordclock.js scratch-float/timeline.json shell/
```
Then Safari → Develop → Simulator → Frank (PHONE.md §6d), and in the console:

```js
location.href = "/probe-web.html"
```

Same four presses, same paste. Compare `FEATURES` with step 1: a `false` here
and `true` there is wry's `WKWebViewConfiguration`, and that is a fixable line,
not a closed road. **Delete the three files out of `shell/` afterwards** — the
manifest check (`tools/prebuild.py`) will fail the next build if they stay.

## 3 · Road (b) — native PiP, standalone  (10 min)

Deliberately not Frank: 260 lines of Swift that answer the road alone.

```
cd scratch-float/probe-b && xcodegen generate && open floatprobe.xcodeproj
```
Pick a simulator, press ▶. Press **1**, then **2**, then Home. Read the Xcode
console. The lines that matter, in order:

* `[b] isPictureInPictureSupported = …` — `false` on the simulator is common and
  means *go to the phone*, not *road closed*.
* `[b] DID START` or `[b] FAILED TO START <error>`
* `[b] --- BACKGROUND at …` then the `[b] 1s …` ticks after it. **`bg frames`
  climbing while the app is in the background is road (b) proved**; frozen at
  the backgrounding number is road (b) refused.

**Paste the last 30 console lines.**

## 4 · The half no simulator can answer — the free team  (5 min, needs the phone)

A simulator build is not signed at all, so it cannot tell you whether a free
personal team may ship this. Only the phone can. In `probe-b`: target →
Signing & Capabilities → your personal team → Run on the plugged-in iPhone.

The only capability any of the three roads needs is `UIBackgroundModes: [audio]`
— an Info.plist value, not a provisioning entitlement — so this is expected to
just build. **If Xcode shows a signing error, paste it**: that would change the
recommendation, and it is the one thing here nobody can predict from a desk.

> Do **not** add the `voip` background mode, on any road. It is what
> `AVPictureInPictureVideoCallLayer` wants, and App Review rejects it for an app
> that is not a phone. `probe-b` uses the plain sample-buffer content source,
> which needs only `audio`.
