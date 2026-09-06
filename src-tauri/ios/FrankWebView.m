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

    `out` is six doubles for the caller's log, because a fix like this is worth
    a number and not an adjective: the root's size, then the rectangle the
    webview had before. The rectangle it has after is (0, 0, out[0], out[1]) by
    construction.
      0 ok · 1 no pointer · 2 not a UIView · 3 no superview
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

    CGRect was = view.frame;
    CGRect fill = root.bounds;
    if (out != NULL) {
        out[0] = fill.size.width;
        out[1] = fill.size.height;
        out[2] = was.origin.x;
        out[3] = was.origin.y;
        out[4] = was.size.width;
        out[5] = was.size.height;
    }

    view.translatesAutoresizingMaskIntoConstraints = YES;
    view.frame = fill;
    view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;

    UIColor *paper = frank_paper();
    root.backgroundColor = paper;
    view.backgroundColor = paper;

    [root setNeedsLayout];
    return 0;
}
