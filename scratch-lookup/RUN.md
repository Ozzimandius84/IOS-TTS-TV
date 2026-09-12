# RUN.md — the G-LOOKUP probe, on the simulator and on the phone

Throwaway (11 Sep). Nothing here is Frank, nothing here is committed, nothing
in `src-tauri/` or `shell/` was touched. One Objective-C file, one HTML page,
one hand-written Xcode project — no xcodegen, no script phase, no Rust.

## Simulator (≈1 min)

1. Finder → this folder → double-click `LookupProbe.xcodeproj` (or
   `open scratch-lookup/LookupProbe.xcodeproj`).
2. Xcode toolbar: scheme **LookupProbe**, destination **iPhone 17** (any
   simulator). ▶.
3. Every line lands in `scratch-lookup/probe.log` as well as the page's own
   panel (a simulator process writes the Mac's disk; `__FILE__` names the folder).

## The real phone (≈3 min, free team)

1. Same project. Select the **LookupProbe** target → *Signing & Capabilities* →
   Team: your personal team. (If Xcode says the bundle id is taken, change
   `com.ttstv.lookupprobe` to anything unique.)
2. Destination: your iPhone. ▶. First launch on the phone: Settings → General →
   VPN & Device Management → trust the developer, then open it again.
3. On the phone there is no `probe.log`: the numbers are in the page's log
   panel (newest first). Press and hold in the panel → Select All → Copy, and
   paste it into the chat.
4. Before the presses: Settings → General → Dictionary — note which
   dictionaries are ticked (the answer depends on them, and no API tells an
   app which ones are on).

## The presses (the same on both)

| # | press | answers |
|---|---|---|
| 1 | **▶ Run all** (starts a quiet 220 Hz tone) | `dictionaryHasDefinition` for 15 words in 8 languages, twice (cold, warm); then six sheets open and close by themselves: `shepherd` sheet, `fagus` sheet, half sheet, popover, ours+Apple ×2. Each line says call→gone, same document, scroll, rAF frames, tone seconds advanced vs wall seconds. |
| 2 | Tap the big word (`fagi`) with the mode on *sheet* and *stay* | one press → Apple's panel with nothing selected; press **Done** (or drag down) → the `GONE` line + `after-dismiss` state. |
| 3 | Tap the small dark box at the bottom right | the float's tap, same command |
| 4 | Tap 🎙 "look up" | the voice path, same command |
| 5 | Page, top: tap a word (it goes yellow), tap it again | the reading page's free gesture: second tap on the cursor's word → Apple's panel |
| 6 | Page: double-tap (or press-and-hold) a word | the OS menu. The log prints the whole menu WebKit built (`buildMenu … as built by WebKit: root[…]`) and where **Frank** went. Press **Look Up** once: the `present … UP …` lines name the class Apple's own Look Up uses, for comparison with row 2. Then select again and press **Frank**: our card. |
| 7 | Mode → *ours+Apple*, tap the big word | (c): our entry on top, Apple's controller as a child below; `(c) child …` says whether it drew and whether any of its text is in our process (counted, never printed). |
