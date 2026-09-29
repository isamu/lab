import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { continuesInto, groupOf, outermostList, registerOf, slipsOf, type Judged, type Register } from "../packages/chaff/src/detectors/register.ts";
import { enumeratedRuns, enumeratorStarts, numberedStarts } from "../packages/chaff/src/detectors/enumerated-runs.ts";
import type { Sentence, Span, StructureKind, StructureNode, Token } from "../packages/chaff/src/plugin.ts";

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
    assert.equal(registerOf([token("し", "VERB", "する"), token("ます", "AUX")], [], POLITE), "polite");
    assert.equal(registerOf([token("する", "VERB")], [], POLITE), "plain");
    assert.equal(registerOf([token("重要", "NOUN"), token("だ", "AUX")], [], POLITE), "plain");
    assert.equal(registerOf([token("高い", "ADJ")], [], POLITE), "plain");
  });

  it("原形でも書いた形でも丁寧語に当てる", () => {
    assert.equal(registerOf([token("ください", "VERB", "くださる")], [], POLITE), "polite");
    assert.equal(registerOf([token("し", "VERB", "する"), token("ませ", "AUX", "ます"), token("ん", "AUX")], [], POLITE), "polite");
  });

  it("述語の無い文末（名詞・助詞・接続助詞で終わる）は調子を持たない", () => {
    assert.equal(registerOf([token("通り", "NOUN")], [], POLITE), undefined);
    assert.equal(registerOf([token("帽子", "NOUN")], [], POLITE), undefined);
    assert.equal(registerOf([token("より", "ADP")], [], POLITE), undefined);
    assert.equal(registerOf([token("から", "SCONJ")], [], POLITE), undefined);
    assert.equal(registerOf([], [], POLITE), undefined);
  });

  it("述語に続く非自立名詞で終わる文末は、その述語の調子（「予約できること。」）", () => {
    assert.equal(registerOf([dependent("こと")], [token("できる", "VERB")], POLITE), "plain");
    assert.equal(registerOf([dependent("もの")], [token("な", "AUX")], POLITE), "plain");
    assert.equal(registerOf([dependent("もの")], [token("です", "AUX")], POLITE), "polite");
  });

  it("手前の述語は助動詞の連なりごと見る（「おかけしましたこと。」は丁寧体）", () => {
    const preceding = [
      token("迷惑", "NOUN"),
      token("を", "ADP"),
      token("おかけ", "NOUN"),
      token("し", "VERB", "する"),
      token("まし", "AUX", "ます"),
      token("た", "AUX"),
    ];
    assert.equal(registerOf([dependent("こと")], preceding, POLITE), "polite");
    assert.equal(registerOf([dependent("こと")], [token("し", "VERB", "する"), token("ませ", "AUX", "ます"), token("ん", "AUX")], POLITE), "polite");
    assert.equal(registerOf([dependent("こと")], [token("し", "VERB", "する"), token("た", "AUX")], POLITE), "plain");
    assert.equal(registerOf([dependent("こと")], [token("の", "ADP"), token("だ", "AUX")], POLITE), "plain");
  });

  it("非自立名詞でも、手前が述語でなければ調子を持たない（「以下のとおり。」）", () => {
    assert.equal(registerOf([dependent("とおり")], [token("の", "ADP")], POLITE), undefined);
    assert.equal(registerOf([dependent("とおり")], [], POLITE), undefined);
    assert.equal(registerOf([token("出口", "NOUN")], [token("使う", "VERB")], POLITE), undefined);
  });

  it("丁寧語の語彙表が空なら、述語で終わる文はすべて plain", () => {
    assert.equal(registerOf([token("し", "VERB"), token("ます", "AUX")], [], []), "plain");
  });
});

describe("continuesInto: 分割器が「！」「？」で切った文が、後ろへ続くか", () => {
  const sentence = (start: number, end: number, first?: Token, text = "作っていた！"): Sentence => ({
    text,
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

  it("「。」で切れた文は、助詞で始まる文が続いても続きとは見ない", () => {
    assert.equal(continuesInto(sentence(0, 10, undefined, "設定します。"), sentence(10, 20, token("という", "ADP"))), false);
    assert.equal(continuesInto(sentence(0, 10, undefined, "導入しませんか？"), sentence(10, 20, token("が", "ADP"))), true);
    assert.equal(continuesInto(sentence(0, 10, undefined, "Really?"), sentence(10, 20, token("と", "ADP"))), true);
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
    const entries = [judged("polite", 50), judged("polite"), judged("polite"), judged("plain"), judged("polite", 50), judged("plain", 50)];
    assert.deepEqual(indicesOf(entries), [3, 5]);
  });
});

describe("groupOf: 箇条書きが先、無ければ番号で始まる段落の並び", () => {
  const list = { start: 10, end: 50 };
  const run = { start: 60, end: 90 };

  it("箇条書きの中なら箇条書き、並びの中なら並び、どちらでもなければ本文", () => {
    assert.equal(groupOf(20, [list], [run]), 10);
    assert.equal(groupOf(70, [list], [run]), 60);
    assert.equal(groupOf(55, [list], [run]), undefined);
  });

  it("両方に入っていれば箇条書き", () => {
    assert.equal(groupOf(70, [{ start: 65, end: 80 }], [run]), 65);
  });
});

const node = (kind: StructureKind, start: number, children: readonly StructureNode[] = []): StructureNode => ({
  kind,
  address: "",
  span: { start, end: start + 1 },
  line: 1,
  attrs: {},
  children,
});

const labelled = (start: number, label: string, children: readonly StructureNode[] = []): StructureNode => ({
  ...node("item", start, children),
  attrs: { label },
});

describe("numberedStarts: 条の外の、番号の付いた行", () => {
  it("見出しの下の項目は数え、条の中の項目は深くても数えない", () => {
    const tree = node("doc", 0, [
      node("section", 0, [labelled(5, "（1）"), labelled(9, "（2）")]),
      node("article", 20, [labelled(25, "２", [labelled(28, "（1）")])]),
    ]);
    assert.deepEqual(numberedStarts(tree), [
      { start: 5, label: "（1）" },
      { start: 9, label: "（2）" },
    ]);
  });

  it("条や項目でない葉は数えない。番号の書き方が無ければ空の番号。項目が無ければ空", () => {
    assert.deepEqual(numberedStarts(node("doc", 0, [node("quantity", 3), node("chapter", 4, [node("item", 6)])])), [{ start: 6, label: "" }]);
    assert.deepEqual(numberedStarts(node("doc", 0)), []);
  });
});

describe("enumeratorStarts: 番号の直後が助詞なら、項目ではなく項目を指す本文", () => {
  const word = (surface: string, pos: string, start: number): Token => ({ span: { start, end: start + surface.length }, surface, pos });
  const sentenceOf = (start: number, text: string, tokens: readonly Token[]): Sentence => ({ span: { start, end: start + text.length }, text, tokens });
  // 「（1）納税者が」「（2）の金額は」「  （3）  と同じ」「（4）」の後に文が無い
  const source = "（1）納税者が\n（2）の金額は\n  （3）  と同じ\n（4）";
  const at = (text: string): number => source.indexOf(text);
  const sentences = [
    sentenceOf(0, "（1）納税者が", [word("（", "PUNCT", 0), word("1", "NOUN", 1), word("）", "PUNCT", 2), word("納税", "NOUN", 3)]),
    sentenceOf(at("（2）"), "（2）の金額は", [word("（", "PUNCT", at("（2）")), word("の", "ADP", at("の金額"))]),
    sentenceOf(at("  （3）"), "  （3）  と同じ", [
      word("（", "PUNCT", at("（3）")),
      word("3", "NOUN", at("3）")),
      word("）", "PUNCT", at("）  と")),
      word("  ", "PUNCT", at("  と")),
      word("と", "ADP", at("と同じ")),
    ]),
  ];
  const lines = [
    { start: 0, label: "（1）" },
    { start: at("（2）"), label: "（2）" },
    { start: at("  （3）"), label: "（3）" },
    { start: at("（4）"), label: "（4）" },
  ];

  it("直後が名詞なら項目、助詞なら除く。字下げと番号の後の空白は飛ばす", () => {
    assert.deepEqual(enumeratorStarts(lines.slice(0, 3), sentences, source), [0]);
  });

  it("直後に語が無ければ項目として残す", () => {
    assert.deepEqual(enumeratorStarts([lines[3] ?? { start: 0, label: "" }], sentences, source), [at("（4）")]);
    assert.deepEqual(enumeratorStarts([], sentences, source), []);
  });
});

describe("enumeratedRuns: 番号で始まる段落が空行だけを挟んで続く範囲", () => {
  // 位置は source の中の位置。段落は「A」「(1)x」「(2)y」「B」「(3)z」。
  const source = "A.\n\n(1)x\n\n(2)y\n\nB.\n\n(3)z";
  const spanOf = (text: string): Span => ({ start: source.indexOf(text), end: source.indexOf(text) + text.length });
  const paragraphs = ["A.", "(1)x", "(2)y", "B.", "(3)z"].map(spanOf);
  const starts = ["(1)x", "(2)y", "(3)z"].map((text) => source.indexOf(text));

  it("空行だけを挟んだ二つをまとめ、本文を挟んだ一つは並びにしない", () => {
    assert.deepEqual(enumeratedRuns(paragraphs, starts, source), [{ start: source.indexOf("(1)x"), end: source.indexOf("(2)y") + 4 }]);
  });

  it("番号の行の始まりから段落の始まりまでが字下げだけなら、その段落は番号で始まる", () => {
    const indented = "  (1)x\n\n  (2)y";
    const spans = [
      { start: 2, end: 6 },
      { start: 10, end: 14 },
    ];
    assert.deepEqual(enumeratedRuns(spans, [0, 8], indented), [{ start: 2, end: 14 }]);
  });

  it("番号の行がほかの段落の中なら、後ろの段落は番号で始まらない", () => {
    assert.deepEqual(enumeratedRuns([spanOf("A."), spanOf("B.")], [0, source.indexOf("B.")], source), []);
    assert.deepEqual(enumeratedRuns([spanOf("(2)y"), spanOf("B.")], [source.indexOf("(1)x"), source.indexOf("(2)y")], source), []);
  });

  it("一つの段落に番号の行が二つあれば並び", () => {
    const joined = "(1)x\n(2)y";
    assert.deepEqual(enumeratedRuns([{ start: 0, end: joined.length }], [0, 5], joined), [{ start: 0, end: joined.length }]);
  });

  it("番号の行が無ければ、段落が無ければ空", () => {
    assert.deepEqual(enumeratedRuns(paragraphs, [], source), []);
    assert.deepEqual(enumeratedRuns([], starts, source), []);
  });
});
