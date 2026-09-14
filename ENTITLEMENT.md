# `com.apple.developer.networking.multicast` — the ask, and whether it is needed

**Osca fills the form; this file is what to paste.** Written 14 Sep by the
G-DISCOVER lane, which wired the discovery the entitlement is for.

---

## 0 · Read this part first: Apple's own two answers disagree

The `> go` that opened this lane says *"iOS forbids multicast/Bonjour browsing
without `com.apple.developer.networking.multicast`"*. That is **half** of what
Apple says, and the other half is worth ten minutes before 99 USD or a wait on
a review queue.

**Apple's documentation** (`com.apple.developer.networking.multicast`, the
entitlement's own page, fetched 14 Sep):

> A Boolean value that indicates whether an app can send or receive IP
> multicast traffic. … It also allows your app to browse and advertise
> **arbitrary** Bonjour service types.

**Apple's developer news post** ("How to use multicast networking in your
app"):

> Maintaining compatibility with some legacy devices and software might
> require the use of **custom multicast and broadcast protocols** (not
> Bonjour). Since these capabilities give your app complete access to the
> user's local network, such access requires the
> `com.apple.developer.networking.multicast` restricted entitlement.

and, in the same post:

> Use Bonjour whenever you need to discover or connect to other devices on
> your network.

Read together: a service type **declared** in `NSBonjourServices` is not
"arbitrary", and discovering it through Apple's own APIs (`NWBrowser`,
`NSNetServiceBrowser`) is the thing the post tells you to do *instead of*
needing the entitlement. On that reading Frank needs no entitlement at all —
only the local-network permission prompt, which it already has.

**But an Apple DTS engineer says the opposite**, on the developer forums
(thread 709302):

> If you are browsing for a Bonjour service with either NWBrowser or
> NetServiceBrowser, then yes, you will still need to declare this in the
> Info.plist. The Multicast Entitlement is also needed here because
> interacting with this particular service utilizes multicast under the hood.

**So: file the form.** The sources disagree, the form costs nothing but
Osca's five minutes, and a granted entitlement makes the question moot. The
typed card stays either way — that was Osca's word and it is not a fallback
of last resort, it is the guarantee that none of this can strand anyone.

### The part that is NOT in doubt

Frank does not use `NWBrowser`. It uses **`mdns-sd`**, a pure-Rust mDNS stack
that opens **its own UDP multicast socket** on 224.0.0.251:5353
(`src-tauri/Cargo.toml`, and `lib.rs::sync_discover`). That is raw multicast
by every reading of every source above, and it is squarely what the
entitlement exists for. **We need the entitlement because we bring our own
mDNS, not because Bonjour needs one.**

Which leaves a second road, free and available today, and it is worth naming
before the form is filed:

| | road A — the entitlement | road B — `NWBrowser` |
|---|---|---|
| what changes | nothing in the code; the key goes in `frank_iOS.entitlements` | a small Objective-C shim beside `ios/FrankAudio.m`, called from Rust like the audio session already is |
| cost | 99 USD/yr paid team + Apple's review of the form | a day of work; no fee, no queue, no review |
| risk | the request can be declined, and the reason is not always given | the shim is new code on a road nobody here has walked |
| still needs | `NSBonjourServices`, the local-network prompt | `NSBonjourServices`, the local-network prompt |

Road B also survives a declined request, which is the reason to keep it
written down rather than decided against.

### The ten-minute measurement that settles it for free

Nobody has yet watched Frank browse on the real iPhone. Before anything else:

1. Build and run the current `FRANK` phone build on the real phone (the six
   presses, `PHONE.md` §6b).
2. Settings ▸ Sync ▸ press **Sync** while Studio is running on the Mac.
3. Read the line above the card.

Since this lane it says which of three things happened, in words:

- **"Found *\<Mac name\>* on this network · one tap to pair"** — the browse
  worked. **The entitlement is not needed**, the form can be withdrawn, and
  road B is moot.
- **"No Studio found on this network · type the address and code…"** — it
  looked and saw nothing. A network problem, or Studio is not running.
- **"Frank cannot look for Studio on this network on this device (…)"** — it
  was refused. **That is the entitlement** (or the local-network prompt was
  declined — check Settings ▸ Frank ▸ Local Network first).

Before this lane all three drew the middle sentence, which is why the
question has gone unanswered for eight days.

---

## 1 · The form

The request page is **<https://developer.apple.com/contact/request/networking-multicast>**.

**It is behind an Apple ID sign-in**, so this lane could not read the live
field list and does not pretend to: what follows is the substance Apple asks
for, drafted so it can be pasted into whatever the fields turn out to be.
Osca: if a field here has no counterpart on the page, drop it; if the page
asks something this does not answer, §4 below has the numbers to answer it
with.

### App

- **App name** — Frank
- **Bundle ID** — `com.ttstv.frank` (confirm against
  `src-tauri/tauri.conf.json`)
- **Platform** — iOS (iPhone, iPad)
- **App Store status** — not yet submitted; in development

### What the app does

> Frank is an offline reader. It shows one book in two languages side by
> side, reads it aloud in a cloned voice, and highlights each word as it is
> spoken.
>
> The books are made on the person's own Mac, by a companion app called Frank
> Studio, and then copied to the phone. They are large — a parsed book with
> its audio is hundreds of megabytes — and they are the person's own
> property: their scans, their imports, their recordings.

### Why multicast is needed

> To copy a book from the Mac to the phone, the phone has to find the Mac.
> Both are the same person's devices on the same home network.
>
> Frank Studio advertises itself over Bonjour (`_frank._tcp`, and
> `_ttstv._tcp` for older builds). Frank on the phone browses for it and
> offers "Found *\<Mac name\>* — Pair". The phone also advertises itself
> (`_frank-phone._tcp`) so the Mac can send a finished book straight to it
> over the local network.
>
> Frank's discovery is implemented in Rust (the `mdns-sd` crate), because the
> app's networking is one cross-platform Rust core shared by the iOS, macOS
> and Android builds. That crate opens its own multicast socket rather than
> calling `NWBrowser`, which is why this entitlement is required.
>
> Without it the person must read an IP address and a six-digit code off the
> Mac's screen and type both into the phone. That path is built, it works,
> and it is kept permanently as the fallback — the entitlement replaces a
> transcription with a tap; it does not unlock a feature that is otherwise
> missing.

### The alternative considered (Apple will ask)

> We can browse the same declared Bonjour service types through `NWBrowser`
> via an Objective-C shim, and we will do that instead if this request is
> declined. We are asking because our networking layer is shared across three
> platforms and a single Rust implementation is the one that stays correct.
>
> We do not need broadcast, we do not need multicast to any group other than
> mDNS (224.0.0.251:5353 / ff02::fb), and we do not carry media, telemetry or
> any third-party traffic over the local network.

### Scope

- **Multicast groups used** — mDNS only: `224.0.0.251:5353`, `ff02::fb`
- **Service types** — `_frank._tcp`, `_ttstv._tcp`, `_frank-phone._tcp`
  (all three declared in `NSBonjourServices`)
- **What travels** — the advert carries a device name, a shape version, and
  an eight-character fingerprint of the pairing code. **Never** a token, a
  credential, or any of the person's content. Books move over plain TCP to
  the paired Mac only, after pairing.
- **Who it reaches** — the person's own devices, on their own network.
  Nothing is sent off the local network by this feature, and nothing reaches
  Frank's developers.

---

## 2 · Once it is granted

1. Add to **`src-tauri/gen/apple/frank_iOS/frank_iOS.entitlements`** (today an
   empty `<dict/>` — the file the ship build actually signs):

   ```xml
   <key>com.apple.developer.networking.multicast</key>
   <true/>
   ```

   and the same key in `src-tauri/gen/apple/project.yml` under the target's
   entitlements, so an `xcodegen` regeneration puts it back — the three-files-
   must-agree rule that `tests/test_pair_link.py` already keeps for the launch
   scheme.
2. Regenerate the provisioning profile (the entitlement is attached to the
   App ID, so the existing profile does not carry it).
3. `NSBonjourServices` is **already** the three names. Nothing there to do.
4. Press Sync on the real phone and read the line. It should be the first of
   the three sentences.

**The simulator proves nothing here.** Apple: *"You can test your app using
the iOS and iPadOS simulators without an active entitlement, but using
multicast and broadcast networking on physical hardware requires the
entitlement."* A browse that works in the simulator is the expected result
either way.

---

## 3 · What is already built (so the form is not describing a plan)

| | where |
|---|---|
| Mac advertises `_frank._tcp` **and** `_ttstv._tcp`, one port, one TXT | `TTSTV studio/sync.py::Advert` |
| the TXT carries `fp`, the pairing code's public half | `TTSTV studio/sync.py::code_fp` |
| Mac browses `_frank-phone._tcp` for a paired phone | `TTSTV studio/sync.py::find_phones` |
| phone browses both Mac types on one deadline | `src-tauri/src/lib.rs::sync_discover` |
| phone says **why** it found nothing | `lib.rs::Discovery`, `lib.rs::cannot_look` |
| phone advertises itself | `lib.rs::sync_advertise` |
| one tap: the code recovered from `fp` | `lib.rs::code_for_fp` |
| the card's two states | `TTSTV settings/settings.js::showPicker`, `syncFoundLine` |

Proved on the wire in both directions with the real code on both sides — the
Python advert seen by the real Rust browse, and the Rust advert seen by
`find_phones` — in `TTSTV studio/STATUS.md` §2.

---

## 4 · The one thing to decide before the tap ships

The advert carries `fp` = `sha256(six-digit code)[:8]`. A million-wide secret
with its hash on the wire **is** the secret: recovering the code from `fp`
costs **74 ms** in release Rust and **40 ms** in Python. That is exactly how
the phone gets its one tap — and exactly what anyone else on the Wi-Fi can do.

It is not a new hole. `POST /sync/pair` has **no rate limit** (measured,
`studio/serve.py::_handle_sync_pair`: no counter, no delay, no lockout), so
the same million could already be typed at the door in minutes. Publishing
`fp` moves a LAN attacker from minutes to microseconds; it does not move them
from impossible to possible.

**One tap is the decision to say out loud that the LAN is the trust
boundary.** If that is not what Osca wants, two cheap ways out, either of
which keeps everything above:

- **lengthen `CODE_DIGITS`** (`studio/sync.py`) — a fingerprint of a
  12-digit code is not walkable, and the phone then cannot do the one tap
  either. One tap and a walkable code are the same fact.
- **rate-limit `POST /sync/pair`** — worth doing regardless, and it is three
  lines.

Neither is taken here. Both are Osca's.
