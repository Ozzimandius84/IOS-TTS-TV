/*  FrankInbox.m -- the two roots an incoming file can land in, and the only
    reason Rust can name either of them.
    ---------------------------------------------------------------------
    C2/K8, 13 September. A PDF shared out of Safari reaches this app by one of
    two roads, and NEITHER of them has a path Rust can compute:

      Copy to Frank        the OS copies the file into the app's OWN container,
      (CFBundleDocumentTypes)  at <home>/Documents/Inbox/<name>. `NSHomeDirectory`
                           is a per-install UUID path, so it is asked for, never
                           built. Costs no entitlement and no extension: the
                           document types in `gen/apple/project.yml` are the whole
                           of it, and a FREE personal team signs it unchanged.

      Share -> Frank       a share EXTENSION is a different process with a
      (the extension)      different container, and the only supported way for it
                           to hand anything to the app is an APP GROUP container:
                           <shared>/AppGroup/<UUID>/. That path is not derivable
                           either, and the call that answers it returns nil when
                           the entitlement is absent or unsigned -- which is the
                           honest signal we want, not a crash.

    So: two calls into Foundation, both answering into a caller's buffer. That
    a group root comes back NULL is a RESULT, not an error -- it is exactly how
    `inbox.rs` reports "the App Group is not signed on this build", which is the
    answer K8 exists to give if a personal team cannot carry the entitlement.

    WHY OBJECTIVE-C AND NOT SWIFT -- the answer `FrankAudio.m` and
    `FrankSearch.m` already give: the caller is Rust, a `.m` file exports plain
    C symbols an `extern "C"` block links against, and a Swift function would
    need `@_cdecl` plus a bridging header for nothing. The share extension
    itself IS Swift, because its caller is the OS, not Rust.

    WHERE THIS FILE IS COMPILED. `build.rs`, by the `cc` crate, into its own
    archive (`frankinbox`) beside `frankaudio`, `frankwebview` and
    `franksearch` -- the house pattern, and the reason is in `build.rs`'s own
    note: a second `.file()` on one build is a lie about which archive holds
    what. It is therefore deliberately ABSENT from the Xcode target's
    `sources`: two compilations of one file is `duplicate symbol
    _frank_inbox_documents` twenty minutes into a phone build.

    NO FRAMEWORK IS ADDED BY THIS FILE. Foundation only, which the crate
    already links.

    Return codes are ints because they cross an FFI boundary; `inbox.rs` turns
    them into the sentence that goes in the log.
      0 ok, `out` holds a NUL-terminated path
      2 no such container (no entitlement, not signed for it, or not iOS)
      3 the path did not fit in `cap` bytes
      4 a NULL argument
*/
#import <Foundation/Foundation.h>

/// Copy `path` into `out` as UTF-8 with a NUL. Shared by both calls below so
/// the "did it fit" rule is written once.
static int frank_inbox_put(NSString *path, char *out, int cap) {
    if (out == NULL || cap <= 0) return 4;
    out[0] = '\0';
    if (path.length == 0) return 2;
    const char *utf8 = path.fileSystemRepresentation;
    if (utf8 == NULL) return 2;
    size_t n = strlen(utf8);
    if (n + 1 > (size_t)cap) return 3;
    memcpy(out, utf8, n + 1);
    return 0;
}

/// `<app container>/Documents` -- where "Copy to Frank" puts a shared file
/// (inside its own `Inbox/` subfolder, which the OS creates and which this
/// call deliberately does NOT append: `inbox.rs` owns that name, because it is
/// the one part of the path that is Apple's convention rather than this
/// phone's identity).
///
/// `NSSearchPathForDirectoriesInDomains` and not `NSHomeDirectory() +
/// @"/Documents"`: the two agree today on iOS and the search path is the one
/// Apple documents as the answer.
int frank_inbox_documents(char *out, int cap) {
    NSArray<NSString *> *dirs =
        NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    return frank_inbox_put(dirs.firstObject, out, cap);
}

/// The App Group container shared with the share extension, or `2` if this
/// build does not carry the entitlement.
///
/// THIS IS THE MEASUREMENT. `containerURLForSecurityApplicationGroupIdentifier:`
/// answers nil when the running binary's entitlements do not name the group --
/// so a build signed by a team that cannot carry `com.apple.security.
/// application-groups` reports `2` here and says so in the log, rather than
/// failing somewhere less legible.
int frank_inbox_group(const char *group_id, char *out, int cap) {
    if (group_id == NULL) return 4;
    NSString *gid = [NSString stringWithUTF8String:group_id];
    if (gid.length == 0) return 4;
    NSURL *url = [NSFileManager.defaultManager
        containerURLForSecurityApplicationGroupIdentifier:gid];
    if (url == nil) {
        NSLog(@"frank: no App Group container for %@ -- the entitlement is absent or unsigned", gid);
        return 2;
    }
    return frank_inbox_put(url.path, out, cap);
}
