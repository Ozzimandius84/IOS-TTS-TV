# RUN.md — the D1(b) speech probe: Q-D4 and Q-D5, on a real phone

Throwaway (13 Sep). One Objective-C file, one hand-written Xcode project — no
xcodegen, no Rust, no script phase. **Nothing in `src-tauri/` or `shell/` is
touched or read**, so a wrong answer here cannot break a build.

It exists because the two questions D6 rests on cannot be answered in a
container with no speaker:

| | question | how this answers it |
|---|---|---|
| **Q-D4** | does the shipped voice honour `<phoneme>` and `<lang>`, or ignore them silently? | half a number (did Apple's parser accept the document, and what text did it keep) and half **your ear** — press 3(c) says *fagus* with an IPA override that should make it come out **“banana”**. If it does not, the tag is being ignored. |
| **Q-D5** | do word boundaries still fire under SSML? | a count: boundaries against words, plain and SSML, printed with the substring each range points at. |

Two more come free: press 5 measures the **rate curve** (the number
`src-tauri/src/speech.rs::av_rate` is waiting for), and press 6 is **the lock
screen**, which is the whole reason D1(b) exists.

## Simulator (≈1 min) — everything but the ear and the lock screen

1. `open "scratch-speech/SpeechProbe.xcodeproj"`.
2. Scheme **SpeechProbe**, destination any iPhone simulator. ▶.
3. Every line also lands in `scratch-speech/probe.log` (a simulator process
   writes the Mac's disk; `__FILE__` names the folder).

**A simulator is not the answer to Q-D4.** It has whatever voices the Mac has
and its audio path is not the phone's. Press 1 there to see the shape; judge
nothing by it.

## The real phone (≈3 min, free personal team)

1. Same project → target **SpeechProbe** → *Signing & Capabilities* → Team:
   your personal team. (If the bundle id is taken, change
   `com.ttstv.speechprobe` to anything unique.)
2. Destination: your iPhone. ▶. First launch: Settings → General → VPN &
   Device Management → trust the developer, then open it again.
3. **Before any press: download two voices.** Settings → Accessibility →
   Spoken Content → Voices → English → tap the ⬇ on two of them (an *Enhanced*
   and a *Premium* if the phone offers one). `plan-12-sep-cd.md` D2: *the
   default is not representative*, and press 1 prints which one every later
   answer came from.
4. There is no `probe.log` on the phone. Press and hold in the panel → Select
   All → Copy → paste into the chat.

## The presses

| # | press | listen for / read |
|---|---|---|
| **1** | **voices** | every non-default voice on the phone, and the best one for `en-GB`, `en-US`, `fr-FR`, `it-IT`, `el-GR`, `la`. **`la` will say `(no voice)` — that is expected** and it is why press 2 has four parts. |
| **2** | **`<lang>`** | four readings: (a) the Latin line plain in the English voice — the mangling; (b) the same inside `<lang xml:lang="la">`; (c) inside `<lang xml:lang="it-IT">`; (d) an English sentence with a French clause, as the **control**. *If (d) changes and (b) does not → `<lang>` works, Latin has no voice, and Italian (c) is the product's fallback. If neither (b) nor (d) changes → `<lang>` is ignored and D6's mid-article language switch is off the table on iOS.* |
| **3** | **`<phoneme>`** | (a) *fagus* plain, (b) *fagus* with scholarly Latin IPA, (c) ***fagus* told to say “banana”**. (c) is the whole question: if it is not a banana, `<phoneme>` does nothing and `voice/phon_la.py` has nowhere to go here. Then (d) `<break>`+`<prosody>` and (e) `<say-as>`+`<sub>` — one line each, so we learn whether the whole instrument is there or only part of it. |
| **4** | **boundaries** | five readings of nearly the same words, plain and SSML. Read the `BOUNDARIES n for m words` line. **1.00 per word is the answer the highlight needs; 0 under SSML means the good script and the highlight are in tension.** The `first ranges:` line shows the substring each range actually points at — that is the proof the index is into the tag-stripped string. |
| **5** | **rate** | sixty words at Apple rates 0.40, 0.50, 0.83, 1.00. Read the `wpm` on each. `speech.rs::av_rate` maps a web multiple onto that scale as a straight line through Apple's one published point and says so; **these four numbers are what corrects it.** In particular 0.83 is the Settings default (`wpm` 300 over `BASE_WPM` 180) and should come out near 1.67× the 0.50 reading. |
| **6** | **lock screen** | 40 sentences are queued and then **nothing of ours runs**. Press it, **lock the phone**, count to sixty. Still reading = a queued `AVSpeechSynthesizer` survives the lock screen, which is the difference between D1(a) and D1(b) and the reason `speech_speak` takes a batch. (This probe sets no now-playing info, so a blank lock screen here is expected and is not the app's answer — the app has `NOW_PLAYING_JS`.) |

`stop` empties the queue at any time.

## What to paste back

Press 1, then 4, then 5 (the numbers), and one sentence each for 2 and 3 —
**what you heard**. That is Q-D4 and Q-D5 answered, with the voice named.
