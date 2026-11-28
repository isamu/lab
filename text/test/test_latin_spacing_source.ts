import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { latinSpacing } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { followsCaptionLabel, isCitedEntryLine, isNumberTableBoundary, lineAt } from "../packages/chaff/src/latin-spacing-source.ts";

// latin-spacing と、空け方が書き手のものでない所: 空白を含む組織の名前を並べた行、変換で一続きになった表、“”で引いた題名、
// 文献の記載の行、行の頭の図表の札の後ろ。どれも数えず、同じ空白を文の中に書けば数える。例文はすべて自作。

await ja.prepare?.({ pos: true });

const spacing = (source: string): string[] => latinSpacing(ja, source, "business/report");

/** 英字と数字の前後をどれも詰めた文。文書の書き方を「詰める」にする。 */
const TOUCHING = [
  "社内ではAIを使い、DXを進め、ITを整え、PCを配ります。",
  "会員は30名で、会場は2か所、予算は5万円、期間は3週間です。",
  "参加者は12名、資料は4部、机は8台、椅子は20脚です。",
].join("\n\n");

const withBody = (line: string): string => `# お知らせ\n\n${TOUCHING}\n\n${line}\n`;

describe("名前だけを並べた行の、空白を含む組織の名前", () => {
  it("行の残りが一つの組織の名前なら、前の名前とのあいだの空白を数えない", () => {
    assert.deepEqual(spacing(withBody("総務局 ABC Lab（エービーシー ラボ）推進チーム")), []);
  });

  it("文の中の同じ空白は数える", () => {
    assert.deepEqual(spacing(withBody("総務局の ABC推進チームが担当します。")), ["英字:空けています"]);
  });
});

describe("変換で一続きになった表", () => {
  const table = "発行済株式総数 8,922,775－－総株主の議決権 －87,769－普通株式8,776,90087,769－";

  it("数の前後の升の区切りの空白を数えない", () => {
    assert.equal(isNumberTableBoundary(table, { kind: "before-digit", offset: 7, spaced: true }), true);
    assert.deepEqual(spacing(withBody(table)), []);
  });

  it("英字の前後の空白は、表の中でも数える", () => {
    assert.equal(isNumberTableBoundary(table, { kind: "letter", offset: 7, spaced: true }), false);
    assert.deepEqual(spacing(withBody(`${table}合弁会社 ABCを設立`)), ["英字:空けています"]);
  });

  it("桁の区切りが崩れていない文の空白は数える", () => {
    assert.equal(isNumberTableBoundary("発行済株式の総数は 8,922,775株です。", { kind: "before-digit", offset: 9, spaced: true }), false);
    assert.deepEqual(spacing(withBody("発行済株式の総数は 8,922,775株です。")), ["後ろの数字:空けています"]);
  });
});

describe("“”で引いた題名", () => {
  it("中の空け方を数えない", () => {
    assert.deepEqual(spacing(withBody("“サンプル・マーク 1.0 全世界証”. Example Org.")), []);
  });

  it("引かずに書けば数える", () => {
    assert.equal(spacing(withBody("サンプル・マーク 1.0 全世界証を使います。")).length, 2);
  });
});

describe("文献の記載の行", () => {
  const entry = "山田花子. 図書館の夢を見るか LRG編（第1回）. 架空誌. 2019, （26）, p. 1-10.";

  it("著者の後ろの「. 」と「. 年,」がある行を、文献の記載と読む", () => {
    assert.equal(isCitedEntryLine(entry), true);
    assert.equal(isCitedEntryLine("山田花子. 2019, 架空誌."), true);
    assert.equal(isCitedEntryLine("図書館の夢を見るか LRG編を読みました。2019年の号です。"), false);
    assert.equal(isCitedEntryLine("山田花子, 鈴木一郎. 図書館の夢. 架空誌. 2019, 3(2), p. 5-9."), true);
    assert.equal(isCitedEntryLine("これは例です. 次の号は 2019年に出ます."), false);
    assert.equal(isCitedEntryLine("2019, 架空誌. 山田花子."), false);
    assert.equal(isCitedEntryLine(""), false);
  });

  it("題名の中の空白を数えない", () => {
    assert.deepEqual(spacing(withBody(entry)), []);
  });

  it("文の中の同じ題名の空白は数える", () => {
    assert.deepEqual(spacing(withBody("図書館の夢を見るか LRG編を読みました。")), ["英字:空けています"]);
  });

  it("lineAt は位置を含む行", () => {
    assert.equal(lineAt("一\n二三\n四", 3), "二三");
    assert.equal(lineAt("一\n二三\n四", 0), "一");
    assert.equal(lineAt("一\n二三\n四", 6), "四");
  });
});

describe("行の頭の図表の札", () => {
  const labels = new Set(["表", "図"]);
  const boundary = (offset: number, spaced = true): { readonly kind: "before-digit"; readonly offset: number; readonly spaced: boolean } => ({
    kind: "before-digit",
    offset,
    spaced,
  });

  it("札だけを書いた後ろの空白を、札と題の区切りと読む", () => {
    assert.equal(followsCaptionLabel("表 6種類の会員", boundary(1), labels), true);
    assert.equal(followsCaptionLabel("前の文\n- 図 3つの手順", boundary(7), labels), true);
    assert.equal(followsCaptionLabel("表 6種類の会員", boundary(1, false), labels), false);
    assert.equal(followsCaptionLabel("全部で 6種類", boundary(3), labels), false);
    assert.equal(followsCaptionLabel("表 6種類の会員", boundary(1), new Set()), false);
  });

  it("札の後ろの空白を数えず、文の中の空白は数える", () => {
    assert.deepEqual(spacing(withBody("表 6種類の会員")), []);
    assert.deepEqual(spacing(withBody("会員の種類は全部で 6種類あります。")), ["後ろの数字:空けています"]);
  });
});
