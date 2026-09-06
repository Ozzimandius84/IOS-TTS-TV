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
