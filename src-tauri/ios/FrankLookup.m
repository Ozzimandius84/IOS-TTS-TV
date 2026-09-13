/*  FrankLookup.m -- Apple's own Look Up panel, over the reader, for one word.
    ---------------------------------------------------------------------
    `UIReferenceLibraryViewController` is the whole of iOS's dictionary API that
    a third-party app may touch, and what it gives back is a PICTURE: the panel
    is drawn by another process (measured twice -- 0 of our text views, 2 remote
    scene hosts in our view tree), so there is no way to read it, cache it,
    re-draw it or speak it, and Apple's terms forbid all four anyway. Presenting
    it for the word the reader asked about is inside the letter of those terms.
    Nothing crosses back over this boundary but an int.

    WHY THERE IS NO `dictionaryHasDefinitionForTerm:` IN THIS FILE. It is the
    other half of the class and it is deliberately absent. G-LOOKUP-2 measured
    it at 31-95 ms a call over 23,837 calls -- p95 129 ms, worst 353 ms, no
    cache to warm, no useful parallelism (four queues, x1.1) -- which is 23
    seconds for a median chapter and 112 for a long one. The control that opens
    this panel is decided ONCE PER BOOK from the book's language instead, in
    `lookup.rs::offered`, at a cost of zero calls. A symbol that exists is a
    symbol somebody calls in a loop, so it does not exist.

    WHY OBJECTIVE-C AND NOT SWIFT -- `FrankAudio.m`'s answer and `FrankSearch.m`'s
    answer, for the same reason: the caller is Rust, a `.m` file exports plain C
    symbols an `extern "C"` block links against, and a Swift function would need
    `@_cdecl` plus a bridging header for nothing.

    WHERE THIS FILE IS COMPILED. `build.rs`, by the `cc` crate, into its OWN
    archive (`franklookup`) beside `frankaudio`, `frankwebview`, `franksearch`
    and `frankinbox` -- the house pattern, and `build.rs`'s own note says why an
    archive per file rather than a second `.file()` on one build. It is
    therefore deliberately ABSENT from the Xcode target's `sources`: two
    compilations of one file is `duplicate symbol _frank_lookup_present` twenty
    minutes into a phone build, which is how `FrankAudio.m` learned it at 14:24
    on 6 September. No framework beyond Foundation and UIKit, both of which
    `gen/apple/project.yml` already names.

    A HALF SHEET, AND THAT IS A DECISION (K-L2, 13 Sep). Full sheet, half sheet
    and popover were all measured at 535-620 ms warm, so the choice cost nothing
    and was made on what the reader sees: at the medium detent the one-word view
    stays visible above the panel, which is what "two clean states, side by
    side" has to look like. Dragging up gives the large detent; the grabber says
    so. `UISheetPresentationController` is iOS 15, and 15 is this app's
    deployment target since job 8b.

    THREADING. `FrankSearch.m`'s rule, and its reason: the presentation is
    dispatched to the main queue, so `0` means *handed over*, not *on screen*.
    The one failure worth a code -- nothing to present from -- is still checked
    before the dispatch when the call already arrives on the main thread.

    Return values are ints because they cross an FFI boundary; `lookup.rs`
    turns them into the sentence that goes in the log.
      0 ok · 2 no word · 3 nothing on screen to present from
    (1 and 4 are `lookup.rs`'s own and never come from here.)
*/
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

/// The view controller a panel can be presented from: the key window of the
/// foreground scene, walked down through whatever is already presented.
/// `FrankSearch.m::frank_search_top`'s shape and its reasons -- `keyWindow` on
/// `UIApplication` is deprecated and lies in a multi-scene app, and the second
/// pass exists because a scene can be `foregroundInactive` for the moment a
/// press arrives in.
static UIViewController *frank_lookup_top(void) {
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

/// One panel, never a stack: a second press replaces the first rather than
/// putting another sheet on top of it -- `FrankSearch.m`'s rule, and the same
/// rule `reader/lookup.js` keeps for its own card.
static __weak UIReferenceLibraryViewController *gOpen = nil;

/// Open Apple's Look Up panel for `term`, as a half sheet over the app.
int frank_lookup_present(const char *term) {
    if (term == NULL) return 2;
    NSString *word = [NSString stringWithUTF8String:term];
    word = [word stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    if (word.length == 0) return 2;

    void (^show)(void) = ^{
        UIViewController *top = frank_lookup_top();
        if (top == nil) {
            NSLog(@"frank: apple panel -- no view controller on screen");
            return;
        }
        UIReferenceLibraryViewController *up = gOpen;
        if (up != nil) {
            [up dismissViewControllerAnimated:NO completion:nil];
            gOpen = nil;
        }
        /* `initWithTerm:` takes ANY string -- a phrase, a Greek word, nonsense --
           and presents in 535-620 ms warm. A term with no entry opens a panel
           saying "No Content Found", which is why the control that reaches this
           call does not exist for a language iOS has no dictionary for. */
        UIReferenceLibraryViewController *vc =
            [[UIReferenceLibraryViewController alloc] initWithTerm:word];
        vc.modalPresentationStyle = UIModalPresentationPageSheet;
        if (@available(iOS 15.0, *)) {
            UISheetPresentationController *sheet = vc.sheetPresentationController;
            if (sheet != nil) {
                /* THE HALF SHEET (K-L2). Medium first so the word stays on
                   screen above it; large is one drag away, because a long
                   entry that cannot be opened up is a worse answer than a
                   panel that covers the word on purpose. */
                sheet.detents = @[ UISheetPresentationControllerDetent.mediumDetent,
                                   UISheetPresentationControllerDetent.largeDetent ];
                sheet.prefersGrabberVisible = YES;
                sheet.prefersScrollingExpandsWhenScrolledToEdge = NO;
            }
        }
        gOpen = vc;
        [top presentViewController:vc animated:YES completion:nil];
    };

    if (NSThread.isMainThread) {
        /* The one code we can honestly return, returned before the dispatch. */
        if (frank_lookup_top() == nil) return 3;
    }
    dispatch_async(dispatch_get_main_queue(), show);
    return 0;
}
