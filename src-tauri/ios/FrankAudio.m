/*  FrankAudio.m -- the audio session, and the only reason Frank's sound
    survives the app switcher.
    ---------------------------------------------------------------------
    An iOS app is suspended a few seconds after it goes to the background
    unless its Info.plist claims a background mode, and its audio is stopped
    with it. `gen/apple/project.yml` now claims `UIBackgroundModes: [audio]`;
    that key alone is not enough. The category of the app's AVAudioSession
    decides whether the system treats the sound as something to keep alive
    (`AVAudioSessionCategoryPlayback`) or as decoration to silence
    (`SoloAmbient`, the default). WKWebView does not set it -- it plays into
    whatever session the app has -- so the app must, and there is no Tauri or
    Rust API for it. Hence eleven lines of Objective-C.

    WHY OBJECTIVE-C AND NOT SWIFT. The caller is Rust. A Swift function is only
    callable from Rust through `@_cdecl`, an underscored attribute with no
    stability promise, and a Swift file in this target would also want a
    bridging header for nothing. A `.m` file exports plain C symbols that
    `extern "C"` in `lib.rs` links against directly, which is the same door
    `gen/apple/Sources/frank/main.mm` already uses to call into Rust. The
    smallest thing that cannot break.

    WHY THE CATEGORY AND THE ACTIVATION ARE TWO CALLS. Activating a `Playback`
    session stops whatever else the phone is playing. Doing that at launch
    would mean opening Frank kills your music before you have asked for a
    word. So launch sets the category only -- which interrupts nothing -- and
    the session is activated on the first `play` event the page sees, which is
    the moment the reader actually starts reading (`NOW_PLAYING_JS` ->
    `audio_session_start`).

    Return values are ints because they cross an FFI boundary; `lib.rs` turns
    them into the sentence that goes in the log.
      0 ok · 1 setCategory failed · 2 setActive failed
*/
#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>

/// Route this app's sound as playback: keeps going when the screen locks and
/// when Frank is not the front app. `spokenAudio` is the mode for a book being
/// read aloud -- it is what tells the system to duck rather than mix, and what
/// CarPlay and AirPods use to pick their processing.
int frank_audio_session_category(void) {
    NSError *err = nil;
    AVAudioSession *s = [AVAudioSession sharedInstance];
    if (![s setCategory:AVAudioSessionCategoryPlayback
                   mode:AVAudioSessionModeSpokenAudio
                options:0
                  error:&err]) {
        NSLog(@"frank: AVAudioSession setCategory failed: %@", err);
        return 1;
    }
    return 0;
}

/// Take the session. Called once, when the reader first plays -- never at
/// launch, for the reason at the top of this file.
int frank_audio_session_activate(void) {
    NSError *err = nil;
    if (![[AVAudioSession sharedInstance] setActive:YES error:&err]) {
        NSLog(@"frank: AVAudioSession setActive failed: %@", err);
        return 2;
    }
    return 0;
}
