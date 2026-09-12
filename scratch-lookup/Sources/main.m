/*  LookupProbe -- G-LOOKUP, 11 Sep 2026. THROWAWAY: nothing here is Frank.
    ---------------------------------------------------------------------
    Osca: "If we could USE the Apple float WITH our app, so just with one
    press, that WOULD work -- then we just add our dictionaries on top of
    that." This app answers, on a simulator and on the phone, four things:

      1. One press -> Apple's Look Up for a word with NOTHING selected:
         `UIReferenceLibraryViewController(term:)` presented over a WKWebView
         from a host command (`lookup_apple`), as a sheet, a half sheet and a
         popover. How long, what it is (class, presentation, view tree), how
         it goes away, what the page looks like after, what it does for Latin.
      2. (a) a "Frank" item beside Look Up in the text-selection menu, put
         there the only way a Tauri app could: `buildMenuWithBuilder:` added
         at RUNTIME to the webview's class (wry's `WryWebView` is a runtime
         subclass of WKWebView; so is `LPWryWebView` here), calling
         WKWebView's own first.
      3. (b) our entry INSIDE Apple's panel -- measured by walking Apple's
         view tree: what is in-process that anything could be added to.
      3. (c) ONE sheet with our entry on top and Apple's controller as a
         child below -- whether it embeds at all, and whether any of Apple's
         text is in our process (counted, never logged: Apple forbids
         republishing it, and this probe does not store it).
      4. The page's state across every sheet: the same document (load id),
         the same scroll, the selection, a tone's clock, rAF frames.

    THE EYE. Every line goes to NSLog, to the page's own log panel, and on a
    SIMULATOR to `<this folder>/probe.log` -- `__FILE__` is this file's
    absolute path at compile time, and a simulator process runs as the Mac
    user with the host's disk (the same trick as Frank's PROBE_FILE,
    lib.rs). A phone has no such disk: read the page's panel there.

    Objective-C, one file, no storyboard, no Info.plist file (Xcode generates
    one), no frameworks phase (-fmodules autolinks UIKit and WebKit) -- so
    the hand-written project file beside it has as little in it as possible.
*/
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <QuartzCore/QuartzCore.h>
#import <objc/runtime.h>
#include <sys/utsname.h>

#pragma mark - the log

static CFTimeInterval gT0 = 0;
static NSString *gLogPath = nil;
static __weak WKWebView *gWeb = nil;

static double ms_since(CFTimeInterval t) { return (CACurrentMediaTime() - t) * 1000.0; }

static void write_line(NSString *line) {
    NSLog(@"lookupprobe %@", line);
#if TARGET_OS_SIMULATOR
    if (gLogPath == nil) return;
    NSFileHandle *h = [NSFileHandle fileHandleForWritingAtPath:gLogPath];
    if (h == nil) {
        [[NSFileManager defaultManager] createFileAtPath:gLogPath contents:nil attributes:nil];
        h = [NSFileHandle fileHandleForWritingAtPath:gLogPath];
    }
    if (h != nil) {
        [h seekToEndOfFile];
        [h writeData:[[line stringByAppendingString:@"\n"] dataUsingEncoding:NSUTF8StringEncoding]];
        [h closeFile];
    }
#endif
}

static NSString *json_of(id obj) {
    NSData *d = [NSJSONSerialization dataWithJSONObject:obj options:0 error:nil];
    return d ? [[NSString alloc] initWithData:d encoding:NSUTF8StringEncoding] : @"null";
}

static void to_page(NSString *js) {
    void (^go)(void) = ^{
        WKWebView *w = gWeb;
        if (w) [w evaluateJavaScript:js completionHandler:nil];
    };
    if (NSThread.isMainThread) go(); else dispatch_async(dispatch_get_main_queue(), go);
}

/// A native line: the file, NSLog, and the page's panel.
static void plog(NSString *fmt, ...) NS_FORMAT_FUNCTION(1, 2);
static void plog(NSString *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    NSString *s = [[NSString alloc] initWithFormat:fmt arguments:ap];
    va_end(ap);
    NSString *line = [NSString stringWithFormat:@"%8.1f %@", ms_since(gT0), s];
    write_line(line);
    to_page([NSString stringWithFormat:@"window.probe && probe.nativeLine(%@[0])", json_of(@[line])]);
}

static void reply(NSString *rid, NSDictionary *obj) {
    if (rid.length == 0) return;
    to_page([NSString stringWithFormat:@"window.probe && probe.reply(%@[0], %@)", json_of(@[rid]), json_of(obj)]);
}

static void page_state(NSString *tag) {
    to_page([NSString stringWithFormat:@"window.probe && probe.state(%@[0])", json_of(@[tag])]);
}

#pragma mark - the screen

static UIWindow *gFallbackWindow = nil;

/// FrankSearch.m's `frank_search_top`, the same two passes.
static UIWindow *key_window(void) {
    for (int pass = 0; pass < 2; pass++) {
        for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
            if (![scene isKindOfClass:UIWindowScene.class]) continue;
            UIWindowScene *ws = (UIWindowScene *)scene;
            if (pass == 0 && ws.activationState != UISceneActivationStateForegroundActive) continue;
            for (UIWindow *w in ws.windows) if (w.isKeyWindow) return w;
        }
    }
    return gFallbackWindow;
}

static UIViewController *top_vc(void) {
    UIViewController *vc = key_window().rootViewController;
    while (vc.presentedViewController) vc = vc.presentedViewController;
    return vc;
}

/// A view tree as numbers. Text inside it is COUNTED, never logged.
typedef struct { int views, depth, texts, remote, webviews, scrolls; NSUInteger chars; } LPTree;

static void walk(UIView *v, int depth, LPTree *t, NSMutableDictionary<NSString *, NSNumber *> *hist,
                 NSMutableArray<NSString *> *buttons) {
    t->views++;
    if (depth > t->depth) t->depth = depth;
    NSString *cls = NSStringFromClass(v.class);
    hist[cls] = @(hist[cls].intValue + 1);
    if ([cls rangeOfString:@"Remote"].location != NSNotFound ||
        [cls rangeOfString:@"LayerHost"].location != NSNotFound ||
        [cls rangeOfString:@"Hosted"].location != NSNotFound) t->remote++;
    if ([v isKindOfClass:WKWebView.class]) t->webviews++;
    if ([v isKindOfClass:UIScrollView.class]) t->scrolls++;
    NSString *text = nil;
    if ([v isKindOfClass:UILabel.class]) text = ((UILabel *)v).text;
    else if ([v isKindOfClass:UITextView.class]) text = ((UITextView *)v).text;
    if (text.length) { t->texts++; t->chars += text.length; }
    if ([v isKindOfClass:UIButton.class]) {
        NSString *bt = [(UIButton *)v titleForState:UIControlStateNormal];
        if (bt.length && buttons.count < 8) [buttons addObject:bt];   /* chrome only: "Done", "Manage" */
    }
    for (UIView *s in v.subviews) walk(s, depth + 1, t, hist, buttons);
}

static NSString *describe_tree(UIView *root) {
    if (root == nil) return @"(no view)";
    LPTree t = {0};
    NSMutableDictionary *hist = [NSMutableDictionary new];
    NSMutableArray *buttons = [NSMutableArray new];
    walk(root, 0, &t, hist, buttons);
    NSArray *keys = [hist keysSortedByValueUsingComparator:^NSComparisonResult(NSNumber *a, NSNumber *b) {
        return [b compare:a];
    }];
    NSMutableArray *top = [NSMutableArray new];
    for (NSString *k in keys) {
        if (top.count >= 10) break;
        [top addObject:[NSString stringWithFormat:@"%@x%@", k, hist[k]]];
    }
    return [NSString stringWithFormat:
            @"views=%d depth=%d text-views=%d chars=%lu remote-hosts=%d wkwebviews=%d scrollviews=%d "
            @"buttons=[%@] classes=[%@]",
            t.views, t.depth, t.texts, (unsigned long)t.chars, t.remote, t.webviews, t.scrolls,
            [buttons componentsJoinedByString:@"|"], [top componentsJoinedByString:@" "]];
}

#pragma mark - our entry (a stand-in for Frank's Wiktionary pack)

static NSString *frank_entry(NSString *word) {
    static NSDictionary *d;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        d = @{
            @"tityre": @"Tityrus (voc. Tityre) -- a shepherd's name; Eclogue 1.",
            @"patulae": @"patulus, -a, -um -- spreading, broad.",
            @"recubans": @"recubo, -are -- to lie back, recline.",
            @"sub": @"sub (+abl.) -- under, beneath.",
            @"tegmine": @"tegmen, -inis n. -- cover, shelter, shade.",
            @"fagi": @"fagus, -i f. -- beech tree (gen. fagi).",
            @"fagus": @"fagus, -i f. -- beech tree.",
            @"silvestrem": @"silvestris, -e -- of the woods, woodland.",
            @"tenui": @"tenuis, -e -- thin, slender.",
            @"musam": @"Musa, -ae f. -- a Muse; song.",
            @"meditaris": @"meditor, -ari -- to practise, rehearse.",
            @"avena": @"avena, -ae f. -- oat; a shepherd's reed pipe.",
            @"shepherd": @"shepherd -- one who tends sheep.",
            @"beech": @"beech -- a tree of the genus Fagus.",
        };
    });
    NSString *e = d[word.lowercaseString];
    return e ?: @"(no entry in the probe's stand-in -- Frank's pack would answer here)";
}

#pragma mark - presentations

@interface LPPopDelegate : NSObject <UIPopoverPresentationControllerDelegate>
@end
@implementation LPPopDelegate
/* On an iPhone a popover adapts to a sheet unless the delegate says NONE. */
- (UIModalPresentationStyle)adaptivePresentationStyleForPresentationController:(UIPresentationController *)c
                                                               traitCollection:(UITraitCollection *)t {
    return UIModalPresentationNone;
}
@end
static LPPopDelegate *gPop = nil;

/// (c): OUR entry on top, Apple's controller as a CHILD below, in one sheet.
@interface LPCombo : UIViewController
@property (nonatomic, copy) NSString *term;
@property (nonatomic, strong) UIReferenceLibraryViewController *ref;
@end
@implementation LPCombo
- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = UIColor.systemBackgroundColor;
    UILabel *head = [UILabel new];
    head.numberOfLines = 0;
    head.font = [UIFont preferredFontForTextStyle:UIFontTextStyleHeadline];
    head.text = [NSString stringWithFormat:@"Frank · %@\n%@", self.term, frank_entry(self.term)];
    head.translatesAutoresizingMaskIntoConstraints = NO;
    UIView *slot = [UIView new];
    slot.translatesAutoresizingMaskIntoConstraints = NO;
    slot.clipsToBounds = YES;
    [self.view addSubview:head];
    [self.view addSubview:slot];
    UILayoutGuide *g = self.view.safeAreaLayoutGuide;
    [NSLayoutConstraint activateConstraints:@[
        [head.topAnchor constraintEqualToAnchor:g.topAnchor constant:18],
        [head.leadingAnchor constraintEqualToAnchor:g.leadingAnchor constant:18],
        [head.trailingAnchor constraintEqualToAnchor:g.trailingAnchor constant:-18],
        [slot.topAnchor constraintEqualToAnchor:head.bottomAnchor constant:12],
        [slot.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
        [slot.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
        [slot.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor],
    ]];
    [self addChildViewController:self.ref];
    self.ref.view.frame = slot.bounds;
    self.ref.view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [slot addSubview:self.ref.view];
    [self.ref didMoveToParentViewController:self];
}
- (void)viewDidAppear:(BOOL)animated {
    [super viewDidAppear:animated];
    plog(@"(c) child slot=%@ child view=%@ child's own tree: %@",
         NSStringFromCGRect(self.ref.view.superview.frame), NSStringFromCGRect(self.ref.view.frame),
         describe_tree(self.ref.view));
}
@end

/// (a)'s card: our entry, for the selection the "Frank" menu item was pressed on.
@interface LPCard : UIViewController
@property (nonatomic, copy) NSString *term;
@end
@implementation LPCard
- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = UIColor.systemBackgroundColor;
    UILabel *l = [UILabel new];
    l.numberOfLines = 0;
    l.font = [UIFont preferredFontForTextStyle:UIFontTextStyleBody];
    l.text = [NSString stringWithFormat:@"Frank · %@\n\n%@\n\n(our entry, from our data)", self.term,
              frank_entry(self.term)];
    l.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:l];
    UILayoutGuide *g = self.view.safeAreaLayoutGuide;
    [NSLayoutConstraint activateConstraints:@[
        [l.topAnchor constraintEqualToAnchor:g.topAnchor constant:24],
        [l.leadingAnchor constraintEqualToAnchor:g.leadingAnchor constant:20],
        [l.trailingAnchor constraintEqualToAnchor:g.trailingAnchor constant:-20],
    ]];
}
@end

static NSString *gPendingReply = nil;   /* the next UP takes it */
static void lookup_apple(NSString *term, NSString *mode, CGRect anchor, NSString *rid, double autoMs);

/// THE HOST COMMAND. `lookup_apple(term)` as Frank's lib.rs would call it:
/// FrankSearch.m's shape (top view controller, one sheet never a stack).
static void lookup_apple(NSString *term, NSString *mode, CGRect anchor, NSString *rid, double autoMs) {
    CFTimeInterval t0 = CACurrentMediaTime();
    UIViewController *root = key_window().rootViewController;
    if (root == nil) { plog(@"lookup_apple: nothing on screen to present from"); reply(rid, @{@"error": @3}); return; }
    if (root.presentedViewController != nil) {
        /* one sheet, never a stack -- the FrankSearch.m rule: the old one goes, then this one comes */
        plog(@"lookup_apple: a sheet is up (%@) -- replacing it", NSStringFromClass(root.presentedViewController.class));
        [root dismissViewControllerAnimated:NO completion:^{ lookup_apple(term, mode, anchor, rid, autoMs); }];
        return;
    }
    UIViewController *top = root;
    UIReferenceLibraryViewController *ref = [[UIReferenceLibraryViewController alloc] initWithTerm:term];
    double initMs = ms_since(t0);
    UIViewController *shown = ref;
    if ([mode isEqualToString:@"ours"]) {
        LPCombo *c = [LPCombo new];
        c.term = term;
        c.ref = ref;
        c.modalPresentationStyle = UIModalPresentationPageSheet;
        shown = c;
    } else if ([mode isEqualToString:@"half"]) {
        ref.modalPresentationStyle = UIModalPresentationPageSheet;
        UISheetPresentationController *sp = ref.sheetPresentationController;
        sp.detents = @[[UISheetPresentationControllerDetent mediumDetent],
                       [UISheetPresentationControllerDetent largeDetent]];
        sp.prefersGrabberVisible = YES;
    } else if ([mode isEqualToString:@"popover"]) {
        ref.modalPresentationStyle = UIModalPresentationPopover;
        ref.preferredContentSize = CGSizeMake(340, 420);
        UIPopoverPresentationController *pp = ref.popoverPresentationController;
        pp.sourceView = gWeb;
        pp.sourceRect = anchor;
        if (gPop == nil) gPop = [LPPopDelegate new];
        pp.delegate = gPop;
    } else {
        ref.modalPresentationStyle = UIModalPresentationPageSheet;
    }
    gPendingReply = rid;
    plog(@"lookup_apple(\"%@\") mode=%@ init=%.1fms anchor=%@", term, mode, initMs, NSStringFromCGRect(anchor));
    [top presentViewController:shown animated:YES completion:^{
        plog(@"lookup_apple(\"%@\") mode=%@ ON SCREEN (present completion) at %.1fms from the call",
             term, mode, ms_since(t0));
        if (autoMs > 0) {
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(autoMs * NSEC_PER_MSEC)),
                           dispatch_get_main_queue(), ^{
                CFTimeInterval d0 = CACurrentMediaTime();
                UIViewController *p = shown.presentingViewController;
                [p dismissViewControllerAnimated:YES completion:^{
                    plog(@"programmatic dismiss of %@ done in %.1fms", mode, ms_since(d0));
                }];
            });
        }
    }];
}

static void present_card(NSString *term, CFTimeInterval t0) {
    UIViewController *top = top_vc();
    LPCard *card = [LPCard new];
    card.term = term;
    card.modalPresentationStyle = UIModalPresentationPageSheet;
    UISheetPresentationController *sp = card.sheetPresentationController;
    sp.detents = @[[UISheetPresentationControllerDetent mediumDetent]];
    sp.prefersGrabberVisible = YES;
    [top presentViewController:card animated:YES completion:^{
        plog(@"(a) Frank card for \"%@\" on screen %.1fms after the menu press", term, ms_since(t0));
    }];
}

#pragma mark - (a): the "Frank" item beside Look Up, added at runtime

static Class gMenuClass = Nil;
static NSUInteger gBuilds = 0;
static NSString *const kFrankMenu = @"com.ttstv.frank.lookup-menu";

static NSString *elt_name(UIMenuElement *e, int depth) {
    if ([e isKindOfClass:UIMenu.class]) {
        UIMenu *m = (UIMenu *)e;
        NSString *name = [m.identifier stringByReplacingOccurrencesOfString:@"com.apple.menu." withString:@""];
        if (m.title.length) name = [NSString stringWithFormat:@"%@\"%@\"", name, m.title];
        if (depth >= 3) return [name stringByAppendingString:@"[…]"];
        NSMutableArray *kids = [NSMutableArray new];
        for (UIMenuElement *k in m.children) [kids addObject:elt_name(k, depth + 1)];
        return [NSString stringWithFormat:@"%@[%@]", name, [kids componentsJoinedByString:@", "]];
    }
    return e.title.length ? [NSString stringWithFormat:@"\"%@\"", e.title] : @"?";
}

static void frank_item_pressed(WKWebView *w) {
    CFTimeInterval t0 = CACurrentMediaTime();
    [w evaluateJavaScript:@"String(window.getSelection())" completionHandler:^(id r, NSError *e) {
        NSString *sel = [r isKindOfClass:NSString.class] ? r : @"";
        sel = [sel stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
        plog(@"(a) Frank pressed: selection %lu chars read back in %.1fms%@", (unsigned long)sel.length,
             ms_since(t0), e ? [NSString stringWithFormat:@" error=%@", e.localizedDescription] : @"");
        present_card(sel, t0);
    }];
}

static void lp_buildMenu(id self, SEL _cmd, id<UIMenuBuilder> builder) {
    IMP sup = class_getMethodImplementation(class_getSuperclass(gMenuClass), _cmd);
    ((void (*)(id, SEL, id))sup)(self, _cmd, builder);
    gBuilds++;
    BOOL context = (builder.system == UIMenuSystem.contextSystem);
    if (!context) { plog(@"(a) buildMenu #%lu system=main -- left alone", (unsigned long)gBuilds); return; }
    plog(@"(a) buildMenu #%lu system=context, as built by WebKit: %@", (unsigned long)gBuilds,
         elt_name([builder menuForIdentifier:UIMenuRoot], 0));
    if ([builder menuForIdentifier:kFrankMenu]) return;
    __weak WKWebView *weakSelf = (WKWebView *)self;
    UIAction *act = [UIAction actionWithTitle:@"Frank" image:nil identifier:nil
                                      handler:^(__kindof UIAction *a) { frank_item_pressed(weakSelf); }];
    UIMenu *m = [UIMenu menuWithTitle:@"" image:nil identifier:kFrankMenu
                              options:UIMenuOptionsDisplayInline children:@[act]];
    if ([builder menuForIdentifier:UIMenuLookup]) {
        [builder insertSiblingMenu:m afterMenuForIdentifier:UIMenuLookup];
        plog(@"(a) Frank inserted as a sibling AFTER com.apple.menu.lookup");
    } else {
        [builder insertChildMenu:m atEndOfMenuForIdentifier:UIMenuRoot];
        plog(@"(a) no lookup menu in this build -- Frank appended at the root's end");
    }
}

/// What Frank's FrankLookup.m would export: add the override to wry's class.
static int frank_lookup_menu_install(WKWebView *w) {
    Class c = object_getClass(w);
    SEL s = @selector(buildMenuWithBuilder:);
    BOOL added = class_addMethod(c, s, (IMP)lp_buildMenu, "v@:@");
    gMenuClass = c;
    plog(@"(a) menu install on %@ (super %@): %@", NSStringFromClass(c),
         NSStringFromClass(class_getSuperclass(c)), added ? @"added" : @"ALREADY HAD ONE -- not replaced");
    return added ? 0 : 1;
}

#pragma mark - watching what is on screen, whoever put it there

@interface UIViewController (LookupProbe)
- (void)lp_presentViewController:(UIViewController *)vc animated:(BOOL)a completion:(void (^)(void))c;
- (void)lp_dismissViewControllerAnimated:(BOOL)a completion:(void (^)(void))c;
@end

@implementation UIViewController (LookupProbe)
- (void)lp_presentViewController:(UIViewController *)vc animated:(BOOL)a completion:(void (^)(void))c {
    plog(@"present %@ over %@ (style asked %ld)", NSStringFromClass(vc.class), NSStringFromClass(self.class),
         (long)vc.modalPresentationStyle);
    [self lp_presentViewController:vc animated:a completion:c];
}
- (void)lp_dismissViewControllerAnimated:(BOOL)a completion:(void (^)(void))c {
    plog(@"dismiss asked of %@ (its presented: %@)", NSStringFromClass(self.class),
         NSStringFromClass(self.presentedViewController.class));
    [self lp_dismissViewControllerAnimated:a completion:c];
}
@end

static void lp_swizzle(void) {
    Class c = UIViewController.class;
    method_exchangeImplementations(class_getInstanceMethod(c, @selector(presentViewController:animated:completion:)),
                                   class_getInstanceMethod(c, @selector(lp_presentViewController:animated:completion:)));
    method_exchangeImplementations(class_getInstanceMethod(c, @selector(dismissViewControllerAnimated:completion:)),
                                   class_getInstanceMethod(c, @selector(lp_dismissViewControllerAnimated:completion:)));
}

static uintptr_t gUpPtr = 0;
static CFTimeInterval gUpAt = 0;
static NSString *gUpClass = nil;
static NSString *gUpReply = nil;   /* the reply owed when THIS sheet goes */

static void tick(void) {
    UIViewController *root = key_window().rootViewController;
    UIViewController *p = root.presentedViewController;
    uintptr_t ptr = (uintptr_t)(__bridge void *)p;
    if (ptr == gUpPtr) return;
    if (gUpPtr != 0) {
        plog(@"GONE %@ after %.0fms on screen", gUpClass, ms_since(gUpAt));
        page_state(@"after-dismiss");
        if (gUpReply) { reply(gUpReply, @{@"gone": @YES, @"onScreenMs": @(ms_since(gUpAt))}); gUpReply = nil; }
    }
    gUpPtr = ptr;
    if (p == nil) return;
    gUpReply = gPendingReply;
    gPendingReply = nil;
    gUpAt = CACurrentMediaTime();
    gUpClass = NSStringFromClass(p.class);
    plog(@"UP %@ via %@ frame=%@ screen=%@", gUpClass, NSStringFromClass(p.presentationController.class),
         NSStringFromCGRect(p.view.frame), NSStringFromCGRect(UIScreen.mainScreen.bounds));
    page_state(@"while-up");
    __weak UIViewController *wp = p;
    for (NSNumber *d in @[@800, @2500]) {
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(d.doubleValue * NSEC_PER_MSEC)),
                       dispatch_get_main_queue(), ^{
            UIViewController *s = wp;
            if (s) plog(@"tree of %@ at +%@ms: %@", NSStringFromClass(s.class), d, describe_tree(s.view));
        });
    }
}

#pragma mark - the web view and the bridge (Tauri's invoke, stood in for)

@interface LPViewController : UIViewController <WKScriptMessageHandler>
@end

@implementation LPViewController
- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = UIColor.systemBackgroundColor;
    WKWebViewConfiguration *cfg = [WKWebViewConfiguration new];
    cfg.allowsInlineMediaPlayback = YES;
    cfg.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;
    [cfg.userContentController addScriptMessageHandler:self name:@"frank"];
    /* wry's WryWebView is a subclass of WKWebView registered at run time; so is this. */
    Class wry = objc_getClass("LPWryWebView");
    if (wry == Nil) {
        wry = objc_allocateClassPair(WKWebView.class, "LPWryWebView", 0);
        objc_registerClassPair(wry);
    }
    WKWebView *w = [[wry alloc] initWithFrame:self.view.bounds configuration:cfg];
    w.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    if (@available(iOS 16.4, *)) { w.inspectable = YES; }
    [self.view addSubview:w];
    gWeb = w;
    frank_lookup_menu_install(w);
    NSURL *u = [NSBundle.mainBundle URLForResource:@"probe" withExtension:@"html"];
    [w loadFileURL:u allowingReadAccessToURL:u.URLByDeletingLastPathComponent];
}

- (void)userContentController:(WKUserContentController *)ucc didReceiveScriptMessage:(WKScriptMessage *)m {
    if (![m.body isKindOfClass:NSDictionary.class]) return;
    NSDictionary *d = m.body;
    NSString *cmd = d[@"cmd"], *rid = [NSString stringWithFormat:@"%@", d[@"id"]];
    NSDictionary *a = [d[@"args"] isKindOfClass:NSDictionary.class] ? d[@"args"] : @{};
    if ([cmd isEqualToString:@"log"]) {
        /* the page already shows its own line; file + NSLog only */
        write_line([NSString stringWithFormat:@"%8.1f page %@", ms_since(gT0), a[@"line"]]);
        return;
    }
    if ([cmd isEqualToString:@"env"]) {
        struct utsname u;
        uname(&u);
        NSDictionary *env = NSProcessInfo.processInfo.environment;
        reply(rid, @{
            @"ios": UIDevice.currentDevice.systemVersion,
            @"machine": [NSString stringWithUTF8String:u.machine],
            @"sim": env[@"SIMULATOR_DEVICE_NAME"] ?: @"(device)",
            @"langs": [NSLocale.preferredLanguages componentsJoinedByString:@","],
            @"locale": NSLocale.currentLocale.localeIdentifier,
        });
        return;
    }
    if ([cmd isEqualToString:@"has"]) {
        NSString *term = a[@"term"] ?: @"";
        CFTimeInterval t = CACurrentMediaTime();
        BOOL has = [UIReferenceLibraryViewController dictionaryHasDefinitionForTerm:term];
        double ms = ms_since(t);
        write_line([NSString stringWithFormat:@"%8.1f dictionaryHasDefinitionForTerm(\"%@\") = %@ in %.1fms",
                    ms_since(gT0), term, has ? @"YES" : @"NO", ms]);
        reply(rid, @{@"has": @(has), @"ms": @(ms)});
        return;
    }
    if ([cmd isEqualToString:@"lookup_apple"]) {
        CGRect r = CGRectMake([a[@"x"] doubleValue], [a[@"y"] doubleValue], [a[@"w"] doubleValue], [a[@"h"] doubleValue]);
        lookup_apple(a[@"term"] ?: @"", a[@"mode"] ?: @"sheet", r, rid, [a[@"autoDismissMs"] doubleValue]);
        return;
    }
    plog(@"unknown command %@", cmd);
}
@end

#pragma mark - the app

@interface LPAppDelegate : UIResponder <UIApplicationDelegate>
@property (strong, nonatomic) UIWindow *window;
@end

@implementation LPAppDelegate
- (BOOL)application:(UIApplication *)app didFinishLaunchingWithOptions:(NSDictionary *)opts {
    gT0 = CACurrentMediaTime();
    NSString *here = [NSString stringWithUTF8String:__FILE__];
    gLogPath = [[[here stringByDeletingLastPathComponent] stringByDeletingLastPathComponent]
                stringByAppendingPathComponent:@"probe.log"];
    lp_swizzle();
    self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
    self.window.rootViewController = [LPViewController new];
    [self.window makeKeyAndVisible];
    gFallbackWindow = self.window;
    plog(@"=== start %@ | iOS %@ | %@ | langs %@", [NSDate date], UIDevice.currentDevice.systemVersion,
         NSProcessInfo.processInfo.environment[@"SIMULATOR_DEVICE_NAME"] ?: UIDevice.currentDevice.model,
         [NSLocale.preferredLanguages componentsJoinedByString:@","]);
    [NSTimer scheduledTimerWithTimeInterval:0.05 repeats:YES block:^(NSTimer *t) { tick(); }];
    return YES;
}
@end

int main(int argc, char *argv[]) {
    @autoreleasepool {
        return UIApplicationMain(argc, argv, nil, NSStringFromClass(LPAppDelegate.class));
    }
}
