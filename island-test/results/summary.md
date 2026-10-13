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
