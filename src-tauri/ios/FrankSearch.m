/*  FrankSearch.m -- the search sheet, and the only reason pressing "Search the
    web" does not throw the reader away.
    ---------------------------------------------------------------------
    `design/reader/search.html` gives the WEB lane one row, and `reader/
    lookup.js` gives the word panel one button, and both mean the same thing:
    take these words to the web WITHOUT LEAVING THE BOOK. On iOS there are three
    ways to do that and only one of them is right.

      UIApplication openURL      leaves the app. Safari comes up, Frank goes to
                                 the background, and coming back is the user's
                                 problem and the app switcher's. The audio would
                                 survive (job 8b) and nothing else would.
      A WKWebView of our own      a browser we would then have to build: a back
                                 button, a reload, a share sheet, cookies, and
                                 sign-ins that do not work because the session
                                 is not Safari's.
      SFSafariViewController      a sheet OVER the app. Real Safari -- the same
                                 cookies, the same reader mode, the same
                                 password autofill -- in a view controller we
                                 present and the system draws, with a Done
                                 button that dismisses it and gives the app back
                                 exactly as it was. Nothing to build, nothing to
                                 maintain, and the app is never backgrounded.

    The third one, therefore. Sixty lines, and most of them are this comment.

    WHY OBJECTIVE-C AND NOT SWIFT -- the same answer `FrankAudio.m` gives, for
    the same reason: the caller is Rust, a `.m` file exports plain C symbols an
    `extern "C"` block links against, and a Swift function needs `@_cdecl`, an
    underscored attribute with no stability promise, plus a bridging header for
    nothing.

    WHERE THIS FILE IS COMPILED. `build.rs`, by the `cc` crate, into its own
    archive (`franksearch`) beside `frankaudio` and `frankwebview` -- the house
    pattern, and `build.rs`'s own note says why an archive per file rather than a
    second `.file()` on one build. It is therefore deliberately ABSENT from the
    Xcode target's `sources`: two compilations of one file is `duplicate symbol
    _frank_search_present` twenty minutes into a phone build, which is how
    `FrankAudio.m` learned it at 14:24 on 6 September.

    The FRAMEWORKS are the other half and they are NOT in `build.rs`. This crate
    is a `staticlib`, so cargo never runs a linker and its
    `cargo:rustc-link-lib=framework=` lines reach nothing; Xcode links the
    binary, so Xcode is told. `SafariServices.framework` is named in
    `gen/apple/project.yml` beside `AVFoundation.framework`, for the reason
    written above that line. UIKit was already there.

    THREADING. `frank_search_present` is called from Rust's `on_navigation`,
    which is WebKit's `decidePolicyForNavigationAction` delegate callback, on the
    main thread. Presenting a modal from inside that callback is how WebKit gets
    wedged, so the presentation is dispatched and the run loop is allowed one
    turn first. What that costs is honesty about the return value: 0 means
    *handed to the main queue*, not *on screen*. The one failure worth a code --
    there is no view controller to present from -- is still checked before the
    dispatch when the call already arrives on the main thread, which it does.

    Return values are ints because they cross an FFI boundary; `search.rs`
    turns them into the sentence that goes in the log.
      0 ok · 2 not an http(s) address · 3 nothing on screen to present from
    (1 and 4 are `search.rs`'s own and never come from here.)
*/
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <SafariServices/SafariServices.h>

/// The delegate exists for one line: forget the sheet when the user presses
/// Done. Without it `gOpen` would keep naming a controller that is gone, and the
/// next press would spend a `dismissViewControllerAnimated:` on nothing.
@interface FrankSearchSheet : NSObject <SFSafariViewControllerDelegate>
@end

static FrankSearchSheet *gDelegate = nil;
/// Weak: the presenting view controller owns the sheet while it is up, and this
/// goes nil by itself if it comes down some way we did not hear about.
static __weak SFSafariViewController *gOpen = nil;

@implementation FrankSearchSheet
- (void)safariViewControllerDidFinish:(SFSafariViewController *)controller {
    if (gOpen == controller) gOpen = nil;
}
@end

/// The view controller a sheet can be presented from: the key window of the
/// foreground scene, walked down through whatever is already presented.
///
/// `UIApplication.keyWindow` has been deprecated since iOS 13 and lies in a
/// multi-scene app; `UIWindowScene.keyWindow` is iOS 15, which is this app's
/// deployment target since the float (job 8b). The second pass exists because a
/// scene can be `foregroundInactive` for a moment -- during the very transition
/// a press can arrive in -- and a sheet presented then is still correct.
static UIViewController *frank_search_top(void) {
    UIWindow *key = nil;
    for (int pass = 0; pass < 2 && key == nil; pass++) {
        for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
            if (![scene isKindOfClass:UIWindowScene.class]) continue;
            UIWindowScene *ws = (UIWindowScene *)scene;
            if (pass == 0 && ws.activationState != UISceneActivationStateForegroundActive) continue;
            key = ws.keyWindow;
            if (key) break;
        }
    }
    if (key == nil) return nil;
    UIViewController *vc = key.rootViewController;
    while (vc.presentedViewController) vc = vc.presentedViewController;
    return vc;
}

/// Open `url` in a Safari sheet over the app.
///
/// The address is validated here as well as in `search.rs` -- an
/// `SFSafariViewController` handed anything but http(s) raises, and a raise
/// across an FFI boundary is a crash with no sentence in it.
int frank_search_present(const char *url) {
    if (url == NULL) return 2;
    NSString *s = [NSString stringWithUTF8String:url];
    NSURL *u = s.length ? [NSURL URLWithString:s] : nil;
    NSString *scheme = u.scheme.lowercaseString;
    if (u == nil || !([scheme isEqualToString:@"https"] || [scheme isEqualToString:@"http"])) {
        NSLog(@"frank: search sheet refused a non-http address");
        return 2;
    }

    void (^show)(void) = ^{
        UIViewController *top = frank_search_top();
        if (top == nil) {
            NSLog(@"frank: search sheet -- no view controller on screen");
            return;
        }
        /* ONE SHEET, NEVER A STACK. Pressing Search twice replaces the sheet
           rather than putting a second one on top of the first, which is the
           same rule reader/lookup.js keeps for the Mac's 900x700 window. */
        SFSafariViewController *up = gOpen;
        if (up != nil) {
            [up dismissViewControllerAnimated:NO completion:nil];
            gOpen = nil;
        }
        SFSafariViewControllerConfiguration *cfg = [SFSafariViewControllerConfiguration new];
        cfg.entersReaderIfAvailable = NO;   /* a search results page is not an article */
        cfg.barCollapsingEnabled = YES;
        SFSafariViewController *vc = [[SFSafariViewController alloc] initWithURL:u
                                                                  configuration:cfg];
        vc.dismissButtonStyle = SFSafariViewControllerDismissButtonStyleDone;
        /* A page sheet, so the reader stays visible behind it and a downward
           drag puts it away -- the same gesture that closes every other sheet
           on the phone. */
        vc.modalPresentationStyle = UIModalPresentationPageSheet;
        if (gDelegate == nil) gDelegate = [FrankSearchSheet new];
        vc.delegate = gDelegate;
        gOpen = vc;
        [top presentViewController:vc animated:YES completion:nil];
    };

    if (NSThread.isMainThread) {
        /* The one code we can honestly return, returned before the dispatch. */
        if (frank_search_top() == nil) return 3;
    }
    dispatch_async(dispatch_get_main_queue(), show);
    return 0;
}
