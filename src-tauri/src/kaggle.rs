//! The courier -- Kaggle's five verbs, in Rust, on `pull.rs`'s `Wire`.
//!
//! 85 Stage 2. `PROMPTS/reasoning/phone-studio.md` is the map; this is its §2
//! and §7.1 built. The person who has only a phone parses a book on their own
//! Kaggle kernel, because the parser is Python and there is ONE parser (F7),
//! and a phone has no CPython.
//!
//! **RUST, NOT JS, AND THE REASON IS NOT TASTE.** The page is at a `frank://`
//! origin, and every Kaggle call from it would be a cross-origin request to a
//! host that sends no `Access-Control-Allow-Origin`. There is no flag, no
//! proxy on the phone, and no amount of `fetch` that gets around that. Rust is
//! not a page, so CORS never enters it -- the same reason `pull.rs` is here.
//!
//! **THE CLI IS NOT NEEDED AND NEITHER IS PYTHON.** `voice/remote/kaggle.py`
//! shells out to the `kaggle` CLI; the CLI is a thin wrapper over
//! `https://www.kaggle.com/api/v1` with HTTP **Basic** auth, `username:key`,
//! both out of `kaggle.json`. Five requests, and the phone has a Studio.
//!
//! **WHAT THE MAP GOT WRONG, AND THIS FILE CORRECTS.** §2 said the upload is
//! "multipart" and that `Wire` needs one new method, `put_multipart`. Read off
//! the CLI's own generated client (`kaggle_api.py`, 1.6.17), it is not
//! multipart at all -- it is a three-step handshake:
//!
//!   1. `POST /blobs/upload` with a JSON *description* of the file
//!      (`{type, name, contentLength, lastModifiedEpochSeconds}`) ->
//!      `{token, createUrl}`;
//!   2. `PUT createUrl` with the raw bytes -- a **signed storage URL**, and
//!      the CLI sends NO credential to it;
//!   3. the `token` from step 1 goes in the version's `files` list.
//!
//! So `Wire` grew three small methods instead of one large one (`get_auth`,
//! `post_json`, `put_bytes`), and the credential is never sent to the storage
//! host. That is a better fact than the one the map assumed, and it is the
//! kind of thing a map is for.
//!
//! **THE TRAPS, ALREADY PAID FOR** (`voice/remote/kaggle.py`'s comments are
//! the receipts; each is a test below):
//!
//!   * a dataset pushed but not yet `ready` mounts EMPTY -- a kernel started
//!     against it dies in under a second with "job.json not found";
//!   * **a refused kernel push exits 0** on the CLI, and answers 200 with an
//!     error sentence in the body here. The body is read, always;
//!   * `kernels status` answers for the slug's NEWEST version, which right
//!     after a push is still the previous one -- nothing is believed until the
//!     status has moved or `lastRunTime` has;
//!   * **403 is never evidence of an auth problem.** Kaggle answers 403 for a
//!     dataset that does not exist, which is what a first push looks like; so
//!     a 403 falls through to create, and only a refusal of BOTH is reported,
//!     with both possibilities named;
//!   * the log cannot be read while the kernel runs. Progress during a run is
//!     an estimate, never an observation, and nothing here pretends otherwise.
//!
//! **WHAT IS NOT PROVED HERE.** No Cowork shell reaches kaggle.com -- measured
//! in both rooms on 14 Sep, refused at the egress proxy -- so every test below
//! runs against a `Fake` that answers the shapes above. The cold start, the
//! quota cost (K-C) and a real round trip are Osca's press, and this lane
//! claims none of them.

use crate::pull::{Reply, Wire};
use std::io::Read;
use tauri::Manager;

pub const API: &str = "https://www.kaggle.com/api/v1";
/// The two kernels (K-D): a CPU one for the parse and the GPU one that already
/// exists. Two slugs, so the account's two concurrent GPU sessions can never
/// block a parse, and so the CPU kernel installs no engine.
pub const STUDIO_KERNEL: &str = "ttstv-studio";
pub const RENDER_KERNEL: &str = "ttstv-render";
/// The job dataset's slug, per user. One dataset, versioned per job.
pub const JOB_DATASET: &str = "ttstv-studio-job";

/// How long a dataset is given to reach `ready`, and how often it is asked.
/// `voice/remote/kaggle.py::wait_dataset_ready`'s own numbers.
pub const READY_TIMEOUT_MS: u64 = 300_000;
pub const READY_POLL_MS: u64 = 5_000;
/// A push that printed a version gets this long before "nothing moved" is an
/// error (`TOOK_GRACE_S`).
pub const TOOK_GRACE_MS: u64 = 600_000;

// ------------------------------------------------------------- the credential

/// A Kaggle account, as the two strings `kaggle.json` holds.
///
/// **THE KEY NEVER REACHES THE PAGE.** It is pasted once into the page, handed
/// straight to Rust, and stored by Rust; no command answers with it, no log
/// line takes it, and `Debug` is written by hand below so that a stray
/// `{:?}` -- in a panic, a trace, an error -- cannot print it. That is the one
/// rule `studio/kaggle.py::save_pasted_credentials` keeps on the Mac, kept
/// here by the type rather than by care.
#[derive(Clone, PartialEq, Eq)]
pub struct Creds {
    pub username: String,
    key: String,
}

impl std::fmt::Debug for Creds {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Creds {{ username: {:?}, key: <{} chars> }}", self.username, self.key.len())
    }
}

impl Creds {
    pub fn new(username: &str, key: &str) -> Self {
        Creds { username: username.trim().to_string(), key: key.trim().to_string() }
    }
    /// `Authorization: Basic base64(username:key)`.
    pub fn auth(&self) -> String {
        format!("Basic {}", b64(format!("{}:{}", self.username, self.key).as_bytes()))
    }
    pub fn is_empty(&self) -> bool {
        self.username.is_empty() || self.key.is_empty()
    }
    /// The `kaggle.json` this credential is stored as: `{"username":"…","key":"…"}`,
    /// one line, no pretty-printing, byte-for-byte the file Kaggle downloads
    /// and `parse_pasted` reads back.
    pub fn to_kaggle_json(&self) -> String {
        serde_json::json!({"username": self.username, "key": self.key}).to_string()
    }
}

/// Standard base64, written out rather than taken as a dependency: it is
/// fifteen lines, it is the only encoder this crate needs, and `lib.rs`'s
/// `json_field` already sets the precedent (a dependency for one string in one
/// file is a dependency to keep in step forever).
pub fn b64(input: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);
    for c in input.chunks(3) {
        let b = [c[0], *c.get(1).unwrap_or(&0), *c.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(A[(n >> 18 & 63) as usize] as char);
        out.push(A[(n >> 12 & 63) as usize] as char);
        out.push(if c.len() > 1 { A[(n >> 6 & 63) as usize] as char } else { '=' });
        out.push(if c.len() > 2 { A[(n & 63) as usize] as char } else { '=' });
    }
    out
}

/// One paste of a whole `kaggle.json` -> the two fields, or a sentence.
///
/// A PORT, line for line, of `studio/kaggle.py::parse_pasted_credentials`, and
/// the sentences are the same sentences -- a person looking at a refusal on
/// the phone and the same refusal on the Mac should not be reading two
/// different apps. Tolerant in ONE direction only: a paste picks up whatever
/// was around it (a leading newline, a stray prompt line), so the object is
/// found between the FIRST `{` and the LAST `}` rather than the blob being
/// required to be exactly a JSON document. It is not tolerant about the object
/// itself.
///
/// **No refusal quotes the paste**, on either side.
pub fn parse_pasted(blob: &str) -> Result<Creds, String> {
    const PASTE_MAX: usize = 8192;
    if blob.trim().is_empty() {
        return Err("nothing was pasted".into());
    }
    if blob.len() > PASTE_MAX {
        return Err("that is much bigger than a kaggle.json — paste just the file, \
                    or choose it from Files".into());
    }
    let (start, end) = (blob.find('{'), blob.rfind('}'));
    let (start, end) = match (start, end) {
        (Some(a), Some(b)) if b > a => (a, b),
        _ => return Err("that does not look like a kaggle.json — it should start \
                         with a { and end with a }".into()),
    };
    let v: serde_json::Value = serde_json::from_str(&blob[start..=end])
        .map_err(|_| "that is not readable as JSON — paste the whole kaggle.json \
                      exactly as it was downloaded".to_string())?;
    let user = v.get("username").and_then(|x| x.as_str()).unwrap_or("").trim();
    let key = v.get("key").and_then(|x| x.as_str()).unwrap_or("").trim();
    if user.is_empty() {
        return Err("there is no username in that file".into());
    }
    if key.is_empty() {
        return Err("there is nothing beside `username` in that file — \
                    download a fresh one from Kaggle".into());
    }
    Ok(Creds::new(user, key))
}

// ------------------------------------------------------------------ answers

/// What a verb answers when Kaggle said something this file understands.
#[derive(Debug, Clone, PartialEq)]
pub enum Refusal {
    /// Kaggle would not authenticate. The only refusal that means "the key is
    /// wrong" -- and 403 is NOT one of these.
    Auth(String),
    /// A 403, which Kaggle uses for BOTH "no such dataset" and "not your
    /// account". Never treated as either on its own.
    Ambiguous(String),
    /// Kaggle answered, and said no in words.
    Said(String),
    /// Nothing answered: DNS, a reset, a timeout, aeroplane mode.
    Lost(String),
}

impl Refusal {
    /// The one sentence a person can act on.
    pub fn sentence(&self) -> String {
        match self {
            Refusal::Auth(_) => "Kaggle would not accept that username and key — \
                                 download a fresh kaggle.json from your account page."
                .to_string(),
            Refusal::Ambiguous(_) => "Kaggle answered 403, which it uses for both \
                                      “no such thing” and “not your account”."
                .to_string(),
            Refusal::Said(m) => m.clone(),
            Refusal::Lost(_) => "Kaggle could not be reached.".to_string(),
        }
    }
}

/// 401 is the auth refusal and **403 is not** -- `_AMBIGUOUS_MARKERS`, and the
/// live bug it was written for: `_AUTH_MARKERS` once listed 403, so `push` gave
/// up before reaching `create` and no first push of any new dataset could
/// succeed (fixed in `bfa1e46`, 29 Aug). A bare `401` in a body is not one
/// either -- a 401 KB file prints `401k` in a progress bar.
pub fn refusal_for(code: u16, body: &str) -> Refusal {
    match code {
        401 => Refusal::Auth(body.to_string()),
        403 => Refusal::Ambiguous(body.to_string()),
        _ => Refusal::Said(if body.trim().is_empty() {
            format!("Kaggle answered {code}")
        } else {
            body.chars().take(400).collect()
        }),
    }
}

fn body_of(reply: Reply) -> Result<String, Refusal> {
    match reply {
        Reply::Body(mut r) => {
            let mut s = String::new();
            r.read_to_string(&mut s).map_err(|e| Refusal::Lost(e.to_string()))?;
            Ok(s)
        }
        Reply::Refused(code, text) => Err(refusal_for(code, &text)),
        Reply::Lost(why) => Err(Refusal::Lost(why)),
    }
}

/// `Kernel push error: <message>` anywhere in a body. **A refused push is not
/// a non-2xx** -- the CLI exits 0 on one, and this is the line that catches it.
pub fn push_refusal(body: &str) -> Option<String> {
    let i = body.find("Kernel push error:")?;
    let rest = &body[i + "Kernel push error:".len()..];
    let msg = rest.lines().next().unwrap_or("").trim();
    Some(if msg.is_empty() { "(no message)".into() } else { msg.to_string() })
}

/// The one refusal that means "wait": the account's two GPU sessions are both
/// held. A parse should never see it -- `ttstv-studio` asks for no GPU -- and
/// that is exactly why K-D is two kernels and not one.
pub fn is_slot_busy(msg: &str) -> bool {
    msg.to_lowercase().contains("gpu session count")
}

// -------------------------------------------------------------- the courier

/// One file on its way up.
pub struct Upload<'a> {
    pub name: &'a str,
    pub bytes: &'a [u8],
}

pub struct Courier {
    pub creds: Creds,
}

impl Courier {
    pub fn new(creds: Creds) -> Self {
        Courier { creds }
    }

    fn auth(&self) -> String {
        self.creds.auth()
    }

    // --- verb 1: put the job up -------------------------------------------

    /// One file up, in the three steps §2's note describes. Answers the token
    /// the version's `files` list wants.
    fn upload_one(&self, w: &mut dyn Wire, up: &Upload) -> Result<String, Refusal> {
        let body = serde_json::json!({
            "type": "dataset",
            "name": up.name,
            "contentLength": up.bytes.len(),
            "lastModifiedEpochSeconds": (w.now() / 1000) as i64,
        })
        .to_string();
        let (code, text) = w
            .post_json(&format!("{API}/blobs/upload"), Some(&self.auth()), &body)
            .map_err(Refusal::Lost)?;
        if !(200..300).contains(&code) {
            return Err(refusal_for(code, &text));
        }
        let v: serde_json::Value =
            serde_json::from_str(&text).map_err(|e| Refusal::Said(e.to_string()))?;
        let token = v.get("token").and_then(|x| x.as_str()).unwrap_or("").to_string();
        let create_url = v.get("createUrl").and_then(|x| x.as_str()).unwrap_or("");
        if token.is_empty() || create_url.is_empty() {
            return Err(Refusal::Said(
                "Kaggle took the upload request but named no token or URL".into(),
            ));
        }
        // NO CREDENTIAL ON THIS ONE. `createUrl` is signed; the CLI sends none
        // either, and a key sent to a storage host that did not ask for it is
        // how a credential leaves an app by accident.
        let (code, text) = w.put_bytes(create_url, up.bytes).map_err(Refusal::Lost)?;
        if !(200..300).contains(&code) {
            return Err(refusal_for(code, &text));
        }
        Ok(token)
    }

    /// **Verb 1.** The whole flat job up, as a new version of
    /// `<user>/ttstv-studio-job`, creating the dataset on a first push.
    ///
    /// The order is `version` then `create`, and not "ask whether it exists":
    /// the status of a dataset that does not exist is reported inconsistently,
    /// and a failed `version` is cheap. A 403 on the first attempt is what a
    /// first push LOOKS like and never stops the create.
    ///
    /// Every name here must be FLAT. Nothing in this function can enforce
    /// that -- the dataset API takes names, not paths -- so
    /// `voice/remote/studio_pack.py` is where the rule lives and
    /// `flat_names_only` below is the guard on this side.
    pub fn put_job(
        &self,
        w: &mut dyn Wire,
        slug: &str,
        files: &[Upload],
        notes: &str,
    ) -> Result<(), Refusal> {
        flat_names_only(files)?;
        let mut tokens = Vec::with_capacity(files.len());
        for f in files {
            tokens.push(self.upload_one(w, f)?);
        }
        let file_rows: Vec<serde_json::Value> =
            tokens.iter().map(|t| serde_json::json!({ "token": t })).collect();
        let user = &self.creds.username;

        let version = serde_json::json!({
            "versionNotes": notes,
            "files": file_rows,
            "convertToCsv": false,
            "deleteOldVersions": false,
        })
        .to_string();
        let (code, text) = w
            .post_json(
                &format!("{API}/datasets/create/version/{user}/{slug}"),
                Some(&self.auth()),
                &version,
            )
            .map_err(Refusal::Lost)?;
        if (200..300).contains(&code) && !text.contains("\"error\"") {
            return Ok(());
        }
        let first = refusal_for(code, &text);
        if let Refusal::Auth(_) = first {
            // An auth refusal is not a missing dataset. Falling through to
            // `create` on one prints "creating it", fails again for the same
            // reason, and reports the second failure -- which reads as "Kaggle
            // would not take the upload" when what happened is that the key is
            // wrong (session B, 29 Aug).
            return Err(first);
        }

        let new = serde_json::json!({
            "title": "TTS TV studio job",
            "slug": slug,
            "ownerSlug": user,
            "licenseName": "other",
            "isPrivate": true,               // and `--public` is passed nowhere
            "convertToCsv": false,
            "files": file_rows,
        })
        .to_string();
        let (code2, text2) = w
            .post_json(&format!("{API}/datasets/create/new"), Some(&self.auth()), &new)
            .map_err(Refusal::Lost)?;
        if (200..300).contains(&code2) && !text2.contains("\"error\"") {
            return Ok(());
        }
        let second = refusal_for(code2, &text2);
        match (&first, &second) {
            (Refusal::Ambiguous(_), Refusal::Ambiguous(_)) => Err(Refusal::Ambiguous(
                "both the version and the create were answered 403".into(),
            )),
            _ => Err(second),
        }
    }

    // --- verb 2: wait for it ----------------------------------------------

    /// **Verb 2.** Poll `datasets status` until `ready`.
    ///
    /// NOT OPTIONAL, and the receipt is two dead Phase B runs on 28 Aug:
    /// `create`/`version` answer as soon as the upload lands, but Kaggle
    /// processes a private dataset asynchronously, and a kernel started before
    /// `ready` finds `/kaggle/input/<slug>` **empty** -- while `datasets files`
    /// already shows the upload. Anything that is not the word `ready`,
    /// including a 403 on a dataset still processing, counts as not ready.
    pub fn wait_ready(&self, w: &mut dyn Wire, slug: &str) -> Result<(), Refusal> {
        let user = &self.creds.username;
        let url = format!("{API}/datasets/status/{user}/{slug}");
        let started = w.now();
        loop {
            if let Ok(text) = body_of(w.get_auth(&url, Some(&self.auth()))) {
                if text.to_lowercase().contains("ready") {
                    return Ok(());
                }
            }
            if w.now().saturating_sub(started) >= READY_TIMEOUT_MS {
                return Err(Refusal::Said(format!(
                    "{slug} did not become ready within {}s — check it on kaggle.com",
                    READY_TIMEOUT_MS / 1000
                )));
            }
            w.wait(READY_POLL_MS);
        }
    }

    // --- verb 3: push the kernel ------------------------------------------

    /// **Verb 3.** The script and its metadata up.
    ///
    /// `enable_gpu` is a parameter with no default: `ttstv-studio` is a CPU
    /// kernel and `ttstv-render` is not, and a kernel that got a GPU it did not
    /// ask for costs the person a slot out of two and hours out of thirty.
    ///
    /// **THE BODY IS READ EVEN ON A 200.** A refused push is a 200 with
    /// `Kernel push error: …` in it -- the CLI's own exit code is 0 on one.
    pub fn push_kernel(
        &self,
        w: &mut dyn Wire,
        slug: &str,
        script: &str,
        dataset_sources: &[String],
        enable_gpu: bool,
    ) -> Result<u32, Refusal> {
        let user = &self.creds.username;
        let body = serde_json::json!({
            "id": format!("{user}/{slug}"),
            "slug": slug,
            "newTitle": slug,
            "text": script,
            "language": "python",
            "kernelType": "script",
            "isPrivate": true,
            "enableGpu": enable_gpu,
            "enableTpu": false,
            "enableInternet": true,          // pip, and nothing else: K-B has
                                             // the phone fetch the source
            "datasetDataSources": dataset_sources,
            "competitionDataSources": [],
            "kernelDataSources": [],
        })
        .to_string();
        let (code, text) = w
            .post_json(&format!("{API}/kernels/push"), Some(&self.auth()), &body)
            .map_err(Refusal::Lost)?;
        if !(200..300).contains(&code) {
            return Err(refusal_for(code, &text));
        }
        if let Some(why) = push_refusal(&text) {
            return Err(Refusal::Said(why));
        }
        let v: serde_json::Value = serde_json::from_str(&text).unwrap_or(serde_json::Value::Null);
        if let Some(e) = v.get("error").and_then(|x| x.as_str()) {
            if !e.trim().is_empty() {
                return Err(Refusal::Said(e.to_string()));
            }
        }
        Ok(v.get("versionNumber").and_then(|x| x.as_u64()).unwrap_or(0) as u32)
    }

    // --- verb 4: watch it --------------------------------------------------

    /// **Verb 4.** The slug's newest version's status word, lowercased
    /// (`complete`, `running`, `queued`, `error`, …).
    ///
    /// The trap this cannot fix and the caller must know: **it answers for the
    /// NEWEST version**, which right after a push is still the previous one. A
    /// push is not believed to have taken until the word has MOVED. `Watch`
    /// below is that rule, written down once.
    pub fn status(&self, w: &mut dyn Wire, slug: &str) -> Result<String, Refusal> {
        let user = &self.creds.username;
        let url = format!("{API}/kernels/status?userName={user}&kernelSlug={slug}");
        let text = body_of(w.get_auth(&url, Some(&self.auth())))?;
        let v: serde_json::Value =
            serde_json::from_str(&text).map_err(|e| Refusal::Said(e.to_string()))?;
        let raw = v.get("status").and_then(|x| x.as_str()).unwrap_or("");
        Ok(status_word(raw))
    }

    // --- verb 5: bring it home --------------------------------------------

    /// **Verb 5.** Every output file's name and its (already signed) URL, and
    /// the log -- which is `None` while the kernel runs, because Kaggle does
    /// not serve it then. **That is why there is no live progress anywhere in
    /// this app**: a card that moves during a run is showing an estimate, and
    /// says so.
    pub fn output(&self, w: &mut dyn Wire, slug: &str) -> Result<Output, Refusal> {
        let user = &self.creds.username;
        let url = format!("{API}/kernels/output?userName={user}&kernelSlug={slug}");
        let text = body_of(w.get_auth(&url, Some(&self.auth())))?;
        let v: serde_json::Value =
            serde_json::from_str(&text).map_err(|e| Refusal::Said(e.to_string()))?;
        let files = v
            .get("files")
            .and_then(|x| x.as_array())
            .map(|rows| {
                rows.iter()
                    .filter_map(|r| {
                        Some(OutFile {
                            name: r.get("fileName")?.as_str()?.to_string(),
                            url: r.get("url")?.as_str()?.to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        let log = v
            .get("log")
            .and_then(|x| x.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());
        Ok(Output { files, log })
    }

    /// One output file's bytes. Its URL is signed, so no credential goes with
    /// it -- the same rule as the upload's PUT, for the same reason.
    pub fn fetch(&self, w: &mut dyn Wire, file: &OutFile) -> Result<Vec<u8>, Refusal> {
        match w.get(&file.url, None) {
            Reply::Body(mut r) => {
                let mut out = Vec::new();
                r.read_to_end(&mut out).map_err(|e| Refusal::Lost(e.to_string()))?;
                Ok(out)
            }
            Reply::Refused(code, text) => Err(refusal_for(code, &text)),
            Reply::Lost(why) => Err(Refusal::Lost(why)),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct OutFile {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Output {
    pub files: Vec<OutFile>,
    pub log: Option<String>,
}

/// `"KernelWorkerStatus.COMPLETE"` -> `"complete"`. The CLI prints the same
/// thing inside a sentence and `voice/remote/kaggle.py::parse_status` takes
/// the same last segment.
pub fn status_word(raw: &str) -> String {
    raw.trim().to_lowercase().rsplit('.').next().unwrap_or("").to_string()
}

/// A name with a separator in it means the packer nested something, and a
/// nested push versions its metadata and nothing else, **silently**
/// (`[[kaggle-dataset-shape]]`, one whole session). Refuse before the upload
/// rather than after it: this is the same guard `studio_pack.flat_name` is,
/// on the side that does the sending.
fn flat_names_only(files: &[Upload]) -> Result<(), Refusal> {
    for f in files {
        if f.name.contains('/') || f.name.contains('\\') || f.name.starts_with('.')
            || f.name.is_empty()
        {
            return Err(Refusal::Said(format!(
                "{:?} is not a flat name — a folder uploads as nothing at all",
                f.name
            )));
        }
    }
    Ok(())
}

// ------------------------------------------------------------------ the watch

/// What the works pane is told, and the whole of what can honestly be said
/// while a kernel runs.
#[derive(Debug, Clone, PartialEq)]
pub enum Stage {
    /// Uploading the job.
    Packing,
    /// Uploaded; Kaggle is still processing it. `wait_ready`'s window.
    Settling,
    /// Pushed, and the status has not moved off the previous version yet.
    Pushed,
    /// Kaggle says this word.
    Running(String),
    /// A word Kaggle uses for a finished run.
    Done(String),
    Failed(String),
}

impl Stage {
    /// The shelf's line, from the first second. K-E's answer is that the book
    /// shows greyed with the stage NAMED -- a 4-to-8-minute wait that says
    /// nothing reads as a hang, and a hang is what people close the app on.
    pub fn line(&self) -> String {
        match self {
            Stage::Packing => "sending the book to your Kaggle account…".into(),
            Stage::Settling => "Kaggle is unpacking the job…".into(),
            Stage::Pushed => "queued on Kaggle…".into(),
            Stage::Running(w) => format!("parsing on Kaggle ({w})…"),
            Stage::Done(_) => "parsed".into(),
            Stage::Failed(why) => why.clone(),
        }
    }
    pub fn settled(&self) -> bool {
        matches!(self, Stage::Done(_) | Stage::Failed(_))
    }
}

/// The words Kaggle ends on.
pub fn is_final(word: &str) -> bool {
    matches!(word, "complete" | "error" | "cancelacknowledged" | "cancelrequested")
}

/// The push-is-not-believed rule, written down once.
///
/// `status` answers for the newest version, so right after a push it is still
/// the PREVIOUS run's word -- and a watcher that trusts it reports a finished
/// parse that has not started. So: remember the word seen BEFORE the push, and
/// treat nothing as this run until the word has moved off it, or the grace has
/// run out (and then say so, rather than guessing).
pub struct Watch {
    pub before: Option<String>,
    pub pushed_at: u64,
    pub moved: bool,
}

impl Watch {
    pub fn new(before: Option<String>, pushed_at: u64) -> Self {
        Watch { before, pushed_at, moved: false }
    }

    pub fn saw(&mut self, word: &str, now: u64) -> Stage {
        if !self.moved {
            if Some(word) != self.before.as_deref() {
                self.moved = true;
            } else if now.saturating_sub(self.pushed_at) >= TOOK_GRACE_MS {
                return Stage::Failed(
                    "Kaggle never started this job — open the kernel on kaggle.com".into(),
                );
            } else {
                return Stage::Pushed;
            }
        }
        match word {
            "complete" => Stage::Done(word.into()),
            w if is_final(w) => Stage::Failed(format!("Kaggle ended the run: {w}")),
            w => Stage::Running(w.into()),
        }
    }
}

// ---------------------------------------------------------- the commands
//
// W2 PHONE-STUDIO (23 Sep). Thin wrappers: read the credential, build
// `pull::Net::new()`, call the existing verb, and map `Refusal` into a
// serialisable `KaggleFault`. **No verb logic is rewritten** -- this
// section is the surface (the window's IPC), and nothing here decides
// anything the verb has not already decided.

/// What every command in this section answers with when Kaggle said no.
/// Serialisable because Tauri's `Err` payload crosses the IPC boundary as JSON.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct KaggleFault {
    /// "auth" | "ambiguous" | "said" | "lost" | "no-key"
    pub kind: String,
    /// `Refusal::sentence()` (the words a person can act on), or, for
    /// "no-key", the fixed sentence in §6.5. NEVER a credential.
    pub why: String,
}

impl From<Refusal> for KaggleFault {
    fn from(r: Refusal) -> Self {
        let kind = match &r {
            Refusal::Auth(_) => "auth",
            Refusal::Ambiguous(_) => "ambiguous",
            Refusal::Said(_) => "said",
            Refusal::Lost(_) => "lost",
        };
        KaggleFault { kind: kind.to_string(), why: r.sentence() }
    }
}

impl KaggleFault {
    pub fn no_key() -> Self {
        KaggleFault {
            kind: "no-key".to_string(),
            why: "no Kaggle key on this phone \u{2014} paste your kaggle.json in Settings \u{25B8} Kaggle"
                .to_string(),
        }
    }
}

/// One file of the flat job, bound for the dataset. `b64` is standard base64
/// WITH padding, this file's own alphabet (`kaggle.rs:118-130`), because
/// Tauri's JSON IPC carries strings and not bytes.
#[derive(Debug, Clone, PartialEq, serde::Deserialize)]
pub struct KaggleFile {
    pub name: String,
    pub b64: String,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct KaggleOutFile {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Default, serde::Serialize)]
pub struct KaggleOutput {
    pub files: Vec<KaggleOutFile>,
    pub log: Option<String>,
}

/// The key store's answer. NO KEY, NO MASK OF THE KEY, no length.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct KaggleKeyState {
    pub present: bool,
    pub username: Option<String>,
}

/// Standard base64 back to bytes. Fifteen lines, the mirror of `b64`, for
/// `b64`'s own reason: a dependency for one string in one file is a
/// dependency to keep in step forever. `Err` names the position, never the
/// content.
pub fn unb64(s: &str) -> Result<Vec<u8>, String> {
    fn val(c: u8) -> Result<u8, String> {
        match c {
            b'A'..=b'Z' => Ok(c - b'A'),
            b'a'..=b'z' => Ok(c - b'a' + 26),
            b'0'..=b'9' => Ok(c - b'0' + 52),
            b'+' => Ok(62),
            b'/' => Ok(63),
            _ => Err(format!("not base64 at byte {c}")),
        }
    }
    let s = s.trim();
    if s.is_empty() {
        return Ok(vec![]);
    }
    if s.len() % 4 != 0 {
        return Err(format!("length {} is not a multiple of 4", s.len()));
    }
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(s.len() / 4 * 3);
    for chunk in bytes.chunks(4) {
        let pad = (chunk[2] == b'=') as usize + (chunk[3] == b'=') as usize;
        let a = val(chunk[0])?;
        let b = val(chunk[1])?;
        let c = if pad >= 2 { 0 } else { val(chunk[2])? };
        let d = if pad >= 1 { 0 } else { val(chunk[3])? };
        let n = ((a as u32) << 18) | ((b as u32) << 12) | ((c as u32) << 6) | d as u32;
        out.push((n >> 16) as u8);
        if pad < 2 {
            out.push((n >> 8) as u8);
        }
        if pad < 1 {
            out.push(n as u8);
        }
    }
    Ok(out)
}

// ------------------------------------------------------------ the key store
//
// D4(d): a 0600 file in `app_data_dir()`, written only by Rust. The key
// is pasted once into the page, handed straight to Rust, and stored by
// Rust; no command answers with it, no log line takes it, and nothing here
// prints it. The one place the person's Kaggle account is kept on this
// phone.

pub const KAGGLE_KEY_FILE: &str = "kaggle.json";

/// The one place the user's Kaggle account is kept on this phone.
pub fn kaggle_key_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> std::path::PathBuf {
    app.path().app_data_dir().expect("no app data dir").join(KAGGLE_KEY_FILE)
}

/// Read the key. `None` when the file is absent OR unreadable-as-a-kaggle.json
/// -- the two are one answer to a caller, and `kaggle_key_set` is the fix for
/// both. Never panics, never logs the contents.
pub fn kaggle_key_read<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Option<Creds> {
    let text = std::fs::read_to_string(kaggle_key_path(app)).ok()?;
    parse_pasted(&text).ok()
}

/// Write it, 0600, atomically. `Err` is a sentence about the FILE, never its
/// contents and never the key.
pub fn kaggle_key_write<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    c: &Creds,
) -> Result<(), String> {
    use std::fs;
    #[cfg(unix)]
    use std::os::unix::fs::OpenOptionsExt;
    let path = kaggle_key_path(app);
    let dir = path.parent().ok_or("no parent dir for kaggle.json")?;
    fs::create_dir_all(dir).map_err(|e| format!("could not create {}: {e}", dir.display()))?;
    let part = path.with_extension("json.part");
    let content = c.to_kaggle_json();
    {
        let mut opts = fs::OpenOptions::new();
        opts.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            opts.mode(0o600);
        }
        let mut f = opts
            .open(&part)
            .map_err(|e| format!("could not write {}: {e}", part.display()))?;
        use std::io::Write;
        f.write_all(content.as_bytes())
            .map_err(|e| format!("could not write {}: {e}", part.display()))?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&part, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("could not set permissions on {}: {e}", part.display()))?;
    }
    fs::rename(&part, &path)
        .map_err(|e| format!("could not rename {} to {}: {e}", part.display(), path.display()))?;
    Ok(())
}

/// Take it off this phone. `Ok(false)` when there was none.
pub fn kaggle_key_drop<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<bool, String> {
    let path = kaggle_key_path(app);
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(format!("could not remove {}: {e}", path.display())),
    }
}

#[tauri::command]
pub fn kaggle_key_set<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    pasted: String,
) -> Result<KaggleKeyState, String> {
    let c = parse_pasted(&pasted)?;
    kaggle_key_write(&app, &c)?;
    Ok(KaggleKeyState { present: true, username: Some(c.username) })
}

#[tauri::command]
pub fn kaggle_key_state<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<KaggleKeyState, String> {
    match kaggle_key_read(&app) {
        Some(c) => Ok(KaggleKeyState { present: true, username: Some(c.username) }),
        None => Ok(KaggleKeyState { present: false, username: None }),
    }
}

// -------------------------------------------------------- the six verb commands

/// Verb 1. The whole flat job up, as a new version of `<user>/ttstv-studio-job`.
#[tauri::command]
pub fn put_job<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    slug: String,
    notes: String,
    files: Vec<KaggleFile>,
) -> Result<(), KaggleFault> {
    let creds = kaggle_key_read(&app).ok_or_else(KaggleFault::no_key)?;
    let decoded: Vec<(String, Vec<u8>)> = files
        .iter()
        .map(|f| {
            unb64(&f.b64)
                .map(|bytes| (f.name.clone(), bytes))
                .map_err(|e| KaggleFault {
                    kind: "said".to_string(),
                    why: format!("{}: {e}", f.name),
                })
        })
        .collect::<Result<_, _>>()?;
    let ups: Vec<Upload> = decoded
        .iter()
        .map(|(n, b)| Upload { name: n, bytes: b })
        .collect();
    let mut w = crate::pull::Net::new();
    Courier::new(creds)
        .put_job(&mut w, &slug, &ups, &notes)
        .map_err(KaggleFault::from)
}

/// Verb 2. Poll `datasets status` until `ready`. Blocks up to
/// `READY_TIMEOUT_MS` (300 s) and sleeps `READY_POLL_MS` (5 s) between asks.
#[tauri::command]
pub fn wait_ready<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    slug: String,
) -> Result<(), KaggleFault> {
    let creds = kaggle_key_read(&app).ok_or_else(KaggleFault::no_key)?;
    let mut w = crate::pull::Net::new();
    Courier::new(creds)
        .wait_ready(&mut w, &slug)
        .map_err(KaggleFault::from)
}

/// Verb 3. The kernel script and its metadata up. Answers the version number.
/// `datasets` are `owner/slug` strings; `gpu` is explicit for the reason
/// `kaggle.rs:424-429` gives (the parse kernel is CPU: pass `false`).
#[tauri::command]
pub fn push_kernel<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    slug: String,
    script: String,
    datasets: Vec<String>,
    gpu: bool,
) -> Result<u32, KaggleFault> {
    let creds = kaggle_key_read(&app).ok_or_else(KaggleFault::no_key)?;
    let mut w = crate::pull::Net::new();
    Courier::new(creds)
        .push_kernel(&mut w, &slug, &script, &datasets, gpu)
        .map_err(KaggleFault::from)
}

/// Verb 4. The slug's newest version's status word, lowercased.
#[tauri::command]
pub fn status<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    slug: String,
) -> Result<String, KaggleFault> {
    let creds = kaggle_key_read(&app).ok_or_else(KaggleFault::no_key)?;
    let mut w = crate::pull::Net::new();
    Courier::new(creds)
        .status(&mut w, &slug)
        .map_err(KaggleFault::from)
}

/// Verb 5. Every output file's name and its signed URL, and the log
/// (`None` while the kernel runs — Kaggle does not serve it then).
#[tauri::command]
pub fn output<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    slug: String,
) -> Result<KaggleOutput, KaggleFault> {
    let creds = kaggle_key_read(&app).ok_or_else(KaggleFault::no_key)?;
    let mut w = crate::pull::Net::new();
    let out = Courier::new(creds)
        .output(&mut w, &slug)
        .map_err(KaggleFault::from)?;
    Ok(KaggleOutput {
        files: out
            .files
            .into_iter()
            .map(|f| KaggleOutFile { name: f.name, url: f.url })
            .collect(),
        log: out.log,
    })
}

/// Verb 5b (W2-D1). One output file's BYTES, through the app — the storage
/// host sends no `Access-Control-Allow-Origin`, so a `frank://` page cannot
/// fetch the signed URL itself. Returns a RAW IPC body, not base64.
#[tauri::command]
pub fn fetch<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    url: String,
) -> Result<tauri::ipc::Response, KaggleFault> {
    let creds = kaggle_key_read(&app).ok_or_else(KaggleFault::no_key)?;
    let mut w = crate::pull::Net::new();
    let file = OutFile { name: String::new(), url };
    let bytes = Courier::new(creds)
        .fetch(&mut w, &file)
        .map_err(KaggleFault::from)?;
    Ok(tauri::ipc::Response::new(bytes))
}

// --------------------------------------------------------- the kernel script
//
// 85 Stage 2, §2. The Python script the phone pushes to Kaggle as
// `ttstv-studio`'s kernel. It is the SAME file as `voice/remote/
// kaggle_studio.py` in the main TTSTV repo -- `include_str!` embeds it in
// the binary at compile time. The phone never runs Python; it pushes this
// text to Kaggle's `kernels push` endpoint, and Kaggle runs it.

/// The `ttstv-studio` kernel script, embedded at compile time.
pub const STUDIO_KERNEL_SCRIPT: &str = include_str!("../kaggle_studio.py");

// --------------------------------------------------------- the tests

#[cfg(test)]
mod kaggle_tests {
    use super::*;
    use std::collections::HashMap;

    /// The network as Kaggle behaves, including the four behaviours no
    /// session has ever watched it perform and one it has (403 on a first
    /// push). Every answer is a shape read off the CLI's own generated
    /// client, not invented here.
    struct Fake {
        json: Vec<(String, String)>,     // (url, body) posted
        puts: Vec<(String, usize)>,      // (url, bytes)
        gets: Vec<String>,
        answers: HashMap<String, (u16, String)>,
        ready_after: usize,
        ready_asked: usize,
        clock: u64,
        slept: u64,
    }

    impl Fake {
        fn new() -> Self {
            Fake {
                json: vec![], puts: vec![], gets: vec![], answers: HashMap::new(),
                ready_after: 0, ready_asked: 0, clock: 1_700_000_000_000, slept: 0,
            }
        }
        fn answer(mut self, url: &str, code: u16, body: &str) -> Self {
            self.answers.insert(url.to_string(), (code, body.to_string()));
            self
        }
    }

    impl Wire for Fake {
        fn get(&mut self, url: &str, _bearer: Option<&str>) -> Reply {
            self.gets.push(format!("GET {url}"));
            match self.answers.get(url) {
                Some((c, b)) if (200..300).contains(c) => {
                    Reply::Body(Box::new(std::io::Cursor::new(b.clone().into_bytes())))
                }
                Some((c, b)) => Reply::Refused(*c, b.clone()),
                None => Reply::Refused(404, "{}".into()),
            }
        }
        fn get_auth(&mut self, url: &str, auth: Option<&str>) -> Reply {
            self.gets.push(format!("GET {url} {}", auth.unwrap_or("-")));
            if url.contains("/datasets/status/") {
                self.ready_asked += 1;
                let body = if self.ready_asked > self.ready_after {
                    r#"{"status":"ready"}"#
                } else {
                    r#"{"status":"processing"}"#
                };
                return Reply::Body(Box::new(std::io::Cursor::new(body.as_bytes().to_vec())));
            }
            match self.answers.get(url) {
                Some((c, b)) if (200..300).contains(c) => {
                    Reply::Body(Box::new(std::io::Cursor::new(b.clone().into_bytes())))
                }
                Some((c, b)) => Reply::Refused(*c, b.clone()),
                None => Reply::Refused(404, "{}".into()),
            }
        }
        fn post_json(&mut self, url: &str, auth: Option<&str>, body: &str) -> Result<(u16, String), String> {
            self.json.push((format!("{url} {}", auth.unwrap_or("-")), body.to_string()));
            if url.ends_with("/blobs/upload") {
                let n = self.json.len();
                return Ok((200, format!(
                    r#"{{"token":"tok-{n}","createUrl":"https://storage.example/put/{n}"}}"#)));
            }
            Ok(self.answers.get(url).cloned().unwrap_or((200, "{}".into())))
        }
        fn put_bytes(&mut self, url: &str, bytes: &[u8]) -> Result<(u16, String), String> {
            self.puts.push((url.to_string(), bytes.len()));
            Ok((200, String::new()))
        }
        fn post_form(&mut self, _u: &str, _f: &[(&str, &str)]) -> Result<(u16, String), String> {
            unreachable!("the courier posts JSON, never a form")
        }
        fn now(&self) -> u64 { self.clock }
        fn wait(&mut self, ms: u64) { self.slept += ms; self.clock += ms; }
    }

    fn creds() -> Creds { Creds::new("osca", "k3y") }

    // ---------------------------------------------------------- the credential

    #[test]
    fn basic_is_base64_of_user_colon_key_and_the_key_never_prints() {
        assert_eq!(b64(b""), "");
        assert_eq!(b64(b"f"), "Zg==");
        assert_eq!(b64(b"fo"), "Zm8=");
        assert_eq!(b64(b"foo"), "Zm9v");
        assert_eq!(b64(b"foob"), "Zm9vYg==");
        assert_eq!(b64(b"osca:k3y"), "b3NjYTprM3k=");
        assert_eq!(creds().auth(), "Basic b3NjYTprM3k=");
        // The one rule the type keeps: a stray `{:?}` cannot leak it.
        let shown = format!("{:?}", creds());
        assert!(shown.contains("osca") && !shown.contains("k3y"), "{shown}");
    }

    #[test]
    fn a_pasted_kaggle_json_is_read_the_way_the_mac_reads_one() {
        let c = parse_pasted("\n$ cat kaggle.json\n{\"username\":\"osca\",\"key\":\"k3y\"}\n")
            .expect("tolerant of what a paste picks up");
        assert_eq!((c.username.as_str(), c.auth().as_str()), ("osca", "Basic b3NjYTprM3k="));
        // ...and not tolerant about the object itself.
        for (blob, want) in [
            ("", "nothing was pasted"),
            ("   ", "nothing was pasted"),
            ("kaggle.json", "does not look like"),
            ("{not json}", "not readable as JSON"),
            (r#"{"key":"k"}"#, "no username"),
            (r#"{"username":"osca"}"#, "nothing beside"),
            (r#"{"username":"  ","key":"k"}"#, "no username"),
        ] {
            let e = parse_pasted(blob).unwrap_err();
            assert!(e.contains(want), "{blob:?} -> {e}");
            assert!(!e.contains("k3y"), "no refusal quotes the paste");
        }
        let big = format!("{{\"username\":\"o\",\"key\":\"{}\"}}", "x".repeat(9000));
        assert!(parse_pasted(&big).unwrap_err().contains("much bigger"));
    }

    // ------------------------------------------------------------- verb 1

    #[test]
    fn the_upload_is_a_handshake_then_raw_bytes_and_the_key_goes_to_kaggle_only() {
        let mut w = Fake::new();
        let job = vec![
            Upload { name: "job.json", bytes: b"{}" },
            Upload { name: "a1b2c3d4_cli.py", bytes: b"print(1)" },
        ];
        Courier::new(creds()).put_job(&mut w, JOB_DATASET, &job, "job 1").unwrap();

        // Two handshakes, two PUTs, one version call.
        let blobs: Vec<_> = w.json.iter().filter(|(u, _)| u.contains("/blobs/upload")).collect();
        assert_eq!(blobs.len(), 2);
        assert!(blobs.iter().all(|(u, _)| u.contains("Basic b3NjYTprM3k=")));
        assert!(blobs[0].1.contains(r#""name":"job.json""#) && blobs[0].1.contains(r#""contentLength":2"#));
        assert_eq!(w.puts.iter().map(|(_, n)| *n).collect::<Vec<_>>(), vec![2, 8]);
        // THE ONE THAT MATTERS: the storage host is never sent the key.
        assert!(w.puts.iter().all(|(u, _)| u.starts_with("https://storage.example/")));
        let (url, body) = w.json.last().unwrap();
        assert!(url.contains("/datasets/create/version/osca/ttstv-studio-job"));
        assert!(body.contains("tok-1") && body.contains("tok-2"), "{body}");
        assert!(body.contains(r#""deleteOldVersions":false"#), "a version, never a replacement");
    }

    #[test]
    fn a_403_on_the_first_push_is_a_missing_dataset_and_goes_on_to_create() {
        // `bfa1e46`'s bug, in the other language: 403 must not look like auth.
        let mut w = Fake::new()
            .answer(&format!("{API}/datasets/create/version/osca/ttstv-studio-job"), 403, "Forbidden");
        let job = vec![Upload { name: "job.json", bytes: b"{}" }];
        Courier::new(creds()).put_job(&mut w, JOB_DATASET, &job, "first").unwrap();
        let created = w.json.iter().any(|(u, _)| u.contains("/datasets/create/new"));
        assert!(created, "a 403 must fall through to create");
        let (_, body) = w.json.iter().find(|(u, _)| u.contains("/create/new")).unwrap();
        assert!(body.contains(r#""isPrivate":true"#), "a job is never public");
    }

    #[test]
    fn a_401_stops_before_create_and_two_403s_are_reported_as_both() {
        let mut w = Fake::new()
            .answer(&format!("{API}/datasets/create/version/osca/ttstv-studio-job"), 401, "no");
        let job = vec![Upload { name: "job.json", bytes: b"{}" }];
        let e = Courier::new(creds()).put_job(&mut w, JOB_DATASET, &job, "x").unwrap_err();
        assert!(matches!(e, Refusal::Auth(_)));
        assert!(!w.json.iter().any(|(u, _)| u.contains("/create/new")), "auth is not a missing dataset");
        assert!(e.sentence().contains("fresh kaggle.json"));

        let mut w = Fake::new()
            .answer(&format!("{API}/datasets/create/version/osca/ttstv-studio-job"), 403, "F")
            .answer(&format!("{API}/datasets/create/new"), 403, "F");
        let e = Courier::new(creds()).put_job(&mut w, JOB_DATASET, &job, "x").unwrap_err();
        assert!(matches!(e, Refusal::Ambiguous(_)));
        assert!(e.sentence().contains("both"), "{}", e.sentence());
    }

    #[test]
    fn a_nested_name_is_refused_before_a_single_byte_goes_up() {
        let mut w = Fake::new();
        for bad in ["parser/cli.py", "a\\b.py", ".hidden", ""] {
            let job = vec![Upload { name: bad, bytes: b"x" }];
            let e = Courier::new(creds()).put_job(&mut w, JOB_DATASET, &job, "x").unwrap_err();
            assert!(e.sentence().contains("flat name"), "{bad:?}");
        }
        assert!(w.puts.is_empty() && w.json.is_empty(), "nothing went up");
    }

    // ------------------------------------------------------------- verb 2

    #[test]
    fn nothing_is_pushed_until_the_dataset_says_ready() {
        let mut w = Fake::new();
        w.ready_after = 3;                  // processing, processing, processing, ready
        Courier::new(creds()).wait_ready(&mut w, JOB_DATASET).unwrap();
        assert_eq!(w.ready_asked, 4);
        assert_eq!(w.slept, READY_POLL_MS * 3, "5s apart, as the CLI polls");
    }

    #[test]
    fn a_dataset_that_never_becomes_ready_is_a_sentence_not_a_hang() {
        let mut w = Fake::new();
        w.ready_after = usize::MAX;
        let e = Courier::new(creds()).wait_ready(&mut w, JOB_DATASET).unwrap_err();
        assert!(e.sentence().contains("did not become ready"));
        assert!(w.slept >= READY_TIMEOUT_MS);
    }

    // ------------------------------------------------------------- verb 3

    #[test]
    fn a_refused_push_is_a_200_with_a_sentence_in_it() {
        // The CLI exits 0 on one. This is the whole reason the body is read.
        let mut w = Fake::new().answer(
            &format!("{API}/kernels/push"), 200,
            "Kernel push error: Maximum batch size exceeded\nsomething else");
        let e = Courier::new(creds())
            .push_kernel(&mut w, STUDIO_KERNEL, "print(1)", &["osca/ttstv-studio-job".into()], false)
            .unwrap_err();
        assert_eq!(e.sentence(), "Maximum batch size exceeded");
        assert_eq!(push_refusal("Kernel push error:"), Some("(no message)".into()));
        assert_eq!(push_refusal("all fine"), None);
        assert!(is_slot_busy("GPU session count exceeded") && !is_slot_busy("all fine"));
    }

    #[test]
    fn the_studio_kernel_asks_for_no_gpu_and_the_render_kernel_is_a_different_slug() {
        let mut w = Fake::new()
            .answer(&format!("{API}/kernels/push"), 200, r#"{"versionNumber": 7}"#);
        let v = Courier::new(creds())
            .push_kernel(&mut w, STUDIO_KERNEL, "print(1)", &["osca/ttstv-studio-job".into()], false)
            .unwrap();
        assert_eq!(v, 7);
        let (_, body) = w.json.last().unwrap();
        assert!(body.contains(r#""enableGpu":false"#), "K-D: the parse is CPU");
        assert!(body.contains(r#""kernelType":"script""#) && body.contains(r#""isPrivate":true"#));
        assert!(body.contains(r#""id":"osca/ttstv-studio""#));
        assert!(body.contains("ttstv-studio-job"), "the job must be attached");
        assert_ne!(STUDIO_KERNEL, RENDER_KERNEL);
    }

    // ------------------------------------------------------------- verb 4

    #[test]
    fn the_status_word_is_the_last_segment_lowercased() {
        assert_eq!(status_word("KernelWorkerStatus.COMPLETE"), "complete");
        assert_eq!(status_word(" KernelWorkerStatus.Running "), "running");
        assert_eq!(status_word("queued"), "queued");
        assert!(is_final("complete") && is_final("error") && !is_final("running"));
    }

    #[test]
    fn a_push_is_not_believed_until_the_word_has_moved() {
        // The trap: `status` answers for the NEWEST version, which right after
        // a push is still the previous run's -- so a watcher that trusts it
        // reports a finished parse that has not started.
        let mut watch = Watch::new(Some("complete".into()), 1_000);
        assert_eq!(watch.saw("complete", 1_100), Stage::Pushed);
        assert!(watch.saw("complete", 1_100).line().contains("queued"));
        assert_eq!(watch.saw("running", 2_000), Stage::Running("running".into()));
        assert_eq!(watch.saw("complete", 3_000), Stage::Done("complete".into()));

        // ...and it does not wait for ever: the grace runs out and says so.
        let mut stuck = Watch::new(Some("complete".into()), 0);
        assert!(matches!(stuck.saw("complete", TOOK_GRACE_MS + 1), Stage::Failed(_)));

        // A first-ever push has no previous word, so the first answer counts.
        let mut first = Watch::new(None, 0);
        assert_eq!(first.saw("queued", 1), Stage::Running("queued".into()));
    }

    #[test]
    fn every_stage_has_a_line_from_the_first_second() {
        // K-E: the book shows greyed with the stage NAMED. A 4-to-8 minute
        // wait that says nothing reads as a hang.
        for s in [Stage::Packing, Stage::Settling, Stage::Pushed,
                  Stage::Running("queued".into()), Stage::Done("complete".into())] {
            assert!(!s.line().is_empty() && !s.line().contains("None"), "{s:?}");
        }
        assert!(!Stage::Packing.settled() && Stage::Done("complete".into()).settled());
        assert!(Stage::Failed("x".into()).settled());
    }

    // ------------------------------------------------------------- verb 5

    #[test]
    fn the_output_is_named_files_and_a_log_that_is_absent_while_it_runs() {
        let running = format!(
            "{API}/kernels/output?userName=osca&kernelSlug={STUDIO_KERNEL}");
        let mut w = Fake::new().answer(&running, 200,
            r#"{"files":[{"fileName":"done.json","url":"https://storage.example/o/1"},
                         {"fileName":"out/hash","url":"https://storage.example/o/2"}],
                "log":""}"#);
        let got = Courier::new(creds()).output(&mut w, STUDIO_KERNEL).unwrap();
        assert_eq!(got.files.len(), 2);
        assert_eq!(got.files[0].name, "done.json");
        assert_eq!(got.log, None, "the log cannot be read while the kernel runs");

        let mut w = w;
        w.answers.insert("https://storage.example/o/2".into(), (200, "cfda3087a17772f6\n".into()));
        let bytes = Courier::new(creds()).fetch(&mut w, &got.files[1]).unwrap();
        assert_eq!(String::from_utf8_lossy(&bytes).trim(), "cfda3087a17772f6");
        // Signed URL: no credential rides along.
        assert!(w.gets.iter().any(|g| g == "GET https://storage.example/o/2"));
    }

    #[test]
    fn nothing_that_answered_is_ever_a_lost_connection() {
        assert!(matches!(refusal_for(401, "x"), Refusal::Auth(_)));
        assert!(matches!(refusal_for(403, "x"), Refusal::Ambiguous(_)));
        assert!(matches!(refusal_for(500, ""), Refusal::Said(_)));
        assert!(refusal_for(500, "").sentence().contains("500"));
        assert!(Refusal::Lost("reset".into()).sentence().contains("could not be reached"));
    }

    // ---------------------------------------------------- W2: unb64, types, key

    #[test]
    fn unb64_round_trips_b64_over_every_length() {
        for input in [b"" as &[u8], b"f", b"fo", b"foo", b"foob", b"osca:k3y"] {
            assert_eq!(unb64(&b64(input)).unwrap(), input, "round-trip of {input:?}");
        }
        // Rejects
        assert!(unb64("a").is_err(), "length 1 is not a multiple of 4");
        assert!(unb64("====").is_err(), "four pads is not valid");
        assert!(unb64("!!!x").is_err(), "bad characters");
    }

    #[test]
    fn kaggle_fault_maps_every_refusal_kind() {
        let cases = [
            (Refusal::Auth("x".into()), "auth"),
            (Refusal::Ambiguous("x".into()), "ambiguous"),
            (Refusal::Said("x".into()), "said"),
            (Refusal::Lost("x".into()), "lost"),
        ];
        for (r, expected_kind) in cases {
            let f = KaggleFault::from(r);
            assert_eq!(f.kind, expected_kind);
            assert!(!f.why.is_empty());
        }
        let nk = KaggleFault::no_key();
        assert_eq!(nk.kind, "no-key");
        assert!(nk.why.contains("kaggle.json"));
    }

    #[test]
    fn to_kaggle_json_round_trips_through_parse_pasted() {
        let c = Creds::new("osca", "k3y");
        let json = c.to_kaggle_json();
        let c2 = parse_pasted(&json).expect("round-trip");
        assert_eq!(c2.username, "osca");
        assert_eq!(c2.auth(), c.auth());
        // The key never appears in Debug
        let shown = format!("{:?}", c);
        assert!(shown.contains("osca") && !shown.contains("k3y"), "{shown}");
    }

    // ------------------------------------------------------ the kernel script

    #[test]
    fn the_studio_kernel_script_is_embedded_and_is_the_right_one() {
        assert!(!STUDIO_KERNEL_SCRIPT.is_empty(), "the script is embedded");
        assert!(
            STUDIO_KERNEL_SCRIPT.contains("ttstv-studio"),
            "the script is the studio kernel"
        );
        assert!(
            STUDIO_KERNEL_SCRIPT.contains("parser.cli"),
            "it runs the parser"
        );
        assert!(
            STUDIO_KERNEL_SCRIPT.contains("def main()"),
            "it has a main function"
        );
        assert!(
            STUDIO_KERNEL_SCRIPT.contains("\"enableGpu\": false")
                || !STUDIO_KERNEL_SCRIPT.contains("enableGpu"),
            "the studio kernel is CPU — it never enables a GPU"
        );
    }
}
