import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { latinBoundaries, minorityStyle, occurrencesOutside, type Boundary } from "../packages/chaff/src/orthography.ts";
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
    ["Node.js 22 以上", ["after-digit:spaced"]],
    ["3日で終わる", ["after-digit:touching"]],
    ["を 3回", ["before-digit:spaced", "after-digit:touching"]],
    ["3GBの容量", ["after-digit:touching"]],
    ["10ms 待つ", ["after-digit:spaced"]],
    ["v1.2の変更", ["after-digit:touching"]],
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
    ["全角のＡＢＣは数えない", []],
    ["二つ空けた  API", []],
    ["全角の空白\u3000API", []],
    ["English only here", []],
    ["", []],
  ];
  cases.forEach(([text, expected]) => {
    it(JSON.stringify(text), () => assert.deepEqual(kinds(text), expected));
  });

  it("gives the offset of the boundary in UTF-16, after an emoji too", () => {
    assert.deepEqual(
      latinBoundaries("😀あA").map((boundary) => boundary.offset),
      [3],
    );
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

  it("stays off unless it is turned on, like every experimental rule", () => {
    const config = configFrom("prefer:\n  サーバー: サーバ\n");
    const doc = buildDocument("a.md", "# 設定\n\nサーバーを起動する。\n", ja, teamRules(config));
    const ids = runRules(doc, loadRules("ja"), {}, false, "technical/readme").findings.map((finding) => finding.rule);
    assert.ok(!ids.includes("preferred-term"));
  });
});

describe("latin-spacing", () => {
  const spacing = (source: string, level: Settings[string] = "normal", adapter = ja): (string | number | undefined)[] => {
    const doc = buildDocument("a.md", source, adapter);
    return runRules(doc, loadRules(adapter.id), { "latin-spacing": level }, false, "technical/readme")
      .findings.filter((finding) => finding.rule === "latin-spacing")
      .map((finding) => `${String(finding.values["kind"])}:${String(finding.values["style"])}`);
  };

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

  it("on relaxed, one odd place is not enough", () => {
    assert.deepEqual(spacing("# 使い方\n\nAPI を呼び、JSON を受け取り、IDを返す。\n", "relaxed"), []);
  });

  it("does not run on English", () => {
    assert.deepEqual(spacing("# Usage\n\nCall the API and get JSON.\n", "normal", en), []);
  });
});
