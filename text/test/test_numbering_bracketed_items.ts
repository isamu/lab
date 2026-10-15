import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { profileFor } from "../packages/chaff/src/profile/for-file.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";

// numbering-gap: 社内規程は、号の（1）（2）と第 2 項の「2」を条の下の同じ深さに読むことがある。括弧で囲んだ番号と囲まない番号は
// 別の並びで、「（2）の次が 2」は抜けではない。例文は自作。

const lines = (...rows: string[]): string => rows.join("\n");

const GENRE = "legal/statute";

const gapsOf = (source: string, path = "kitei.md"): [unknown, unknown][] =>
  runRules(buildDocument(path, source, ja, undefined, profileFor(EMPTY, path, source, "ja", GENRE)), loadRules(ja.id), {}, true, GENRE)
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => [finding.values["previous"], finding.values["label"]]);

const kitei = (...article: string[]): string =>
  lines(
    "# 休業規程",
    "",
    "(目的)",
    "第1条\tこの規程は、休業の取扱いを定める。",
    "",
    "(終了)",
    "第2条\t次の各号に掲げる事由が生じた場合には、休業は終了する。",
    ...article,
  );

before(async () => prepare());

describe("numbering-gap: bracketed items and bare paragraph numbers under one article", () => {
  it("does not read item (2) and paragraph 2 as one sequence", () => {
    const source = kitei(
      "(1)\t休業の理由がなくなった場合",
      "(2)\t新たな休業が始まった場合",
      "2　前項第1号の場合には、従業員は速やかに会社に届け出る。",
      "3　復職後の取扱いは次の各号による。",
    );
    assert.deepEqual(gapsOf(source), []);
  });

  it("still reports a gap among the bracketed items", () => {
    const source = kitei("(1)\t休業の理由がなくなった場合", "(3)\t新たな休業が始まった場合", "2　前項第1号の場合には、従業員は速やかに会社に届け出る。");
    assert.deepEqual(gapsOf(source), [["（1）", "（3）"]]);
  });

  it("still reports a gap among the bare paragraph numbers", () => {
    const source = kitei(
      "(1)\t休業の理由がなくなった場合",
      "(2)\t新たな休業が始まった場合",
      "2　前項第1号の場合には、従業員は速やかに会社に届け出る。",
      "4　復職後の取扱いは次の各号による。",
    );
    assert.deepEqual(gapsOf(source), [["2", "4"]]);
  });

  it("reads full-width and half-width brackets as one way of writing", () => {
    const source = kitei("（1）\t休業の理由がなくなった場合", "(3)\t新たな休業が始まった場合");
    assert.equal(gapsOf(source).length, 1);
  });
});
