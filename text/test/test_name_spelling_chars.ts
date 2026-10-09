import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { foldSpelling, foldedKeysOf, type SpellingChars } from "../packages/chaff/src/name-spelling-chars.ts";
import { nameVariants, type NameMention } from "../packages/chaff/src/name-variants.ts";

// 一語の名前の中で同じ音を書く字（桜ヶ丘・桜ケ丘・桜が丘）。例文はすべて自作。

const KE: SpellingChars = new Map([
  ["ヶ", "ヶ"],
  ["ケ", "ヶ"],
  ["が", "ヶ"],
]);

const variants = (source: string): readonly string[] => namedRuleRun("name-variant", source, ja, "a.md").findings;

const mention = (surface: string, offset: number, reading?: string): NameMention => ({ surface, offset, reading, words: [surface] });

const KANA_MESSAGE = (name: string, usual: string): string =>
  `「${name}」は、ほかの所では「${usual}」と書いています（名前の中の、同じ音を書く字の違い。ヶ と ケ など）`;

describe("name-variant: 名前の中の ヶ・ケ・が", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("本文の名前と、表の升の名前の 桜ヶ丘 と 桜ケ丘", () => {
    const listing = (cell: string): string =>
      `メゾン桜ヶ丘は駅から歩いて15分です。\n\n| 項目 | 内容 |\n| --- | --- |\n| 物件名 | メゾン${cell} 203号室 |\n\nメゾン桜ヶ丘の内見は平日に受け付けます。\n`;
    assert.deepEqual(variants(listing("桜ケ丘")), [KANA_MESSAGE("桜ケ丘", "桜ヶ丘")]);
    assert.deepEqual(variants(listing("桜ヶ丘")), []);
  });

  it("解析器が一語と読む 霞が関 は比べ、桜・が・丘 と読む書き方は助詞の が と分けられないので比べない", () => {
    assert.deepEqual(variants("霞ヶ関で降ります。霞ヶ関から歩き、帰りも霞が関から乗ります。\n"), [KANA_MESSAGE("霞が関", "霞ヶ関")]);
    assert.deepEqual(variants("桜ヶ丘に住んでいます。桜ヶ丘は静かな町です。春は桜が丘を彩ります。\n"), []);
  });

  it("字を抜いた形、違う漢字の名前、長い語の一部は言わない", () => {
    assert.deepEqual(variants("桜ヶ丘に住んでいます。桜ヶ丘は静かな町です。隣は桜丘です。\n"), []);
    assert.deepEqual(variants("桜丘に住んでいます。桜丘は静かな町です。隣は桜ヶ岡です。\n"), []);
    assert.deepEqual(variants("桜ヶ丘に住んでいます。桜ヶ丘は静かな町です。夜桜が丘を照らします。\n"), []);
  });
});

describe("the characters for one sound inside a name", () => {
  it("foldSpelling folds a lexicon character only between two kanji", () => {
    assert.equal(foldSpelling("桜ケ丘", KE), "桜ヶ丘");
    assert.equal(foldSpelling("桜が丘", KE), "桜ヶ丘");
    assert.equal(foldSpelling("桜ヶ丘", KE), "桜ヶ丘");
    assert.equal(foldSpelling("ケーキ", KE), "ケーキ");
    assert.equal(foldSpelling("アケミ", KE), "アケミ");
    assert.equal(foldSpelling("桜が", KE), "桜が");
    assert.equal(foldSpelling("桜ケ丘", new Map()), "桜ケ丘");
    assert.equal(foldSpelling("", KE), "");
  });

  it("foldedKeysOf gives a key only to a name holding a foldable character", () => {
    assert.deepEqual(foldedKeysOf("桜ケ丘", KE), ["桜ヶ丘"]);
    assert.deepEqual(foldedKeysOf("桜ヶ丘", KE), ["桜ヶ丘"]);
    assert.deepEqual(foldedKeysOf("桜丘", KE), []);
    assert.deepEqual(foldedKeysOf("Content-Type", KE), []);
    assert.deepEqual(foldedKeysOf("桜ケ丘", new Map()), []);
  });

  it("nameVariants: the fold is a kana variant; a name written only once each way is still compared, and the cell forms count", () => {
    const spelling = { chars: KE, alsoWritten: [mention("桜ケ丘", 30)] };
    const found = nameVariants([mention("桜ヶ丘", 0), mention("桜ヶ丘", 10)], new Map(), spelling);
    assert.deepEqual(
      found.map(({ mention: { surface }, usual, kind }) => [surface, usual, kind]),
      [["桜ケ丘", "桜ヶ丘", "kana"]],
    );
    assert.deepEqual(nameVariants([mention("桜ヶ丘", 0), mention("桜ケ丘", 10)]), []);
    assert.deepEqual(nameVariants([mention("桜丘", 0), mention("桜ヶ岡", 10)], new Map(), { chars: KE, alsoWritten: [] }), []);
    assert.deepEqual(
      nameVariants([mention("Content-Type", 0), mention("Content-Type", 20)], new Map(), { chars: KE, alsoWritten: [mention("contentType", 40)] }),
      [],
    );
  });
});
