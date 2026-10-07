import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nameCueAt, type NameCues } from "../packages/chaff/src/name-cue.ts";

// 敬称の無い名前を、前後の語から人の名前と読む（name-variant）。例文はすべて自作。

const cues: NameCues = { leads: ["担当の", "私、"], suffixes: ["様", "さん"], particles: ["です", "まで", "が"] };

/** text の中で最初に書いた name の読み。 */
const cueOf = (text: string, name: string): string | undefined => nameCueAt(text, text.indexOf(name), name, cues);

describe("nameCueAt: 名前の前後の語", () => {
  it("人を指す前置きか、敬称が付けば person", () => {
    assert.equal(cueOf("担当の斎藤です。", "斎藤"), "person");
    assert.equal(cueOf("私、斎藤が伺います。", "斎藤"), "person");
    assert.equal(cueOf("斉藤様へ", "斉藤"), "person");
    assert.equal(cueOf("𠮷田さん", "𠮷田"), "person");
  });

  it("名前のすぐ後ろに来る語なら slot、どちらも無ければ bare", () => {
    assert.equal(cueOf("斉藤までご連絡ください。", "斉藤"), "slot");
    assert.equal(cueOf("そこで髙橋が答えた。", "髙橋"), "slot");
    assert.equal(cueOf("署名: 高橋", "高橋"), "bare");
    assert.equal(cueOf("沢山の資料", "沢山"), "bare");
  });

  it("前後に漢字が続けば、長い連なりの一部で、名前と読まない", () => {
    assert.equal(cueOf("鹿嶋市まで", "鹿嶋"), undefined);
    assert.equal(cueOf("担当の斉藤商事です", "斉藤"), undefined);
    assert.equal(cueOf("株式会社髙橋様", "髙橋"), undefined);
  });

  it("2〜4 字の漢字でなければ、名前と読まない", () => {
    assert.equal(cueOf("担当の斎です", "斎"), undefined);
    assert.equal(cueOf("担当の斎藤太郎丸です", "斎藤太郎丸"), undefined);
    assert.equal(cueOf("担当のサイトウです", "サイトウ"), undefined);
    assert.equal(cueOf("高い山です", "高い"), undefined);
    assert.equal(nameCueAt("担当の斎藤です", 3, "", cues), undefined);
  });

  it("文書の端と、語彙の空な場合", () => {
    assert.equal(cueOf("斎藤", "斎藤"), "bare");
    assert.equal(cueOf("担当の斎藤", "斎藤"), "person");
    const empty = { leads: [], suffixes: [], particles: [] };
    assert.equal(nameCueAt("担当の斎藤です", 3, "斎藤", empty), "bare");
    assert.equal(nameCueAt("𠮷高橋まで", 2, "高橋", empty), undefined);
    assert.equal(nameCueAt("高橋𠮷まで", 0, "高橋", empty), undefined);
    assert.equal(nameCueAt("ご連絡は、斎藤でございます", 5, "斎藤", { ...empty, particles: ["でございます"] }), "slot");
  });
});
