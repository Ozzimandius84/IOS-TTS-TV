/**
 * webkit_smoke.mjs -- the Library page, in a real WebKit, with the console read.
 *
 * The phone's engine is WebKit and the desk's is not, so "it draws in Chrome"
 * proves nothing about the thing Osca actually looks at. This serves `shell/`
 * exactly as the dev server does -- static files, off disk, correct MIME --
 * opens a page in Playwright's WebKit under the iPhone 15 descriptor, and
 * prints EVERY console error and pageerror with file:line. It is the whole
 * diagnosis for a blank page, and it is meant to be run every time.
 *
 *   npx playwright install webkit          # once
 *   node tests/webkit_smoke.mjs            # WebKit, then Chromium, and the diff
 *   node tests/webkit_smoke.mjs --engine webkit
 *   node tests/webkit_smoke.mjs --path /reader/reader.html?book=books%2Feuthyphro
 *
 * Exit 1 on: any console error, any pageerror, a missing SHELF, or a body
 * whose background is transparent -- that last one is not a nicety. A custom
 * property defined ONLY through a function the engine does not have (`--bg:
 * color-mix(...)`) is invalid at computed-value time, so `background:
 * var(--bg)` becomes `unset` and the page paints on whatever is behind the
 * webview. It raises no console error anywhere; the only way to see it is to
 * ask for the number.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const SHELL = join(REPO, "shell");

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const ENGINE = arg("--engine", "both");
const PAGE_PATH = arg("--path", "/library/library.html");
const WAIT_MS = Number(arg("--wait", "3000"));
const FLOW = !argv.includes("--no-flow");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav",
};

function serve(root) {
  return new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
      let file = join(root, rel);
      try {
        if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      } catch {
        res.writeHead(404).end("no");
        return;
      }
      try {
        const body = await readFile(file);
        res.writeHead(200, { "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404).end("no");
      }
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

/** What the page is, as numbers -- run inside the page, in both engines. */
const PROBE = `(() => {
  const cs = getComputedStyle(document.documentElement);
  const bs = getComputedStyle(document.body);
  const rect = (s) => { const e = document.querySelector(s); if (!e) return null;
    const r = e.getBoundingClientRect(); return {w:+r.width.toFixed(1), h:+r.height.toFixed(1)}; };
  return {
    title: document.title,
    shelfInDom: document.body.innerHTML.indexOf("SHELF") >= 0,
    railrow: document.querySelectorAll(".railrow").length,
    tile: document.querySelectorAll(".tile").length,
    paragraphs: document.querySelectorAll("p").length,
    firstRunCard: !!document.querySelector(".fr-gate"),
    supportsColorMix: !!(window.CSS && CSS.supports && CSS.supports("color", "color-mix(in oklab, #fff, #000 50%)")),
    bgVar: cs.getPropertyValue("--bg").trim(),
    bodyBackground: bs.backgroundColor,
    bodyColor: bs.color,
    railRect: rect(".rail") || rect("main"),
  };
})()`;

async function run(engineName, url) {
  const pw = await import("playwright");
  const engine = pw[engineName];
  const devices = pw.devices;
  const descriptor = devices["iPhone 15"] || devices["iPhone 14"] || {
    viewport: { width: 393, height: 852 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true,
  };
  // The Cowork container has a Chromium at a fixed path and no way to fetch
  // another (`cdn.playwright.dev` is not on the egress allowlist), so the
  // comparison half can be pointed at it. WebKit is the Mac's job: Playwright
  // has no WebKit build the container is allowed to download.
  const exe = process.env[`PLAYWRIGHT_${engineName.toUpperCase()}_PATH`];
  const browser = await engine.launch(exe ? { executablePath: exe } : {});
  const context = await browser.newContext({ ...descriptor });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => {
    const first = String(e.stack || "").split("\n").find((l) => /:\d+:\d+/.test(l)) || "";
    errors.push({ kind: "pageerror", text: e.message, where: first.trim(), stack: e.stack });
  });
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const l = m.location() || {};
    // A 404 is not a script error, and the engines do not agree that it is one
    // at all: Chromium logs "Failed to load resource" on the console and WebKit
    // says nothing. Counting it would make the two incomparable and would fail
    // the page for asking Studio a question no static host answers. Printed,
    // never counted -- `requestfailed` is the same class.
    const resource = /^Failed to load resource\b/.test(m.text());
    errors.push({
      kind: resource ? "resource" : "console." + m.type(), text: m.text(),
      where: l.url ? `${l.url}:${l.lineNumber ?? 0}:${l.columnNumber ?? 0}` : "",
    });
  });
  page.on("requestfailed", (r) =>
    errors.push({ kind: "requestfailed", text: `${r.url()} -- ${r.failure()?.errorText || "?"}`, where: "" }));

  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(WAIT_MS);
  const dom = await page.evaluate(PROBE);
  const ua = await page.evaluate("navigator.userAgent");

  /* ---- and then the three things a person does on this page, because a page
   * that draws and cannot be used is the same bug one step later. The context
   * is fresh, so the first-run gate is genuinely on its first run. */
  const flow = {};
  if (FLOW && PAGE_PATH.startsWith("/library/")) {
    flow.firstRunCardOnOpen = dom.firstRunCard;
    const skip = page.locator(".fr-gate button", { hasText: "Skip" }).first();
    if (await skip.count()) {
      await skip.click();
      await page.waitForTimeout(400);
    }
    flow.firstRunCardAfterSkip = await page.evaluate('!!document.querySelector(".fr-gate")');
    const row = page.locator(".railrow").first();
    if (await row.count()) {
      flow.slug = await row.getAttribute("data-slug");
      // `openReader` is `window.open(url, "_blank")` unless a host offers
      // `TTSTVHost.openReader` -- so in a browser the reader is a POPUP, not a
      // navigation, and the proof has to catch it. It is also the one thing on
      // this page that a WKWebView does not do by itself: see the report.
      const opened = await Promise.all([
        page.waitForEvent("popup", { timeout: 8000 }).catch(() => null),
        row.dblclick(),
      ]);
      const reader = opened[0] || page;
      await reader.waitForTimeout(3000);
      flow.opened = opened[0] ? "popup" : "same page";
      flow.url = reader.url();
      flow.paragraphs = await reader.evaluate("document.querySelectorAll('p').length");
    }
  }
  await browser.close();
  return { engine: engineName, ua, dom, flow, errors };
}

function report(r) {
  const hard = r.errors.filter((e) => e.kind === "pageerror" || e.kind === "console.error");
  console.log(`\n=== ${r.engine} ===`);
  console.log(`UA: ${r.ua}`);
  console.log(`DOM: ${JSON.stringify(r.dom)}`);
  console.log(`ERRORS: ${hard.length} hard, ${r.errors.length - hard.length} other`);
  for (const e of r.errors) {
    console.log(`  [${e.kind}] ${e.text}`);
    if (e.where) console.log(`        at ${e.where}`);
  }
  return hard;
}

const TRANSPARENT = /^rgba\(0,\s*0,\s*0,\s*0\)$|^transparent$/;

const server = await serve(SHELL);
const url = `http://127.0.0.1:${server.address().port}${PAGE_PATH}`;
console.log(`serving ${SHELL}\n  -> ${url}`);

const engines = ENGINE === "both" ? ["webkit", "chromium"] : [ENGINE];
const results = [];
for (const e of engines) results.push(await run(e, url));
server.close();

let bad = 0;
for (const r of results) {
  const hard = report(r);
  if (hard.length) {
    bad++;
    console.log(`\nFIRST ERROR, verbatim (${r.engine}):\n${hard[0].stack || hard[0].text}`);
  }
  if (!r.dom.shelfInDom) { console.log(`FAIL ${r.engine}: "SHELF" is not in the DOM`); bad++; }
  if (FLOW && Object.keys(r.flow).length) {
    console.log(`FLOW: ${JSON.stringify(r.flow)}`);
    if (r.flow.firstRunCardOnOpen !== true) {
      console.log(`FAIL ${r.engine}: no first-run card on a first open`); bad++;
    }
    if (r.flow.firstRunCardAfterSkip !== false) {
      console.log(`FAIL ${r.engine}: the first-run card survived Skip`); bad++;
    }
    if (r.flow.slug) {
      const want = `reader.html?book=books%2F${r.flow.slug}`;
      if (!String(r.flow.url).includes(want)) {
        console.log(`FAIL ${r.engine}: double-tap went to ${r.flow.url}, not ...${want}`); bad++;
      }
      if (!(r.flow.paragraphs > 0)) {
        console.log(`FAIL ${r.engine}: the reader opened with ${r.flow.paragraphs} paragraphs`); bad++;
      }
    }
  }
  if (TRANSPARENT.test(r.dom.bodyBackground)) {
    console.log(`FAIL ${r.engine}: body background is ${r.dom.bodyBackground} -- ` +
      `--bg is "${r.dom.bgVar}" and CSS.supports(color-mix) is ${r.dom.supportsColorMix}. ` +
      `An engine without color-mix has no --bg at all, and the page paints on nothing.`);
    bad++;
  }
}
if (results.length === 2) {
  const [w, c] = results;
  console.log(`\n=== webkit vs chromium ===`);
  for (const k of ["railrow", "tile", "shelfInDom", "supportsColorMix", "bodyBackground", "paragraphs"]) {
    const same = JSON.stringify(w.dom[k]) === JSON.stringify(c.dom[k]);
    console.log(`  ${same ? "same" : "DIFF"}  ${k}: webkit=${JSON.stringify(w.dom[k])} chromium=${JSON.stringify(c.dom[k])}`);
  }
}
console.log(bad ? `\nwebkit_smoke: FAIL (${bad})` : `\nwebkit_smoke: OK`);
process.exit(bad ? 1 : 0);
