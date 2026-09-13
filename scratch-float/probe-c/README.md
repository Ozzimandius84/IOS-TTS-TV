# probe-c — the float, road (a), built to be pressed

**F0 of Programme F.** `probe-web.html` (6 Sep) asked whether the browser has
the feature. This asks the four questions F0 was actually set, over a **whole
real chapter**:

| | |
|---|---|
| **K26a** | does the WORD keep up — dropped words counted against the clock |
| **K26b** | does AUDIO continue while Frank is not the front app |
| **K26c** | does tapping the PiP return to Frank on the same WORD ID |
| **K28** | does it survive TEN MINUTES backgrounded |
| **K27** | can `mediaSession` carry the quiet ring's questions (answered: no — `F0.md` §6) |

| file | |
|---|---|
| `float.html` | the spike. Four clocks counted separately — `rAF`, a 60 Hz timer, `timeupdate`, and an **AudioWorklet tick on the audio thread** — so "it froze" is never the finding. `?mode=manual` swaps the compositor's pull for `track.requestFrame()`. |
| `timeline.json` | `eclogues-en/c001` — 794 words, 263.3 s, MMS_FA aligned, 0% of its gaps the 350 ms divider |
| `build-timeline.mjs` | builds it by lifting `tokenise` + `paraIndexOf` **verbatim out of `reader/listen.js`**, so the probe and the page agree on which word is word N |
| `drops.mjs` | the rate table, and the number the 6 Sep table did not print: how long the WRONG word stands there |
| `test-probe-c.cjs` | 16 assertions, no browser, no phone — run it before spending a press |
| `wordclock.js` | the parent's, byte for byte (asserted). probe-b counts the same word. |
| `audio.wav` | **not committed** — a symlink, `RUN.md` step 0 |

**`F0.md` is the answer. `RUN.md` is the three presses and the ten-minute wait.
Nothing here has been on a phone.** The Mac panel it feeds into is
`TTSTV/design/reader/FLOAT.md`.
