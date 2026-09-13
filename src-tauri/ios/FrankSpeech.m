/*  FrankSpeech.m -- AVSpeechSynthesizer, and the whole of what a live voice
    can be on this phone.
    ---------------------------------------------------------------------
    D1(b), `PROMPTS/plan-12-sep-cd.md`. D1(a) shipped the same reading through
    `window.speechSynthesis` in the webview and it works -- until the phone
    goes in a pocket. Web speech on iOS is not a synthesiser with a weak
    background story; it is a synthesiser the system is entitled to silence
    the moment the page stops being frontmost, and `onend` simply stops
    arriving (`reader/sysvoice.js`'s watchdog exists because of it). It also
    offers exactly four controls -- voice, rate, pitch, volume -- because SSML
    was dropped from the web speech spec, so there is no `<break>`, no
    `<phoneme>`, no mid-utterance `<lang>`, and D6's whole thesis (*"we do not
    need a better synthesiser, we need a better SCRIPT"*) has no instrument to
    play on.

    `AVSpeechSynthesizer` is that instrument. It is the SAME voices -- nothing
    here sounds better than D1(a) by itself -- and everything around them is
    different: it keeps speaking with the screen locked (given
    `UIBackgroundModes: [audio]` and the Playback session `FrankAudio.m`
    takes), it reports `willSpeakRangeOfSpeechString:` per word, and since
    iOS 16 it takes an SSML utterance.

    WHAT CROSSES THIS BOUNDARY, and it is deliberately narrow: text in, ints
    out. One callback function pointer, registered once, carrying four ints --
    kind, generation, location, length. No object, no string, no allocation
    the caller has to free, and nothing that has to be dropped in an order.
    `src/speech.rs` is the only caller and holds the whole of the why.

    ★ THE RANGE IS UTF-16 AND SO IS A JS STRING, which is the one piece of
    luck in the file. `willSpeakRangeOfSpeechString:` hands back an NSRange
    into `utterance.speechString`, and NSString is UTF-16 -- so
    `range.location` IS the `charIndex` a `speechSynthesis` `onboundary` event
    would carry for the same word, with no re-indexing anywhere. That is what
    lets `reader/sysvoice.js` treat this engine and the web one as one
    interface: the same `wordAtChar(starts, charIndex)` maps both, and the
    boundary->word-id proof (`design/reader/test-sysvoice.mjs` §2, 25,551 of
    25,551 ids) covers both without being re-run against a phone.

    RATE IS NOT A MULTIPLE HERE and the conversion is NOT in this file.
    `AVSpeechUtteranceRate` is 0..1 with 0.5 as normal speech and a curve of
    Apple's own; the web's `utterance.rate` is a MULTIPLE of normal. Something
    has to convert, and the honest place is somewhere it can be tested without
    a phone -- so `speech.rs::av_rate` does it, has the argument in its doc
    comment, and this file takes the AV-scale number and clamps it. A number
    arriving here is already in Apple's units.

    WHY OBJECTIVE-C AND NOT SWIFT -- `FrankAudio.m`'s answer: the caller is
    Rust, a `.m` exports plain C symbols an `extern "C"` block links against,
    and a Swift function would want `@_cdecl` and a bridging header for
    nothing.

    WHERE IT IS COMPILED. `build.rs`, by the `cc` crate, into its OWN archive
    (`frankspeech`) beside `frankaudio`, `frankwebview`, `franksearch`,
    `franklookup` and `frankinbox` -- and therefore deliberately ABSENT from
    the Xcode target's `sources`, because two compilations of one file is
    `duplicate symbol _frank_speech_speak` twenty minutes into a phone build.
    No framework beyond Foundation and AVFoundation, and `gen/apple/
    project.yml` already names AVFoundation for `FrankAudio.m` -- so this file
    adds no `sdk:` line, which is the one link-time trap the float lane wrote
    down (project memory `the_float_needs_a_background_mode`).

    THREADING. The synthesiser is created and driven on the main queue, and
    every delegate callback arrives there, so the callback into Rust is always
    on the main thread. A `speak` arriving from anywhere else is dispatched;
    `0` therefore means *handed over*, not *speaking* -- `FrankSearch.m`'s
    rule and its reason.

    Return values are ints because they cross an FFI boundary; `speech.rs`
    turns them into the sentence that goes in the log.
      0 ok · 1 a string has a NUL or is not UTF-8 · 2 there is nothing to say
      3 no callback registered · 4 not iOS · 5 no voice for that language
      6 SSML needs iOS 16 and this phone is older · 7 the SSML did not parse
*/
#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>
/* `objc_setAssociatedObject` / `objc_getAssociatedObject`. Named explicitly
   rather than left to `-fmodules` to pull in behind AVFoundation: the two
   symbols are the runtime's, not a framework's, and an implicit include that
   works today is an "implicit declaration of function" the next time the
   toolchain tightens. */
#import <objc/runtime.h>

/* kind, on the callback. Kept in step with `speech.rs::Kind`. */
enum { FRANK_SPEECH_START = 1, FRANK_SPEECH_WORD = 2, FRANK_SPEECH_END = 3,
       FRANK_SPEECH_CANCEL = 4, FRANK_SPEECH_PAUSE = 5, FRANK_SPEECH_CONTINUE = 6 };

typedef void (*frank_speech_event)(int kind, int uid, int location, int length);

static frank_speech_event gEvent = NULL;

/*  THE UTTERANCE ID, AND WHY IT IS AN INT AND NOT A POINTER.

    Every event has to say WHICH utterance it is about, and the two obvious
    answers are both wrong here. A pointer would cross the FFI boundary as a
    number the caller must not dereference and must somehow know is still
    alive. An index into a queue would be re-used the moment the queue is
    emptied -- and a cancelled utterance may still deliver a boundary or two
    before AVFoundation lets go of it (the same race `sysvoice.js` guards with
    its own `generation`), so a re-used number is a stale boundary landing on
    a live sentence.

    So the id is the CALLER'S, it is never re-used, and nothing here
    interprets it: it rides on the utterance in an associated object and comes
    back on every event. `speech.rs` does not interpret it either -- the map
    from id to sentence lives in the one place that made both, the native
    adapter in `reader/sysvoice.js`.  */
static const void *kUidKey = &kUidKey;

static int frank_speech_uid(AVSpeechUtterance *u) {
    NSNumber *n = objc_getAssociatedObject(u, kUidKey);
    return n ? n.intValue : 0;
}

@interface FrankSpeechDelegate : NSObject <AVSpeechSynthesizerDelegate>
@end

@implementation FrankSpeechDelegate

- (void)fire:(int)kind for:(AVSpeechUtterance *)u at:(NSRange)r {
    if (gEvent == NULL) return;
    gEvent(kind, frank_speech_uid(u), (int)r.location, (int)r.length);
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)s
  didStartSpeechUtterance:(AVSpeechUtterance *)u {
    [self fire:FRANK_SPEECH_START for:u at:NSMakeRange(0, 0)];
}

/*  ★ THE WORD. Q-D5 is whether this still fires when the utterance was built
    from SSML rather than from a plain string; nothing in this file can answer
    that -- `scratch-speech` presses it on a phone and Osca reads the number.
    Either way the range is into `speechString`, which for an SSML utterance
    is the text with the tags removed, so a caller that built the SSML from
    the same words it is highlighting gets indices into the words. */
- (void)speechSynthesizer:(AVSpeechSynthesizer *)s
     willSpeakRangeOfSpeechString:(NSRange)characterRange
                        utterance:(AVSpeechUtterance *)u {
    [self fire:FRANK_SPEECH_WORD for:u at:characterRange];
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)s
 didFinishSpeechUtterance:(AVSpeechUtterance *)u {
    [self fire:FRANK_SPEECH_END for:u at:NSMakeRange(0, 0)];
}

/*  A CANCEL IS NOT AN END, and the caller must be able to tell them apart:
    `sysvoice.js` walks to the next sentence on an end and stands still on a
    cancel, and a cancel that arrived as an end would run the chapter on at
    the exact moment somebody asked it to stop. */
- (void)speechSynthesizer:(AVSpeechSynthesizer *)s
 didCancelSpeechUtterance:(AVSpeechUtterance *)u {
    [self fire:FRANK_SPEECH_CANCEL for:u at:NSMakeRange(0, 0)];
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)s
  didPauseSpeechUtterance:(AVSpeechUtterance *)u {
    [self fire:FRANK_SPEECH_PAUSE for:u at:NSMakeRange(0, 0)];
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)s
didContinueSpeechUtterance:(AVSpeechUtterance *)u {
    [self fire:FRANK_SPEECH_CONTINUE for:u at:NSMakeRange(0, 0)];
}

@end

/*  ONE SYNTHESISER FOR THE LIFE OF THE APP. Apple's own guidance and the
    practical reason both point the same way: a synthesiser deallocated while
    speaking has undefined behaviour, and one created per utterance loses the
    queue that makes `speak` after `speak` gapless. */
static AVSpeechSynthesizer *gSynth = nil;
static FrankSpeechDelegate *gDelegate = nil;

static void frank_speech_ensure(void) {
    if (gSynth != nil) return;
    gSynth = [[AVSpeechSynthesizer alloc] init];
    gDelegate = [[FrankSpeechDelegate alloc] init];
    gSynth.delegate = gDelegate;
}

/// Register the one callback. Called once, from `speech.rs`, before anything
/// else here. A second call replaces the first rather than refusing, because
/// a hot reload in a debug build is a second call and refusing it would leave
/// a dead pointer to be called into.
int frank_speech_init(frank_speech_event cb) {
    if (cb == NULL) return 3;
    gEvent = cb;
    dispatch_async(dispatch_get_main_queue(), ^{ frank_speech_ensure(); });
    return 0;
}

/*  THE VOICE, and quality is a FIELD here rather than a substring of a name.
    On the Mac, `speechSynthesis.getVoices()` names the enhanced voices in the
    name itself -- "Daniel (Enhanced)" -- which is why `sysvoice.js::qualityOf`
    reads the name at all. AVFoundation does not: `name` is "Daniel" whatever
    was downloaded and `quality` is the enum. So the JSON below carries
    `quality` as a word, and `qualityOf` was taught to prefer an explicit
    field over the substring. Judging the system voice on a default voice is
    judging the wrong thing (Q-D1), so the field is the honest half. */
static NSString *frank_speech_quality(AVSpeechSynthesisVoice *v) {
    if (@available(iOS 16.0, *)) {
        if (v.quality == AVSpeechSynthesisVoiceQualityPremium) return @"premium";
    }
    if (v.quality == AVSpeechSynthesisVoiceQualityEnhanced) return @"enhanced";
    return @"default";
}

/// Every installed voice, as a JSON array, into `out` (NUL-terminated).
/// Returns the number of bytes written, or a negative error:
///   -1 no buffer · -2 the JSON would not fit · -3 could not be encoded
///
/// The shape is `speechSynthesis.getVoices()`'s, field for field, plus
/// `quality`, so `sysvoice.js::pickVoice` ranks a native list with the code it
/// already has: `{name, lang, voiceURI, localService, default, quality}`.
/// `localService` is always true and that is not a shrug -- every one of these
/// is on the phone, which is the whole offline story (D6, *"Offline?
/// Entirely."*).
int frank_speech_voices(char *out, int cap) {
    if (out == NULL || cap <= 1) return -1;
    NSArray<AVSpeechSynthesisVoice *> *voices = [AVSpeechSynthesisVoice speechVoices];
    NSMutableArray *rows = [NSMutableArray arrayWithCapacity:voices.count];
    for (AVSpeechSynthesisVoice *v in voices) {
        [rows addObject:@{ @"name": v.name ?: @"",
                           @"lang": v.language ?: @"",
                           @"voiceURI": v.identifier ?: @"",
                           @"localService": @YES,
                           @"default": @NO,
                           @"quality": frank_speech_quality(v) }];
    }
    NSError *err = nil;
    NSData *json = [NSJSONSerialization dataWithJSONObject:rows options:0 error:&err];
    if (json == nil) {
        NSLog(@"frank: speech voices JSON failed: %@", err);
        return -3;
    }
    if ((int)json.length + 1 > cap) return -2;
    memcpy(out, json.bytes, json.length);
    out[json.length] = '\0';
    return (int)json.length;
}

/*  Pick the voice object for an identifier, then for a language, then give
    up. The identifier road is the one the page normally takes -- it has the
    list, it ranked it, it names the winner -- and the language road is what
    answers when a voice was uninstalled between the list and the press. */
static AVSpeechSynthesisVoice *frank_speech_voice(NSString *voiceId, NSString *lang) {
    if (voiceId.length) {
        AVSpeechSynthesisVoice *v = [AVSpeechSynthesisVoice voiceWithIdentifier:voiceId];
        if (v != nil) return v;
    }
    if (lang.length) {
        AVSpeechSynthesisVoice *v = [AVSpeechSynthesisVoice voiceWithLanguage:lang];
        if (v != nil) return v;
    }
    return nil;
}

/// Speak one utterance.
///
/// `rate` is already in Apple's 0..1 scale (`speech.rs::av_rate` converted it);
/// `pitch` is 0.5..2 and `volume` 0..1, both Apple's own ranges. `ssml`
/// non-zero means `text` is an SSML document and not a string of words.
///
/// ★ THE UTTERANCE IS QUEUED, NOT SWAPPED, AND THAT IS THE WHOLE OF WHY THIS
/// FILE EXISTS. AVSpeechSynthesizer speaks what it is given in order, and it
/// goes on doing it with the screen locked and the app not frontmost. The web
/// engine cannot: `speechSynthesis` lives in the WKWebView, and a backgrounded
/// WKWebView has its timers throttled and its JavaScript suspended -- so a
/// reader that speaks one sentence and asks JS for the next stops at the end
/// of whichever sentence the lock button interrupted. Being able to hand the
/// REST OF THE CHAPTER over in one call, and have it read out with nothing of
/// ours running, is the difference between D1(a) and D1(b), and it is why
/// `reader/sysvoice.js` grew a batch path (`synth.queues`) rather than only a
/// new synthesiser object.
///
/// A caller that wants the queue empty calls `frank_speech_cancel` first;
/// that is what a rate change, a voice change and a pause all do.
int frank_speech_speak(const char *text, const char *lang, const char *voice_id,
                       double rate, double pitch, double volume, int ssml, int uid) {
    if (gEvent == NULL) return 3;
    if (text == NULL) return 2;
    NSString *body = [NSString stringWithUTF8String:text];
    if (body == nil) return 1;
    if ([body stringByTrimmingCharactersInSet:
              NSCharacterSet.whitespaceAndNewlineCharacterSet].length == 0) return 2;
    NSString *language = lang ? [NSString stringWithUTF8String:lang] : nil;
    NSString *voiceId = voice_id ? [NSString stringWithUTF8String:voice_id] : nil;

    AVSpeechUtterance *u = nil;
    if (ssml) {
        if (@available(iOS 16.0, *)) {
            u = [AVSpeechUtterance speechUtteranceWithSSMLRepresentation:body];
            /* Q-D4's failure mode, and it is SILENT: an SSML document Apple
               will not parse comes back nil rather than throwing, and a
               caller that fell back to plain text here would answer Q-D4
               "yes" for a phone that had ignored every tag. It returns 7. */
            if (u == nil) return 7;
        } else {
            return 6;
        }
    } else {
        u = [AVSpeechUtterance speechUtteranceWithString:body];
    }

    AVSpeechSynthesisVoice *v = frank_speech_voice(voiceId, language);
    if (v == nil && (voiceId.length || language.length)) return 5;
    if (v != nil) u.voice = v;

    double r = rate;
    if (r < AVSpeechUtteranceMinimumSpeechRate) r = AVSpeechUtteranceMinimumSpeechRate;
    if (r > AVSpeechUtteranceMaximumSpeechRate) r = AVSpeechUtteranceMaximumSpeechRate;
    u.rate = (float)r;
    if (pitch > 0) u.pitchMultiplier = (float)MIN(MAX(pitch, 0.5), 2.0);
    if (volume >= 0) u.volume = (float)MIN(MAX(volume, 0.0), 1.0);

    objc_setAssociatedObject(u, kUidKey, @(uid), OBJC_ASSOCIATION_RETAIN_NONATOMIC);

    dispatch_async(dispatch_get_main_queue(), ^{
        frank_speech_ensure();
        [gSynth speakUtterance:u];
    });
    return 0;
}

/// Stop, immediately, and empty the queue. Idempotent: cancelling a silent
/// synthesiser is not an error and fires nothing.
int frank_speech_cancel(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        frank_speech_ensure();
        [gSynth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
    });
    return 0;
}

/*  PAUSE, AND WHY IT IS HERE WHEN `sysvoice.js` DOES NOT USE IT.

    The engine's own pause is cancel-and-remember-the-word (★ POSITION IS
    SACRED, `plan-12-sep.md` A2c.32) because `speechSynthesis.pause()` is the
    call that silently fails on iOS and in a backgrounded tab. Native pause
    does not have that fault -- `AVSpeechBoundaryWord` finishes the word and
    stops -- and it is the only pause that can be exact, so it is offered for
    the one caller that will need exactness and cannot use the engine's:
    the lock screen and a headphone press, which pause an app and not a page.
    That caller does not exist yet (the report's §6 says so, and says whose it
    is). It costs nothing per word and cannot be called in a loop.  */
int frank_speech_pause(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        frank_speech_ensure();
        [gSynth pauseSpeakingAtBoundary:AVSpeechBoundaryWord];
    });
    return 0;
}

int frank_speech_resume(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        frank_speech_ensure();
        [gSynth continueSpeaking];
    });
    return 0;
}

/// Bit 0: speaking. Bit 1: paused. Asked by the engine's watchdog, which is
/// the loop that keeps a chapter from wedging on an utterance that ended in
/// silence (`sysvoice.js`, THE WATCHDOG). Safe off the main thread: both are
/// plain atomic reads on the synthesiser.
int frank_speech_speaking(void) {
    if (gSynth == nil) return 0;
    return (gSynth.isSpeaking ? 1 : 0) | (gSynth.isPaused ? 2 : 0);
}
