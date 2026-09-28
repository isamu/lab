import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import type { Mention, StructurePatterns } from "../packages/chaff/src/plugin.ts";

// 算用数字で番号を振った文書の「3.2節」「第3章」「3.2.1項」。木の通し番号（### 3.2）と同じ番地で読み、無ければ参照先が無いと言う。

const patterns = (): StructurePatterns => {
  if (ja.structure === undefined) throw new Error("lang-ja has no structure");
  return ja.structure;
};

// 数量は形態素で読む。CLI と同じく解析器を読み込んでから試す。
before(async () => prepare());

const lines = (...rows: string[]): string => rows.join("\n");

type Read = { readonly label: unknown; readonly target: unknown; readonly fallback?: unknown; readonly document?: unknown };

const read = (text: string): Read[] =>
  patterns()
    .references(text)
    .map((mention: Mention) => ({ ...mention.attrs }))
    .map(({ label, target, fallback, document }) => ({
      label,
      target,
      ...(fallback === undefined ? {} : { fallback }),
      ...(document === undefined ? {} : { document }),
    }));

const statuteJa = loadProfiles().find((definition) => definition.id === "statute")?.languages["ja"];

const dangling = (source: string, path = "d.md", statute = false): unknown[] =>
  runRules(buildDocument(path, source, ja, undefined, statute ? statuteJa : undefined), loadRules("ja"), {}, true, "technical/spec")
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => finding.values["label"]);

const DESIGN = (reference: string): string =>
  lines(
    "# 設計書",
    "",
    "## 1. 概要",
    "",
    "目的を書く。",
    "",
    "## 2. 構成",
    "",
    "### 2.1 認証",
    "",
    "本文。",
    "",
    "### 2.2 データ",
    "",
    `詳しくは${reference}を参照する。`,
  );

describe("日本語: 章・節・項の番号を参照として読む", () => {
  const cases: readonly (readonly [string, string, Read[]])[] = [
    ["点のある節", "3.2節で述べた。", [{ label: "3.2節", target: "3.2" }]],
    [
      "番号と単位のあいだの空白",
      "3.2 節と3.3　節",
      [
        { label: "3.2 節", target: "3.2" },
        { label: "3.3　節", target: "3.3" },
      ],
    ],
    ["全角の数字と点", "３．２節による。", [{ label: "３．２節", target: "3.2" }]],
    ["第を付けた章", "第3章に定める。", [{ label: "第3章", target: "ch3", fallback: "3" }]],
    ["第の無い章", "3章で述べた。", [{ label: "3章", target: "ch3", fallback: "3" }]],
    ["三段の項", "3.2.1項の表", [{ label: "3.2.1項", target: "3.2.1" }]],
    ["行頭でも、後ろが本文なら参照", "3.2節で述べたとおり。", [{ label: "3.2節", target: "3.2" }]],
    ["他の文書の章", "民法第3章を参照する。", [{ label: "第3章", target: "ch3", fallback: "3", document: "民法" }]],
  ];
  cases.forEach(([name, text, expected]) => {
    it(name, () => assert.deepEqual(read(text), expected));
  });
});

describe("日本語: 章・節・項に似たものは参照にしない", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["版の番号", "バージョン3.2節の変更"],
    ["v の付いた版", "v3.2節"],
    ["単位の無い版", "バージョン3.2を使う。"],
    ["日付の途中", "2024.3.2節"],
    ["倍", "3.2倍になる。"],
    ["節約", "3.2節約できる。"],
    ["項目", "3項目ある。"],
    ["数を数える章", "全3章からなる。"],
    ["章の構成", "3章構成の本"],
    ["章からなる", "本書は3章からなる。"],
    ["点の無い節", "2節を読む。"],
    ["点のある章", "3.2章"],
    ["漢数字の章（法令の番地）", "第三章に定める。"],
    ["漢数字の節（法令の番地）", "第二節の規定"],
    ["算用数字でも点の無い節", "第2節の規定"],
    ["行頭の見出しの番号", "3.2節 データの形"],
    ["空白を挟んだ見出しの番号", "第 1 章 総則"],
  ];
  cases.forEach(([name, text]) => {
    it(name, () => assert.deepEqual(read(text), []));
  });
});

describe("日本語: 読んだ番地が木に無ければ参照先が無い", () => {
  it("見出しにある節は黙る", () => assert.deepEqual(dangling(DESIGN("2.1節")), []));
  it("見出しに無い節は言う", () => assert.deepEqual(dangling(DESIGN("2.3節")), ["2.3節"]));
  it("見出しにある章は黙る", () => assert.deepEqual(dangling(DESIGN("2章")), []));
  it("見出しに無い章は言う", () => assert.deepEqual(dangling(DESIGN("第4章")), ["第4章"]));
  it("見出しに無い項は言う", () => assert.deepEqual(dangling(DESIGN("2.2.1項")), ["2.2.1項"]));
  it("他の文書の節は引かない", () => assert.deepEqual(dangling(DESIGN("民法第9章")), []));
  it("「## 第2章」の見出しは ch2 として当たる", () =>
    assert.deepEqual(dangling(lines("## 第1章 総則", "", "### 1.1 目的", "", "第2章で扱う。", "", "## 第2章 運用", "", "### 2.1 手順", "", "本文。")), []));
  it("見出しの下の「## 第2章」（h1/ch2）にも当たる", () =>
    assert.deepEqual(
      dangling(lines("# 規則", "", "## 第1章 総則", "", "### 第11条 目的", "", "第2章に定める。", "", "## 第2章 運用", "", "### 第12条 手順", "", "本文。")),
      [],
    ));
  it("見出しの下に無い章は言う", () =>
    assert.deepEqual(
      dangling(lines("# 規則", "", "## 第1章 総則", "", "### 第1条 目的", "", "第9章に定める。", "", "## 第2章 運用", "", "### 第2条 手順", "", "本文。")),
      ["第9章"],
    ));
  it("法令の漢数字の章・節は、この読み方では引かない", () =>
    assert.deepEqual(
      dangling(lines("第一条　目的を定める。", "第二条　第九章及び第三節の規定による。", "第三条　前条による。", "第四条　本文。"), "c.txt", true),
      [],
    ));
});

describe("日本語: 節の番号は数量ではない", () => {
  const quantities = (text: string): unknown[] =>
    patterns()
      .quantities(text)
      .map((mention) => mention.attrs["unit"]);
  it("3.2節は数量にしない", () => assert.deepEqual(quantities("3.2節で述べた。"), []));
  it("全3章は数量のまま", () => assert.deepEqual(quantities("全3章からなる。"), ["章"]));
});
