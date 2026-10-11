//! `web_fetch` -- the phone reaches the book hosts itself (PHONE-SEARCH, 11 Oct 2026).
//!
//! Osca, 11 Oct 12:58: "ANYTHING an iPhone 17 CAN do locally, the phone app
//! should do" -- and searching Gutenberg, Internet Archive, LibriVox,
//! Wikisource and the rest is a few small HTTPS calls, so it runs here, with
//! the Mac off (`design/surface-drafts/WHERE-IT-RUNS.md`). A `frank://` page
//! cannot `fetch()` these hosts itself: none of them sends
//! `Access-Control-Allow-Origin` for every answer (archive.org's downloads,
//! Gutenberg's files, LibriVox's API), so the bytes come through the app.
//!
//! # The one command
//!
//! `invoke("web_fetch", { url, as: "text" | "bytes", timeout_ms? })`
//!
//! * `as: "text"` answers `{ status, url, type, text }` for ANY HTTP status
//!   (a 404 is an answer, and the page needs to tell it from no answer);
//! * `as: "bytes"` answers the raw body (an IPC `Response`, no base64) on a
//!   2xx, and an error string otherwise -- this is what PHONE-ADD downloads a
//!   book file with.
//! * `form: {field: value}` (optional) sends the first hop as a form POST
//!   (`application/x-www-form-urlencoded`) to the same allowlisted hosts --
//!   Faded Page's own search (`csearc2.php`) reads only a POSTed form, and a
//!   GET answers its whole 9,157-book catalogue. A redirect after it is a GET.
//! * The error string starts with a word the page can branch on:
//!   `refused:` (this address is not one Frank searches -- nothing was sent),
//!   `no answer:` (timeout, DNS, TLS, connection -- the host did not answer),
//!   `http <code>:` (bytes only), `too big:`.
//!
//! # The allowlist, and why it is a list
//!
//! A page that could fetch any address through the app would be a proxy for
//! whatever script ran in it. So the command takes HTTPS addresses on the
//! hosts `tools/search/sources` asks (`HOSTS`, each source's own module) and
//! nothing else, and it checks EVERY redirect hop against the same list --
//! archive.org's download lands on `iaNNN.us.archive.org`, which is covered
//! by the registrable name, and a redirect to anywhere else is refused.
//! NOT on it, on purpose: YouTube (a cloud job -- another session), Dokumen
//! (never asked: a site known for pirated PDFs, `sources.NOT_ASKED`),
//! Hugging Face (asked only where a local index exists, never on a phone),
//! the Brave web search (a key on the Mac). `raw.githubusercontent.com`,
//! `codeload.github.com` and `api.github.com` are allowed only under the two
//! organisations the sources read (Perseus's TEI, Standard Ebooks' repos);
//! `www.googleapis.com` only under `/books/`.
//!
//! # Where it runs
//!
//! An `async` command whose blocking ureq call runs on the blocking pool, so
//! six sources asked at once are six calls at once and the main thread (the
//! webview's) never waits on a host.

use std::io::Read;
use std::time::Duration;

/// Hosts matched as the name itself or any subdomain of it.
pub const ALLOWED_HOSTS: &[&str] = &[
    "gutendex.com",
    "gutenberg.org",      // www., aleph., and the file mirrors
    "pglaf.org",          // Gutenberg's own mirror host
    "archive.org",        // + every iaNNN.us.archive.org a download lands on
    "librivox.org",
    "openlibrary.org",    // + covers.openlibrary.org
    "wikisource.org",     // en., la., el., zh., ... and the multilingual root
    "wikidata.org",       // www. (the Wikisource bridge) and query.
    "wikimedia.org",      // upload. -- a Wikisource scan's image
    "standardebooks.org",
    "fadedpage.com",
    "perseus.org",        // scaife.perseus.org
];

/// Hosts allowed only under a path prefix: a whole code host is too wide.
pub const ALLOWED_PREFIXES: &[(&str, &str)] = &[
    ("raw.githubusercontent.com", "/PerseusDL/"),
    ("api.github.com", "/repos/PerseusDL/"),
    ("api.github.com", "/orgs/standardebooks/"),
    ("api.github.com", "/repos/standardebooks/"),
    ("codeload.github.com", "/standardebooks/"),
    ("www.googleapis.com", "/books/"),
];

/// The hosts that answer 403 to a User-Agent without "Mozilla" in it --
/// `tools/search/common.py`'s `BROWSER_UA_HOSTS`, the same suffix rule.
const BROWSER_UA_HOSTS: &[&str] = &["gutenberg.org", "pglaf.org", "archive.org", "fadedpage.com"];
const BROWSER_UA: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) \
AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const HONEST_UA: &str = "Frank/1.0 (a reading app on one iPhone; not a crawler)";

pub const DEFAULT_TIMEOUT_MS: u64 = 20_000;
pub const MAX_TIMEOUT_MS: u64 = 120_000;
/// A search answer is small; a page of HTML is under a megabyte. 16 MB is
/// far past either and stops a wrong address filling the phone's memory.
pub const MAX_TEXT: u64 = 16 * 1024 * 1024;
/// A book file: the biggest epub on Osca's shelf is ~40 MB; a scanned PDF can
/// be ~150. Past this the add is a cloud job anyway (WHERE-IT-RUNS: OCR).
pub const MAX_BYTES: u64 = 300 * 1024 * 1024;
const MAX_HOPS: usize = 6;

/// `https://host[:port]/path?q` -> `(host, path)`, lowercased host, or None
/// for anything that is not https.
pub fn split_https(url: &str) -> Option<(String, String)> {
    let rest = url.strip_prefix("https://")?;
    let end = rest.find(|c| c == '/' || c == '?' || c == '#').unwrap_or(rest.len());
    let authority = &rest[..end];
    if authority.is_empty() || authority.contains('@') {
        return None; // no userinfo: "https://archive.org@evil.example/" is evil.example
    }
    let host = match authority.rsplit_once(':') {
        Some((h, port)) if port.chars().all(|c| c.is_ascii_digit()) => h,
        _ => authority,
    };
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    if host.is_empty() || !host.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-') {
        return None;
    }
    let path = &rest[end..];
    let path = if path.starts_with('/') { path.to_string() } else { format!("/{path}") };
    Some((host, path))
}

fn suffix_match(host: &str, name: &str) -> bool {
    host == name || host.ends_with(&format!(".{name}"))
}

/// Whether Frank may ask this address. The whole of the policy.
pub fn allowed(url: &str) -> Result<(), String> {
    let (host, path) = split_https(url)
        .ok_or_else(|| format!("refused: {} is not an https address", short(url)))?;
    if ALLOWED_HOSTS.iter().any(|h| suffix_match(&host, h)) {
        return Ok(());
    }
    // a prefix rule: no `..` may walk out of the prefix
    if !path.contains("/../") && !path.contains("%2e") && !path.contains("%2E") {
        for (h, p) in ALLOWED_PREFIXES {
            if host == *h && path.starts_with(p) {
                return Ok(());
            }
        }
    }
    Err(format!("refused: {host} is not one of the places Frank searches"))
}

fn short(s: &str) -> String {
    s.chars().take(80).collect()
}

fn ua_for(url: &str) -> &'static str {
    match split_https(url) {
        Some((h, _)) if BROWSER_UA_HOSTS.iter().any(|b| suffix_match(&h, b)) => BROWSER_UA,
        _ => HONEST_UA,
    }
}

/// `Location` against the address it came from: absolute, scheme-relative,
/// or a path on the same host.
pub fn resolve(base: &str, loc: &str) -> String {
    if loc.starts_with("https://") || loc.starts_with("http://") {
        return loc.to_string();
    }
    if let Some(rest) = loc.strip_prefix("//") {
        return format!("https://{rest}");
    }
    let origin_end = base
        .strip_prefix("https://")
        .map(|r| 8 + r.find('/').unwrap_or(r.len()))
        .unwrap_or(base.len());
    let origin = &base[..origin_end];
    if loc.starts_with('/') {
        format!("{origin}{loc}")
    } else {
        // relative to the base's directory
        let path_end = base.find('?').unwrap_or(base.len());
        let dir_end = base[..path_end].rfind('/').map(|i| i + 1).unwrap_or(path_end);
        let dir = if dir_end > origin_end { &base[..dir_end] } else { origin };
        if dir.ends_with('/') { format!("{dir}{loc}") } else { format!("{dir}/{loc}") }
    }
}

pub struct Got {
    pub status: u16,
    pub url: String,
    pub content_type: String,
    pub body: Vec<u8>,
}

/// The fetch itself, every hop checked. Blocking: called on the blocking pool.
pub fn get(url: &str, timeout_ms: u64, limit: u64, form: Option<&[(String, String)]>) -> Result<Got, String> {
    let t = Duration::from_millis(timeout_ms.clamp(1_000, MAX_TIMEOUT_MS));
    let agent = ureq::AgentBuilder::new()
        .redirects(0)
        .timeout(t) // the whole call, connect to last byte
        .build();
    let mut at = url.to_string();
    let mut form = form;
    for _ in 0..MAX_HOPS {
        allowed(&at)?;
        let sent = match form.take() {
            Some(f) => {
                let pairs: Vec<(&str, &str)> = f.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
                agent.post(&at).set("User-Agent", ua_for(&at)).send_form(&pairs)
            }
            None => agent.get(&at).set("User-Agent", ua_for(&at)).call(),
        };
        let res = match sent {
            Ok(r) => r,
            Err(ureq::Error::Status(_, r)) => r,
            Err(ureq::Error::Transport(e)) => return Err(format!("no answer: {e}")),
        };
        let status = res.status();
        if (300..400).contains(&status) {
            if let Some(loc) = res.header("Location") {
                let next = resolve(&at, loc);
                // http -> https on the same allowed host is how a few old
                // links still read; anything else plain-http is refused below.
                at = match next.strip_prefix("http://") {
                    Some(r) => format!("https://{r}"),
                    None => next,
                };
                continue;
            }
        }
        let content_type = res.header("Content-Type").unwrap_or("").to_string();
        let final_url = res.get_url().to_string();
        let mut body = Vec::new();
        res.into_reader()
            .take(limit + 1)
            .read_to_end(&mut body)
            .map_err(|e| format!("no answer: the answer broke off ({e})"))?;
        if body.len() as u64 > limit {
            return Err(format!("too big: more than {} MB", limit / (1024 * 1024)));
        }
        return Ok(Got { status, url: final_url, content_type, body });
    }
    Err(format!("no answer: more than {MAX_HOPS} redirects from {}", short(url)))
}

#[derive(serde::Serialize)]
pub struct TextAnswer {
    pub status: u16,
    pub url: String,
    #[serde(rename = "type")]
    pub content_type: String,
    pub text: String,
}

/// `as` is the page's word (`r#as` -- tauri-macros `unraw()`s the key).
#[tauri::command]
pub async fn web_fetch(
    url: String,
    r#as: Option<String>,
    timeout_ms: Option<u64>,
    form: Option<std::collections::BTreeMap<String, String>>,
) -> Result<tauri::ipc::Response, String> {
    let bytes = matches!(r#as.as_deref(), Some("bytes"));
    allowed(&url)?; // refused before a thread is taken
    let timeout = timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS);
    let limit = if bytes { MAX_BYTES } else { MAX_TEXT };
    let form: Option<Vec<(String, String)>> = form.map(|m| m.into_iter().collect());
    let got = tauri::async_runtime::spawn_blocking(move || get(&url, timeout, limit, form.as_deref()))
        .await
        .map_err(|e| format!("no answer: {e}"))??;
    if bytes {
        if !(200..300).contains(&got.status) {
            return Err(format!("http {}: {}", got.status, short(&got.url)));
        }
        return Ok(tauri::ipc::Response::new(got.body));
    }
    let ans = TextAnswer {
        status: got.status,
        url: got.url,
        content_type: got.content_type,
        text: String::from_utf8_lossy(&got.body).into_owned(),
    };
    let json = serde_json::to_string(&ans).map_err(|e| format!("no answer: {e}"))?;
    Ok(tauri::ipc::Response::new(json))
}

#[cfg(test)]
mod web_tests {
    use super::*;

    #[test]
    fn the_search_hosts_are_allowed() {
        for u in [
            "https://gutendex.com/books/?search=walden",
            "https://www.gutenberg.org/ebooks/205.epub3.images",
            "https://archive.org/advancedsearch.php?q=plato",
            "https://ia801604.us.archive.org/1/items/x/x.epub",
            "https://librivox.org/api/feed/audiobooks?title=walden",
            "https://openlibrary.org/search.json?q=dao",
            "https://covers.openlibrary.org/b/id/1-M.jpg",
            "https://en.wikisource.org/w/api.php?action=query",
            "https://www.wikidata.org/w/api.php",
            "https://standardebooks.org/ebooks/x",
            "https://www.fadedpage.com/csearch.php",
            "https://raw.githubusercontent.com/PerseusDL/canonical-greekLit/master/x.xml",
            "https://codeload.github.com/standardebooks/x/zip/refs/heads/master",
            "https://www.googleapis.com/books/v1/volumes?q=x",
            "https://archive.org:443/x",
        ] {
            assert!(allowed(u).is_ok(), "{u}");
        }
    }

    #[test]
    fn everything_else_is_refused_before_a_byte_is_sent() {
        for u in [
            "http://archive.org/x",                       // not https
            "https://www.youtube.com/results?q=x",        // cloud, another session
            "https://dokumen.pub/x",                      // never asked
            "https://huggingface.co/x",
            "https://api.search.brave.com/x",
            "https://evilarchive.org/x",                  // not a subdomain
            "https://archive.org.evil.example/x",
            "https://archive.org@evil.example/x",         // userinfo
            "https://raw.githubusercontent.com/someone/else",
            "https://raw.githubusercontent.com/PerseusDL/../x",
            "https://www.googleapis.com/drive/v3/files",
            "frank://localhost/x",
            "https://192.168.1.4:8765/state",
        ] {
            let e = allowed(u).unwrap_err();
            assert!(e.starts_with("refused:"), "{u}: {e}");
        }
    }

    #[test]
    fn a_redirect_is_resolved_against_where_it_came_from() {
        assert_eq!(resolve("https://archive.org/download/x/y.epub", "https://ia8.us.archive.org/1/y.epub"),
                   "https://ia8.us.archive.org/1/y.epub");
        assert_eq!(resolve("https://www.gutenberg.org/ebooks/1.epub", "/cache/epub/1/pg1.epub"),
                   "https://www.gutenberg.org/cache/epub/1/pg1.epub");
        assert_eq!(resolve("https://a.archive.org/d/x?q=1", "y"), "https://a.archive.org/d/y");
        assert_eq!(resolve("https://a.archive.org", "//b.archive.org/z"), "https://b.archive.org/z");
    }

    #[test]
    fn the_two_user_agents_follow_common_py() {
        assert_eq!(ua_for("https://ia1.us.archive.org/x"), BROWSER_UA);
        assert_eq!(ua_for("https://www.gutenberg.org/x"), BROWSER_UA);
        assert_eq!(ua_for("https://gutendex.com/books"), HONEST_UA);
    }
}
