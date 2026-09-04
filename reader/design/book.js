/* ===================== BOOK — one parse, for every pane ===================
   Both benches carried their own copy of this and the copies had ALREADY
   drifted: the reading page capped at 40 chapters, the collection page at
   400, and neither knew. That is the whole argument for this file.

     Book.normalise(raw, name, cap) -> {title, author, chapters, dropped,
                                        shown, total, structure}
     Book.open(file, cap) -> Promise<book>

   A chapter's blocks are {r, t, st}:  r "sp" speaker · "dir" direction ·
   "l" a line, with st the stanza it belongs to (null when the parser gives
   none, which is how prose is told from verse downstream).

   `structure` is new, thirteenth pass: whatever `raw.structure` carries
   (bookshape.py's own `structure_of`, the same tree build.py and
   build-library.py now bake into every book-data.js that has one) is
   passed straight through, UNPRUNED, on purpose -- a chapter id this cap
   or the FRONT heuristic below has just dropped can still be named inside
   it. book-nav.js is the one place that actually WALKS this tree, and it
   already has to look up every chapter id it finds there against whatever
   `chapters` this same call is returning (an id that isn't in the final
   list is exactly as absent from the tree as one that was never there),
   so pruning it twice would be the drift this file exists to prevent, not
   protection against it. A book with none gets `[]`, same as an absent
   "structure" key on the raw JSON.

   Nothing is fetched. These pages open over file://, where fetch() is
   blocked, but a book the PERSON picks is readable -- so a book arrives
   through <input type=file> or a drop, and nothing is copied into the repo. */
(function(){

/* A NUMBERED TITLE, AND ONLY THAT. The eclogues write "I.  MELIBOEUS,
   TITYRUS", so splitting on the first "." looks right -- until it turns
   Poems' "by T. S. ELIOT" into number "by T." and cast "S. eliot", and every
   untitled chapter into its id. Split ONLY when the title opens with a
   numeral. book-nav.js reuses this same regex on a structure node's own
   title ("SCENE I. Rossillon...") for the identical reason. */
const NUMBERED = /^\s*((?:[IVXLCDM]+|\d+)\s*[.)])\s*(.*)$/i;

/* FRONT MATTER IS NOT A CHAPTER. The parser gives no way to tell, so this is
   a heuristic and every bench SAYS what it dropped rather than hiding it.
   PARSER-NOTES.md asks for chapter.role, which would make this a fact. */
const FRONT = /^(contents?|table of contents|synopsis|characters?( in the play)?|dramatis personae|preface|foreword|introduction|note on the text|copyright|title page|half[- ]title|colophon|by\b.*)$/i;

function titleCaseCast(s){
  return s.split(",").map(w=>w.trim()).filter(Boolean)
          .map(w=>w.split(/\s+/).map(x=>x[0].toUpperCase()+x.slice(1).toLowerCase()).join(" "))
          .join(" · ");
}

/* ONE CAP, AND IT IS HERE. The benches used to hold their own -- 40 on the
   reading page, 400 on the collection page -- and neither knew the other
   existed. The number is not arbitrary: it existed because the reading page's
   box classifier measured every line in the book with a Range, so cost scaled
   with length. That has been fixed at the source (page.js samples now), so
   both panes can carry the same number and this is the only place to change
   it. Shakespeare's complete works is 866 chapters and still wants a cap;
   PARSER-NOTES.md asks for the structural level above chapter that would let
   it be opened a play at a time instead -- book-nav.js's own left-pane stack
   (thirteenth pass) is a first real step toward exactly that, for whichever
   books already carry `structure`. */
const CAP = 400;

function normalise(raw, name, cap){
  cap = cap || CAP;
  /* THE JOIN IS DELIBERATELY BARE. paragraph.sentences[] loses the space
     after terminal punctuation -- 575 paragraphs in hamlet, 69 in
     eclogues-en. Logged in PARSER-NOTES.md as a parser bug rather than
     patched here, because patching it here would hide it. */
  const text = p => (p.sentences||[]).map(s=>s.text||"").join("").trim();
  const dropped=[];
  const body=(raw.chapters||[]).filter(ch=>{
    const ti=(ch.title||"").trim();
    if(ti && FRONT.test(ti)){ dropped.push(ti); return false; }
    return true;
  });
  const chapters=body.slice(0,cap).map(ch=>{
    const blocks=[];
    (ch.paragraphs||[]).forEach(p=>{
      const s=text(p); if(!s) return;
      const role=p.role||"line";
      if(role==="speaker"||p.kind==="speaker") blocks.push({r:"sp",t:s.replace(/\.$/,"")});
      else if(role==="direction")               blocks.push({r:"dir",t:s});
      else                                      blocks.push({r:"l",t:s,st:p.stanza});
    });
    const ti=(ch.title||"").trim(), m=ti.match(NUMBERED);
    let n="", nm="";
    if(m){ n=m[1].trim(); nm = m[2].includes(",") ? titleCaseCast(m[2]) : m[2].trim(); }
    else if(ti){ nm=ti; }            // a plain title IS the title
    else { n=ch.id||""; }            // only then fall back to the id
    return {id:ch.id, n, t:nm, blocks};
  });
  return {title: raw.title||name, author: raw.author||"", chapters, dropped,
          shown: chapters.length, total: body.length,
          structure: raw.structure||[]};
}

function open(file, cap){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>{ try{ res(normalise(JSON.parse(r.result), file.name, cap)); }
                   catch(e){ rej(e); } };
    r.onerror=()=>rej(new Error("could not read that file"));
    r.readAsText(file);
  });
}

/* the line a bench prints beside its button, so the two say the same thing */
function summary(b, unit){
  unit = unit || "chapters";
  return (b.shown<b.total ? b.shown+" of "+b.total+" "+unit : b.total+" "+unit)
       + (b.dropped.length ? "  ·  front matter skipped: "+b.dropped.length : "");
}

window.Book = {normalise, open, summary, CAP, NUMBERED, FRONT};
})();
