// voiceui/commands.js -- THE ASSISTANT IS THE BOOK SPEAKING BACK (chat 106,
// Osca, 14 Sep): "stop, play, ask it to switch languages, read out slowly,
// define, grammar, general info about the book." Stage 1 of that is six
// commands, every one DETERMINISTIC and TEMPLATED -- no model, no network,
// nothing invented about a book: each answer is read out of the book's own
// records (`book.meta.json`, `book.json` meta, `names.json`, `grammar.json`,
// `stitch.json`, the pace store) or says plainly that the record is not
// there.
//
//   switch    the other language of a bilingual book, same word, named as
//             the person says it ("switch", "English", "Greek", "l'autre
//             langue"). `ground`/`target` generalised: on a stitched book
//             (books/<slug>/stitch.json) it is the paired paragraph and the
//             proportional word; on a pair the reader aligns, it is the
//             grammar's own pane op.
//   slower    one coarse stop DOWN the pace list (`Transport.PACES`: 150 200
//             250 300 350 400 500 600), never wrapping -- the ONE stored rate
//             (G-WPM, Settings' `wpm`). The engine re-bases on the word by
//             itself (reader.html, "THE RATE ... RE-BASES"). `faster` and
//             `normal` are the same road up and back to the default, so a
//             spoken rate and the bar's number never disagree.
//   define    = `what does this mean`, the gloss answers.js already gives.
//             Only the phrase set lives here; app.js routes it to the lookup.
//   grammar   the word's `grammar.json` row spoken as ONE sentence: case,
//             number, gender, person, tense, mood, the lemma -- and "or" the
//             other readings when the pack was not certain.
//   about     the book's records as three sentences: who, when, what -- and
//             "I don't know when it was written" when no record says.
//   where     chapter n of N, its title, and how far through.
//
// Every phrase set is written in every SHELF language (languages/<code>/
// packet.json: en fr de la grc sa zh) plus `el` for the Iliad, because the
// recogniser is set to the book's language and a French reader says "plus
// lentement", not "slower". Answers are templated in English, French and
// German; every other language answers in English (§6 of the report).
//
// Pure: `parse(text)` is text -> {cmd, ...} and the `format*` functions are
// records -> one sentence. `execute` takes its doors as arguments (the
// bridge, the pace store, the records, the position) so a node test drives
// it with fakes and the page drives it with the real ones. No DOM here.
//
// UMD: module.exports under Node, or window.VoiceUI.commands in the browser
// via a plain <script> tag -- see grammar.js's file header for why.
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceUI = root.VoiceUI || {};
    root.VoiceUI.commands = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

const COMMANDS = ["switch", "slower", "faster", "normal", "define", "grammar", "about", "where"];

// ------------------------------------------------------- language names
// How the shelf's languages are NAMED, in each shelf language, so "English"
// and "anglais" and "Englisch" all resolve to `en`. The person names the
// language they want to hear, in the language they are speaking.
const LANGUAGE_NAMES = {
  en: ["english", "englisch", "anglais", "inglese", "inglés", "anglice", "ἀγγλικά", "αγγλικά", "英文", "英语", "英語", "आङ्ग्लभाषा"],
  fr: ["french", "français", "francais", "französisch", "gallice", "francese", "francés", "γαλλικά", "法文", "法语", "法語"],
  de: ["german", "deutsch", "allemand", "germanice", "tedesco", "alemán", "γερμανικά", "德文", "德语", "德語"],
  la: ["latin", "lateinisch", "latine", "latina", "latino", "latín", "λατινικά", "拉丁文", "拉丁语", "拉丁語"],
  grc: ["ancient greek", "old greek", "altgriechisch", "grec ancien", "graece", "ἑλληνική", "ἑλληνιστί", "古希腊语", "古希臘語"],
  el: ["greek", "griechisch", "grec", "greco", "griego", "ελληνικά", "ελληνική", "希腊语", "希腊文", "希臘語"],
  sa: ["sanskrit", "sanscrit", "sanskritisch", "संस्कृतम्", "संस्कृत", "梵文", "梵语", "梵語"],
  zh: ["chinese", "chinesisch", "chinois", "mandarin", "sinice", "中文", "汉语", "漢語", "普通话"],
  it: ["italian", "italien", "italienisch", "italiano", "italice", "意大利语", "意大利文"],
  es: ["spanish", "espagnol", "spanisch", "español", "hispanice", "西班牙语", "西班牙文"],
};

// the language a person is likely to mean by a bare "Greek" when the book
// is Ancient Greek: the packet code, not the modern one
const GREEK_ALIAS = { el: "grc" };

function fold(s) {
  return String(s || "").toLowerCase().normalize("NFC").replace(/[.?!,;:]+$/g, "").replace(/\s+/g, " ").trim();
}

function languageCodeOf(name, { bookLangs = [] } = {}) {
  const n = fold(name);
  if (!n) return null;
  for (const code of Object.keys(LANGUAGE_NAMES)) {
    if (LANGUAGE_NAMES[code].some((x) => fold(x) === n)) {
      // "Greek" on a book whose languages include grc means grc
      if (GREEK_ALIAS[code] && bookLangs.includes(GREEK_ALIAS[code]) && !bookLangs.includes(code)) return GREEK_ALIAS[code];
      return code;
    }
  }
  return null;
}

// ------------------------------------------------------- the phrase sets
// One regex list per command. Every entry is anchored: a command is the
// whole utterance, never a substring of a longer one ("what does switch
// mean" is a lookup, not a switch). Order: the more specific commands first.
const PHRASES = {
  slower: [
    /^(read )?(slower|slowly|more slowly|slow down|slow)$/,
    /^(lis )?plus (lentement|doucement)$/, /^(plus )?lent(ement)?$/, /^ralentis?(sez)?$/, /^doucement$/,
    /^langsam(er)?$/, /^(bitte )?langsamer( lesen)?$/, /^(lies )?langsamer$/,
    /^(lege )?lentius$/, /^lente$/, /^tardius$/,
    /^βραδύτερον$/, /^βραδέως$/, /^πιο (αργά|σιγά)$/, /^αργά$/,
    /^मन्दतरम्$/, /^शनैः$/,
    /^慢一点$/, /^慢一點$/, /^慢点$/, /^慢些$/, /^读慢一点$/, /^讀慢一點$/,
  ],
  faster: [
    /^(read )?(faster|quicker|more quickly|speed up|quick)$/,
    /^plus (vite|rapidement)$/, /^accélère$/,
    /^schneller$/, /^(bitte )?schneller( lesen)?$/,
    /^(lege )?celerius$/, /^velocius$/,
    /^ταχύτερον$/, /^πιο γρήγορα$/, /^γρήγορα$/,
    /^शीघ्रतरम्$/,
    /^快一点$/, /^快一點$/, /^快点$/, /^快些$/,
  ],
  normal: [
    /^(normal|normal speed|normal pace|usual speed|regular speed)$/,
    /^(vitesse )?normale?$/, /^(normale )?geschwindigkeit$/, /^normal(es tempo)?$/,
    /^(celeritas )?solita$/, /^συνήθως$/, /^κανονικά$/, /^正常(速度)?$/,
  ],
  define: [
    /^(define|definition|meaning|what does it mean|what is this word|define this|define it|what's this|what is this)$/,
    /^(définis|définition|définir|sens|que veut dire ce mot|ça veut dire quoi|qu'est-ce que ça veut dire|que signifie ce mot|signification)$/,
    /^(definiere|definition|bedeutung|was heißt das|was heisst das|was bedeutet das|was bedeutet das wort)$/,
    /^(quid significat|quid sibi vult|quid est hoc verbum|significatio)$/,
    /^(τί σημαίνει|τί ἐστι τοῦτο|τι σημαίνει|τι σημαινει|τί σημαίνει τοῦτο)$/,
    /^(किमर्थः|कोऽर्थः|अर्थः)$/,
    /^(什么意思|什麼意思|这是什么意思|這是什麼意思|定义|定義|释义|釋義)$/,
  ],
  grammar: [
    /^(grammar|what grammar|the grammar|parse|parse it|parse this|what form|what form is this|what case|what tense|what case is this|what tense is this|which case|which tense|analyse|analyze|morphology)$/,
    /^(grammaire|la grammaire|quelle forme|quel cas|quel temps|analyse|analyse grammaticale|quelle est la forme)$/,
    /^(grammatik|die grammatik|welche form|welcher fall|welche zeit|analysiere|welcher kasus)$/,
    /^(grammatica|quae forma|quis casus|quod tempus|analysis)$/,
    /^(γραμματική|γραμματικη|τίς πτῶσις|τί πτῶσις|ποία πτῶσις|τίς χρόνος|ἀνάλυσις|ποια πτώση|ποιος χρόνος)$/,
    /^(व्याकरणम्|व्याकरण|का विभक्तिः|कः कालः)$/,
    /^(语法|語法|什么词形|什麼詞形|什么时态|什麼時態|分析)$/,
  ],
  about: [
    /^(about|about the book|about this book|about this|what is this book|what's this book|what book is this|who wrote this|who wrote it|who is the author|tell me about the book|tell me about this book|what am i reading|what am i listening to|general info|information|info)$/,
    /^(à propos|a propos|à propos du livre|de quoi parle ce livre|c'est quoi ce livre|qui a écrit ça|qui a écrit ce livre|qui est l'auteur|quel est ce livre|parle-moi du livre|qu'est-ce que je lis)$/,
    /^(über das buch|worum geht es|worum geht es hier|was ist das für ein buch|wer hat das geschrieben|wer ist der autor|welches buch ist das|erzähl mir vom buch|was lese ich)$/,
    /^(de libro|quis scripsit|quis auctor|quis auctor est|quid est hic liber|de quo agitur)$/,
    /^(περὶ τοῦ βιβλίου|τίς ἔγραψε|τίς ὁ ποιητής|τί τὸ βιβλίον|περί του βιβλίου|ποιος το έγραψε|ποιος είναι ο συγγραφέας|τι βιβλίο είναι αυτό)$/,
    /^(ग्रन्थविषये|कः लेखकः|को लेखकः|कः ग्रन्थः)$/,
    /^(关于这本书|關於這本書|这是什么书|這是什麼書|作者是谁|作者是誰|谁写的|誰寫的|介绍一下这本书|介紹一下這本書)$/,
  ],
  where: [
    /^(where|where am i|where are we|where is this|which chapter|what chapter|what chapter is this|which chapter is this|how far|how far in|how far along|how far through|how much is left|position|progress)$/,
    /^(où|ou|où suis-je|où en suis-je|où en sommes-nous|quel chapitre|quel chapitre est-ce|c'est quel chapitre|on en est où|j'en suis où|combien reste-t-il|progression)$/,
    /^(wo|wo bin ich|wo sind wir|welches kapitel|welches kapitel ist das|wie weit|wie weit sind wir|wie weit bin ich|wie viel fehlt noch|fortschritt)$/,
    /^(ubi|ubi sum|ubi sumus|quod caput|quod caput est|quantum restat|quousque)$/,
    /^(ποῦ|ποῦ εἰμι|ποῦ ἐσμεν|τί κεφάλαιον|ποῖον κεφάλαιον|πόσον λείπεται|πού είμαι|πού είμαστε|ποιο κεφάλαιο|πόσο μένει)$/,
    /^(कुत्र|कुत्रास्मि|कः अध्यायः|को ऽध्यायः|किं शेषम्)$/,
    /^(哪里|哪裡|我在哪|我在哪里|我在哪裡|第几章|第幾章|这是第几章|這是第幾章|读到哪了|讀到哪了|还剩多少|還剩多少|进度|進度)$/,
  ],
  // `switch` is last: a bare language name is also a switch ("English",
  // "anglais"), and that check runs after every other set has had its turn
  switch: [
    /^(switch|switch language|switch languages|switch the language|change language|change the language|other language|the other language|the other one|translate|translation|other side|the other side)$/,
    /^(change|changer|change de langue|changer de langue|l'autre langue|autre langue|l'autre|traduction|traduis|traduire|de l'autre côté)$/,
    /^(wechseln|wechsel|sprache wechseln|die sprache wechseln|andere sprache|die andere sprache|die andere|übersetzung|übersetze|übersetzen)$/,
    /^(muta|muta linguam|altera lingua|alteram linguam|in alteram linguam|verte|interpretatio)$/,
    /^(μετάβαλε|ἄλλη γλῶσσα|ἡ ἄλλη γλῶσσα|εἰς τὴν ἄλλην γλῶσσαν|ἑρμήνευε|ἑρμηνεία|άλλαξε γλώσσα|η άλλη γλώσσα|μετάφραση)$/,
    /^(भाषां परिवर्तय|अन्या भाषा|अन्यभाषा|अनुवादः)$/,
    /^(切换|切換|切换语言|切換語言|换语言|換語言|另一种语言|另一種語言|另一个|另一個|翻译|翻譯)$/,
  ],
};

// what a bare "switch" may be followed by: "switch to English", "en
// anglais", "auf Deutsch", "in Latin"
const SWITCH_TO = [
  /^(?:switch|change|go|read|translate)?\s*(?:to|into|in)\s+(.+)$/,
  /^(?:passe |passer |lis |traduis )?(?:en|à|au)\s+(.+)$/,
  /^(?:wechsle |wechseln |lies )?(?:auf|zu|ins|in)\s+(.+)$/,
  /^(?:lege |verte )?(?:in|ad)\s+(.+)$/,
  /^(?:στὰ|στα|εἰς τὰ|εις τα|στὴν|στην)\s+(.+)$/,
  /^(?:切换到|切換到|换成|換成|用)(.+)$/,
];

// parse(text, {bookLangs}) -> {cmd, lang?} | null
//   {cmd:"switch", lang:"en"|null}   lang is the language NAMED, or null for
//                                    "the other one"
//   {cmd:"slower"|"faster"|"normal"|"define"|"grammar"|"about"|"where"}
function parse(text, { bookLangs = [] } = {}) {
  const t = fold(text);
  if (!t) return null;
  for (const cmd of COMMANDS) {
    if (cmd === "switch") continue;
    if (PHRASES[cmd].some((re) => re.test(t))) return { cmd };
  }
  if (PHRASES.switch.some((re) => re.test(t))) return { cmd: "switch", lang: null };
  const direct = languageCodeOf(t, { bookLangs });
  if (direct) return { cmd: "switch", lang: direct };
  for (const re of SWITCH_TO) {
    const m = t.match(re);
    if (m) {
      const code = languageCodeOf(m[1], { bookLangs });
      if (code) return { cmd: "switch", lang: code };
    }
  }
  return null;
}

// ------------------------------------------------------- the templates
// Seven answer languages (en fr de la el es it). `T(lang)` picks the table by
// the language the person asked in (the recogniser's, which is the book's);
// `grc` answers in the `el` table; anything else answers in English. Every template is ONE sentence, spoken and written.
const T = {
  en: {
    switched: (name) => `Now in ${name}.`,
    switchedNear: (name) => `Now in ${name}, at the nearest paired sentence.`,
    alreadyIn: (name) => `You are already in ${name}.`,
    noOther: () => "This book has only one language.",
    noPair: (name) => `There is no ${name} paired with this passage.`,
    cannotMove: (name) => `I can't move to the ${name} on this book yet.`,
    noPosition: () => "Nothing is playing yet.",
    pace: (wpm) => `${wpm} words a minute.`,
    paceFloor: (wpm) => `Already at the slowest, ${wpm} words a minute.`,
    paceCeiling: (wpm) => `Already at the fastest, ${wpm} words a minute.`,
    noPace: () => "This book has no pace to change.",
    noGrammar: (w) => `I have no grammar for ${w}.`,
    grammarOff: () => "This book has no grammar record.",
    noWord: () => "I don't know which word you are on.",
    about1: (title, author) => (author ? `${title}, by ${author}.` : `${title}; the record names no author.`),
    aboutWhen: (when) => (when ? `It is dated ${when}.` : "I don't know when it was written."),
    aboutWhat: (parts) => parts.join(", ") + ".",
    aboutSubjects: (subs) => `It is filed under ${subs.join("; ")}.`,
    aboutCast: (names) => `The speakers include ${names.join(", ")}.`,
    noAbout: () => "I have no record of this book.",
    where: (n, N, title, far) => `Chapter ${n} of ${N}${title ? ", " + title : ""}${far ? ", " + far : ""}.`,
    far: (f) => (f < 0.08 ? "at the start" : f < 0.3 ? "about a quarter in" : f < 0.42 ? "about a third in" : f < 0.58 ? "about halfway" : f < 0.72 ? "about two thirds in" : f < 0.92 ? "near the end" : "at the end"),
    form: { verse: "verse", prose: "prose", drama: "a play", fragments: "fragments", letters: "letters", dialogue: "a dialogue" },
    inLang: (name) => `in ${name}`,
    chapters: (n) => `${n} chapter${n === 1 ? "" : "s"}`,
    words: (n) => `${n.toLocaleString("en")} words`,
    langName: { en: "English", fr: "French", de: "German", la: "Latin", grc: "Ancient Greek", el: "Greek", sa: "Sanskrit", zh: "Chinese", it: "Italian", es: "Spanish" },
  },
  fr: {
    switched: (name) => `Maintenant en ${name}.`,
    switchedNear: (name) => `Maintenant en ${name}, à la phrase appariée la plus proche.`,
    alreadyIn: (name) => `Vous êtes déjà en ${name}.`,
    noOther: () => "Ce livre n'a qu'une seule langue.",
    noPair: (name) => `Il n'y a pas de ${name} apparié à ce passage.`,
    cannotMove: (name) => `Je ne peux pas encore passer au ${name} sur ce livre.`,
    noPosition: () => "Rien ne joue encore.",
    pace: (wpm) => `${wpm} mots par minute.`,
    paceFloor: (wpm) => `Déjà au plus lent, ${wpm} mots par minute.`,
    paceCeiling: (wpm) => `Déjà au plus rapide, ${wpm} mots par minute.`,
    noPace: () => "Ce livre n'a pas de vitesse à changer.",
    noGrammar: (w) => `Je n'ai pas de grammaire pour ${w}.`,
    grammarOff: () => "Ce livre n'a pas de fiche de grammaire.",
    noWord: () => "Je ne sais pas sur quel mot vous êtes.",
    about1: (title, author) => (author ? `${title}, de ${author}.` : `${title} ; la fiche ne nomme pas d'auteur.`),
    aboutWhen: (when) => (when ? `Daté de ${when}.` : "Je ne sais pas quand il a été écrit."),
    aboutWhat: (parts) => parts.join(", ") + ".",
    aboutSubjects: (subs) => `Classé sous ${subs.join(" ; ")}.`,
    aboutCast: (names) => `Parmi les personnages : ${names.join(", ")}.`,
    noAbout: () => "Je n'ai aucune fiche pour ce livre.",
    where: (n, N, title, far) => `Chapitre ${n} sur ${N}${title ? ", " + title : ""}${far ? ", " + far : ""}.`,
    far: (f) => (f < 0.08 ? "au début" : f < 0.3 ? "vers le quart" : f < 0.42 ? "vers le tiers" : f < 0.58 ? "vers la moitié" : f < 0.72 ? "aux deux tiers" : f < 0.92 ? "vers la fin" : "à la fin"),
    form: { verse: "vers", prose: "prose", drama: "une pièce", fragments: "fragments", letters: "lettres", dialogue: "un dialogue" },
    inLang: (name) => `en ${name}`,
    chapters: (n) => `${n} chapitre${n === 1 ? "" : "s"}`,
    words: (n) => `${n.toLocaleString("fr")} mots`,
    langName: { en: "anglais", fr: "français", de: "allemand", la: "latin", grc: "grec ancien", el: "grec", sa: "sanskrit", zh: "chinois", it: "italien", es: "espagnol" },
  },
  de: {
    switched: (name) => `Jetzt auf ${name}.`,
    switchedNear: (name) => `Jetzt auf ${name}, beim nächsten gepaarten Satz.`,
    alreadyIn: (name) => `Sie sind schon auf ${name}.`,
    noOther: () => "Dieses Buch hat nur eine Sprache.",
    noPair: (name) => `Zu dieser Stelle gibt es kein ${name}.`,
    cannotMove: (name) => `Ich kann bei diesem Buch noch nicht zum ${name} wechseln.`,
    noPosition: () => "Es spielt noch nichts.",
    pace: (wpm) => `${wpm} Wörter pro Minute.`,
    paceFloor: (wpm) => `Schon am langsamsten, ${wpm} Wörter pro Minute.`,
    paceCeiling: (wpm) => `Schon am schnellsten, ${wpm} Wörter pro Minute.`,
    noPace: () => "Dieses Buch hat kein Tempo zum Ändern.",
    noGrammar: (w) => `Ich habe keine Grammatik zu ${w}.`,
    grammarOff: () => "Dieses Buch hat keine Grammatikdatei.",
    noWord: () => "Ich weiß nicht, bei welchem Wort Sie sind.",
    about1: (title, author) => (author ? `${title}, von ${author}.` : `${title}; die Datei nennt keinen Autor.`),
    aboutWhen: (when) => (when ? `Datiert ${when}.` : "Ich weiß nicht, wann es geschrieben wurde."),
    aboutWhat: (parts) => parts.join(", ") + ".",
    aboutSubjects: (subs) => `Eingeordnet unter ${subs.join("; ")}.`,
    aboutCast: (names) => `Zu den Sprechern gehören ${names.join(", ")}.`,
    noAbout: () => "Ich habe keine Datei zu diesem Buch.",
    where: (n, N, title, far) => `Kapitel ${n} von ${N}${title ? ", " + title : ""}${far ? ", " + far : ""}.`,
    far: (f) => (f < 0.08 ? "am Anfang" : f < 0.3 ? "etwa ein Viertel" : f < 0.42 ? "etwa ein Drittel" : f < 0.58 ? "etwa die Hälfte" : f < 0.72 ? "etwa zwei Drittel" : f < 0.92 ? "kurz vor dem Ende" : "am Ende"),
    form: { verse: "Verse", prose: "Prosa", drama: "ein Stück", fragments: "Fragmente", letters: "Briefe", dialogue: "ein Dialog" },
    inLang: (name) => `auf ${name}`,
    chapters: (n) => `${n} Kapitel`,
    words: (n) => `${n.toLocaleString("de")} Wörter`,
    langName: { en: "Englisch", fr: "Französisch", de: "Deutsch", la: "Latein", grc: "Altgriechisch", el: "Griechisch", sa: "Sanskrit", zh: "Chinesisch", it: "Italienisch", es: "Spanisch" },
  },
  // THE SHELF'S OTHER LANGUAGES (wave 8, 26 Sep: "templates beyond
  // en/fr/de"). books/index.json counts la ×4 and el ×1 today; es and it
  // are the two the voice picker names next. Latin answers a Latin book in
  // Latin because the assistant IS the book (chat 106); numerals stay
  // Arabic. `grc` (Homer's Greek) answers in modern Greek, the recogniser's.
  la: {
    switched: (name) => `Nunc ${name}.`,
    switchedNear: (name) => `Nunc ${name}, proxima sententia.`,
    alreadyIn: (name) => `Iam ${name} legis.`,
    noOther: () => "Hic liber unam tantum linguam habet.",
    noPair: (name) => `Nihil ${name} huic loco iunctum est.`,
    cannotMove: (name) => `Nondum ${name} in hoc libro transire possum.`,
    noPosition: () => "Nihil adhuc sonat.",
    pace: (wpm) => `${wpm} verba in minuto.`,
    paceFloor: (wpm) => `Iam lentissime, ${wpm} verba in minuto.`,
    paceCeiling: (wpm) => `Iam celerrime, ${wpm} verba in minuto.`,
    noPace: () => "Hic liber celeritatem mutandam non habet.",
    noGrammar: (w) => `Grammaticam verbi ${w} non habeo.`,
    grammarOff: () => "Hic liber tabulam grammaticam non habet.",
    noWord: () => "Nescio quo in verbo sis.",
    about1: (title, author) => (author ? `${title}, auctore ${author}.` : `${title}; tabula auctorem non nominat.`),
    aboutWhen: (when) => (when ? `Anno ${when} datum.` : "Nescio quando scriptum sit."),
    aboutWhat: (parts) => parts.join(", ") + ".",
    aboutSubjects: (subs) => `Sub his positum: ${subs.join("; ")}.`,
    aboutCast: (names) => `Inter loquentes sunt ${names.join(", ")}.`,
    noAbout: () => "Nullam tabulam huius libri habeo.",
    where: (n, N, title, far) => `Caput ${n} ex ${N}${title ? ", " + title : ""}${far ? ", " + far : ""}.`,
    far: (f) => (f < 0.08 ? "in initio" : f < 0.3 ? "circa quartam partem" : f < 0.42 ? "circa tertiam partem" : f < 0.58 ? "circa medium" : f < 0.72 ? "circa duas tertias" : f < 0.92 ? "prope finem" : "in fine"),
    form: { verse: "versus", prose: "prosa", drama: "fabula", fragments: "fragmenta", letters: "epistulae", dialogue: "dialogus" },
    inLang: (name) => `${name}`,
    chapters: (n) => `${n} ${n === 1 ? "caput" : "capita"}`,
    words: (n) => `${n.toLocaleString("en")} verba`,
    langName: { en: "Anglice", fr: "Gallice", de: "Germanice", la: "Latine", grc: "Graece antique", el: "Graece", sa: "Sanscritice", zh: "Sinice", it: "Italice", es: "Hispanice" },
  },
  el: {
    switched: (name) => `Τώρα στα ${name}.`,
    switchedNear: (name) => `Τώρα στα ${name}, στην πλησιέστερη πρόταση.`,
    alreadyIn: (name) => `Είστε ήδη στα ${name}.`,
    noOther: () => "Αυτό το βιβλίο έχει μόνο μία γλώσσα.",
    noPair: (name) => `Δεν υπάρχουν ${name} αντιστοιχισμένα με αυτό το χωρίο.`,
    cannotMove: (name) => `Δεν μπορώ ακόμη να περάσω στα ${name} σε αυτό το βιβλίο.`,
    noPosition: () => "Δεν παίζει τίποτα ακόμη.",
    pace: (wpm) => `${wpm} λέξεις το λεπτό.`,
    paceFloor: (wpm) => `Ήδη στο πιο αργό, ${wpm} λέξεις το λεπτό.`,
    paceCeiling: (wpm) => `Ήδη στο πιο γρήγορο, ${wpm} λέξεις το λεπτό.`,
    noPace: () => "Αυτό το βιβλίο δεν έχει ρυθμό για αλλαγή.",
    noGrammar: (w) => `Δεν έχω γραμματική για το ${w}.`,
    grammarOff: () => "Αυτό το βιβλίο δεν έχει αρχείο γραμματικής.",
    noWord: () => "Δεν ξέρω σε ποια λέξη βρίσκεστε.",
    about1: (title, author) => (author ? `${title}, του ${author}.` : `${title}· το αρχείο δεν αναφέρει συγγραφέα.`),
    aboutWhen: (when) => (when ? `Χρονολογείται ${when}.` : "Δεν ξέρω πότε γράφτηκε."),
    aboutWhat: (parts) => parts.join(", ") + ".",
    aboutSubjects: (subs) => `Ταξινομείται υπό ${subs.join("· ")}.`,
    aboutCast: (names) => `Στους ομιλητές είναι οι ${names.join(", ")}.`,
    noAbout: () => "Δεν έχω αρχείο για αυτό το βιβλίο.",
    where: (n, N, title, far) => `Κεφάλαιο ${n} από ${N}${title ? ", " + title : ""}${far ? ", " + far : ""}.`,
    far: (f) => (f < 0.08 ? "στην αρχή" : f < 0.3 ? "περίπου στο ένα τέταρτο" : f < 0.42 ? "περίπου στο ένα τρίτο" : f < 0.58 ? "περίπου στη μέση" : f < 0.72 ? "περίπου στα δύο τρίτα" : f < 0.92 ? "κοντά στο τέλος" : "στο τέλος"),
    form: { verse: "ποίηση", prose: "πεζογραφία", drama: "θεατρικό έργο", fragments: "αποσπάσματα", letters: "επιστολές", dialogue: "διάλογος" },
    inLang: (name) => `στα ${name}`,
    chapters: (n) => `${n} ${n === 1 ? "κεφάλαιο" : "κεφάλαια"}`,
    words: (n) => `${n.toLocaleString("el")} λέξεις`,
    langName: { en: "αγγλικά", fr: "γαλλικά", de: "γερμανικά", la: "λατινικά", grc: "αρχαία ελληνικά", el: "ελληνικά", sa: "σανσκριτικά", zh: "κινεζικά", it: "ιταλικά", es: "ισπανικά" },
  },
  es: {
    switched: (name) => `Ahora en ${name}.`,
    switchedNear: (name) => `Ahora en ${name}, en la frase más cercana.`,
    alreadyIn: (name) => `Ya está en ${name}.`,
    noOther: () => "Este libro tiene una sola lengua.",
    noPair: (name) => `No hay ${name} emparejado con este pasaje.`,
    cannotMove: (name) => `Todavía no puedo pasar al ${name} en este libro.`,
    noPosition: () => "Todavía no suena nada.",
    pace: (wpm) => `${wpm} palabras por minuto.`,
    paceFloor: (wpm) => `Ya en lo más lento, ${wpm} palabras por minuto.`,
    paceCeiling: (wpm) => `Ya en lo más rápido, ${wpm} palabras por minuto.`,
    noPace: () => "Este libro no tiene ritmo que cambiar.",
    noGrammar: (w) => `No tengo gramática para ${w}.`,
    grammarOff: () => "Este libro no tiene ficha de gramática.",
    noWord: () => "No sé en qué palabra está.",
    about1: (title, author) => (author ? `${title}, de ${author}.` : `${title}; la ficha no nombra autor.`),
    aboutWhen: (when) => (when ? `Fechado en ${when}.` : "No sé cuándo se escribió."),
    aboutWhat: (parts) => parts.join(", ") + ".",
    aboutSubjects: (subs) => `Clasificado bajo ${subs.join("; ")}.`,
    aboutCast: (names) => `Entre los personajes están ${names.join(", ")}.`,
    noAbout: () => "No tengo ficha de este libro.",
    where: (n, N, title, far) => `Capítulo ${n} de ${N}${title ? ", " + title : ""}${far ? ", " + far : ""}.`,
    far: (f) => (f < 0.08 ? "al principio" : f < 0.3 ? "hacia el primer cuarto" : f < 0.42 ? "hacia el primer tercio" : f < 0.58 ? "hacia la mitad" : f < 0.72 ? "hacia los dos tercios" : f < 0.92 ? "cerca del final" : "al final"),
    form: { verse: "verso", prose: "prosa", drama: "una obra de teatro", fragments: "fragmentos", letters: "cartas", dialogue: "un diálogo" },
    inLang: (name) => `en ${name}`,
    chapters: (n) => `${n} capítulo${n === 1 ? "" : "s"}`,
    words: (n) => `${n.toLocaleString("es")} palabras`,
    langName: { en: "inglés", fr: "francés", de: "alemán", la: "latín", grc: "griego antiguo", el: "griego", sa: "sánscrito", zh: "chino", it: "italiano", es: "español" },
  },
  it: {
    switched: (name) => `Ora in ${name}.`,
    switchedNear: (name) => `Ora in ${name}, alla frase più vicina.`,
    alreadyIn: (name) => `È già in ${name}.`,
    noOther: () => "Questo libro ha una sola lingua.",
    noPair: (name) => `Non c'è ${name} accoppiato a questo passo.`,
    cannotMove: (name) => `Non posso ancora passare al ${name} in questo libro.`,
    noPosition: () => "Non suona ancora nulla.",
    pace: (wpm) => `${wpm} parole al minuto.`,
    paceFloor: (wpm) => `Già al più lento, ${wpm} parole al minuto.`,
    paceCeiling: (wpm) => `Già al più veloce, ${wpm} parole al minuto.`,
    noPace: () => "Questo libro non ha un ritmo da cambiare.",
    noGrammar: (w) => `Non ho grammatica per ${w}.`,
    grammarOff: () => "Questo libro non ha una scheda di grammatica.",
    noWord: () => "Non so su quale parola sia.",
    about1: (title, author) => (author ? `${title}, di ${author}.` : `${title}; la scheda non nomina un autore.`),
    aboutWhen: (when) => (when ? `Datato ${when}.` : "Non so quando sia stato scritto."),
    aboutWhat: (parts) => parts.join(", ") + ".",
    aboutSubjects: (subs) => `Classificato sotto ${subs.join("; ")}.`,
    aboutCast: (names) => `Tra i personaggi ci sono ${names.join(", ")}.`,
    noAbout: () => "Non ho una scheda di questo libro.",
    where: (n, N, title, far) => `Capitolo ${n} di ${N}${title ? ", " + title : ""}${far ? ", " + far : ""}.`,
    far: (f) => (f < 0.08 ? "all'inizio" : f < 0.3 ? "verso il primo quarto" : f < 0.42 ? "verso il primo terzo" : f < 0.58 ? "verso la metà" : f < 0.72 ? "verso i due terzi" : f < 0.92 ? "vicino alla fine" : "alla fine"),
    form: { verse: "versi", prose: "prosa", drama: "un dramma", fragments: "frammenti", letters: "lettere", dialogue: "un dialogo" },
    inLang: (name) => `in ${name}`,
    chapters: (n) => `${n} capitol${n === 1 ? "o" : "i"}`,
    words: (n) => `${n.toLocaleString("it")} parole`,
    langName: { en: "inglese", fr: "francese", de: "tedesco", la: "latino", grc: "greco antico", el: "greco", sa: "sanscrito", zh: "cinese", it: "italiano", es: "spagnolo" },
  },
};
function tableFor(lang) {
  const l = String(lang || "en").toLowerCase().split(/[-_]/)[0];
  return T[l] || (l === "grc" ? T.el : T.en);
}
function languageName(code, lang) {
  const t = tableFor(lang);
  return t.langName[code] || T.en.langName[code] || String(code || "").toUpperCase();
}

// ------------------------------------------------------- grammar -> sentence
// grammar.json (the pack's own shape, measured on eclogues-la / les-pensées /
// eclogues-en 14 Sep): words[<surface>] = {readings:[{case, number, gender,
// person, tense, mood, voice, nonfinite, degree, other, lemma}], certain,
// headwords:{<lemma>:[{text, pos, ...}]}}. Keys are the surface text as it
// stands in the book (case kept), so the lookup tries exact, then a
// case-fold, then an accent-fold.
const READING_ORDER = ["person", "number", "gender", "case", "degree", "tense", "voice", "mood", "nonfinite"];
function readingWords(r) {
  const out = [];
  for (const k of READING_ORDER) {
    const v = r[k];
    if (v === undefined || v === null || v === "") continue;
    out.push(Array.isArray(v) ? v.join(" or ") : String(v));
  }
  return out;
}
function grammarEntry(grammar, surface) {
  const words = grammar && grammar.words;
  if (!words || !surface) return null;
  if (Object.prototype.hasOwnProperty.call(words, surface)) return words[surface];
  const want = String(surface).toLowerCase();
  const wantFold = want.normalize("NFD").replace(/[̀-ͯ]/g, "");
  let byFold = null;
  for (const k of Object.keys(words)) {
    const kl = k.toLowerCase();
    if (kl === want) return words[k];
    if (!byFold && kl.normalize("NFD").replace(/[̀-ͯ]/g, "") === wantFold) byFold = words[k];
  }
  return byFold;
}
function posOf(entry, lemma) {
  const hw = entry && entry.headwords && entry.headwords[lemma];
  if (!Array.isArray(hw) || !hw.length) return null;
  return hw[0].pos || null;
}
// "patulae is the dative singular feminine of patulus, an adjective -- or
//  the genitive singular, or the nominative plural."
function formatGrammar(entry, surface, lang) {
  const t = tableFor(lang);
  if (!entry || !Array.isArray(entry.readings) || !entry.readings.length) return t.noGrammar(surface);
  const first = entry.readings[0];
  const lemma = first.lemma || surface;
  const pos = posOf(entry, lemma);
  const head = readingWords(first).join(" ");
  const others = entry.certain ? [] : entry.readings.slice(1, 4).map((r) => readingWords(r).join(" ")).filter((s) => s && s !== head);
  const same = lemma.toLowerCase() === String(surface).toLowerCase();
  let s;
  if (t === T.fr) {
    s = head ? `${surface} est ${head}${same ? "" : " de " + lemma}` : (same ? `${surface}` : `${surface} vient de ${lemma}`);
    if (pos) s += ` (${pos})`;
    if (others.length) s += " — ou " + others.join(", ou ");
  } else if (t === T.de) {
    s = head ? `${surface} ist ${head}${same ? "" : " von " + lemma}` : (same ? `${surface}` : `${surface} kommt von ${lemma}`);
    if (pos) s += ` (${pos})`;
    if (others.length) s += " — oder " + others.join(", oder ");
  } else {
    s = head ? `${surface} is the ${head}${same ? "" : " of " + lemma}` : (same ? `${surface}` : `${surface} is a form of ${lemma}`);
    if (pos) s += `, ${/^[aeiou]/i.test(pos) ? "an" : "a"} ${pos}`;
    if (others.length) s += " — or the " + others.join(", or the ");
  }
  return s + ".";
}

// ------------------------------------------------------- about -> 3 sentences
// `meta` is book.meta.json (title, author, lang, chapters[], words) merged
// with what book.json carries when it is small enough to read (form,
// meta.subjects, meta.contributors, meta.date -- see records.js). `names`
// is names.json. A book with neither answers noAbout. NOTHING is invented:
// "when" comes only from a record that states it (meta.written / period),
// never from the source file's own date, which for a Gutenberg Virgil is
// 1995.
function castOf(names, max = 4) {
  const list = (names && Array.isArray(names.names) ? names.names : []).filter((n) => n && n.cast).slice(0, max);
  return list.map((n) => n.text);
}
function formatAbout(meta, names, lang) {
  const t = tableFor(lang);
  if (!meta || !meta.title) return t.noAbout();
  const out = [t.about1(meta.title, meta.author || null)];
  const when = meta.written || meta.period || (meta.meta && (meta.meta.written || meta.meta.period)) || null;
  out.push(t.aboutWhen(when));
  const parts = [];
  const form = meta.form && t.form[meta.form];
  if (form) parts.push(form);
  if (meta.lang) parts.push(t.inLang(languageName(meta.lang, lang)));
  const nCh = Array.isArray(meta.chapters) ? meta.chapters.length : (typeof meta.chapters === "number" ? meta.chapters : 0);
  if (nCh) parts.push(t.chapters(nCh));
  if (meta.words) parts.push(t.words(meta.words));
  if (parts.length) {
    let s = t.aboutWhat(parts);
    out.push(s.charAt(0).toUpperCase() + s.slice(1));
  }
  const subs = (meta.meta && Array.isArray(meta.meta.subjects) ? meta.meta.subjects : []).map((x) => String(x).replace(/\s*--\s*/g, ", ")).slice(0, 3);
  if (subs.length) out.push(t.aboutSubjects(subs));
  const cast = castOf(names);
  if (cast.length) out.push(t.aboutCast(cast));
  return out.join(" ");
}

// ------------------------------------------------------- where -> sentence
// pos: {chapterIndex, chapterCount, chapterTitle, fraction|null}
function formatWhere(pos, lang) {
  const t = tableFor(lang);
  if (!pos || !(pos.chapterCount > 0)) return t.noPosition();
  const far = typeof pos.fraction === "number" && isFinite(pos.fraction) ? t.far(Math.max(0, Math.min(1, pos.fraction))) : "";
  const title = pos.chapterTitle ? String(pos.chapterTitle).replace(/\s+/g, " ").trim() : "";
  return t.where(pos.chapterIndex + 1, pos.chapterCount, title, far);
}

// ------------------------------------------------------- pace
const PACES = [150, 200, 250, 300, 350, 400, 500, 600];
function nearestStop(wpm, paces) {
  let i = 0, best = Infinity;
  for (let k = 0; k < paces.length; k++) {
    const d = Math.abs(paces[k] - wpm);
    if (d < best) { best = d; i = k; }
  }
  return i;
}
// stepPace(now, dir, paces) -> {wpm, at:"floor"|"ceiling"|null}. One stop,
// no wrap: "slower" at 150 stays at 150 and says so, unlike the bar's own
// button, which wraps because a one-button bar must.
function stepPace(now, dir, paces = PACES) {
  const i = nearestStop(now, paces);
  const j = Math.max(0, Math.min(paces.length - 1, i + dir));
  const at = dir < 0 && j === 0 && paces[j] >= now ? "floor" : dir > 0 && j === paces.length - 1 && paces[j] <= now ? "ceiling" : null;
  return { wpm: paces[j], at };
}

// ------------------------------------------------------- switch -> a target
// On a stitched book the paragraphs of the two languages are interleaved
// and stitch.json pairs them: paragraphs[pid] = {from:<slug>, pair:[pids]}.
// The same word is a PROPORTION across the paired paragraph, exactly as
// groundStopOrdinal does across a sentence, because the alignment is at
// paragraph level and a word alignment would be a guess.
function pairedTarget({ stitch, langOf, wordId, wantLang, sentenceWordsOf }) {
  if (!stitch || !stitch.paragraphs || !wordId) return null;
  const pid = wordId.split(".").slice(0, 2).join(".");
  const row = stitch.paragraphs[pid];
  if (!row || !Array.isArray(row.pair) || !row.pair.length) return null;
  const hereLang = langOf(row.from);
  const candidates = row.pair.filter((p) => stitch.paragraphs[p]);
  const other = candidates.find((p) => !wantLang || langOf(stitch.paragraphs[p].from) === wantLang);
  if (!other) return null;
  const toLang = langOf(stitch.paragraphs[other].from);
  if (wantLang && toLang !== wantLang) return null;
  if (toLang === hereLang) return null;
  // ordinal within the source paragraph -> proportion -> the target paragraph
  const fromWords = sentenceWordsOf ? sentenceWordsOf(pid) : null;
  const toWords = sentenceWordsOf ? sentenceWordsOf(other) : null;
  let targetWordId = null;
  if (fromWords && fromWords.length && toWords && toWords.length) {
    const k = Math.max(0, fromWords.findIndex((w) => w.id === wordId));
    const j = Math.min(toWords.length - 1, Math.round((k / Math.max(1, fromWords.length - 1)) * (toWords.length - 1)));
    targetWordId = toWords[j].id;
  }
  return { paragraphId: other, lang: toLang, fromLang: hereLang, wordId: targetWordId };
}

// ------------------------------------------------------- switch -> the other BOOK
// Osca's test (wave 8, 26 Sep): "two books, two separate voice gens, moving
// between them". Two books on the shelf, each with its own render, paired by
// `books/<target>/align.json` ({target sentence id: [ground sentence ids]},
// align/sentences.py). Nothing here is a word alignment: the landing is the
// aligned SENTENCE's first word, and when the sentence itself was never
// paired the nearest paired sentence before it in the same chapter stands in
// (the reader's own nearestIndex rule for a follower pane), and the answer
// says so (`exact: false`).
//
// partnerOf(slug, R) -> {slug, other, alignIn} | null
//   Who the other book is, from the records alone, cheapest first:
//   1. `align.sentences.json` beside align.json (sentences.py writes it,
//      naming target and ground) -- 1 KB;
//   2. the shelf's own index: a `<a>+<b>` row (a stitched book) names both
//      halves, and whichever half holds align.json is the target;
//   3. `align-words.json`'s own `target`/`ground` (200 KB; last).
//   `alignIn` is the slug whose align.json carries the map.
async function partnerOf(slug, R) {
  if (!slug || !R || typeof R.load !== "function") return null;
  const side = await R.load(slug, "align.sentences.json");
  if (side && side.target && side.ground) {
    if (side.target === slug) return { slug, other: side.ground, alignIn: slug, via: "align.sentences.json" };
    if (side.ground === slug) return { slug, other: side.target, alignIn: side.target, via: "align.sentences.json" };
  }
  const rows = typeof R.index === "function" ? await R.index() : null;
  for (const row of rows || []) {
    const s = row && row.slug ? String(row.slug) : "";
    if (s.indexOf("+") < 0) continue;
    const halves = s.split("+");
    if (halves.length !== 2 || !halves.includes(slug)) continue;
    const other = halves[0] === slug ? halves[1] : halves[0];
    if (await R.load(slug, "align.json")) return { slug, other, alignIn: slug, via: "index.json " + s };
    if (await R.load(other, "align.json")) return { slug, other, alignIn: other, via: "index.json " + s };
  }
  const words = await R.load(slug, "align-words.json");
  if (words && words.target && words.ground) {
    if (words.target === slug) return { slug, other: words.ground, alignIn: slug, via: "align-words.json" };
    if (words.ground === slug) return { slug, other: words.target, alignIn: words.target, via: "align-words.json" };
  }
  return null;
}

// invert {a: [b...]} -> {b: [a...]}, first writer wins the order
function invertAlign(map) {
  const out = {};
  for (const k of Object.keys(map || {})) {
    for (const v of (Array.isArray(map[k]) ? map[k] : [map[k]])) {
      if (!v) continue;
      (out[v] = out[v] || []).push(k);
    }
  }
  return out;
}

// alignedIn(map, sid) -> {id, exact, via} | null
//   the sentence `sid` maps to; a miss takes the nearest key BEFORE it in
//   the same chapter (ids are zero-padded, so string order is reading
//   order), else the nearest after; null when the chapter has no key at all
function alignedIn(map, sid) {
  if (!map || !sid) return null;
  if (Array.isArray(map[sid]) && map[sid].length) return { id: map[sid][0], exact: true, via: sid };
  const cid = String(sid).split(".")[0] + ".";
  let before = null, after = null;
  for (const k of Object.keys(map)) {
    if (k.indexOf(cid) !== 0 || !Array.isArray(map[k]) || !map[k].length) continue;
    if (k < sid) { if (before === null || k > before) before = k; }
    else if (after === null || k < after) after = k;
  }
  const via = before !== null ? before : after;
  return via === null ? null : { id: map[via][0], exact: false, via };
}

// the reader's flat word numbering (reader/listen.js buildMap + book-nav.js
// buildWordDomIndex): every `p.line` split on whitespace, numbered in chapter
// order, `p.sp`/`p.dir` skipped. A block of book-data.js is one paragraph
// (`r` "l" is a line), so the count is taken here without the DOM.
function wordsOfBlock(t) { return String(t || "").split(/\s+/).filter(Boolean).length; }

// landingOf(sid, bookData, timingsOfChapter) -> {chapterId, ch, wi, note} | null
//   where the other book's cursor must sit for sentence `sid`: `ch` is the
//   chapter's index, `wi` the flat index of the sentence's first word --
//   the words of every line before its paragraph, plus the words of the
//   earlier sentences in that paragraph (from the book's timings, when it
//   has them; 0 with a note when it has not)
function landingOf(sid, data, tim) {
  const m = /^(c\d+)\.p(\d+)\.s(\d+)$/.exec(String(sid || ""));
  if (!m || !data || !Array.isArray(data.chapters)) return null;
  const cid = m[1], p = parseInt(m[2], 10), sn = parseInt(m[3], 10);
  const ch = data.chapters.findIndex((c) => c && c.id === cid);
  if (ch < 0) return null;
  const blocks = Array.isArray(data.chapters[ch].blocks) ? data.chapters[ch].blocks : [];
  if (p < 1 || p > blocks.length) return null;
  let wi = 0;
  for (let i = 0; i < p - 1; i++) if (blocks[i] && blocks[i].r === "l") wi += wordsOfBlock(blocks[i].t);
  let note = null;
  if (sn > 1) {
    const pid = cid + ".p" + m[2] + ".";
    const earlier = (tim || []).filter((s) => s && String(s.id).indexOf(pid) === 0 && parseInt(String(s.id).split(".s")[1], 10) < sn);
    if (earlier.length) wi += earlier.reduce((n, s) => n + (Array.isArray(s.words) ? s.words.length : 0), 0);
    else note = "sentence " + sn + " of its paragraph, no timings to count the earlier ones: landing on the paragraph";
  }
  return { chapterId: cid, ch, wi, note, line: blocks[p - 1] && blocks[p - 1].r === "l" };
}

// pairedBook({slug, sentenceId, wantLang}, R) -> the whole move, planned:
//   {slug, other, lang, sentenceId, exact, via, landing} | {refused}
async function pairedBook({ slug, sentenceId, wantLang }, R) {
  const pair = await partnerOf(slug, R);
  if (!pair) return { refused: "no pair" };
  const lang = typeof R.learnLang === "function" ? await R.learnLang(pair.other) : null;
  if (wantLang && lang && lang !== wantLang) return { refused: "other is " + lang, other: pair.other, lang };
  const align = await R.load(pair.alignIn, "align.json");
  if (!align) return { refused: "no align.json in " + pair.alignIn, other: pair.other, lang };
  const map = pair.alignIn === slug ? align : invertAlign(align);
  const hit = alignedIn(map, sentenceId);
  if (!hit) return { refused: "chapter unpaired", other: pair.other, lang, keys: Object.keys(map).length };
  const [data, tim] = await Promise.all([R.bookData(pair.other), R.timings(hit.id.split(".")[0], pair.other)]);
  const landing = landingOf(hit.id, data, tim);
  if (!landing) return { refused: data ? "sentence " + hit.id + " is not in " + pair.other + "'s text" : "no book-data.js for " + pair.other, other: pair.other, lang };
  return { slug, other: pair.other, lang, sentenceId: hit.id, exact: hit.exact, via: hit.via, pairVia: pair.via, landing, keys: Object.keys(map).length };
}

// ------------------------------------------------------- execute
// doors:
//   lang               the language the person asked in (answers' table)
//   bridge             the reader bridge (getPosition/seekToWord/getSpeed...)
//   position()         -> {wordId, sentenceId, chapterId, chapterIndex,
//                          chapterCount, chapterTitle, fraction, text} | null
//                       (the packet's own view of the cursor, audio or not)
//   records            {meta(), names(), grammar(), stitch(), langOf(slug)}
//                       each returning a Promise of the record or null
//   pace               {now() -> wpm|0, set(wpm) -> wpm, paces} | null
//   paragraphWords(pid)-> [{id,text}] | null   (for the switch proportion)
//   bookLangs          the languages of the book being read
//   handleUtterance    the grammar path, for a reader-aligned pair
//   pair               {open(plan) -> Promise<bool>, wait?} -- the door to
//                      the OTHER BOOK of a pair (two books, two renders):
//                      commands plans the move with pairedBook(), the door
//                      seats the other book's cursor and opens it
// Every branch returns {type:"answer", text, cmd, ...} -- the medium (spoken
// or written) is app.js's decision, never this file's.
async function execute(parsed, doors) {
  const { lang } = doors;
  const t = tableFor(lang);
  const cmd = parsed && parsed.cmd;
  const pos = doors.position ? await doors.position() : null;

  if (cmd === "slower" || cmd === "faster" || cmd === "normal") {
    const pace = doors.pace;
    if (!pace || !(pace.now() > 0)) return { type: "answer", cmd, text: t.noPace(), unavailable: ["pace"] };
    const now = pace.now();
    if (cmd === "normal") {
      const def = pace.defaultWpm || 300;
      const got = pace.set(def);
      return { type: "answer", cmd, text: t.pace(got || def), wpm: got || def };
    }
    const step = stepPace(now, cmd === "slower" ? -1 : 1, pace.paces || PACES);
    if (step.at) return { type: "answer", cmd, text: step.at === "floor" ? t.paceFloor(now) : t.paceCeiling(now), wpm: now, at: step.at };
    const got = pace.set(step.wpm);
    return { type: "answer", cmd, text: t.pace(got || step.wpm), wpm: got || step.wpm, from: now };
  }

  if (cmd === "grammar") {
    if (!pos || !pos.text) return { type: "answer", cmd, text: t.noWord() };
    const R = doors.records;
    const grammar = R ? (R.grammarAt ? await R.grammarAt(pos.wordId) : (R.grammar ? await R.grammar() : null)) : null;
    if (!grammar) return { type: "answer", cmd, text: t.grammarOff(), unavailable: ["grammar.json"] };
    const entry = grammarEntry(grammar, pos.text);
    return { type: "answer", cmd, text: formatGrammar(entry, pos.text, lang), wordId: pos.wordId, word: pos.text, found: !!entry };
  }

  if (cmd === "about") {
    const meta = doors.records && doors.records.meta ? await doors.records.meta() : null;
    const R = doors.records;
    const names = R ? (R.namesAt ? await R.namesAt() : (R.names ? await R.names() : null)) : null;
    return { type: "answer", cmd, text: formatAbout(meta, names, lang), found: !!(meta && meta.title) };
  }

  if (cmd === "where") {
    return { type: "answer", cmd, text: formatWhere(pos, lang), found: !!(pos && pos.chapterCount > 0) };
  }

  if (cmd === "switch") {
    const langs = doors.bookLangs || [];
    const want = parsed.lang || null;
    if (!pos) return { type: "answer", cmd, text: t.noPosition() };
    // a pair the reader itself aligns: the grammar's own pane ops
    const aligned = doors.bridge && typeof doors.bridge.getAlignedSentenceId === "function" && pos.sentenceId
      ? doors.bridge.getAlignedSentenceId("target", pos.sentenceId) : null;
    if (aligned && doors.handleUtterance) {
      const toRole = doors.side === "ground" ? "target" : "ground";
      const r = await doors.handleUtterance(toRole);
      const name = languageName(want || (toRole === "ground" ? doors.groundLang : doors.targetLang) || "?", lang);
      return Object.assign({ cmd, viaGrammar: toRole, text: t.switched(name) }, r, { type: "answer" });
    }
    const stitch = doors.records && doors.records.stitch ? await doors.records.stitch() : null;
    // TWO BOOKS, TWO RENDERS: a book that is not stitched but has a partner
    // on the shelf. The move is planned from the records and made by the
    // door app.js hands in (the other book's cursor, then the host). It is
    // asked BEFORE the book's own languages are consulted, because the
    // partner is another book: "English" on the Latin Eclogues names it.
    if (!stitch && doors.pair && doors.records && typeof doors.records.slugNow === "function") {
      const plan = await pairedBook({ slug: doors.records.slugNow(), sentenceId: pos.sentenceId, wantLang: want }, doors.records);
      if (plan && !plan.refused) {
        const name = languageName(plan.lang || want || "?", lang);
        let opened = false;
        try { opened = !!(await doors.pair.open(plan)); } catch (e) { opened = false; }
        if (!opened) return { type: "answer", cmd, text: t.cannotMove(name), plan, moved: false };
        return { type: "answer", cmd, text: plan.exact ? t.switched(name) : t.switchedNear(name), plan, moved: true, book: plan.other };
      }
      if (plan && plan.refused && plan.other) {
        return { type: "answer", cmd, text: t.noPair(languageName(want || plan.lang || "?", lang)), plan, moved: false };
      }
    }
    if (want && langs.length && !langs.includes(want)) return { type: "answer", cmd, text: t.noPair(languageName(want, lang)), want };
    if (!stitch) return { type: "answer", cmd, text: langs.length > 1 ? t.cannotMove(languageName(want || langs.find((l) => l !== pos.lang) || "?", lang)) : t.noOther(), unavailable: ["stitch.json"] };
    // the halves' languages, learned before langOf (a sync cache) is asked
    if (typeof doors.records.learnLang === "function") await Promise.all([stitch.a, stitch.b].filter(Boolean).map((h) => doors.records.learnLang(h)));
    const langOf = doors.records.langOf || ((slug) => null);
    const target = pairedTarget({ stitch, langOf, wordId: pos.wordId, wantLang: want, sentenceWordsOf: doors.paragraphWords });
    if (!target) {
      if (want && pos.lang === want) return { type: "answer", cmd, text: t.alreadyIn(languageName(want, lang)) };
      return { type: "answer", cmd, text: t.noPair(languageName(want || langs.find((l) => l !== pos.lang) || "?", lang)) };
    }
    const name = languageName(target.lang, lang);
    let moved = false;
    if (target.wordId && doors.bridge && typeof doors.bridge.seekToWord === "function") {
      try { moved = !!doors.bridge.seekToWord("target", target.wordId); } catch (e) { moved = false; }
    }
    if (!moved && doors.seekToParagraph) {
      try { moved = !!(await doors.seekToParagraph(target.paragraphId, target.wordId)); } catch (e) { moved = false; }
    }
    if (!moved) return { type: "answer", cmd, text: t.cannotMove(name), target, moved: false };
    return { type: "answer", cmd, text: t.switched(name), target, moved: true };
  }

  return { type: "unrecognized", text: String(parsed && parsed.cmd) };
}

  return { COMMANDS, PHRASES, LANGUAGE_NAMES, SWITCH_TO, PACES, T, parse, languageCodeOf, languageName, tableFor,
           grammarEntry, formatGrammar, formatAbout, formatWhere, castOf, stepPace, nearestStop, pairedTarget,
           partnerOf, invertAlign, alignedIn, landingOf, wordsOfBlock, pairedBook, execute, fold };
});
