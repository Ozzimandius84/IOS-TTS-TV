// Frank declares no commands. The desktop app's build.rs lists twenty-eight
// (`tabs_*`, `host_*`) because its pages call them through `window.TTSTVHost`;
// the shell Frank ships is the PWA byte-for-byte and calls nothing -- it is
// the same HTML that runs in a browser tab with no Tauri under it at all.
// When sync gives Frank its first command, it is declared here.
fn main() {
    tauri_build::build()
}
