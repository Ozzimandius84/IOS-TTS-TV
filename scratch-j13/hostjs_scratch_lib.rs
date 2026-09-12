pub mod search {
pub const CMD: &str = "frank_search";
pub const DOOR: &str = "x-web-search:";
pub const SEARCH: &str = "https://www.google.com/search?q=";
}
pub const HOST_JS: &str = r#"(function () {
  "use strict";
  var TAURI = window.__TAURI__ && window.__TAURI__.core;
  if (!TAURI || typeof TAURI.invoke !== "function") return;
  window.TTSTVHost = window.TTSTVHost || {};
  /* the Bonjour browse behind the Transfer tab's Sync button (job 26) */
  window.TTSTVHost.syncDiscover = function (ms) { return TAURI.invoke("sync_discover", { ms: ms }); };
  window.TTSTVHost.deviceName = "Frank on this phone";
  /* design/reader/search.html's COVERED, in its order, and its webQuery():
     the words, then -site: for every source the app already covers. The
     same two lines desktop/src/host.js carries; the sheet adds nothing. */
  var COVERED = ["gutenberg.org", "archive.org", "youtube.com", "wikipedia.org", "wiktionary.org"];
  var webQuery = function (q) { return q + COVERED.map(function (d) { return " -site:" + d; }).join(""); };
  // TTSTVHost.search(q: string) -> Promise<string | null>
  window.TTSTVHost.search = function (q) {
    const query = String(q == null ? "" : q).trim();
    if (!query) return Promise.resolve(null);
    const web = webQuery(query);
    return TAURI.invoke("frank_search", { query: web }).then(() => "sheet");
  };
})();
"#;
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn the_host_object_calls_its_two_commands_and_nothing_else() {
        // the page reaches the browse through window.TTSTVHost.syncDiscover
        // and the browse is the command build.rs declares; the reader reaches
        // the sheet through window.TTSTVHost.search and the sheet is the name
        // search.rs's wrapper answers (job 13) -- two commands, two calls
        assert!(HOST_JS.contains("window.TTSTVHost.syncDiscover"));
        assert!(HOST_JS.contains(r#"invoke("sync_discover""#));
        assert!(HOST_JS.contains("window.TTSTVHost.search = function (q)"));
        assert!(HOST_JS.contains(&format!(r#"invoke("{}", {{ query: web }})"#, search::CMD)));
        assert_eq!(HOST_JS.matches("invoke(").count(), 2, "two commands, two calls");
        assert!(HOST_JS.contains("const TAURI = window.__TAURI__ && window.__TAURI__.core")
            || HOST_JS.contains("var TAURI = window.__TAURI__ && window.__TAURI__.core"));
        assert!(HOST_JS.contains("if (!TAURI"), "a page outside Frank gets no host object");
    }

    #[test]
    fn search_is_the_desktop_hosts_shape_and_the_sheet_takes_the_site_form() {
        // the name and shape lookup.js guards on, exactly as desktop/src/host.js
        // spells them: q in, Promise<string | null> out, null for nothing
        assert!(HOST_JS.contains("// TTSTVHost.search(q: string) -> Promise<string | null>"));
        assert!(HOST_JS.contains(r#"const query = String(q == null ? "" : q).trim();"#));
        assert!(HOST_JS.contains("if (!query) return Promise.resolve(null);"));
        assert!(HOST_JS.contains(r#".then(() => "sheet")"#));
        // the -site: form is built HERE (search.rs never builds it), from the
        // mock's five domains in the mock's order -- host.js's own two lines
        let covered = r#"["gutenberg.org", "archive.org", "youtube.com", "wikipedia.org", "wiktionary.org"]"#;
        assert!(HOST_JS.contains(covered), "COVERED is the mock's list, in its order");
        assert!(HOST_JS.contains(r#"" -site:" + d"#));
        assert!(HOST_JS.contains("const web = webQuery(query);"));
        // and it is `web`, not the bare word, that crosses to the sheet
        assert!(!HOST_JS.contains(r#"invoke("frank_search", { query })"#));
        assert!(!HOST_JS.contains(r#"invoke("frank_search", { query: query })"#));
        // HOST_JS never touches location or window.open: the sheet is the
        // wrapper's (search.rs), reached through invoke and nothing else
        assert!(!HOST_JS.contains("location."));
        assert!(!HOST_JS.contains("window.open"));
        assert!(!HOST_JS.contains(search::DOOR), "door one is search.rs's, not the host's");
    }

}
