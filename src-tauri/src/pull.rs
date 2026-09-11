//! The pull: a Sync's books, downloaded by the app and not by the page.
//!
//! G-SYNCBG (Osca, 11 Sep 2026). After G-PULL the phone could take a book --
//! but the taking was JavaScript inside the Settings page: `runDriveSync` and
//! the LAN loop fetched every file of every book and handed it to the book
//! door one `book_put` at a time. *"Leave the page and it cancels;
//! background keeps it; lock pauses it. It must survive using the app."*
//! Opening a book IS leaving the page -- the reader is a navigation of the
//! one webview -- so the pull died the moment anyone did the thing the pull
//! was for.
//!
//! So the bulk moves here. **The page still decides WHAT** (TTSTV
//! `library/drive.js::syncJob`): it reads Drive's `library.json` or Studio's
//! manifest, compares it with `book_list`, merges the small ledgers (marks,
//! positions, settings) itself, and hands this module a JOB --
//!
//! ```text
//!   {transport: "drive" | "lan", trigger, auth: {...},
//!    books: [{slug, hash, title, meta, files: [{rel, id | url, bytes}]}]}
//! ```
//!
//! -- and this module does the HOW on its own thread: each file downloaded
//! (Drive `files/<id>?alt=media` with the bearer; the LAN `<base><url>?t=`
//! with the pair token, `settings.js::syncUrl`'s shape), streamed into the
//! version's `.part/` folder by the book door's own functions
//! ([`crate::book_write_from`] shares [`crate::book_dest`] with `book_put`),
//! and committed by [`crate::book_commit`] -- the row LAST, exactly as
//! `book_meta` commits it. One book at a time, in the page's order.
//!
//! What a pull that is interrupted leaves behind is what G-PULL promised: a
//! `.part/<slug>@<hash>/` with some files in it and no row, so the book is not
//! on the shelf and an installed older version is untouched. The next
//! `sync_start` for the same version RESUMES: a file already in `.part/`
//! whose byte count equals the job's `bytes` is not fetched again.
//!
//! Everything above the network is plain `std` and [`Wire`] is the network,
//! so the runner is tested with a fake one (`mod pull_tests`) -- the order,
//! the resume, a refused `rel`, the token refresh, `sync_stop`. [`Net`] is
//! the real one: `ureq`, blocking, on the runner's thread.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use crate::{book_commit, book_have, book_hash_ok, book_installed, book_rel, book_slug_ok, book_write_from, json_field};

/// Drive's download door, `library/drive.js::driveClient.getBytes`'s URL.
pub const DRIVE_FILES: &str = "https://www.googleapis.com/drive/v3/files/";
/// Google's token endpoint -- `drive.js`'s `GOOGLE.TOKEN`, the request
/// `googleRefresh` makes: client id + refresh token, NO secret (an iOS client
/// is a PKCE public client and has none).
pub const GOOGLE_TOKEN: &str = "https://oauth2.googleapis.com/token";
/// A token within this of its expiry is refreshed before it is spent --
/// `googleAccessToken`'s minute.
pub const REFRESH_EARLY_MS: u64 = 60_000;
/// How many times one file is tried when the network, not the server, said
/// no (a lock that froze a socket, a short body, a 5xx), and the waits
/// between the tries.
pub const TRIES: usize = 4;
pub const BACKOFF_MS: [u64; 3] = [1_000, 3_000, 8_000];

// ---------------------------------------------------------------- the job

/// What the page hands over. Every field has a default so a job from an
/// older page is refused in words by [`check_job`], never by a parse error
/// the page cannot read.
#[derive(Clone, Debug, Default, PartialEq, serde::Deserialize)]
#[serde(default)]
pub struct Job {
    /// `"drive"` or `"lan"`.
    pub transport: String,
    /// Why this ran: `"press"` (the Sync button), `"launch"`, `"foreground"`.
    /// Carried into the status so the row can say it.
    pub trigger: String,
    pub auth: Auth,
    pub books: Vec<Book>,
    /// Set when the page could not plan at all (Drive refused, Studio not
    /// reachable): the reason is recorded as this run's outcome and nothing
    /// is fetched. One record of "what ran and why", and it is the status.
    pub why: Option<String>,
}

/// The credential. Drive: `drive.js`'s own token record, the same four names
/// (`ttstv.sync.google` = `{access, refresh, expires, clientId}`). LAN: the
/// pairing (`ttstv.sync.pair`'s `base` and `token`).
#[derive(Clone, Debug, Default, PartialEq, serde::Deserialize)]
#[serde(default)]
pub struct Auth {
    pub access: Option<String>,
    pub refresh: Option<String>,
    /// Milliseconds since the epoch, as `Date.now()` writes it.
    pub expires: Option<f64>,
    #[serde(rename = "clientId")]
    pub client_id: Option<String>,
    pub base: Option<String>,
    pub token: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, serde::Deserialize)]
#[serde(default)]
pub struct Book {
    pub slug: String,
    pub hash: String,
    pub title: Option<String>,
    /// The row the shelf shows, as JSON text -- `import.js`'s meta object,
    /// built by the page (`drive.js::syncBookMeta`) and committed as
    /// `book_meta` commits one. It arrives as an object; the deserializer
    /// keeps its text.
    #[serde(deserialize_with = "crate::meta_text")]
    pub meta: String,
    pub files: Vec<File>,
}

#[derive(Clone, Debug, Default, PartialEq, serde::Deserialize)]
#[serde(default)]
pub struct File {
    /// The path inside the book -- [`book_rel`]'s rules.
    pub rel: String,
    /// Drive: the file's id (`library.json`'s `files[].id`).
    pub id: Option<String>,
    /// LAN: the path on Studio's sync server (`/books/<slug>/<rel>`,
    /// `/sync/audio/<slug>/<cid>.opus`).
    pub url: Option<String>,
    /// The size the other side says it has, when it knows. `None` for a
    /// chapter Studio has not transcoded yet -- that file is always fetched.
    pub bytes: Option<u64>,
}

// ------------------------------------------------------------- the status

/// `sync_status()`: what is running, or what ran last and how it ended.
/// The Settings row paints it (`settings.js::syncPullLine`); lane 5's dot on
/// the settings icon reads `running`.
#[derive(Clone, Debug, Default, PartialEq, serde::Serialize)]
pub struct Status {
    pub running: bool,
    pub transport: String,
    pub trigger: String,
    /// The book being pulled (its title, else its slug) -- the last one,
    /// once the run is over.
    pub book: Option<String>,
    pub slug: Option<String>,
    /// That book is `i` of `n` (1-based; 0 before the first).
    pub i: u32,
    pub n: u32,
    pub file: Option<String>,
    /// Files of that book in `.part/` so far, of `total`.
    pub done: u32,
    pub total: u32,
    /// Books committed by this run.
    pub pulled: u32,
    /// Books the job named that were already whole on this device.
    pub skipped: u32,
    /// Why it stopped short, in words. `None` for a run that finished.
    pub why: Option<String>,
    /// When it started and when it ended (ms since the epoch).
    pub since: u64,
    pub ended: Option<u64>,
    /// A token this run refreshed: `{access, expires}`. The door
    /// (`SYNC_JS`) writes it into `ttstv.sync.google` on the next status, so
    /// the page's store and this thread spend the same token.
    pub google: Option<Token>,
}

#[derive(Clone, Debug, Default, PartialEq, serde::Serialize)]
pub struct Token {
    pub access: String,
    pub expires: u64,
}

/// The shared half: the status every page may read, and the stop flag.
#[derive(Default)]
pub struct Pull {
    status: Mutex<Status>,
    stop: AtomicBool,
}

impl Pull {
    pub fn snapshot(&self) -> Status {
        self.status.lock().map(|s| s.clone()).unwrap_or_default()
    }

    fn set(&self, f: impl FnOnce(&mut Status)) {
        if let Ok(mut s) = self.status.lock() {
            f(&mut s);
        }
    }

    /// Claim the runner for `job`: `Err(the running status)` when a pull is
    /// already running -- a second start does not replace it (a job planned
    /// on return to the foreground while a press's job is still going would
    /// otherwise throw away the press's progress).
    pub fn begin(&self, job: &Job, now: u64) -> Result<Status, Status> {
        let mut s = self.status.lock().map_err(|_| Status::default())?;
        if s.running {
            return Err(s.clone());
        }
        self.stop.store(false, Ordering::SeqCst);
        *s = Status {
            running: true,
            transport: job.transport.clone(),
            trigger: job.trigger.clone(),
            n: job.books.len() as u32,
            since: now,
            ..Status::default()
        };
        Ok(s.clone())
    }

    /// `sync_stop()`: the runner finishes the file it is on and stops.
    /// Answers whether there was anything to stop.
    pub fn request_stop(&self) -> bool {
        let running = self.snapshot().running;
        if running {
            self.stop.store(true, Ordering::SeqCst);
        }
        running
    }

    fn stopping(&self) -> bool {
        self.stop.load(Ordering::SeqCst)
    }

    fn end(&self, why: Option<String>, now: u64) {
        self.set(|s| {
            s.running = false;
            s.file = None;
            s.why = why;
            s.ended = Some(now);
        });
    }
}

// -------------------------------------------------------------- the wire

/// One GET's answer.
pub enum Reply {
    /// 2xx: the body.
    Body(Box<dyn Read + Send>),
    /// The server answered with a status (and a body, for the sentence).
    Refused(u16, String),
    /// No answer: DNS, a refused connection, a timeout, a reset.
    Lost(String),
}

/// The network, as the runner sees it -- and the clock, so a test can make
/// a token expire without waiting an hour.
pub trait Wire {
    fn get(&mut self, url: &str, bearer: Option<&str>) -> Reply;
    /// `application/x-www-form-urlencoded` POST: the status and the body
    /// text, or a sentence when nothing answered.
    fn post_form(&mut self, url: &str, form: &[(&str, &str)]) -> Result<(u16, String), String>;
    fn now(&self) -> u64;
    fn wait(&mut self, ms: u64);
}

pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ------------------------------------------------------------- the checks

fn drive_id_ok(id: &str) -> bool {
    !id.is_empty() && id.len() <= 256 && id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
}

/// A LAN path is a path on the paired Studio and nothing else: it starts at
/// `/`, names no other host, and carries no query of its own (the token is
/// appended here).
fn lan_path_ok(url: &str) -> bool {
    url.starts_with('/')
        && !url.starts_with("//")
        && !url.contains("://")
        && !url.bytes().any(|c| c <= b' ' || c == b'?' || c == b'#' || c == b'\\' || c >= 0x7f)
}

fn lan_base_ok(base: &str) -> bool {
    let rest = base
        .strip_prefix("http://")
        .or_else(|| base.strip_prefix("https://"))
        .unwrap_or("");
    !rest.is_empty() && !rest.contains('/') && !rest.bytes().any(|c| c <= b' ' || c == b'?' || c == b'#' || c == b'@')
}

/// The whole job, before a byte is fetched: a refusal is a sentence and
/// NOTHING is written (the same rule `book_put` keeps for one file).
pub fn check_job(job: &Job) -> Result<(), String> {
    let drive = match job.transport.as_str() {
        "drive" => true,
        "lan" => false,
        other => return Err(format!("{other:?} is not a transport (drive or lan)")),
    };
    let a = &job.auth;
    if drive {
        let can_refresh = a.refresh.as_deref().map_or(false, |s| !s.is_empty())
            && a.client_id.as_deref().map_or(false, |s| !s.is_empty());
        if a.access.as_deref().map_or(true, str::is_empty) && !can_refresh {
            return Err("Drive: the job carries no token -- sign in with Google".into());
        }
    } else {
        if !a.base.as_deref().map_or(false, lan_base_ok) {
            return Err(format!("{:?} is not a Studio address (http://host:port)", a.base.as_deref().unwrap_or("")));
        }
        if a.token.as_deref().map_or(true, str::is_empty) {
            return Err("the LAN job carries no pairing token -- pair with Studio first".into());
        }
    }
    let mut seen = std::collections::BTreeSet::new();
    for b in &job.books {
        book_slug_ok(&b.slug)?;
        book_hash_ok(&b.hash)?;
        if !seen.insert(b.slug.as_str()) {
            return Err(format!("{} is in the job twice", b.slug));
        }
        let meta = b.meta.trim();
        if !(meta.starts_with('{') && meta.ends_with('}')) {
            return Err(format!("{}: a book's row is a JSON object", b.slug));
        }
        let mut rels = std::collections::BTreeSet::new();
        for f in &b.files {
            book_rel(&f.rel).map_err(|e| format!("{}: {e}", b.slug))?;
            if !rels.insert(f.rel.as_str()) {
                return Err(format!("{}: {} is listed twice", b.slug, f.rel));
            }
            if drive {
                if !f.id.as_deref().map_or(false, drive_id_ok) {
                    return Err(format!("{}: {} has no Drive id", b.slug, f.rel));
                }
            } else if !f.url.as_deref().map_or(false, lan_path_ok) {
                return Err(format!("{}: {} has no path on Studio", b.slug, f.rel));
            }
        }
        if b.files.is_empty() {
            return Err(format!("{}: a book with no files", b.slug));
        }
    }
    Ok(())
}

/// `encodeURIComponent`, for the one value this module puts in a query.
pub fn enc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.bytes() {
        if c.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&c) {
            out.push(c as char);
        } else {
            out.push_str(&format!("%{c:02X}"));
        }
    }
    out
}

/// A number field out of Google's flat token answer (`"expires_in": 3599`);
/// [`json_field`]'s twin for the one field that is not a string.
pub fn json_number(src: &str, key: &str) -> Option<u64> {
    let needle = format!("\"{key}\"");
    let rest = &src[src.find(&needle)? + needle.len()..];
    let rest = rest[rest.find(':')? + 1..].trim_start();
    let end = rest.find(|c: char| !c.is_ascii_digit()).unwrap_or(rest.len());
    rest[..end].parse().ok()
}

// ------------------------------------------------------------- the runner

/// The token this run spends, and whether it refreshed one.
struct Bearer {
    access: String,
    expires: u64,
}

fn refresh(wire: &mut dyn Wire, auth: &Auth, bearer: &mut Bearer, pull: &Pull) -> Result<(), String> {
    let (Some(rt), Some(cid)) = (auth.refresh.as_deref(), auth.client_id.as_deref()) else {
        return Err("Drive: the token expired and the job carries no refresh token -- sign in again".into());
    };
    let (code, body) = wire
        .post_form(GOOGLE_TOKEN, &[("client_id", cid), ("refresh_token", rt), ("grant_type", "refresh_token")])
        .map_err(|e| format!("Google not reachable ({e})"))?;
    let access = json_field(&body, "access_token");
    if code != 200 || access.is_empty() {
        let err = json_field(&body, "error");
        return Err(format!(
            "the refresh was refused: HTTP {code}{}",
            if err.is_empty() { String::new() } else { format!(" ({err})") }
        ));
    }
    bearer.access = access.to_string();
    bearer.expires = wire.now() + 1000 * json_number(&body, "expires_in").unwrap_or(3600);
    let t = Token { access: bearer.access.clone(), expires: bearer.expires };
    pull.set(|s| s.google = Some(t));
    Ok(())
}

/// One file into `.part/`: fetched, retried while the network is the
/// problem, a Drive 401 refreshed once, the byte count held to the job's.
fn fetch_file(
    books: &Path,
    job: &Job,
    b: &Book,
    f: &File,
    wire: &mut dyn Wire,
    bearer: &mut Bearer,
    pull: &Pull,
) -> Result<u64, String> {
    let drive = job.transport == "drive";
    let url = if drive {
        format!("{DRIVE_FILES}{}?alt=media", f.id.as_deref().unwrap_or(""))
    } else {
        format!(
            "{}{}?t={}",
            job.auth.base.as_deref().unwrap_or(""),
            f.url.as_deref().unwrap_or(""),
            enc(job.auth.token.as_deref().unwrap_or(""))
        )
    };
    let what = if drive { "Drive" } else { "Studio" };
    let mut refreshed = false;
    let mut tries = 0;
    loop {
        if drive && (bearer.access.is_empty() || wire.now() + REFRESH_EARLY_MS >= bearer.expires) {
            refresh(wire, &job.auth, bearer, pull)?;
            refreshed = true;
        }
        let lost = match wire.get(&url, if drive { Some(bearer.access.as_str()) } else { None }) {
            Reply::Body(mut body) => match book_write_from(books, &b.slug, &b.hash, &f.rel, &mut body) {
                Ok(n) => match f.bytes {
                    Some(want) if want != n => format!("{}: {n} bytes arrived, {want} were listed", f.rel),
                    _ => return Ok(n),
                },
                Err(e) => e,
            },
            Reply::Refused(401, _) if drive && !refreshed => {
                refresh(wire, &job.auth, bearer, pull)?;
                refreshed = true;
                continue;
            }
            Reply::Refused(code, _) if code == 429 || code >= 500 => format!("{what}: {} -> HTTP {code}", f.rel),
            Reply::Refused(code, text) => {
                let text = text.trim();
                return Err(format!(
                    "{what}: {} -> HTTP {code}{}",
                    f.rel,
                    if text.is_empty() || text.len() > 160 { String::new() } else { format!(" ({text})") }
                ));
            }
            Reply::Lost(why) => format!("{what} not reachable ({why})"),
        };
        tries += 1;
        if tries >= TRIES {
            return Err(lost);
        }
        log::info!("frank: pull {} -- try {tries} failed: {lost}", f.rel);
        wire.wait(BACKOFF_MS[(tries - 1).min(BACKOFF_MS.len() - 1)]);
    }
}

/// THE RUN. Checks the whole job, then each book in the page's order: a book
/// already installed at this hash is skipped; otherwise each file is fetched
/// unless `.part/` already holds it at the listed size (the resume), and the
/// row is committed LAST. Stops after the current file when asked. Always
/// ends the status -- a run cannot be left "running".
pub fn run(books: &Path, job: &Job, wire: &mut dyn Wire, pull: &Pull) {
    let outcome = run_books(books, job, wire, pull);
    pull.end(outcome.err(), wire.now());
}

fn run_books(books: &Path, job: &Job, wire: &mut dyn Wire, pull: &Pull) -> Result<(), String> {
    if let Some(why) = &job.why {
        return Err(why.clone());
    }
    check_job(job)?;
    let mut bearer = Bearer {
        access: job.auth.access.clone().unwrap_or_default(),
        expires: job.auth.expires.map_or(0, |e| if e > 0.0 { e as u64 } else { 0 }),
    };
    if bearer.expires == 0 && !bearer.access.is_empty() {
        // a token with no stated expiry is spent until Drive refuses it
        bearer.expires = u64::MAX - REFRESH_EARLY_MS;
    }
    for (k, b) in job.books.iter().enumerate() {
        if pull.stopping() {
            return Err("stopped".into());
        }
        let title = b.title.clone().filter(|t| !t.is_empty()).unwrap_or_else(|| b.slug.clone());
        pull.set(|s| {
            s.i = k as u32 + 1;
            s.book = Some(title.clone());
            s.slug = Some(b.slug.clone());
            s.file = None;
            s.done = 0;
            s.total = b.files.len() as u32;
        });
        if book_installed(books, &b.slug).as_deref() == Some(b.hash.as_str()) {
            pull.set(|s| s.skipped += 1);
            continue;
        }
        for (j, f) in b.files.iter().enumerate() {
            if j > 0 && pull.stopping() {
                return Err("stopped".into());
            }
            pull.set(|s| s.file = Some(f.rel.clone()));
            let have = book_have(books, &b.slug, &b.hash, &f.rel);
            if !(f.bytes.is_some() && have == f.bytes) {
                fetch_file(books, job, b, f, wire, &mut bearer, pull).map_err(|e| format!("{title}: {e}"))?;
            }
            pull.set(|s| s.done = j as u32 + 1);
        }
        let replaced = book_commit(books, &b.slug, &b.hash, &b.meta).map_err(|e| format!("{title}: {e}"))?;
        log::info!("frank: pull {}@{} -- installed, replaced {replaced:?}", b.slug, b.hash);
        pull.set(|s| s.pulled += 1);
    }
    Ok(())
}

/// `sync_start`'s body: claim the runner and run the job on a thread of its
/// own, off the main thread and outside any page. Answers the status as it
/// is after the claim -- or, when a pull is already running, THAT status,
/// untouched.
pub fn start<W: Wire + Send + 'static>(pull: Arc<Pull>, books: PathBuf, job: Job, wire: W) -> Status {
    let claimed = match pull.begin(&job, wire.now()) {
        Ok(s) => s,
        Err(running) => return running,
    };
    let runner = pull.clone();
    let spawned = std::thread::Builder::new().name("frank-pull".into()).spawn(move || {
        let mut wire = wire;
        run(&books, &job, &mut wire, &runner);
    });
    if let Err(e) = spawned {
        pull.end(Some(format!("frank: could not start the pull -- {e}")), now_ms());
        return pull.snapshot();
    }
    claimed
}

/// What the app evaluates in the page on launch and on return to the
/// foreground: the host door's `auto`, which asks the page to plan
/// (`drive.js::syncAuto`) and hands the job back to `sync_start`. A page
/// without the door ignores it.
pub fn auto_js(trigger: &str) -> String {
    let t = if trigger == "launch" { "launch" } else { "foreground" };
    format!(
        "try {{ if (window.TTSTVHost && window.TTSTVHost.sync && typeof window.TTSTVHost.sync.auto === \"function\") window.TTSTVHost.sync.auto(\"{t}\"); }} catch (e) {{}}"
    )
}

// ------------------------------------------------------------ the network

/// The real [`Wire`]: `ureq`, blocking, rustls with webpki roots -- one
/// client for Drive (https) and Studio on the LAN (plain http). Timeouts are
/// what make a frozen socket after a lock a `Lost` the runner retries,
/// rather than a thread that waits forever.
pub struct Net {
    agent: ureq::Agent,
}

impl Net {
    pub fn new() -> Self {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(15))
            .timeout_read(std::time::Duration::from_secs(30))
            .timeout_write(std::time::Duration::from_secs(30))
            .user_agent("Frank")
            .build();
        Net { agent }
    }
}

impl Default for Net {
    fn default() -> Self {
        Self::new()
    }
}

impl Wire for Net {
    fn get(&mut self, url: &str, bearer: Option<&str>) -> Reply {
        let mut req = self.agent.get(url);
        if let Some(t) = bearer {
            req = req.set("Authorization", &format!("Bearer {t}"));
        }
        match req.call() {
            Ok(res) => Reply::Body(Box::new(res.into_reader())),
            Err(ureq::Error::Status(code, res)) => {
                let mut text = String::new();
                let _ = res.into_reader().take(4096).read_to_string(&mut text);
                Reply::Refused(code, text)
            }
            Err(ureq::Error::Transport(t)) => Reply::Lost(t.to_string()),
        }
    }

    fn post_form(&mut self, url: &str, form: &[(&str, &str)]) -> Result<(u16, String), String> {
        match self.agent.post(url).send_form(form) {
            Ok(res) => {
                let code = res.status();
                res.into_string().map(|t| (code, t)).map_err(|e| e.to_string())
            }
            Err(ureq::Error::Status(code, res)) => Ok((code, res.into_string().unwrap_or_default())),
            Err(ureq::Error::Transport(t)) => Err(t.to_string()),
        }
    }

    fn now(&self) -> u64 {
        now_ms()
    }

    fn wait(&mut self, ms: u64) {
        std::thread::sleep(std::time::Duration::from_millis(ms));
    }
}

#[cfg(test)]
mod pull_tests {
    use super::*;
    use std::collections::{HashMap, VecDeque};
    use std::fs;

    /// One answer the fake network gives, by URL, before it falls back to
    /// the files it holds.
    enum Canned {
        Body(Vec<u8>),
        Status(u16, &'static str),
        Lost,
    }

    /// A network that is a map: Drive by id, the LAN by path. It checks the
    /// bearer like Drive does, records every call, keeps its own clock, and
    /// can press `sync_stop` in the middle of the Nth GET.
    struct Fake {
        files: HashMap<String, Vec<u8>>,
        canned: HashMap<String, VecDeque<Canned>>,
        valid: String,
        refresh: (u16, String),
        clock: u64,
        log: Vec<String>,
        stop_on: Option<(usize, Arc<Pull>)>,
        gets: usize,
    }

    impl Fake {
        fn new() -> Self {
            Fake {
                files: HashMap::new(),
                canned: HashMap::new(),
                valid: "tok-1".into(),
                refresh: (200, r#"{"access_token": "tok-2", "expires_in": 3599, "token_type": "Bearer"}"#.into()),
                clock: 1_000_000,
                log: Vec::new(),
                stop_on: None,
                gets: 0,
            }
        }
        fn drive(mut self, id: &str, bytes: &[u8]) -> Self {
            self.files.insert(format!("{DRIVE_FILES}{id}?alt=media"), bytes.to_vec());
            self
        }
        fn can(&mut self, url: &str, c: Canned) {
            self.canned.entry(url.to_string()).or_default().push_back(c);
        }
        fn gets(&self) -> Vec<String> {
            self.log.iter().filter(|l| l.starts_with("GET ")).cloned().collect()
        }
    }

    impl Wire for Fake {
        fn get(&mut self, url: &str, bearer: Option<&str>) -> Reply {
            self.gets += 1;
            self.log.push(format!("GET {url} {}", bearer.unwrap_or("-")));
            if let Some((n, pull)) = &self.stop_on {
                if *n == self.gets {
                    pull.request_stop();
                }
            }
            if let Some(c) = self.canned.get_mut(url).and_then(|q| q.pop_front()) {
                return match c {
                    Canned::Body(b) => Reply::Body(Box::new(std::io::Cursor::new(b))),
                    Canned::Status(code, text) => Reply::Refused(code, text.into()),
                    Canned::Lost => Reply::Lost("connection reset".into()),
                };
            }
            if url.starts_with(DRIVE_FILES) && bearer != Some(self.valid.as_str()) {
                return Reply::Refused(401, r#"{"error": {"message": "Invalid Credentials"}}"#.into());
            }
            match self.files.get(url) {
                Some(b) => Reply::Body(Box::new(std::io::Cursor::new(b.clone()))),
                None => Reply::Refused(404, "File not found".into()),
            }
        }
        fn post_form(&mut self, url: &str, form: &[(&str, &str)]) -> Result<(u16, String), String> {
            let body: Vec<String> = form.iter().map(|(k, v)| format!("{k}={v}")).collect();
            self.log.push(format!("POST {url} {}", body.join("&")));
            if self.refresh.0 == 200 {
                self.valid = json_field(&self.refresh.1, "access_token").to_string();
            }
            Ok(self.refresh.clone())
        }
        fn now(&self) -> u64 {
            self.clock
        }
        fn wait(&mut self, ms: u64) {
            self.log.push(format!("WAIT {ms}"));
            self.clock += ms;
        }
    }

    fn scratch(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("frank-pull-{name}-{}-{}", std::process::id(), now_ms()));
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn file(rel: &str, id: &str, bytes: usize) -> File {
        File { rel: rel.into(), id: Some(id.into()), url: None, bytes: Some(bytes as u64) }
    }

    fn book(slug: &str, hash: &str, files: Vec<File>) -> Book {
        Book {
            slug: slug.into(),
            hash: hash.into(),
            title: Some(format!("The {slug}")),
            meta: format!(r#"{{"slug":"{slug}","hash":"{hash}","title":"The {slug}"}}"#),
            files,
        }
    }

    fn drive_job(books: Vec<Book>) -> Job {
        Job {
            transport: "drive".into(),
            trigger: "press".into(),
            auth: Auth {
                access: Some("tok-1".into()),
                refresh: Some("refresh-1".into()),
                expires: Some(9_000_000.0),
                client_id: Some("12-abc.apps.googleusercontent.com".into()),
                ..Auth::default()
            },
            books,
            why: None,
        }
    }

    fn go(books: &Path, job: &Job, wire: &mut Fake) -> (Arc<Pull>, Status) {
        let pull = Arc::new(Pull::default());
        pull.begin(job, wire.now()).expect("idle");
        if let Some((n, _)) = wire.stop_on.take() {
            wire.stop_on = Some((n, pull.clone()));
        }
        run(books, job, wire, &pull);
        let st = pull.snapshot();
        (pull, st)
    }

    fn url(id: &str) -> String {
        format!("{DRIVE_FILES}{id}?alt=media")
    }

    #[test]
    fn a_job_runs_in_the_pages_order_and_commits_each_book_whole() {
        let books = scratch("order");
        let mut w = Fake::new().drive("i1", b"{}").drive("i2", b"arma").drive("i3", b"[1]").drive("i4", b"bucolica");
        let job = drive_job(vec![
            book("hamlet", "aaaa", vec![file("book.json", "i1", 2), file("chapters/c001.txt", "i2", 4)]),
            book("eclogues-la", "bbbb", vec![file("timings/c001.json", "i3", 3), file("book-data.js", "i4", 8)]),
        ]);
        let (_, st) = go(&books, &job, &mut w);
        assert_eq!(st.why, None, "{st:?}");
        assert_eq!(
            w.gets(),
            vec![
                format!("GET {} tok-1", url("i1")),
                format!("GET {} tok-1", url("i2")),
                format!("GET {} tok-1", url("i3")),
                format!("GET {} tok-1", url("i4")),
            ],
            "one book at a time, each file in the page's order, the bearer on every one"
        );
        assert_eq!((st.running, st.pulled, st.skipped, st.i, st.n, st.done, st.total), (false, 2, 0, 2, 2, 2, 2));
        assert_eq!(st.book.as_deref(), Some("The eclogues-la"));
        assert_eq!((st.transport.as_str(), st.trigger.as_str(), st.since, st.ended), ("drive", "press", 1_000_000, Some(1_000_000)));
        assert_eq!(fs::read(books.join("hamlet").join("chapters").join("c001.txt")).unwrap(), b"arma");
        assert_eq!(fs::read(books.join("eclogues-la").join("book-data.js")).unwrap(), b"bucolica");
        let rows = crate::book_rows(&books);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[1].1.as_deref(), Some(r#"{"slug":"hamlet","hash":"aaaa","title":"The hamlet"}"#), "the page's row, as sent");
        assert_eq!(book_installed(&books, "hamlet").as_deref(), Some("aaaa"));
        assert!(st.google.is_none(), "a live token is spent, not refreshed");
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn a_book_that_fails_half_way_has_no_row_and_the_next_start_resumes_it_by_bytes() {
        let books = scratch("resume");
        let mut w = Fake::new().drive("i1", b"{}").drive("i2", b"arma").drive("i4", b"cano");
        let job = drive_job(vec![book(
            "aeneid",
            "cccc",
            vec![file("book.json", "i1", 2), file("chapters/c001.txt", "i2", 4), file("chapters/c002.txt", "i3", 5), file("chapters/c003.txt", "i4", 4)],
        )]);
        // i3 is not on Drive: the run stops on it, after two files are in .part
        let (_, st) = go(&books, &job, &mut w);
        assert!(st.why.as_deref().unwrap().contains("chapters/c002.txt -> HTTP 404"), "{:?}", st.why);
        assert_eq!((st.pulled, st.done, st.total), (0, 2, 4));
        assert!(crate::book_rows(&books).is_empty(), "no row: not on the shelf");
        assert_eq!(book_have(&books, "aeneid", "cccc", "chapters/c001.txt"), Some(4));

        // a stale short copy of c003 is in .part too (a stream that broke)
        crate::book_write(&books, "aeneid", "cccc", "chapters/c003.txt", b"ca").unwrap();
        let mut w = Fake::new().drive("i1", b"{}").drive("i2", b"arma").drive("i3", b"virum").drive("i4", b"cano");
        let (_, st) = go(&books, &job, &mut w);
        assert_eq!(st.why, None, "{st:?}");
        assert_eq!(
            w.gets(),
            vec![format!("GET {} tok-1", url("i3")), format!("GET {} tok-1", url("i4"))],
            "the two whole files are not fetched again; the short one is"
        );
        assert_eq!((st.pulled, st.done), (1, 4));
        assert_eq!(fs::read(books.join("aeneid").join("chapters").join("c003.txt")).unwrap(), b"cano");
        assert_eq!(fs::read(books.join("aeneid").join("book.json")).unwrap(), b"{}");
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn a_bad_rel_refuses_the_whole_job_and_nothing_is_fetched_or_written() {
        let books = scratch("refuse");
        for bad in ["../x", "/etc/passwd", "a/../../x", ".meta.json", "chapters/.hash", "a\\b", "", "a//b"] {
            let mut w = Fake::new().drive("i1", b"{}");
            let job = drive_job(vec![
                book("hamlet", "aaaa", vec![file("book.json", "i1", 2)]),
                book("othello", "bbbb", vec![file("book.json", "i1", 2), file(bad, "i1", 2)]),
            ]);
            let (_, st) = go(&books, &job, &mut w);
            let why = st.why.unwrap_or_default();
            assert!(why.starts_with("othello: "), "{bad:?} -> {why}");
            assert!(w.log.is_empty(), "{bad:?}: nothing asked of the network");
            assert!(!books.join(crate::BOOKS_PART).exists() && crate::book_rows(&books).is_empty(), "{bad:?}: nothing written");
            assert!(!st.running && st.ended.is_some());
        }
        // and the other refusals, each a sentence
        let mut cases: Vec<(Job, &str)> = Vec::new();
        let mut j = drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i/../1", 2)])]);
        cases.push((j.clone(), "no Drive id"));
        j = drive_job(vec![book("Hamlet", "aaaa", vec![file("book.json", "i1", 2)])]);
        cases.push((j.clone(), "not a book slug"));
        j = drive_job(vec![book("hamlet", "AAAA", vec![file("book.json", "i1", 2)])]);
        cases.push((j.clone(), "not a book hash"));
        j = drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i1", 2)]), book("hamlet", "bbbb", vec![file("book.json", "i1", 2)])]);
        cases.push((j.clone(), "twice"));
        j = drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i1", 2), file("book.json", "i2", 2)])]);
        cases.push((j.clone(), "listed twice"));
        j = drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i1", 2)])]);
        j.books[0].meta = "[]".into();
        cases.push((j.clone(), "JSON object"));
        j = drive_job(vec![book("hamlet", "aaaa", vec![])]);
        cases.push((j.clone(), "no files"));
        j = drive_job(vec![]);
        j.auth = Auth::default();
        cases.push((j.clone(), "no token"));
        j = drive_job(vec![]);
        j.transport = "icloud".into();
        cases.push((j.clone(), "not a transport"));
        let lan = |base: &str, path: &str| Job {
            transport: "lan".into(),
            auth: Auth { base: Some(base.into()), token: Some("t".into()), ..Auth::default() },
            books: vec![Book { files: vec![File { rel: "book.json".into(), url: Some(path.into()), ..File::default() }], ..book("hamlet", "aaaa", vec![]) }],
            ..Job::default()
        };
        cases.push((lan("http://192.168.1.5:41499", "https://evil.example/x"), "no path on Studio"));
        cases.push((lan("http://192.168.1.5:41499", "//evil.example/x"), "no path on Studio"));
        cases.push((lan("http://192.168.1.5:41499", "/books/hamlet/book.json?x=1"), "no path on Studio"));
        cases.push((lan("file:///etc", "/books/hamlet/book.json"), "not a Studio address"));
        cases.push((lan("http://u@evil/", "/books/hamlet/book.json"), "not a Studio address"));
        for (job, words) in cases {
            let mut w = Fake::new();
            let (_, st) = go(&books, &job, &mut w);
            let why = st.why.clone().unwrap_or_default();
            assert!(why.contains(words), "{words:?} not in {why:?}");
            assert!(w.log.is_empty(), "{words}: nothing fetched");
        }
        assert!(!books.join(crate::BOOKS_PART).exists());
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn an_expiring_token_is_refreshed_with_the_refresh_token_and_no_secret() {
        let books = scratch("refresh");
        let mut w = Fake::new().drive("i1", b"{}").drive("i2", b"arma");
        let mut job = drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i1", 2), file("chapters/c001.txt", "i2", 4)])]);
        job.auth.expires = Some((w.clock + 30_000) as f64); // inside the minute
        let (_, st) = go(&books, &job, &mut w);
        assert_eq!(st.why, None, "{st:?}");
        assert_eq!(
            w.log,
            vec![
                format!("POST {GOOGLE_TOKEN} client_id=12-abc.apps.googleusercontent.com&refresh_token=refresh-1&grant_type=refresh_token"),
                format!("GET {} tok-2", url("i1")),
                format!("GET {} tok-2", url("i2")),
            ],
            "drive.js::googleRefresh's request, exactly: no client_secret; then the new token, once"
        );
        assert_eq!(st.google, Some(Token { access: "tok-2".into(), expires: 1_000_000 + 3_599_000 }), "handed back for the page's key");
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn a_401_mid_run_refreshes_once_and_a_refused_refresh_is_a_sentence() {
        let books = scratch("401");
        // Drive stops taking tok-1 half-way (revoked, or the clock lied)
        let mut w = Fake::new().drive("i1", b"{}").drive("i2", b"arma");
        w.can(&url("i2"), Canned::Status(401, "expired"));
        let job = drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i1", 2), file("chapters/c001.txt", "i2", 4)])]);
        let (_, st) = go(&books, &job, &mut w);
        assert_eq!(st.why, None, "{st:?}");
        assert_eq!(w.log.iter().filter(|l| l.starts_with("POST")).count(), 1);
        assert_eq!(w.log.last().unwrap(), &format!("GET {} tok-2", url("i2")));
        assert_eq!(st.pulled, 1);

        let books2 = scratch("401b");
        let mut w = Fake::new().drive("i1", b"{}");
        w.valid = "nobody".into();
        w.refresh = (400, r#"{"error": "invalid_grant", "error_description": "Token has been expired or revoked."}"#.into());
        let (_, st) = go(&books2, &drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i1", 2)])]), &mut w);
        assert_eq!(st.why.as_deref(), Some("The hamlet: the refresh was refused: HTTP 400 (invalid_grant)"));
        assert!(crate::book_rows(&books2).is_empty() && st.google.is_none());
        let _ = fs::remove_dir_all(&books);
        let _ = fs::remove_dir_all(&books2);
    }

    #[test]
    fn sync_stop_finishes_the_current_file_then_stops_and_a_restart_takes_the_rest() {
        let books = scratch("stop");
        let mk = || Fake::new().drive("i1", b"{}").drive("i2", b"arma").drive("i3", b"virum").drive("i4", b"x");
        let job = drive_job(vec![
            book("aeneid", "cccc", vec![file("book.json", "i1", 2), file("chapters/c001.txt", "i2", 4), file("chapters/c002.txt", "i3", 5)]),
            book("hamlet", "aaaa", vec![file("book.json", "i4", 1)]),
        ]);
        let mut w = mk();
        w.stop_on = Some((2, Arc::new(Pull::default()))); // pressed while the 2nd file is downloading
        let (pull, st) = go(&books, &job, &mut w);
        assert_eq!(st.why.as_deref(), Some("stopped"));
        assert_eq!(w.gets().len(), 2, "the file in flight finished; the third was never asked for");
        assert_eq!((st.done, st.pulled, st.running), (2, 0, false));
        assert_eq!(book_have(&books, "aeneid", "cccc", "chapters/c001.txt"), Some(4), "the current file is whole");
        assert!(crate::book_rows(&books).is_empty());
        assert!(!pull.request_stop(), "nothing left to stop");

        let mut w = mk();
        let (_, st) = go(&books, &job, &mut w);
        assert_eq!(st.why, None);
        assert_eq!(w.gets(), vec![format!("GET {} tok-1", url("i3")), format!("GET {} tok-1", url("i4"))]);
        assert_eq!(st.pulled, 2);
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn the_network_is_retried_a_short_body_is_not_a_file_and_a_404_is_a_sentence() {
        let books = scratch("retry");
        let mut w = Fake::new().drive("i1", b"{}");
        w.can(&url("i1"), Canned::Lost);
        w.can(&url("i1"), Canned::Status(503, "busy"));
        let job = drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i1", 2)])]);
        let (_, st) = go(&books, &job, &mut w);
        assert_eq!(st.why, None, "{st:?}");
        assert_eq!(w.log.iter().filter(|l| l.starts_with("WAIT")).cloned().collect::<Vec<_>>(), vec!["WAIT 1000", "WAIT 3000"]);

        // a body shorter than listed, every time: tried TRIES times, then said
        let books2 = scratch("short");
        let mut w = Fake::new().drive("i1", b"{");
        let (_, st) = go(&books2, &drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i1", 2)])]), &mut w);
        assert_eq!(st.why.as_deref(), Some("The hamlet: book.json: 1 bytes arrived, 2 were listed"));
        assert_eq!(w.gets().len(), TRIES);
        assert!(crate::book_rows(&books2).is_empty());

        // an unknown size is taken as it comes (a chapter Studio has not transcoded yet)
        let books3 = scratch("nosize");
        let mut w = Fake::new().drive("i1", b"{}").drive("i2", b"OggS");
        let mut f = file("audio/c001.opus", "i2", 0);
        f.bytes = None;
        let (_, st) = go(&books3, &drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i1", 2), f])]), &mut w);
        assert_eq!((st.why.as_deref(), st.pulled), (None, 1));

        // a 404 is not the network: said at once, no retry
        let books4 = scratch("404");
        let mut w = Fake::new();
        let (_, st) = go(&books4, &drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "gone", 2)])]), &mut w);
        assert_eq!(st.why.as_deref(), Some("The hamlet: Drive: book.json -> HTTP 404 (File not found)"));
        assert_eq!(w.gets().len(), 1);
        for d in [books, books2, books3, books4] {
            let _ = fs::remove_dir_all(d);
        }
    }

    #[test]
    fn the_lan_asks_studio_by_path_with_the_pair_token_and_no_bearer() {
        let books = scratch("lan");
        let mut w = Fake::new();
        let base = "http://192.168.1.5:41499";
        w.files.insert(format!("{base}/books/hamlet/book.json?t=a%2Fb%20c"), b"{}".to_vec());
        w.files.insert(format!("{base}/sync/audio/hamlet/c001.opus?t=a%2Fb%20c"), b"OggS".to_vec());
        let job = Job {
            transport: "lan".into(),
            trigger: "foreground".into(),
            auth: Auth { base: Some(base.into()), token: Some("a/b c".into()), ..Auth::default() },
            books: vec![Book {
                files: vec![
                    File { rel: "book.json".into(), url: Some("/books/hamlet/book.json".into()), bytes: Some(2), id: None },
                    File { rel: "audio/c001.opus".into(), url: Some("/sync/audio/hamlet/c001.opus".into()), bytes: None, id: None },
                ],
                ..book("hamlet", "aaaa", vec![])
            }],
            why: None,
        };
        let (_, st) = go(&books, &job, &mut w);
        assert_eq!(st.why, None, "{st:?}");
        assert_eq!(
            w.gets(),
            vec![
                format!("GET {base}/books/hamlet/book.json?t=a%2Fb%20c -"),
                format!("GET {base}/sync/audio/hamlet/c001.opus?t=a%2Fb%20c -"),
            ]
        );
        assert_eq!((st.transport.as_str(), st.trigger.as_str(), st.pulled), ("lan", "foreground", 1));
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn an_installed_version_is_skipped_and_a_newer_one_replaces_it() {
        let books = scratch("skip");
        crate::book_write(&books, "hamlet", "aaaa", "book.json", b"{}").unwrap();
        crate::book_commit(&books, "hamlet", "aaaa", "{}").unwrap();
        let mut w = Fake::new().drive("i1", b"{\"v\":2}");
        let (_, st) = go(&books, &drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i1", 7)])]), &mut w);
        assert_eq!((st.why.as_deref(), st.skipped, st.pulled), (None, 1, 0));
        assert!(w.log.is_empty());
        let (_, st) = go(&books, &drive_job(vec![book("hamlet", "bbbb", vec![file("book.json", "i1", 7)])]), &mut w);
        assert_eq!((st.skipped, st.pulled), (0, 1));
        assert_eq!(book_installed(&books, "hamlet").as_deref(), Some("bbbb"));
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn a_job_the_page_could_not_plan_is_recorded_as_its_reason() {
        let books = scratch("why");
        let mut job = drive_job(vec![]);
        job.trigger = "launch".into();
        job.why = Some("Drive: GET /files -> HTTP 403 (insufficient scope)".into());
        let mut w = Fake::new();
        let (_, st) = go(&books, &job, &mut w);
        assert_eq!(st.why, job.why);
        assert_eq!((st.running, st.trigger.as_str(), st.n), (false, "launch", 0));
        // an empty job is a run that found nothing to do: up to date
        let (_, st) = go(&books, &drive_job(vec![]), &mut w);
        assert_eq!((st.why, st.pulled, st.n, st.ended.is_some()), (None, 0, 0, true));
        assert!(w.log.is_empty());
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn start_runs_on_its_own_thread_and_a_second_start_leaves_the_first_alone() {
        let books = scratch("thread");
        let pull = Arc::new(Pull::default());
        let job = drive_job(vec![book("hamlet", "aaaa", vec![file("book.json", "i1", 2)])]);
        // a claim held: a second start answers the running status and changes nothing
        let held = pull.begin(&job, 5).unwrap();
        assert!(held.running && held.n == 1);
        let again = start(pull.clone(), books.clone(), drive_job(vec![]), Fake::new());
        assert_eq!(again, held, "the running pull's status, untouched");
        pull.end(None, 6);

        let st = start(pull.clone(), books.clone(), job, Fake::new().drive("i1", b"{}"));
        assert!(st.running, "answered at once, running");
        let t0 = std::time::Instant::now();
        while pull.snapshot().running {
            assert!(t0.elapsed().as_secs() < 10, "the thread never finished");
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
        let st = pull.snapshot();
        assert_eq!((st.pulled, st.why.as_deref()), (1, None));
        assert_eq!(book_installed(&books, "hamlet").as_deref(), Some("aaaa"));
        let _ = fs::remove_dir_all(&books);
    }

    #[test]
    fn the_small_pieces() {
        assert_eq!(enc("a/b c?é"), "a%2Fb%20c%3F%C3%A9");
        assert_eq!(enc("0123-_.~"), "0123-_.~");
        assert_eq!(json_number(r#"{"access_token": "x", "expires_in": 3599, "scope": "y"}"#, "expires_in"), Some(3599));
        assert_eq!(json_number(r#"{"expires_in":42}"#, "expires_in"), Some(42));
        assert_eq!(json_number(r#"{"a": 1}"#, "expires_in"), None);
        assert!(auto_js("launch").contains(r#"window.TTSTVHost.sync.auto("launch")"#));
        assert!(auto_js("foreground").contains(r#"auto("foreground")"#));
        assert!(auto_js("\");alert(1);//").contains(r#"auto("foreground")"#), "only the two words ever reach the page");
        assert!(auto_js("launch").starts_with("try {"));
    }
}
