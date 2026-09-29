import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { continuesInto, outermostList, registerOf, slipsOf, type Judged, type Register } from "../packages/chaff/src/detectors/register.ts";
import type { Sentence, Token } from "../packages/chaff/src/plugin.ts";

const POLITE = ["です", "ます", "ません", "でしょう", "ください", "ございます"];

const token = (surface: string, pos: string, lemma?: string): Token => ({
  span: { start: 0, end: surface.length },
  surface,
  pos,
  ...(lemma === undefined ? {} : { lemma }),
});

const dependent = (surface: string): Token => ({ ...token(surface, "NOUN"), features: { NounType: "Dependent" } });

const judged = (register: Register, group?: number): Judged => ({ register, group });

const indicesOf = (entries: readonly Judged[], limit = 3): number[] => slipsOf(entries, limit).map((slip) => entries.indexOf(slip.entry));

describe("registerOf: 文末の語の調子", () => {
  it("述語で終わる文末は、丁寧語があれば polite、無ければ plain", () => {
    assert.equal(registerOf([token("し", "VERB", "する"), token("ます", "AUX")], undefined, POLITE), "polite");
    assert.equal(registerOf([token("する", "VERB")], undefined, POLITE), "plain");
    assert.equal(registerOf([token("重要", "NOUN"), token("だ", "AUX")], undefined, POLITE), "plain");
    assert.equal(registerOf([token("高い", "ADJ")], undefined, POLITE), "plain");
  });

  it("原形でも書いた形でも丁寧語に当てる", () => {
    assert.equal(registerOf([token("ください", "VERB", "くださる")], undefined, POLITE), "polite");
    assert.equal(registerOf([token("し", "VERB", "する"), token("ませ", "AUX", "ます"), token("ん", "AUX")], undefined, POLITE), "polite");
  });

  it("述語の無い文末（名詞・助詞・接続助詞で終わる）は調子を持たない", () => {
    assert.equal(registerOf([token("通り", "NOUN")], undefined, POLITE), undefined);
    assert.equal(registerOf([token("帽子", "NOUN")], undefined, POLITE), undefined);
    assert.equal(registerOf([token("より", "ADP")], undefined, POLITE), undefined);
    assert.equal(registerOf([token("から", "SCONJ")], undefined, POLITE), undefined);
    assert.equal(registerOf([], undefined, POLITE), undefined);
  });

  it("述語に続く非自立名詞で終わる文末は、その述語の調子（「予約できること。」）", () => {
    assert.equal(registerOf([dependent("こと")], token("できる", "VERB"), POLITE), "plain");
    assert.equal(registerOf([dependent("もの")], token("な", "AUX"), POLITE), "plain");
    assert.equal(registerOf([dependent("もの")], token("です", "AUX"), POLITE), "polite");
  });

  it("非自立名詞でも、手前が述語でなければ調子を持たない（「以下のとおり。」）", () => {
    assert.equal(registerOf([dependent("とおり")], token("の", "ADP"), POLITE), undefined);
    assert.equal(registerOf([dependent("とおり")], undefined, POLITE), undefined);
    assert.equal(registerOf([token("出口", "NOUN")], token("使う", "VERB"), POLITE), undefined);
  });

  it("丁寧語の語彙表が空なら、述語で終わる文はすべて plain", () => {
    assert.equal(registerOf([token("し", "VERB"), token("ます", "AUX")], undefined, []), "plain");
  });
});

describe("continuesInto: 分割器が「！」「？」で切った文が、後ろへ続くか", () => {
  const sentence = (start: number, end: number, first?: Token): Sentence => ({
    text: "",
    span: { start, end },
    ...(first === undefined ? {} : { tokens: [first] }),
  });

  it("間を置かずに助詞で始まる次の文があれば続く", () => {
    assert.equal(continuesInto(sentence(0, 10), sentence(10, 20, token("という", "ADP"))), true);
  });

  it("間がある、助詞でない、語が無い、次の文が無いなら続かない", () => {
    assert.equal(continuesInto(sentence(0, 10), sentence(11, 20, token("が", "ADP"))), false);
    assert.equal(continuesInto(sentence(0, 10), sentence(10, 20, token("手順", "NOUN"))), false);
    assert.equal(continuesInto(sentence(0, 10), sentence(10, 20)), false);
    assert.equal(continuesInto(sentence(0, 10), undefined), false);
  });
});

describe("outermostList: 文が入っている一番外側の箇条書き", () => {
  const outer = { start: 10, end: 100 };
  const inner = { start: 30, end: 60 };

  it("入れ子なら外側の始まり", () => {
    assert.equal(outermostList(40, [inner, outer]), 10);
    assert.equal(outermostList(40, [outer, inner]), 10);
  });

  it("本文なら undefined。終わりの位置は含まない", () => {
    assert.equal(outermostList(5, [outer]), undefined);
    assert.equal(outermostList(100, [outer]), undefined);
    assert.equal(outermostList(10, [outer]), 10);
    assert.equal(outermostList(40, []), undefined);
  });
});

describe("slipsOf: 本文と箇条書きごとの少数派", () => {
  it("本文の少数派を指す", () => {
    const entries = [judged("polite"), judged("polite"), judged("plain"), judged("polite")];
    assert.deepEqual(indicesOf(entries), [2]);
    assert.deepEqual(
      slipsOf(entries, 3).map((slip) => slip.count),
      [1],
    );
  });

  it("片方しか無ければ何も指さない。空でも同じ", () => {
    assert.deepEqual(indicesOf([judged("plain"), judged("plain")]), []);
    assert.deepEqual(indicesOf([]), []);
  });

  it("箇条書きが丸ごと本文と違う調子でも、箇条書きの中で揃っていれば指さない", () => {
    assert.deepEqual(indicesOf([judged("polite"), judged("polite"), judged("plain", 50), judged("plain", 50), judged("polite")]), []);
  });

  it("箇条書きの中で混ざれば、その箇条書きの少数派を指す", () => {
    assert.deepEqual(indicesOf([judged("plain"), judged("polite", 50), judged("polite", 50), judged("plain", 50)]), [3]);
  });

  it("箇条書きは 1 つずつ見る。別の箇条書きの調子とは比べない", () => {
    assert.deepEqual(indicesOf([judged("polite", 10), judged("polite", 10), judged("plain", 90), judged("plain", 90)]), []);
  });

  it("同数なら文書全体で少ないほうを指す", () => {
    assert.deepEqual(indicesOf([judged("polite"), judged("polite"), judged("polite"), judged("polite", 50), judged("plain", 50)]), [4]);
    assert.deepEqual(indicesOf([judged("plain"), judged("plain"), judged("plain"), judged("polite", 50), judged("plain", 50)]), [3]);
  });

  it("文書全体でも同数なら丁寧体を指す", () => {
    assert.deepEqual(indicesOf([judged("polite"), judged("plain")]), [0]);
  });

  it("少数派が閾値を超えれば別の文体と見て黙る。閾値ちょうどなら指す", () => {
    const entries = [judged("polite"), judged("polite"), judged("polite"), judged("plain"), judged("plain")];
    assert.deepEqual(indicesOf(entries, 1), []);
    assert.deepEqual(indicesOf(entries, 2), [3, 4]);
  });

  it("指す順は judged の順で、群ごとではない", () => {
    const entries = [judged("polite"), judged("polite", 50), judged("plain"), judged("polite", 50), judged("plain", 50), judged("polite")];
    assert.deepEqual(indicesOf(entries), [2, 4]);
  });
});
