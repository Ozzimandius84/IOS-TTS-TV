// library/unzip.js -- a zip reader small enough to ship inside the app shell.
//
// Why not a library. The shell is self-contained by design (PROMPTS/phone-app.md:
// "no build step", and a CDN is a network dependency in an offline-first app),
// and the phone imports a bundle by opening a .zip the bench wrote with Python's
// own `shutil.make_archive` -- one well-understood producer, two storage methods
// (0 = stored, 8 = deflate), no encryption, no zip64 in anything this project
// makes. That is a couple of hundred lines, and it is exact rather than nearly.
//
// What it does NOT do, deliberately, each refused by name rather than
// mis-parsed: zip64 (a bundle over 4 GB), encrypted entries, and any
// compression method other than 0 and 8. `entries()` throws on those with the
// method number in the message, so the Library can say why an import failed.
//
// deflate: `DecompressionStream("deflate-raw")` when the engine has it (Safari
// 16.4+, Chrome 103+) because it is native code; the pure-JS `inflateRaw`
// below when it does not, and it is the same function either way as far as the
// caller is concerned. Both paths are tested against real zips written by
// Python (reader/tests/test_unzip.py).
//
// Every entry's CRC-32 is checked against the one the zip's own directory
// records. A half-AirDropped bundle is the failure this catches, and it is
// the difference between "that file is damaged" and a book that reads fine
// until chapter 7.
"use strict";

const TTSTVUnzip = (() => {

  // ------------------------------------------------------------- bit reader
  function BitReader(bytes) {
    this.b = bytes; this.pos = 0; this.val = 0; this.cnt = 0;
  }
  BitReader.prototype.bits = function (need) {
    let val = this.val, cnt = this.cnt;
    while (cnt < need) {
      if (this.pos >= this.b.length) throw new Error("deflate: out of input");
      val |= this.b[this.pos++] << cnt;
      cnt += 8;
    }
    this.val = val >>> need;
    this.cnt = cnt - need;
    return val & ((1 << need) - 1);
  };

  // ---------------------------------------------------------- huffman (puff)
  const MAXBITS = 15;
  function buildHuff(lengths, n) {
    const count = new Array(MAXBITS + 1).fill(0);
    for (let i = 0; i < n; i++) count[lengths[i]]++;
    count[0] = 0;
    const offs = new Array(MAXBITS + 2).fill(0);
    for (let i = 1; i <= MAXBITS; i++) offs[i + 1] = offs[i] + count[i];
    const symbol = new Array(n).fill(0);
    for (let s = 0; s < n; s++) if (lengths[s]) symbol[offs[lengths[s]]++] = s;
    return { count, symbol };
  }
  function decodeSym(br, h) {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len <= MAXBITS; len++) {
      code |= br.bits(1);
      const count = h.count[len];
      if (code - first < count) return h.symbol[index + (code - first)];
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error("deflate: bad huffman code");
  }

  const LEN_BASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LEN_EXTRA = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DIST_BASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DIST_EXTRA = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const CLEN_ORDER = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

  let FIXED_LIT = null, FIXED_DIST = null;
  function fixedTables() {
    if (FIXED_LIT) return;
    const l = new Array(288);
    for (let i = 0; i < 144; i++) l[i] = 8;
    for (let i = 144; i < 256; i++) l[i] = 9;
    for (let i = 256; i < 280; i++) l[i] = 7;
    for (let i = 280; i < 288; i++) l[i] = 8;
    FIXED_LIT = buildHuff(l, 288);
    FIXED_DIST = buildHuff(new Array(30).fill(5), 30);
  }

  // Grows geometrically rather than trusting a declared size: the caller knows
  // the uncompressed size from the directory, but a corrupt zip is exactly the
  // case where that number is a lie, so it is checked afterwards, not obeyed.
  function Out(hint) {
    this.buf = new Uint8Array(Math.max(hint | 0, 1024));
    this.len = 0;
  }
  Out.prototype.need = function (n) {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length;
    while (cap < this.len + n) cap *= 2;
    const nb = new Uint8Array(cap);
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
  };
  Out.prototype.push = function (b) { this.need(1); this.buf[this.len++] = b; };

  function inflateRaw(bytes, sizeHint) {
    const br = new BitReader(bytes);
    const out = new Out(sizeHint || bytes.length * 4);
    for (;;) {
      const last = br.bits(1);
      const type = br.bits(2);
      if (type === 0) {                                  // stored
        br.val = 0; br.cnt = 0;                          // discard to byte boundary
        if (br.pos + 4 > bytes.length) throw new Error("deflate: truncated stored block");
        const len = bytes[br.pos] | (bytes[br.pos + 1] << 8);
        br.pos += 4;                                     // len + ~len
        out.need(len);
        out.buf.set(bytes.subarray(br.pos, br.pos + len), out.len);
        out.len += len; br.pos += len;
      } else if (type === 1 || type === 2) {
        let lit, dist;
        if (type === 1) { fixedTables(); lit = FIXED_LIT; dist = FIXED_DIST; }
        else {
          const nlen = br.bits(5) + 257, ndist = br.bits(5) + 1, ncode = br.bits(4) + 4;
          const clen = new Array(19).fill(0);
          for (let i = 0; i < ncode; i++) clen[CLEN_ORDER[i]] = br.bits(3);
          const clh = buildHuff(clen, 19);
          const lengths = new Array(nlen + ndist).fill(0);
          let i = 0;
          while (i < nlen + ndist) {
            const sym = decodeSym(br, clh);
            if (sym < 16) lengths[i++] = sym;
            else if (sym === 16) {
              if (i === 0) throw new Error("deflate: repeat with no previous length");
              const prev = lengths[i - 1];
              for (let r = br.bits(2) + 3; r > 0; r--) lengths[i++] = prev;
            } else if (sym === 17) { for (let r = br.bits(3) + 3; r > 0; r--) lengths[i++] = 0; }
            else { for (let r = br.bits(7) + 11; r > 0; r--) lengths[i++] = 0; }
          }
          lit = buildHuff(lengths.slice(0, nlen), nlen);
          dist = buildHuff(lengths.slice(nlen), ndist);
        }
        for (;;) {
          const sym = decodeSym(br, lit);
          if (sym < 256) out.push(sym);
          else if (sym === 256) break;
          else {
            const li = sym - 257;
            if (li >= LEN_BASE.length) throw new Error("deflate: bad length symbol " + sym);
            const length = LEN_BASE[li] + br.bits(LEN_EXTRA[li]);
            const ds = decodeSym(br, dist);
            const distance = DIST_BASE[ds] + br.bits(DIST_EXTRA[ds]);
            if (distance > out.len) throw new Error("deflate: distance before start of output");
            out.need(length);
            let from = out.len - distance;
            for (let k = 0; k < length; k++) out.buf[out.len++] = out.buf[from++];
          }
        }
      } else {
        throw new Error("deflate: reserved block type");
      }
      if (last) break;
    }
    return out.buf.subarray(0, out.len);
  }

  // ------------------------------------------------------------------ crc32
  let CRC_TABLE = null;
  function crcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[n] = c >>> 0;
    }
    return CRC_TABLE;
  }
  function crc32(bytes) {
    const t = crcTable();
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ------------------------------------------------------- central directory
  const EOCD_SIG = 0x06054b50, CEN_SIG = 0x02014b50, LOC_SIG = 0x04034b50;

  function u16(v, o) { return v.getUint16(o, true); }
  function u32(v, o) { return v.getUint32(o, true); }

  /** Every file entry in the zip, read from the central directory (never by
   *  scanning for local headers, which is what makes a self-extracting or
   *  concatenated archive misparse). Directory entries are dropped: a zip
   *  records folders as zero-length names ending in "/", and the bundle's
   *  shape is carried by the file paths themselves. */
  function entries(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // EOCD is at the end, but may be followed by up to 65535 bytes of comment.
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65535; i--) {
      if (u32(view, i) === EOCD_SIG) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("not a zip file (no end-of-central-directory record)");
    const count = u16(view, eocd + 10);
    let off = u32(view, eocd + 16);
    if (off === 0xFFFFFFFF || count === 0xFFFF) throw new Error("zip64 archives are not supported");
    const out = [];
    for (let i = 0; i < count; i++) {
      if (u32(view, off) !== CEN_SIG) throw new Error("corrupt central directory at entry " + i);
      const flag = u16(view, off + 8);
      const method = u16(view, off + 10);
      const crc = u32(view, off + 16);
      const csize = u32(view, off + 20);
      const size = u32(view, off + 24);
      const nameLen = u16(view, off + 28);
      const extraLen = u16(view, off + 30);
      const commentLen = u16(view, off + 32);
      const local = u32(view, off + 42);
      const name = new TextDecoder("utf-8").decode(bytes.subarray(off + 46, off + 46 + nameLen));
      off += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith("/")) continue;                       // a folder record
      if (flag & 0x1) throw new Error("encrypted zip entries are not supported: " + name);
      out.push({ name, method, crc, csize, size, local });
    }
    return out;
  }

  const NATIVE_INFLATE = (typeof DecompressionStream !== "undefined") && (() => {
    try { new DecompressionStream("deflate-raw"); return true; } catch (e) { return false; }
  })();

  async function nativeInflate(bytes) {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** The bytes of one entry, CRC-checked. `buffer` is the whole zip. */
  async function read(buffer, entry) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (u32(view, entry.local) !== LOC_SIG) throw new Error("corrupt local header for " + entry.name);
    const nameLen = u16(view, entry.local + 26);
    const extraLen = u16(view, entry.local + 28);
    const start = entry.local + 30 + nameLen + extraLen;
    const raw = bytes.subarray(start, start + entry.csize);
    let data;
    if (entry.method === 0) data = raw;
    else if (entry.method === 8) {
      // Every inflate failure is re-thrown against the entry's name: the
      // reader of this message is looking at a bundle that arrived badly,
      // and "deflate: distance before start of output" tells them nothing.
      try { data = NATIVE_INFLATE ? await nativeInflate(raw) : inflateRaw(raw, entry.size); }
      catch (e) { throw new Error(`${entry.name}: could not be unpacked (${e.message}) -- the file is damaged or was only partly transferred`); }
    }
    else throw new Error("unsupported zip compression method " + entry.method + " for " + entry.name);
    if (data.length !== entry.size) throw new Error(`${entry.name}: expected ${entry.size} bytes, got ${data.length}`);
    if (crc32(data) !== entry.crc) throw new Error(`${entry.name}: checksum mismatch -- the file is damaged or was only partly transferred`);
    return data;
  }

  return { entries, read, inflateRaw, crc32, NATIVE_INFLATE };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TTSTVUnzip;
if (typeof self !== "undefined") self.TTSTVUnzip = TTSTVUnzip;
