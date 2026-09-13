/*  scratch-speech -- Q-D4 and Q-D5, asked of a real phone.
    =====================================================================
    Throwaway (13 Sep, D1(b)). Nothing here is Frank: one Objective-C file,
    one hand-written Xcode project, no xcodegen, no Rust, no script phase,
    and nothing in `src-tauri/` or `shell/` is touched or read.

    THE TWO QUESTIONS, from `PROMPTS/plan-12-sep-cd.md` D6:

      Q-D4  Does AVSpeechSynthesizer's SSML support actually honour
            <phoneme> and <lang> on the SHIPPED voices, or silently ignore
            them?  *"It decides whether the whole D6 thesis holds."*
      Q-D5  Do the word-boundary callbacks still fire when the utterance is
            SSML rather than plain text?  *"If not, highlighting and the good
            script are in tension."*

    WHY A PROBE AND NOT A TEST. Neither question has an answer that a
    container without a speaker can produce. Q-D5 is countable -- boundaries
    are numbers -- but only a phone fires them; Q-D4 is half countable (did
    Apple's parser accept the document, and what did it keep) and half an EAR,
    because a synthesiser that PARSES a <phoneme> and then ignores it looks
    identical from the outside. So this prints every number it can and makes
    the audible half impossible to mishear:

    ★ THE OVERRIDE IS ABSURD ON PURPOSE. Press 3 says "fagus" three times --
    plain, with a scholarly IPA override, and with an IPA override that makes
    it come out as something entirely different. If the third one sounds like
    the first, <phoneme> is being ignored and no amount of parsing says
    otherwise. That is the whole trick of this file.

    WHAT COMES BACK, and where. Every line goes to the panel on screen and,
    on the simulator only, to `scratch-speech/probe.log` beside this file
    (`__FILE__` names the folder; a simulator process writes the Mac's disk).
    On a real phone there is no log file: press and hold in the panel, Select
    All, Copy, paste into the chat.

    WHAT THIS PROBE DELIBERATELY DOES NOT DO: it does not import anything of
    Frank's, so a wrong answer here costs nothing and cannot break a build.
*/
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>

/* ------------------------------------------------------------- the material

   ONE LATIN LINE, and it is the one on the shelf: Eclogue I opens the corpus
   this app was built for, so if <lang> is going to matter anywhere it matters
   here. Long vowels are what an English voice destroys.  */
static NSString *const LATIN =
    @"Tityre, tu patulae recubans sub tegmine fagi silvestrem tenui musam meditaris avena.";

/* The same line inside an English sentence, which is the ACTUAL product case
   (D6: "a Latin quotation in an English paper spoken as Latin, not mangled as
   English"). A control in French sits beside it, because French is a language
   Apple certainly ships a voice for and Latin certainly is not -- so the two
   together separate "SSML ignored" from "no voice for that language". */
static NSString *const MIXED_EN = @"The poet begins: Tityre, tu patulae recubans sub tegmine fagi.";
static NSString *const MIXED_FR = @"The report concluded, and I quote, que tout va tres bien madame.";

/* Sixty words exactly, for the rate measurement. Ordinary prose, no numerals,
   no abbreviations -- a rate measured on a sentence full of "Dr." would be
   measuring the expansion and not the speed. */
static NSString *const SIXTY =
    @"The river held the light of the evening for a long while after the sun had gone, "
     "and the trees along the far bank stood black against it. A boat went down with "
     "the current and nobody in it spoke. Later the mist came up off the water and the "
     "far bank went away altogether, and there was only the sound of the river moving.";

/* --------------------------------------------------------------- the panel */

static UITextView *gLog = nil;
static NSMutableString *gAll = nil;

static void P(NSString *fmt, ...) {
    va_list a; va_start(a, fmt);
    NSString *line = [[NSString alloc] initWithFormat:fmt arguments:a];
    va_end(a);
    NSLog(@"probe: %@", line);
    dispatch_async(dispatch_get_main_queue(), ^{
        if (gAll == nil) gAll = [NSMutableString string];
        [gAll insertString:[line stringByAppendingString:@"\n"] atIndex:0];   /* newest first */
        gLog.text = gAll;
        /* the simulator writes the Mac's disk; the phone silently does not */
        NSString *here = [@(__FILE__) stringByDeletingLastPathComponent];
        NSString *out = [[here stringByDeletingLastPathComponent]
                             stringByAppendingPathComponent:@"probe.log"];
        [gAll writeToFile:out atomically:YES encoding:NSUTF8StringEncoding error:nil];
    });
}

static NSString *QualityWord(AVSpeechSynthesisVoice *v) {
    if (@available(iOS 16.0, *)) {
        if (v.quality == AVSpeechSynthesisVoiceQualityPremium) return @"PREMIUM";
    }
    if (v.quality == AVSpeechSynthesisVoiceQualityEnhanced) return @"ENHANCED";
    return @"default";
}

/*  ★ NAME THE VOICE ON EVERY ANSWER. `plan-12-sep-cd.md` D2: the enhanced and
    premium voices are downloads most people never turn on, and *"the default
    is not representative"* -- so an answer to Q-D4 that does not say which
    voice gave it is not an answer. Every press prints this first.  */
static NSString *Describe(AVSpeechSynthesisVoice *v) {
    if (v == nil) return @"(no voice)";
    return [NSString stringWithFormat:@"%@ [%@] %@ %@", v.name, v.language,
                     QualityWord(v), v.identifier];
}

/* Best installed voice for a language: premium, then enhanced, then whatever. */
static AVSpeechSynthesisVoice *Best(NSString *lang) {
    AVSpeechSynthesisVoice *best = nil; int bestRank = -1;
    NSString *want = [lang.lowercaseString componentsSeparatedByString:@"-"].firstObject;
    for (AVSpeechSynthesisVoice *v in AVSpeechSynthesisVoice.speechVoices) {
        NSString *have = [v.language.lowercaseString componentsSeparatedByString:@"-"].firstObject;
        if (![have isEqualToString:want]) continue;
        int rank = 1;
        if ([QualityWord(v) isEqualToString:@"ENHANCED"]) rank = 2;
        if ([QualityWord(v) isEqualToString:@"PREMIUM"]) rank = 3;
        if (rank > bestRank) { bestRank = rank; best = v; }
    }
    return best;
}

/* ---------------------------------------------------- the counting delegate

   ONE OBJECT COUNTS EVERYTHING. A run is: give it a label and an utterance,
   it speaks it, counts the boundaries, records the wall clock, and prints one
   line when the utterance ends. Runs are queued one at a time so two answers
   cannot overlap in the ear or in the log. */

@interface Counter : NSObject <AVSpeechSynthesizerDelegate>
@property (nonatomic, strong) AVSpeechSynthesizer *synth;
@property (nonatomic, strong) NSMutableArray *pending;      /* [label, utterance] pairs */
@property (nonatomic, strong) NSString *label;
@property (nonatomic, strong) NSString *spoken;             /* utterance.speechString */
@property (nonatomic, strong) NSMutableArray<NSString *> *ranges;
@property (nonatomic, assign) NSInteger boundaries;
@property (nonatomic, assign) NSTimeInterval t0;
@property (nonatomic, assign) NSInteger words;
@end

@implementation Counter

- (instancetype)init {
    if ((self = [super init])) {
        _synth = [[AVSpeechSynthesizer alloc] init];
        _synth.delegate = self;
        _pending = [NSMutableArray array];
        _ranges = [NSMutableArray array];
    }
    return self;
}

- (void)queue:(NSString *)label utterance:(AVSpeechUtterance *)u {
    if (u == nil) {
        /* Q-D4's SILENT failure, made loud: Apple returns nil for SSML it will
           not parse -- no exception, no reason. A probe that fell back to
           plain text here would answer "yes, SSML works" for a phone that had
           refused the document. */
        P(@"%@ -- REFUSED: speechUtteranceWithSSMLRepresentation returned nil", label);
        return;
    }
    [self.pending addObject:@[label, u]];
    if (!self.synth.isSpeaking) [self next];
}

- (void)next {
    if (self.pending.count == 0) { P(@"---- done ----"); return; }
    NSArray *pair = self.pending.firstObject;
    [self.pending removeObjectAtIndex:0];
    self.label = pair[0];
    AVSpeechUtterance *u = pair[1];
    self.spoken = u.speechString ?: @"";
    self.boundaries = 0;
    [self.ranges removeAllObjects];
    self.words = [[self.spoken componentsSeparatedByCharactersInSet:
                       NSCharacterSet.whitespaceAndNewlineCharacterSet]
                      filteredArrayUsingPredicate:
                          [NSPredicate predicateWithFormat:@"length > 0"]].count;
    self.t0 = CACurrentMediaTime();
    /* THE STRING APPLE KEPT. For a plain utterance this is what went in; for
       an SSML one it is the text with the tags removed -- which is both the
       proof the document parsed and the string every boundary indexes into. */
    P(@"%@ | voice %@", self.label, Describe(u.voice));
    P(@"%@ | rate %.3f  speechString(%lu w, %lu ch): %@", self.label, u.rate,
      (unsigned long)self.words, (unsigned long)self.spoken.length, self.spoken);
    [self.synth speakUtterance:u];
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)s
     willSpeakRangeOfSpeechString:(NSRange)r utterance:(AVSpeechUtterance *)u {
    self.boundaries++;
    if (self.ranges.count < 12) {
        NSString *piece = NSMaxRange(r) <= self.spoken.length
            ? [self.spoken substringWithRange:r] : @"<OUT OF RANGE>";
        [self.ranges addObject:[NSString stringWithFormat:@"%lu+%lu=%@",
                                (unsigned long)r.location, (unsigned long)r.length, piece]];
    }
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)s
 didFinishSpeechUtterance:(AVSpeechUtterance *)u {
    NSTimeInterval dt = CACurrentMediaTime() - self.t0;
    /* ★ Q-D5, AS A NUMBER: boundaries against words. One each is the answer
       the highlight needs; zero is the answer that puts highlighting and the
       good script in tension, and anything between is the interesting case. */
    P(@"%@ | BOUNDARIES %ld for %ld words (%.2f per word) in %.2f s = %.0f wpm",
      self.label, (long)self.boundaries, (long)self.words,
      self.words ? (double)self.boundaries / (double)self.words : 0.0,
      dt, dt > 0 ? (self.words / dt) * 60.0 : 0.0);
    P(@"%@ | first ranges: %@", self.label, [self.ranges componentsJoinedByString:@"  "]);
    [self next];
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)s
 didCancelSpeechUtterance:(AVSpeechUtterance *)u {
    P(@"%@ | CANCELLED after %ld boundaries", self.label, (long)self.boundaries);
    [self next];
}

@end

/* ------------------------------------------------------------- the utterances */

static AVSpeechUtterance *Plain(NSString *text, NSString *lang, float rate) {
    AVSpeechUtterance *u = [AVSpeechUtterance speechUtteranceWithString:text];
    AVSpeechSynthesisVoice *v = Best(lang);
    if (v) u.voice = v;
    u.rate = rate;
    return u;
}

static AVSpeechUtterance *Ssml(NSString *doc, NSString *lang, float rate) {
    AVSpeechUtterance *u = nil;
    if (@available(iOS 16.0, *)) {
        u = [AVSpeechUtterance speechUtteranceWithSSMLRepresentation:doc];
    }
    if (u == nil) return nil;
    AVSpeechSynthesisVoice *v = Best(lang);
    if (v) u.voice = v;
    u.rate = rate;
    return u;
}

/* -------------------------------------------------------------------- the app */

@interface Probe : UIViewController
@property (nonatomic, strong) Counter *c;
@end

@implementation Probe

- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = UIColor.systemBackgroundColor;
    self.c = [[Counter alloc] init];

    /* Playback/spokenAudio, exactly as `src-tauri/ios/FrankAudio.m` sets it,
       so press 6's lock-screen answer is about the SYNTHESISER and not about
       a probe that forgot the session. */
    NSError *err = nil;
    [AVAudioSession.sharedInstance setCategory:AVAudioSessionCategoryPlayback
                                          mode:AVAudioSessionModeSpokenAudio
                                       options:0 error:&err];
    [AVAudioSession.sharedInstance setActive:YES error:&err];

    NSArray<NSString *> *titles = @[@"1 · voices", @"2 · <lang>", @"3 · <phoneme>",
                                    @"4 · boundaries", @"5 · rate", @"6 · lock screen"];
    UIStackView *rowA = [[UIStackView alloc] init];
    UIStackView *rowB = [[UIStackView alloc] init];
    for (UIStackView *r in @[rowA, rowB]) {
        r.axis = UILayoutConstraintAxisHorizontal;
        r.distribution = UIStackViewDistributionFillEqually;
        r.spacing = 6;
        r.translatesAutoresizingMaskIntoConstraints = NO;
    }
    for (NSUInteger i = 0; i < titles.count; i++) {
        UIButton *b = [UIButton buttonWithType:UIButtonTypeSystem];
        [b setTitle:titles[i] forState:UIControlStateNormal];
        b.titleLabel.font = [UIFont systemFontOfSize:13 weight:UIFontWeightSemibold];
        b.tag = (NSInteger)i + 1;
        b.backgroundColor = UIColor.secondarySystemBackgroundColor;
        b.layer.cornerRadius = 8;
        [b addTarget:self action:@selector(press:) forControlEvents:UIControlEventTouchUpInside];
        [(i < 3 ? rowA : rowB) addArrangedSubview:b];
    }
    UIButton *stop = [UIButton buttonWithType:UIButtonTypeSystem];
    [stop setTitle:@"stop" forState:UIControlStateNormal];
    stop.tag = 99;
    [stop addTarget:self action:@selector(press:) forControlEvents:UIControlEventTouchUpInside];
    stop.translatesAutoresizingMaskIntoConstraints = NO;

    gLog = [[UITextView alloc] init];
    gLog.editable = NO;
    gLog.font = [UIFont monospacedSystemFontOfSize:10 weight:UIFontWeightRegular];
    gLog.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:rowA];
    [self.view addSubview:rowB];
    [self.view addSubview:stop];
    [self.view addSubview:gLog];
    UILayoutGuide *g = self.view.safeAreaLayoutGuide;
    [NSLayoutConstraint activateConstraints:@[
        [rowA.topAnchor constraintEqualToAnchor:g.topAnchor constant:8],
        [rowA.leadingAnchor constraintEqualToAnchor:g.leadingAnchor constant:8],
        [rowA.trailingAnchor constraintEqualToAnchor:g.trailingAnchor constant:-8],
        [rowA.heightAnchor constraintEqualToConstant:38],
        [rowB.topAnchor constraintEqualToAnchor:rowA.bottomAnchor constant:6],
        [rowB.leadingAnchor constraintEqualToAnchor:rowA.leadingAnchor],
        [rowB.trailingAnchor constraintEqualToAnchor:rowA.trailingAnchor],
        [rowB.heightAnchor constraintEqualToConstant:38],
        [stop.topAnchor constraintEqualToAnchor:rowB.bottomAnchor constant:4],
        [stop.centerXAnchor constraintEqualToAnchor:g.centerXAnchor],
        [gLog.topAnchor constraintEqualToAnchor:stop.bottomAnchor constant:4],
        [gLog.leadingAnchor constraintEqualToAnchor:g.leadingAnchor constant:6],
        [gLog.trailingAnchor constraintEqualToAnchor:g.trailingAnchor constant:-6],
        [gLog.bottomAnchor constraintEqualToAnchor:g.bottomAnchor],
    ]];

    P(@"scratch-speech -- iOS %@, %lu voices installed",
      UIDevice.currentDevice.systemVersion,
      (unsigned long)AVSpeechSynthesisVoice.speechVoices.count);
    if (@available(iOS 16.0, *)) { P(@"SSML: available (iOS 16+)"); }
    else { P(@"SSML: NOT AVAILABLE -- this phone is older than iOS 16. Q-D4 is unanswerable here."); }
}

- (void)press:(UIButton *)b {
    switch (b.tag) {

    /* 1 -- WHICH VOICES THIS PHONE HAS, because every other answer depends on
       it and no test can know it. `plan-12-sep-cd.md` D2: download two
       enhanced voices before judging the system voice at all. */
    case 1: {
        P(@"---- 1 · the voices on THIS phone ----");
        NSInteger prem = 0, enh = 0;
        for (AVSpeechSynthesisVoice *v in AVSpeechSynthesisVoice.speechVoices) {
            NSString *q = QualityWord(v);
            if ([q isEqualToString:@"PREMIUM"]) prem++;
            if ([q isEqualToString:@"ENHANCED"]) enh++;
            if (![q isEqualToString:@"default"]) P(@"  %@", Describe(v));
        }
        P(@"  %ld premium, %ld enhanced, %lu total (defaults not listed)",
          (long)prem, (long)enh, (unsigned long)AVSpeechSynthesisVoice.speechVoices.count);
        for (NSString *l in @[@"en-GB", @"en-US", @"fr-FR", @"it-IT", @"el-GR", @"la"]) {
            P(@"  best for %@: %@", l, Describe(Best(l)));
        }
        break;
    }

    /* 2 -- Q-D4, HALF ONE: <lang>.
       Four readings of the same material, and the comparison IS the answer:
         (a) the Latin line, plain, in the English voice     -- the mangling
         (b) the Latin line inside <lang xml:lang="la">      -- the product's wish
         (c) the same inside <lang xml:lang="it-IT">         -- the fallback that could work
         (d) an English sentence with a French clause in <lang xml:lang="fr-FR">
       (d) is the CONTROL: French is a language Apple certainly ships a voice
       for and Latin certainly is not, so (b) sounding like (a) while (d) does
       not means "no Latin voice", and (b) AND (d) both sounding unchanged
       means "<lang> is ignored". Those are different answers and the plan
       needs to know which. */
    case 2: {
        P(@"---- 2 · Q-D4a, <lang>: listen to a, b, c, d in order ----");
        [self.c queue:@"2a la-plain-in-en" utterance:Plain(LATIN, @"en-GB", 0.5)];
        [self.c queue:@"2b <lang la>" utterance:Ssml(
            @"<speak>The poet begins. <lang xml:lang=\"la\">Tityre, tu patulae recubans sub "
             "tegmine fagi.</lang></speak>", @"en-GB", 0.5)];
        [self.c queue:@"2c <lang it-IT>" utterance:Ssml(
            @"<speak>The poet begins. <lang xml:lang=\"it-IT\">Tityre, tu patulae recubans sub "
             "tegmine fagi.</lang></speak>", @"en-GB", 0.5)];
        [self.c queue:@"2d <lang fr-FR> CONTROL" utterance:Ssml(
            @"<speak>The report concluded, and I quote, <lang xml:lang=\"fr-FR\">que tout va "
             "tres bien madame</lang>.</speak>", @"en-GB", 0.5)];
        break;
    }

    /* 3 -- Q-D4, HALF TWO: <phoneme alphabet="ipa">.
       ★ THE THIRD ONE IS ABSURD ON PURPOSE. A synthesiser that parses the tag
       and ignores its content is indistinguishable from one that honours it,
       unless what it is told to say is something it would never say otherwise.
       So: "fagus" plain, "fagus" with the scholarly Latin IPA, and "fagus"
       told to come out as "banana". If (c) is not a banana, <phoneme> does
       nothing and D6's IPA engines have nowhere to go on this platform. */
    case 3: {
        P(@"---- 3 · Q-D4b, <phoneme>: (c) MUST sound like 'banana' or the tag is ignored ----");
        [self.c queue:@"3a fagus plain" utterance:Plain(@"fagus, fagus, fagus.", @"en-GB", 0.45)];
        [self.c queue:@"3b fagus IPA fa:gus" utterance:Ssml(
            @"<speak><phoneme alphabet=\"ipa\" ph=\"ˈfaːɡʊs\">fagus</phoneme>, "
             "<phoneme alphabet=\"ipa\" ph=\"ˈfaːɡʊs\">fagus</phoneme>.</speak>",
            @"en-GB", 0.45)];
        [self.c queue:@"3c fagus IPA BANANA" utterance:Ssml(
            @"<speak><phoneme alphabet=\"ipa\" ph=\"bəˈnɑːnə\">fagus"
             "</phoneme>, <phoneme alphabet=\"ipa\" ph=\"bəˈnɑːnə\">"
             "fagus</phoneme>.</speak>", @"en-GB", 0.45)];
        /* ...and the two other levers D6 wants, in one line each, so the ear
           can say whether the WHOLE instrument is there or only part of it. */
        [self.c queue:@"3d <break> and <prosody>" utterance:Ssml(
            @"<speak>One<break time=\"1500ms\"/>two. <prosody rate=\"0.5\" pitch=\"+8st\">This "
             "part is slow and high.</prosody> This part is not.</speak>", @"en-GB", 0.5)];
        [self.c queue:@"3e <say-as> and <sub>" utterance:Ssml(
            @"<speak><say-as interpret-as=\"characters\">SSML</say-as>. "
             "<sub alias=\"Publius Vergilius Maro\">Virgil</sub>.</speak>", @"en-GB", 0.5)];
        break;
    }

    /* 4 -- Q-D5. THE NUMBER THIS WHOLE LANE RESTS ON.
       `reader/sysvoice.js` turns `willSpeakRangeOfSpeechString:`'s location
       into a flat word id, and the container proved that mapping over
       6,159,980 words -- given that the callbacks arrive. Here is whether
       they arrive, plain and under SSML, counted against the word count and
       printed with the substring each range actually points at. If the SSML
       count is 0 while the plain count is right, the good script and the
       highlight are in tension and D6 has a decision to make. */
    case 4: {
        P(@"---- 4 · Q-D5, boundaries: plain vs SSML, same words ----");
        [self.c queue:@"4a plain" utterance:Plain(MIXED_EN, @"en-GB", 0.5)];
        [self.c queue:@"4b SSML, no tags inside" utterance:Ssml(
            [NSString stringWithFormat:@"<speak>%@</speak>", MIXED_EN], @"en-GB", 0.5)];
        [self.c queue:@"4c SSML with <lang>" utterance:Ssml(
            @"<speak>The poet begins: <lang xml:lang=\"it-IT\">Tityre, tu patulae recubans sub "
             "tegmine fagi.</lang></speak>", @"en-GB", 0.5)];
        [self.c queue:@"4d SSML with <phoneme>" utterance:Ssml(
            @"<speak>The poet begins: Tityre, tu patulae recubans sub tegmine "
             "<phoneme alphabet=\"ipa\" ph=\"ˈfaːɡi\">fagi</phoneme>.</speak>",
            @"en-GB", 0.5)];
        [self.c queue:@"4e plain, French control" utterance:Plain(MIXED_FR, @"en-GB", 0.5)];
        break;
    }

    /* 5 -- THE RATE CURVE, which is the one number `speech.rs::av_rate` is
       waiting for. That function maps a web-speech MULTIPLE onto Apple's 0..1
       scale as a straight line through Apple's single published point
       (0.5 = normal), and says in its own doc comment that the line is a
       REFERENCE and not a measurement. These four readings of the same sixty
       words are the measurement: wall seconds and words a minute at 0.40,
       0.50 (normal), 0.83 (the Settings default of wpm 300 over BASE_WPM 180)
       and 1.00 (Apple's maximum). If 0.83 does not come out near 1.67x the
       0.50 reading, the line is wrong and the correction is these numbers. */
    case 5: {
        P(@"---- 5 · the rate curve: sixty words, four rates ----");
        for (NSNumber *r in @[@0.40f, @0.50f, @0.83f, @1.00f]) {
            [self.c queue:[NSString stringWithFormat:@"5 rate %.2f", r.floatValue]
                utterance:Plain(SIXTY, @"en-GB", r.floatValue)];
        }
        break;
    }

    /* 6 -- THE WHOLE POINT OF D1(b). Forty utterances handed over at once and
       nothing of ours running afterwards. Press it, LOCK THE PHONE, and count
       to sixty: if it is still reading, a queued AVSpeechSynthesizer survives
       the lock screen and the reader can be handed a chapter. The lock screen
       should also show something (this probe sets no MPNowPlayingInfo, so
       "nothing" here is expected and is not the app's answer). */
    case 6: {
        P(@"---- 6 · LOCK THE PHONE NOW. 40 sentences queued, nothing of ours will run. ----");
        for (int i = 1; i <= 40; i++) {
            NSString *t = [NSString stringWithFormat:
                @"Sentence number %d. The river held the light of the evening for a long while.", i];
            AVSpeechUtterance *u = Plain(t, @"en-GB", 0.5);
            u.postUtteranceDelay = 0.2;
            [self.c queue:[NSString stringWithFormat:@"6 s%02d", i] utterance:u];
        }
        break;
    }

    default:
        [self.c.pending removeAllObjects];
        [self.c.synth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
        P(@"---- stopped ----");
        break;
    }
}

@end

@interface AppDelegate : UIResponder <UIApplicationDelegate>
@property (nonatomic, strong) UIWindow *window;
@end

@implementation AppDelegate
- (BOOL)application:(UIApplication *)a
    didFinishLaunchingWithOptions:(NSDictionary *)o {
    self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
    self.window.rootViewController = [[Probe alloc] init];
    [self.window makeKeyAndVisible];
    return YES;
}
@end

int main(int argc, char *argv[]) {
    @autoreleasepool {
        return UIApplicationMain(argc, argv, nil, NSStringFromClass(AppDelegate.class));
    }
}
