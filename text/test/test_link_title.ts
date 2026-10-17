import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { externalLinkTitleSpans } from "../packages/chaff/src/link-title.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { namedRuleRun } from "./rule-run.ts";

// 外のページの題名を引いたリンクの文字は、書き手の言葉として数えない（bracket-width-consistency、orthographic-variant、no-doubled-joshi）。例文はすべて自作。

before(async () => {
  await ja.prepare?.({ pos: true });
});

const titlesOf = (source: string): string[] => {
  const doc = buildDocument("a.md", source, ja);
  return externalLinkTitleSpans(doc.source, doc.links).map((span) => doc.source.slice(span.start, span.end));
};

describe("externalLinkTitleSpans: 外のページの題名を引いたリンク", () => {
  it("行の頭に置いた外のページへのリンクは題名", () => {
    assert.deepEqual(titlesOf("# 参考\n\n- [料金の計算 (月額)](https://example.com/a)\n- [サービスの使い方](https://example.com/b)。\n"), [
      "料金の計算 (月額)",
      "サービスの使い方",
    ]);
  });

  it("番号付きの項目、見出し語の後ろ（参考: ）、説明を始めるコロンの前のリンクも題名", () => {
    assert.deepEqual(titlesOf("# 参考\n\n1. [手順の説明](https://example.com/a)\n"), ["手順の説明"]);
    assert.deepEqual(titlesOf("# 参考\r\n\r\n- [手順の説明](https://example.com/a)\r\n"), ["手順の説明"]);
    assert.deepEqual(titlesOf("# 参考\n\n- 参考: [設定を変える](https://example.com/a)\n"), ["設定を変える"]);
    assert.deepEqual(titlesOf("# 参考\n\n- [基準 1.2: 名前 (短い)](https://example.com/a): よい改善。名前だけで分かる。\n"), ["基準 1.2: 名前 (短い)"]);
  });

  it("文の中のリンクは書き手の言葉", () => {
    assert.deepEqual(titlesOf("# 参考\n\n詳しくは[こちらの説明](https://example.com/a)をご覧ください。\n"), []);
    assert.deepEqual(titlesOf("# 参考\n\n- [手順の説明](https://example.com/a) を読んでから始める。\n"), []);
  });

  it("文書の中や手元のファイルへのリンクは題名ではない", () => {
    assert.deepEqual(titlesOf("# 参考\n\n- [手順の説明](./guide.md)\n- [次の節](#next)\n"), []);
  });

  it("リンクが無ければ何も返さない", () => {
    assert.deepEqual(titlesOf("# 参考\n\n- 手順の説明\n"), []);
    assert.deepEqual(titlesOf(""), []);
  });
});

const findingsOf = (rule: string, source: string): readonly string[] => namedRuleRun(rule, source, ja).findings;

/** 全角の括弧を使う本文。半角の括弧を 1 か所足すと、それが少ない方になる。 */
const FULL_WIDTH_PROSE = "申込書（様式1）を出す。控え（写し）を残す。期限（月末）を守る。窓口（本館）で受ける。\n";

describe("bracket-width-consistency: リンクで引いた題名の括弧", () => {
  const RULE = "bracket-width-consistency";

  it("題名の中の半角の括弧は数えない", () => {
    assert.deepEqual(findingsOf(RULE, `# 手続き\n\n${FULL_WIDTH_PROSE}\n- [手続きの案内 (改訂版)](https://example.com/guide)\n`), []);
  });

  it("本文の半角の括弧は今までどおり指す", () => {
    assert.equal(findingsOf(RULE, `# 手続き\n\n${FULL_WIDTH_PROSE}\n手続きの案内 (改訂版) を読む。\n`).length, 2);
  });
});

describe("orthographic-variant: リンクで引いた題名の表記", () => {
  const RULE = "orthographic-variant";
  const PROSE = "名前をつける。番号をつける。印をつける。色をつける。\n";

  it("題名の中の書き方は数えない", () => {
    assert.deepEqual(findingsOf(RULE, `# 名前\n\n${PROSE}\n- 参考: [ラベルを付ける](https://example.com/label)\n`), []);
  });

  it("本文の書き方は今までどおり比べる", () => {
    assert.equal(findingsOf(RULE, `# 名前\n\n${PROSE}札を付ける。\n`).length, 1);
  });
});

describe("no-doubled-joshi: リンクで引いた題名の助詞", () => {
  const RULE = "no-doubled-joshi";

  it("題名の中の助詞は数えない", () => {
    assert.deepEqual(findingsOf(RULE, "# 参考\n\n- [会社の製品の料金の計算の方法](https://example.com/price)\n"), []);
  });

  it("本文の助詞は今までどおり数える", () => {
    assert.equal(findingsOf(RULE, "# 参考\n\n会社の製品の料金の計算の方法を読む。\n").length, 1);
  });
});
