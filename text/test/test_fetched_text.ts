import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charsetOf, decodeFetched } from "../scripts/fetched-text.ts";

// 取得した本文を、宣言された文字コードで読む。例文はすべて自作。

const SHIFT_JIS_HOKOKU = Uint8Array.from([0x95, 0xf1, 0x8d, 0x90]); // 「報告」

const bytesOf = (...parts: readonly (string | Uint8Array)[]): Uint8Array =>
  Uint8Array.from(parts.flatMap((part) => [...(typeof part === "string" ? new TextEncoder().encode(part) : part)]));

describe("charsetOf", () => {
  it("Content-Type の charset を先に、無ければ meta か XML 宣言、どれも無ければ utf-8", () => {
    assert.equal(charsetOf("text/html; charset=Shift_JIS", '<meta charset="euc-jp">'), "shift_jis");
    assert.equal(charsetOf("text/html", '<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS" />'), "shift_jis");
    assert.equal(charsetOf(null, "<meta charset='EUC-JP'>"), "euc-jp");
    assert.equal(charsetOf(null, '<?xml version="1.0" encoding="Shift_JIS"?><html>'), "shift_jis");
    assert.equal(charsetOf(null, ""), "utf-8");
  });

  it("本文中の charset= や encoding= という文字は宣言として読まない", () => {
    assert.equal(charsetOf("text/plain", "Set charset=latin1 in the config."), "utf-8");
    assert.equal(charsetOf("application/json", '{"text": "<?xml encoding=\\"x\\"?>"}'), "utf-8");
  });
});

describe("decodeFetched", () => {
  it("Shift_JIS と宣言されたページを Shift_JIS で読む", () => {
    const page = bytesOf('<?xml version="1.0" encoding="Shift_JIS"?><p>', SHIFT_JIS_HOKOKU, "</p>");
    assert.equal(decodeFetched(page, "text/html"), '<?xml version="1.0" encoding="Shift_JIS"?><p>報告</p>');
  });

  it("宣言が無ければ utf-8、知らない名前も utf-8 で読み、BOM は外す", () => {
    assert.equal(decodeFetched(bytesOf("﻿報告"), null), "報告");
    assert.equal(decodeFetched(bytesOf("報告"), "text/plain; charset=no-such-encoding"), "報告");
  });

  it("空の本文は空", () => {
    assert.equal(decodeFetched(new Uint8Array(), null), "");
  });
});
