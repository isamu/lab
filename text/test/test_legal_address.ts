import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { maskLegalAddresses } from "../packages/chaff/src/legal-address.ts";

// 法令の番地（第二十二条第二項）は漢字の連なりに数えず、区切りとして扱う。

describe("maskLegalAddresses", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["第二十二条第二項", "  "],
    ["第二百三十六条第一項第七号", "   "],
    ["第五十二条の二第一項", "  "],
    ["第十六条の二第五項に規定する", "  に規定する"],
    ["第三条の規定", " の規定"],
    ["第一編第二章第三節第一款第一目", "     "],
    ["金融商品取引法第二十四条第一項", "金融商品取引法  "],
    ["第二百九十八条第一項各号", "  各号"],
    ["第〇条", " "],
    ["第3条第2項", "第3条第2項"],
    ["第三者", "第三者"],
    ["第二", "第二"],
    ["次第", "次第"],
    ["二十二条", "二十二条"],
    ["第条", "第条"],
    ["情報処理推進機構認定試験", "情報処理推進機構認定試験"],
    ["", ""],
  ];
  cases.forEach(([source, masked]) => {
    it(`${source || "(空)"} → ${masked || "(空)"}`, () => {
      assert.equal(maskLegalAddresses(source), masked);
    });
  });
});
