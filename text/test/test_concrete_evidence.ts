import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { evidenceSpans, hasNumeral, startsWithin } from "../packages/chaff/src/detectors/concrete-evidence.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, StructureNode, Token } from "../packages/chaff/src/plugin.ts";

const RULE = "concrete-evidence-density";

const flaggedIn = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "strict" }, true, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["word"]));

/** 具体物の無い節を 3 つ並べ、最後の節だけ中身を変える。strict は 1 節から指摘する。 */
const ABSTRACT_EN = "We value openness. We believe in trust. We act with care.";
const ABSTRACT_JA = "考えかたを述べます。理念を語ります。姿勢を示します。";

const englishWith = (last: string): string => `# Values\n\n## Openness\n\n${ABSTRACT_EN}\n\n## Trust\n\n${ABSTRACT_EN}\n\n## Last\n\n${last}`;
const japaneseWith = (last: string): string => `# 方針\n\n## 公開\n\n${ABSTRACT_JA}\n\n## 信頼\n\n${ABSTRACT_JA}\n\n## 最後\n\n${last}`;

/** 最後の節だけ具体物を持つとき、指摘に残る節。 */
const OTHERS_EN = ["Openness", "Trust"];
const OTHERS_JA = ["公開", "信頼"];

const token = (surface: string, start: number, pos: string, features?: Readonly<Record<string, string>>): Token => ({
  surface,
  span: { start, end: start + surface.length },
  pos,
  ...(features === undefined ? {} : { features }),
});

const PLURAL = { Number: "Plur" };

describe("hasNumeral", () => {
  it("数と読んだ語（NumType=Card）は数える", () => {
    assert.equal(hasNumeral([token("二", 0, "NOUN", { NumType: "Card" }), token("割", 1, "NOUN")]), true);
  });

  it("数の語のすぐ後ろが複数形の名詞なら数える（five minutes）", () => {
    assert.equal(hasNumeral([token("five", 0, "NUM"), token("minutes", 5, "NOUN", PLURAL)]), true);
  });

  it("数の語でも、後ろが複数形の名詞でなければ数えない（one of, one person）", () => {
    assert.equal(hasNumeral([token("one", 0, "NUM"), token("of", 4, "ADP")]), false);
    assert.equal(hasNumeral([token("one", 0, "NUM"), token("person", 4, "NOUN")]), false);
    assert.equal(hasNumeral([token("one", 0, "NUM")]), false);
  });

  it("複数形の名詞の前でも、数の語でなければ数えない（many minutes）", () => {
    assert.equal(hasNumeral([token("many", 0, "ADJ"), token("minutes", 5, "NOUN", PLURAL)]), false);
  });

  it("ハイフンで前の語に続く数は合成語の部品（one-on-one meetings）", () => {
    const tokens = [
      token("one", 0, "NUM"),
      token("-", 3, "X"),
      token("on", 4, "ADP"),
      token("-", 6, "X"),
      token("one", 7, "NUM"),
      token("meetings", 11, "NOUN", PLURAL),
    ];
    assert.equal(hasNumeral(tokens), false);
  });

  it("ハイフンが前にあっても、離れていれば部品ではない（- two days）", () => {
    assert.equal(hasNumeral([token("-", 0, "X"), token("two", 2, "NUM"), token("days", 6, "NOUN", PLURAL)]), true);
  });

  it("括弧が前に付いても数える（(two days)）", () => {
    assert.equal(hasNumeral([token("(", 0, "X"), token("two", 1, "NUM"), token("days", 5, "NOUN", PLURAL)]), true);
  });

  it("品詞が無ければ何も言わない", () => {
    assert.equal(hasNumeral([]), false);
  });
});

describe("startsWithin", () => {
  const section = { start: 10, end: 20 };

  it("節の中で始まるものがあれば真", () => {
    assert.equal(startsWithin(section, [{ start: 10, end: 12 }]), true);
    assert.equal(startsWithin(section, [{ start: 19, end: 30 }]), true);
  });

  it("節の外、終わりちょうどから始まるものは数えない", () => {
    assert.equal(startsWithin(section, [{ start: 0, end: 12 }]), false);
    assert.equal(startsWithin(section, [{ start: 20, end: 25 }]), false);
    assert.equal(startsWithin(section, []), false);
  });
});

describe("evidenceSpans", () => {
  const node = (kind: StructureNode["kind"], start: number, children: readonly StructureNode[] = []): StructureNode => ({
    kind,
    address: "",
    span: { start, end: start + 1 },
    line: 1,
    attrs: {},
    children,
  });

  it("参照・数量・日付を、深い所からも集める", () => {
    const tree = node("doc", 0, [node("section", 1, [node("reference", 2), node("quantity", 3)]), node("date", 4)]);
    assert.deepEqual(
      evidenceSpans(tree).map((span) => span.start),
      [2, 3, 4],
    );
  });

  it("定義・義務・節そのものは具体物ではない", () => {
    const tree = node("doc", 0, [node("definition", 1), node("obligation", 2), node("section", 3), node("article", 4)]);
    assert.deepEqual(evidenceSpans(tree), []);
  });

  it("木が無ければ空", () => {
    assert.deepEqual(evidenceSpans(undefined), []);
  });
});

describe("concrete-evidence-density: リンク", () => {
  it("valid: 相対パス・ページ内・mailto のリンクは、読み手が辿れる出典", () => {
    [
      "See the [guide](/handbook/meetings/). We act on it. We keep it.",
      "See [results](#results). We act on it. We keep it.",
      "Write to [us](mailto:team@example.org). We answer. We care.",
    ].forEach((last) => assert.deepEqual(flaggedIn(englishWith(last), en), OTHERS_EN, last));
  });

  it("valid: 参照の形のリンク（[text][ref]）も数える", () => {
    const last = "See the [guide][g]. We act on it. We keep it.\n\n[g]: /handbook/meetings/";
    assert.deepEqual(flaggedIn(englishWith(last), en), OTHERS_EN);
  });

  it("valid: 日本語の文書でも同じ", () => {
    assert.deepEqual(flaggedIn(japaneseWith("詳しくは[手引き](./guide.md)を見てください。理念を語ります。姿勢を示します。"), ja), OTHERS_JA);
  });

  it("invalid: 画像はリンクではない", () => {
    assert.ok(flaggedIn(englishWith("![A photo](/images/team.jpg)\n\nWe value openness. We believe in trust. We act with care."), en).includes("Last"));
  });

  it("invalid: 見出しの中のリンクは節の本文ではない", () => {
    const source = `# Values\n\n## Openness\n\n${ABSTRACT_EN}\n\n## Trust\n\n${ABSTRACT_EN}\n\n## [Last](/x/)\n\n${ABSTRACT_EN}`;
    assert.equal(flaggedIn(source, en).length, 3);
  });

  it("invalid: 角括弧で囲んだだけの語はリンクではない", () => {
    assert.ok(flaggedIn(englishWith("We say [draft] often. We believe in trust. We act with care."), en).includes("Last"));
  });
});

describe("concrete-evidence-density: 英語の数の語", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("valid: 綴りで書いた数が複数形の名詞を数えていれば具体的な数", () => {
    ["The break lasted five minutes. We value openness. We act with care.", "It spans more than two days. We value openness. We act with care."].forEach(
      (last) => assert.deepEqual(flaggedIn(englishWith(last), en), OTHERS_EN, last),
    );
  });

  it("invalid: one of・two-way・one-on-one は量ではない", () => {
    [
      "One of the things we value is openness. We believe in trust. We act with care.",
      "Make two-way door decisions. We believe in trust. We act with care.",
      "We hold one-on-one meetings. We believe in trust. We act with care.",
    ].forEach((last) => assert.ok(flaggedIn(englishWith(last), en).includes("Last"), last));
  });

  it("日本語は変わらない。漢数字は今までどおり数える", () => {
    assert.deepEqual(flaggedIn(japaneseWith("期間は三日間です。理念を語ります。姿勢を示します。"), ja), OTHERS_JA);
    assert.ok(flaggedIn(japaneseWith(ABSTRACT_JA), ja).includes("最後"));
  });
});

describe("concrete-evidence-density: 構造の木が読んだ参照", () => {
  it("valid: 数字の無い番地への参照（Section VI）は、確かめに行ける具体物", () => {
    const last = "Reviews are sent to the investigator. See Section VI for the details. We act with care.";
    assert.deepEqual(flaggedIn(englishWith(last), en), OTHERS_EN);
  });

  it("invalid: 参照の無い節は、今までどおり指摘する", () => {
    assert.ok(flaggedIn(englishWith(ABSTRACT_EN), en).includes("Last"));
  });
});
