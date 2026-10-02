import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { latinSpacing } from "./rule-run.ts";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hyphenGroups, isHyphen, latinBoundaries, minorityStyle, occurrencesOutside, type Boundary } from "../packages/chaff/src/orthography.ts";
import { loadConfig } from "../packages/chaff/src/config/load.ts";
import { buildDocument, teamRules } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules, type Settings } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 表記のそろい: チームの表記（preferred-term）と、日本語と英数字のあいだの空白（latin-spacing）。

describe("occurrencesOutside", () => {
  const cases: readonly (readonly [string, string, string, readonly number[]])[] = [
    ["サーバーとサーバ", "サーバー", "サーバ", [0]],
    ["ユーザーとユーザ", "ユーザ", "ユーザー", [5]],
    ["ユーザーのユーザー", "ユーザ", "ユーザー", []],
    ["e-mail and email", "e-mail", "email", [0]],
    ["ああああ", "ああ", "あ", [0, 2]],
    ["abc", "", "x", []],
    ["サーバーサーバー", "サーバー", "", [0, 4]],
    ["E-mail me by e-mail, or email.", "e-mail", "email", [0, 13]],
    ["Javascript and JavaScript", "Javascript", "JavaScript", [0]],
    ["JAVASCRIPT", "Javascript", "JavaScript", []],
    ["C++ and c++", "C++", "C", [0, 8]],
    ["use (x) not [x]", "[x]", "(x)", [12]],
  ];
  cases.forEach(([text, avoid, use, expected]) => {
    it(`${text}: ${avoid} → ${use}`, () => assert.deepEqual(occurrencesOutside(text, avoid, use), expected));
  });
});

describe("latinBoundaries", () => {
  const kinds = (text: string): string[] => latinBoundaries(text).map((boundary) => `${boundary.kind}:${boundary.spaced ? "spaced" : "touching"}`);
  const cases: readonly (readonly [string, readonly string[]])[] = [
    ["Node.js 22 以上", ["letter:spaced"]],
    ["Phase 1 は", ["letter:spaced"]],
    ["iOS 17以上", ["letter:touching"]],
    ["JIS X 0301 和暦", ["letter:spaced"]],
    ["を 2 or 3 回", ["before-digit:spaced", "after-digit:spaced"]],
    ["1ファイル x 1シート", ["after-digit:touching", "letter:spaced", "after-digit:touching"]],
    ["の 2 つ", ["before-digit:spaced", "after-digit:spaced"]],
    ["3 GB の", ["letter:spaced"]],
    ["は confidence=0 で", ["letter:spaced", "letter:spaced"]],
    ["API = 0 で", ["after-digit:spaced"]],
    ["は a=b 2 回", ["letter:spaced", "after-digit:spaced"]],
    ["電話：073-489-5909 ファックス", []],
    ["は 2026-06-02 時点", []],
    ["図表Ⅰ-4-1-3 生成", []],
    ["5－1－1 法の規定", []],
    ["5‐1‐1 法の規定", []],
    ["5−1−1 法の規定", []],
    ["は 5－1－1 の", []],
    ["5－1－10 個人事業者", []],
    ["で 3－5 日", ["before-digit:spaced", "after-digit:spaced"]],
    ["5ー1ー1 法", ["after-digit:touching", "before-digit:touching", "after-digit:touching", "before-digit:touching", "after-digit:spaced"]],
    ["5–1–1 法", ["after-digit:spaced"]],
    ["中期的(1-3ヶ月後)", ["after-digit:touching"]],
    ["で 20-30分", ["before-digit:spaced", "after-digit:touching"]],
    ["3日で終わる", ["after-digit:touching"]],
    ["を 3回", ["before-digit:spaced", "after-digit:touching"]],
    ["3GBの容量", ["after-digit:touching"]],
    ["10ms 待つ", ["after-digit:spaced"]],
    ["v1.2の変更", ["letter:touching"]],
    ["H30 等", ["letter:spaced"]],
    ["IPv6アドレス", ["letter:touching"]],
    ["EC2 で動かす", ["letter:spaced"]],
    ["約 .5日", ["after-digit:touching"]],
    ["SmartHRの設定", ["letter:touching"]],
    ["APIを呼ぶ", ["letter:touching"]],
    ["API を呼ぶ", ["letter:spaced"]],
    ["を API で", ["letter:spaced", "letter:spaced"]],
    ["、Aと", ["letter:touching"]],
    ["第3条", []],
    ["第4条第2項", []],
    ["民法第709条の", []],
    ["第 3 条", []],
    ["第3条で 2 か所", ["before-digit:spaced", "after-digit:spaced"]],
    ["次の3条", ["before-digit:touching", "after-digit:touching"]],
    ["第3.5条", []],
    ["第A条", ["letter:touching", "letter:touching"]],
    ["第 A 条", ["letter:spaced", "letter:spaced"]],
    ["全角のＡＢＣは数えない", []],
    ["二つ空けた  API", []],
    ["全角の空白\u3000API", []],
    ["English only here", []],
    ["", []],
  ];
  cases.forEach(([text, expected]) => {
    it(JSON.stringify(text), () => assert.deepEqual(kinds(text), expected));
  });

  it("does not count a space that covers markup, only one the writer typed", () => {
    const written = (text: string, source: string): string[] =>
      latinBoundaries(text, source).map((boundary) => `${boundary.kind}:${boundary.spaced ? "spaced" : "touching"}`);
    assert.deepEqual(written("させた Googleの", "させた[Googleの"), ["letter:touching"]);
    assert.deepEqual(written("1on1 ^1on1 を", "1on1[^1on1]を"), []);
    assert.deepEqual(written("させた Googleの", "させた Googleの"), ["letter:spaced", "letter:touching"]);
  });

  it("gives the offset of the boundary in UTF-16, after an emoji too", () => {
    assert.deepEqual(
      latinBoundaries("😀あA").map((boundary) => boundary.offset),
      [3],
    );
  });
});

describe("hyphens between digits", () => {
  it("reads the half-width, full-width and Japanese hyphens and the minus sign as hyphens", () => {
    ["-", "－", "‐", "‑", "−"].forEach((char) => assert.equal(isHyphen(char), true, char));
  });

  it("does not read the long vowel mark, a dash, a tilde or nothing as a hyphen", () => {
    ["ー", "–", "—", "―", "～", "〜", "_", "", undefined].forEach((char) => assert.equal(isHyphen(char), false, String(char)));
  });

  it("splits on every kind of hyphen and drops empty groups", () => {
    assert.deepEqual(hyphenGroups("5－1－1"), ["5", "1", "1"]);
    assert.deepEqual(hyphenGroups("073-489－5909"), ["073", "489", "5909"]);
    assert.deepEqual(hyphenGroups("5ー1"), ["5ー1"]);
    assert.deepEqual(hyphenGroups("--3"), ["3"]);
    assert.deepEqual(hyphenGroups(""), []);
  });
});

describe("minorityStyle", () => {
  const boundary = (spaced: boolean): Boundary => ({ offset: 0, kind: "letter", spaced });
  const cases: readonly (readonly [string, readonly boolean[], boolean | undefined])[] = [
    ["all spaced", [true, true], undefined],
    ["all touching", [false, false], undefined],
    ["none", [], undefined],
    ["fewer spaced", [false, true, false], true],
    ["fewer touching", [true, false, true], false],
    ["a tie, spaced first", [true, false], false],
    ["a tie, touching first", [false, true], true],
  ];
  cases.forEach(([label, spacedList, expected]) => {
    it(label, () => assert.equal(minorityStyle(spacedList.map(boundary)), expected));
  });
});

const configFrom = (yaml: string) => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-ortho-"));
  writeFileSync(join(dir, "chaff.yaml"), yaml);
  return loadConfig(join(dir, "chaff.yaml"));
};

describe("preferred-term", () => {
  const found = (yaml: string, source: string): (string | number | undefined)[] => {
    const config = configFrom(yaml);
    const doc = buildDocument("a.md", source, ja, teamRules(config));
    const settings: Settings = { "preferred-term": "normal" };
    return runRules(doc, loadRules("ja"), settings, false, "technical/readme")
      .findings.filter((finding) => finding.rule === "preferred-term")
      .map((finding) => finding.values["matched"]);
  };

  it("reports each spelling the team listed to avoid", () => {
    assert.deepEqual(found("prefer:\n  サーバー: サーバ\n  ユーザ: ユーザー\n", "# 設定\n\nサーバーを起動し、ユーザが入る。サーバは止めない。\n"), [
      "サーバー",
      "ユーザ",
    ]);
  });

  it("does not count the avoided spelling inside the one to use", () => {
    assert.deepEqual(found("prefer:\n  ユーザ: ユーザー\n", "# 設定\n\nユーザーが入る。\n"), []);
  });

  it("says nothing with no list, and ignores code", () => {
    assert.deepEqual(found("", "# 設定\n\nサーバーを起動する。\n"), []);
    assert.deepEqual(found("prefer:\n  サーバー: サーバ\n", "# 設定\n\n`サーバー` と打つ。\n"), []);
  });

  it("reads only pairs of two different, non-empty words", () => {
    assert.deepEqual(configFrom("prefer:\n  サーバ: サーバ\n  空: ''\n  数: 3\n  ユーザ: ユーザー\n").prefer, { ユーザ: "ユーザー" });
  });

  it("runs once prefer lists a pair, with no level in rules (on by default since it was measured, spec §21.1)", () => {
    const config = configFrom("prefer:\n  サーバー: サーバ\n");
    const doc = buildDocument("a.md", "# 設定\n\nサーバーを起動する。\n", ja, teamRules(config));
    const ids = runRules(doc, loadRules("ja"), {}, false, "technical/readme").findings.map((finding) => finding.rule);
    assert.ok(ids.includes("preferred-term"));
  });
});

describe("latin-spacing", () => {
  const spacing = (source: string, level: Settings[string] = "normal", adapter = ja): string[] => latinSpacing(adapter, source, "technical/readme", level);

  it("says nothing when the document is consistent, either way", () => {
    assert.deepEqual(spacing("# 使い方\n\nAPI を呼び、JSON を受け取り、ID を返す。\n"), []);
    assert.deepEqual(spacing("# 使い方\n\nAPIを呼び、JSONを受け取り、IDを返す。\n"), []);
  });

  it("points at the fewer way in a mixed document", () => {
    assert.deepEqual(spacing("# 使い方\n\nAPI を呼び、JSON を受け取り、IDを返す。\n"), ["英字:詰めています"]);
  });

  it("counts the space before a digit apart from the space after it", () => {
    assert.deepEqual(spacing("# 使い方\n\nAPI を 3回呼び、JSON を 5回受け取る。\n"), []);
    assert.deepEqual(spacing("# 使い方\n\n3回呼び、5回待ち、10 回で止める。\n"), ["前の数字:空けています"]);
  });

  it("does not read a unit after a number as a Latin word", () => {
    assert.deepEqual(spacing("# 使い方\n\nAPI を呼び、JSON を返し、ID を保存し、3GBの容量を使う。\n"), []);
  });

  it("reads a name that ends in a digit (H30, EC2) as a Latin word, not as a number", () => {
    assert.deepEqual(spacing("# 使い方\n\nAPI を呼び、5日で終わり、H30 等の略称と EC2 で動かす。\n"), []);
    assert.deepEqual(spacing("# 使い方\n\nAPIを呼び、JSONを返し、H30 等を書く。\n"), ["英字:空けています"]);
  });

  it("reads a number after a Latin word (Phase 1) as part of a name", () => {
    assert.deepEqual(spacing("# 計画\n\nAPI を呼び、3日で終わり、Phase 1 は小さく始める。\n"), []);
    assert.deepEqual(spacing("# 計画\n\nAPIを呼び、JSONを返し、Phase 1 は小さく始める。\n"), ["英字:空けています"]);
  });

  it("does not read the bracket of a link as the writer's space", () => {
    assert.deepEqual(spacing("# 使い方\n\nAPIを呼び、JSONを返し、調べるには[Google](https://example.com/)を使う。\n"), []);
  });

  it("does not count the spacing inside a title or a quotation in 「」『』, which is the source's", () => {
    assert.deepEqual(spacing("# 参考\n\nAPIを呼び、JSONを返し、経済産業省の「ガバナンス・ガイドライン ver. 1.1」を読む。\n"), []);
    assert.deepEqual(spacing("# 参考\n\n今年は100人が来て、会場は200席あり、『絵師100人展 16』に参加する。\n"), []);
  });

  it("still points at an odd space outside the quotation", () => {
    assert.deepEqual(spacing("# 参考\n\nAPIを呼び、JSONを返し、「手引き」を IDで引く。\n"), ["英字:空けています"]);
    assert.deepEqual(spacing("# 参考\n\n今年は100人が来て、会場は200席あり、『絵師展』は 16日に開く。\n"), ["後ろの数字:空けています"]);
  });

  it("counts as before when the bracket does not close", () => {
    assert.deepEqual(spacing("# 参考\n\nAPIを呼び、JSONを返し、「手引き ver.1を読む。\n"), ["英字:空けています"]);
  });

  it("does not let the quotations decide which way is usual", () => {
    assert.deepEqual(spacing("# 参考\n\nAPI を呼び、JSON を返し、「APIの手引き」「IDの表」を読み、IDを返す。\n"), ["英字:詰めています"]);
  });

  // 電波利用電子申請の利用規約: 号の番号の後ろの半角空白は、番号と本文の区切り。
  it("does not count the space after an item number at the head of a line (一 JIS)", () => {
    const items = "# 文字\n\n使える文字はUTF-8で送り、APIで受け取る。\n\n一 JIS X 0201の英数字\n\n二 JIS第一水準漢字\n\nイ ASCIIの記号\n\nロ UTF-8の文字\n";
    assert.deepEqual(spacing(items), []);
  });

  it("counts a kanji numeral at the head of a line when the document numbers no items with it (十 GB)", () => {
    assert.deepEqual(spacing("# 文字\n\n十 GBまで使える文字はUTF-8で送り、APIで受け取る。\n"), ["英字:空けています"]);
    assert.deepEqual(spacing("# 文字\n\n使える文字はUTF-8で送り、APIで受け取る。\n\n一 JIS X 0201の英数字\n\n一 ASCIIの記号\n"), [
      "英字:空けています",
      "英字:空けています",
    ]);
  });

  it("skips the space after an indented item number in plain text (the sentence starts at the number), and still counts the spaces in its item", () => {
    const spacingOf = (source: string): string[] =>
      runRules(buildDocument("a.txt", source, ja), loadRules("ja"), { "latin-spacing": "normal" }, false, "technical/readme")
        .findings.filter((finding) => finding.rule === "latin-spacing")
        .map((finding) => `${String(finding.values["kind"])}:${String(finding.values["style"])}`);
    const indent = " ".repeat(2);
    assert.deepEqual(spacingOf(`APIを呼び、JSONを返す。\n\n${indent}一 JISの英数字\n\n${indent}二 ASCIIの記号\n`), []);
    assert.deepEqual(spacingOf(`APIを呼び、JSONを返す。\n\n${indent}一 JISの英数字\n\n${indent}二 ASCII の記号\n`), ["英字:空けています"]);
  });

  it("counts a kanji numeral at a line head with no neighbouring number, even in a numbered list (十 GB beside 一, 二)", () => {
    const items = "# 文字\n\nAPIを呼び、JSONを返す。\n\n一 JISの英数字\n\n二 ASCIIの記号\n\n十 GBまで使える。\n";
    assert.deepEqual(spacing(items), ["英字:空けています"]);
  });

  it("counts a numbered item written once without its space (二CSV) as touching", () => {
    const items = "# 文字\n\nAPI を呼び、JSON を返し、ID を保存する。\n\n一 JIS の文字\n\n二 XML の形式\n\n二CSVの形式\n";
    assert.deepEqual(spacing(items), ["英字:詰めています", "英字:詰めています"]);
  });

  it("counts an item number written without the space (三JSON) as touching", () => {
    assert.deepEqual(spacing("# 文字\n\nAPI を呼び、JSON を返し、ID を保存する。\n\n一 JIS の文字\n\n二 XML の形式\n\n三CSVの形式\n"), [
      "英字:詰めています",
      "英字:詰めています",
    ]);
  });

  it("still counts a kanji numeral that is not an item number", () => {
    assert.deepEqual(spacing("# 文字\n\n使える文字はUTF-8で送り、APIで受け取り、十 GBまで使う。\n"), ["英字:空けています"]);
    assert.deepEqual(spacing("# 文字\n\n使える文字はUTF-8で送り、APIで受け取る。\n\n一つ JISの文字\n"), ["英字:空けています"]);
    assert.deepEqual(spacing("# 文字\n\n使える文字はUTF-8で送り、APIで受け取る。\n\n一つの JIS文字\n"), ["英字:空けています"]);
  });

  it("on relaxed, one odd place is not enough", () => {
    assert.deepEqual(spacing("# 使い方\n\nAPI を呼び、JSON を受け取り、IDを返す。\n", "relaxed"), []);
  });

  it("does not run on English", () => {
    assert.deepEqual(spacing("# Usage\n\nCall the API and get JSON.\n", "normal", en), []);
  });
});
