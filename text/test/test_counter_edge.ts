import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { leadingCounter } from "../packages/chaff/src/detectors/counter-edge.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

type Word = { readonly surface: string; readonly features?: Readonly<Record<string, string>> };

/** 外す助数詞の長さ。助数詞でなければ 0。 */
const counterLength = (tokens: readonly Token[], start: number, run: string): number => leadingCounter(tokens, start, run)?.surface.length ?? 0;

const NUMBER = { NumType: "Card" };
const COUNTER = { NounType: "Class" };

/** 語を詰めて並べた token。 */
const tokensOf = (words: readonly Word[]): Token[] =>
  words.reduce<Token[]>((acc, word) => {
    const start = acc.at(-1)?.span.end ?? 0;
    const token: Token = { span: { start, end: start + word.surface.length }, surface: word.surface, pos: "NOUN" };
    return [...acc, word.features === undefined ? token : { ...token, features: word.features }];
  }, []);

/** 連なりは、数（漢字でない）の後ろ、つまり start の位置から文の終わりまで。 */
const lengthAt = (words: readonly Word[], start: number): number => {
  const tokens = tokensOf(words);
  const run = tokens
    .filter((token) => token.span.start >= start)
    .map((token) => token.surface)
    .join("");
  return counterLength(tokens, start, run);
};

describe("leadingCounter — 連なりの頭の、数に付いた助数詞", () => {
  it("数のすぐ後ろの助数詞は、その長さだけ外す", () => {
    assert.equal(lengthAt([{ surface: "2", features: NUMBER }, { surface: "日", features: COUNTER }, { surface: "日本" }], 1), 1);
    assert.equal(lengthAt([{ surface: "24", features: NUMBER }, { surface: "時間", features: COUNTER }, { surface: "利用" }], 2), 2);
  });

  it("空白一つを挟んだ助数詞（2 日）も数に付く", () => {
    assert.equal(lengthAt([{ surface: "2", features: NUMBER }, { surface: " " }, { surface: "日", features: COUNTER }, { surface: "日本" }], 2), 1);
  });

  it("助数詞でない語は外さない（2021会計年度）", () => {
    assert.equal(lengthAt([{ surface: "2021", features: NUMBER }, { surface: "会計" }, { surface: "年度" }], 4), 0);
  });

  it("数の後ろでない助数詞は外さない", () => {
    assert.equal(lengthAt([{ surface: "毎" }, { surface: "日", features: COUNTER }, { surface: "日本" }], 1), 0);
    assert.equal(lengthAt([{ surface: "日", features: COUNTER }, { surface: "日本" }], 0), 0);
    assert.equal(lengthAt([{ surface: "2", features: NUMBER }, { surface: "、" }, { surface: "日", features: COUNTER }], 2), 0);
  });

  it("挟めるのは空白の語一つまで。二つ挟めば数に付いていない", () => {
    assert.equal(lengthAt([{ surface: "2", features: NUMBER }, { surface: "  " }, { surface: "日", features: COUNTER }], 3), 1);
    assert.equal(lengthAt([{ surface: "2", features: NUMBER }, { surface: " " }, { surface: " " }, { surface: "日", features: COUNTER }], 3), 0);
  });

  it("語と語のあいだに解析されない文字があれば、付いていない", () => {
    const tokens: Token[] = [
      { span: { start: 0, end: 1 }, surface: "2", pos: "NOUN", features: NUMBER },
      { span: { start: 2, end: 3 }, surface: "日", pos: "NOUN", features: COUNTER },
    ];
    assert.equal(counterLength(tokens, 2, "日本"), 0);
    const apart: Token[] = [
      { span: { start: 0, end: 1 }, surface: "2", pos: "NOUN", features: NUMBER },
      { span: { start: 2, end: 3 }, surface: " ", pos: "PUNCT" },
      { span: { start: 3, end: 4 }, surface: "日", pos: "NOUN", features: COUNTER },
    ];
    assert.equal(counterLength(apart, 3, "日本"), 0);
  });

  it("折り返しをまたぐ助数詞（年\\n度）は、その語ごと返す。残りは語の span の終わりから", () => {
    const wrapped: Token[] = [
      { span: { start: 0, end: 4 }, surface: "2026", pos: "NOUN", features: NUMBER },
      { span: { start: 4, end: 7 }, surface: "年度", pos: "NOUN", features: COUNTER },
      { span: { start: 7, end: 9 }, surface: "東京", pos: "PROPN" },
    ];
    assert.deepEqual(leadingCounter(wrapped, 4, "年度東京")?.span, { start: 4, end: 7 });
  });

  it("start に語が始まらない、語が無い、連なりが助数詞で始まらないときは 0", () => {
    const tokens = tokensOf([{ surface: "2", features: NUMBER }, { surface: "日", features: COUNTER }, { surface: "日本" }]);
    assert.equal(counterLength(tokens, 5, "本"), 0);
    assert.equal(counterLength([], 0, "日本"), 0);
    assert.equal(counterLength(tokens, 1, "本"), 0);
  });
});

describe("leadingCounter — 形態素解析の語で", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const realLength = (text: string, run: string): number => {
    const tokens = ja.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);
    return counterLength(tokens, text.indexOf(run), run);
  };

  it("日付・回・時間・人の助数詞を外す", () => {
    assert.equal(realLength("平成2年3月2日日本弁護士連合会臨時総会決議", "日日本弁護士連合会臨時総会決議"), 1);
    assert.equal(realLength("第76回計量士国家試験", "回計量士国家試験"), 1);
    assert.equal(realLength("24時間利用可能可否", "時間利用可能可否"), 2);
    assert.equal(realLength("長野一家3人強盗殺人事件", "人強盗殺人事件"), 1);
    assert.equal(realLength("2 日日本弁護士連合会", "日日本弁護士連合会"), 1);
  });

  it("前提と反対側: 助数詞でない語（会計）、数の無い日（日本）は外さない", () => {
    assert.equal(realLength("2021会計年度国防授権法", "会計年度国防授権法"), 0);
    assert.equal(realLength("日本弁護士連合会", "日本弁護士連合会"), 0);
  });
});
