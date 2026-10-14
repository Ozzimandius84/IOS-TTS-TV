/*  FrankWebView.m -- the black bar, and why sixty points of the screen were
    not the app.
    ---------------------------------------------------------------------
    THE BUG. wry builds the WKWebView with the root view's FRAME:

        // wry-0.55.1/src/wkwebview/mod.rs, the `#[cfg(target_os = "ios")]` arm
        let frame = ns_view.frame();
        let webview = msg_send![super(webview), initWithFrame: frame, ...];
        ...
        ns_view.addSubview(&webview);

    Two faults in three lines, and they compound.

    (1) FRAME, NOT BOUNDS. `frame` is a view's rectangle in its SUPERVIEW's
        coordinate space; the webview is then added as a subview of that same
        view, where the rectangle is read in the ROOT's space instead. Any
        non-zero origin is therefore applied twice -- the webview starts N
        points down and still claims the full height, so its last N points hang
        off the bottom of the screen and N points of root view are left bare.
        `bounds` is the same rectangle in the view's OWN space, origin (0,0),
        which is what a subview that means "fill me" wants.

    (2) NO AUTORESIZING MASK, so the rectangle is whatever it was at the one
        instant the webview was made. UIKit lays the root view out again after
        that -- the launch screen goes, the status bar settles, the device
        rotates -- and the webview does not follow.

    Neither is fixable from CSS: `viewport-fit=cover` and `env(safe-area-inset-*)`
    describe the webview's own box, and this webview's box is the wrong size.
    The shell had both, correctly, and still drew short.

    THE THIRD LINE. The root view's background is black, so the strip that is
    not the webview reads as a hardware bezel rather than as a mistake. It is
    painted with the shell's own paper (`shell/library/library.css`'s `--bg`,
    both schemes) so that if a strip is ever exposed again -- a rotation UIKit
    beats us to, a keyboard, a future split view -- it looks like the page and
    not like a broken app.

    THE FOURTH LINE, AND THE ONE THAT WAS THE BAR ALL ALONG (the webview
    frame, 6 Sep). The fill above was right and filled the wrong box. tao
    builds the UIWindow -- and so the root view -- from the window builder's
    `inner_size` when one is given (`tao-0.35.3/src/platform_impl/ios/
    window.rs`: `Some(dim) => CGRect { origin: screen_bounds.origin, size:
    dim }`), so the desktop's 1100x800 was the PHONE's window, the root was
    1100x800, and the webview filled 1100 of 393 points: a 560 px card
    centred at x~262 and a band under the page where no window was. lib.rs no
    longer passes a size on iOS; this file ALSO puts the window back on the
    screen (`window.frame = screen.bounds`, root = window.bounds) so a size
    that sneaks back in is corrected rather than obeyed, and the log says by
    how much.

    `out` is eight doubles for the caller's log, because a fix like this is
    worth a number and not an adjective: the root's size after, the rectangle
    the webview had before, the size the WINDOW had before. The rectangle the
    webview has after is (0, 0, out[0], out[1]) by construction.
      0 ok · 1 no pointer · 2 not a UIView · 3 no superview · 4 no window
*/
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

/// The shell's `--bg`, both schemes: #fcfcfb light, #131316 dark. Dynamic
/// rather than one colour because Frank follows the system and a light strip
/// under a dark page is the same mistake the other way round.
static UIColor *frank_paper(void) {
    return [UIColor colorWithDynamicProvider:^UIColor *(UITraitCollection *tc) {
        return tc.userInterfaceStyle == UIUserInterfaceStyleDark
            ? [UIColor colorWithRed:0.0745 green:0.0745 blue:0.0863 alpha:1.0]
            : [UIColor colorWithRed:0.9882 green:0.9882 blue:0.9843 alpha:1.0];
    }];
}

/// Make the WKWebView fill the view it was added to, and keep filling it.
/// Called once, from `lib.rs`, inside `with_webview` -- which is to say on the
/// UI thread, which every line below requires.
int frank_webview_fill(void *webview, double *out) {
    if (webview == NULL) {
        return 1;
    }
    UIView *view = (__bridge UIView *)webview;
    if (![view isKindOfClass:[UIView class]]) {
        return 2;
    }
    UIView *root = view.superview;
    if (root == nil) {
        return 3;
    }
    UIWindow *window = view.window;
    if (window == nil) {
        return 4;
    }

    CGRect was = view.frame;
    CGRect windowWas = window.frame;

    /* The window first: tao sized it from `inner_size`, and every view under
       it takes its size from the window. The screen the window is on, not
       `mainScreen`, so an external display or a future split does not put the
       phone's rectangle on the wrong glass. */
    UIScreen *screen = window.screen ?: [UIScreen mainScreen];
    CGRect screenBounds = screen.bounds;
    if (!CGRectEqualToRect(windowWas, screenBounds)) {
        window.frame = screenBounds;
    }
    /* Then the view controller's view, which is `root` when the controller's
       own view is the root; when it is not (a wrapper tao adds one day),
       the controller's view is the one UIKit lays out against the window,
       so size that too. Both are the window's bounds in the window's space. */
    UIView *top = window.rootViewController.view ?: root;
    if (top != nil && !CGRectEqualToRect(top.frame, window.bounds)) {
        top.frame = window.bounds;
        top.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    }
    if (root != top && !CGRectEqualToRect(root.frame, top.bounds)) {
        root.frame = top.bounds;
        root.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    }

    CGRect fill = root.bounds;
    if (out != NULL) {
        out[0] = fill.size.width;
        out[1] = fill.size.height;
        out[2] = was.origin.x;
        out[3] = was.origin.y;
        out[4] = was.size.width;
        out[5] = was.size.height;
        out[6] = windowWas.size.width;
        out[7] = windowWas.size.height;
    }

    view.translatesAutoresizingMaskIntoConstraints = YES;
    view.frame = fill;
    view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;

    UIColor *paper = frank_paper();
    window.backgroundColor = paper;
    if (top != nil) { top.backgroundColor = paper; }
    root.backgroundColor = paper;
    view.backgroundColor = paper;

    [root setNeedsLayout];
    return 0;
}

/*  THE GREY BAR OVER THE KEYBOARD (P2, Osca's iPhone list, 14 Oct 2026:
    "I'd prefer, in surface, for it not exist at all, so ONLY our pill, the
    search bar, as in safari").

    When a field in the page takes focus, WebKit gives the keyboard an input
    accessory view: the grey ^ v (done) form-assistant strip. It is the
    `inputAccessoryView` of WKWebView's private content view (class
    `WKContentView`, a subview of the webview's scroll view), and WebKit
    offers no public switch for it. The well-worn fix is to make that getter
    answer nil. It is done on the CLASS, once, so it is app-wide (Safari's
    address field has no such strip either) and it holds for every field the
    webview ever focuses, the content views it makes later included.

    The class is found two ways: by name, and by walking the given webview's
    subviews for any class whose name STARTS with "WKContentView" (a WebKit
    that renames or subclasses it keeps working). Every class found gets the
    nil getter; a class that is not found is simply not touched.

    Returns how many classes were patched (0 means nothing was found -- the
    bar will still show and the log says so), or -1 for no pointer.
*/
static id frank_no_accessory(id self_, SEL cmd) {
    (void)self_; (void)cmd;
    return nil;
}

static int frank_patch_class(Class c) {
    if (c == Nil) { return 0; }
    SEL sel = @selector(inputAccessoryView);
    /* class_replaceMethod ADDS the method when the class does not define it
       itself and REPLACES it when it does -- either way this class answers
       nil and its superclass (UIView) is left alone. */
    class_replaceMethod(c, sel, (IMP)frank_no_accessory, "@@:");
    return 1;
}

static void frank_find_content_views(UIView *v, NSMutableSet *out, int depth) {
    if (v == nil || depth > 4) { return; }
    if ([NSStringFromClass([v class]) hasPrefix:@"WKContentView"]) {
        [out addObject:[v class]];
    }
    for (UIView *sub in v.subviews) {
        frank_find_content_views(sub, out, depth + 1);
    }
}

int frank_webview_no_accessory(void *webview) {
    if (webview == NULL) {
        return -1;
    }
    NSMutableSet *classes = [NSMutableSet set];
    Class named = NSClassFromString(@"WKContentView");
    if (named != Nil) { [classes addObject:named]; }
    UIView *view = (__bridge UIView *)webview;
    if ([view isKindOfClass:[UIView class]]) {
        frank_find_content_views(view, classes, 0);
    }
    int patched = 0;
    for (id c in classes) {
        patched += frank_patch_class((Class)c);
    }
    /* A field already focused keeps the bar it was given until the keyboard
       asks again; reloadInputViews on the content view makes it ask now. */
    if ([view isKindOfClass:[UIView class]]) {
        NSMutableArray *stack = [NSMutableArray arrayWithObject:view];
        while (stack.count) {
            UIView *v = stack.lastObject; [stack removeLastObject];
            if ([NSStringFromClass([v class]) hasPrefix:@"WKContentView"] && v.isFirstResponder) {
                [v reloadInputViews];
            }
            [stack addObjectsFromArray:v.subviews];
        }
    }
    return patched;
}
