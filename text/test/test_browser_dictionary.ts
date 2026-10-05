import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { unpacked } from "../packages/lang-ja/src/browser/dictionary-bytes.ts";
import { dictionaryFileUrl } from "../packages/lang-ja/src/browser/kuromoji-module.ts";
import { kuromojiDictionaryDir } from "../scripts/browser-files.ts";

// Each dictionary file as it arrives: still gzip (GitHub Pages) or already unpacked by the browser (a server that sends
// Content-Encoding: gzip). Either way the page gets the bytes kuromoji's own Node loader gets.

const DIR = kuromojiDictionaryDir();
const FILES = readdirSync(DIR).toSorted((left, right) => left.localeCompare(right, "en"));

const bytesOf = (buffer: Buffer): Uint8Array<ArrayBuffer> => new Uint8Array([...buffer]);

describe("kuromoji's dictionary in a browser", () => {
  it("unpacks a file that arrives as gzip", async () => {
    for (const file of FILES.filter((name) => name.startsWith("unk"))) {
      const packed = readFileSync(join(DIR, file));
      assert.deepEqual(Buffer.from(await unpacked(bytesOf(packed))), gunzipSync(packed), file);
    }
  });

  it("keeps a file that arrives unpacked", async () => {
    for (const file of FILES.filter((name) => name.startsWith("unk"))) {
      const plain = gunzipSync(readFileSync(join(DIR, file)));
      assert.deepEqual(Buffer.from(await unpacked(bytesOf(plain))), plain, file);
    }
  });

  it("fetches each file from the URL given, though kuromoji's join collapses https:// to https:/", () => {
    assert.equal(dictionaryFileUrl("https:/cdn.example/dict/base.dat.gz", "https://cdn.example/dict/"), "https://cdn.example/dict/base.dat.gz");
    assert.equal(dictionaryFileUrl("http:/127.0.0.1:9/cc.dat.gz", "http://127.0.0.1:9/"), "http://127.0.0.1:9/cc.dat.gz");
    assert.equal(dictionaryFileUrl("https:/a.example/x/y/unk.dat.gz", "https://a.example/x/y/"), "https://a.example/x/y/unk.dat.gz");
  });

  it("tells them apart for every file: no unpacked file starts as gzip does", () => {
    FILES.forEach((file) => {
      const plain = gunzipSync(readFileSync(join(DIR, file)));
      assert.ok(!(plain[0] === 0x1f && plain[1] === 0x8b), file);
    });
  });
});
