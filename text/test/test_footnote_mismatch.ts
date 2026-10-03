import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { noteSlips } from "../packages/chaff/src/detectors/footnote-mismatch.ts";

// 注の無い注の印と、印の無い注（footnote-mismatch）。例文はすべて自作。

const RULE = "footnote-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const slipsIn = (text: string): string[] => noteSlips(text, ["※"]).map((slip) => `${slip.label}:${slip.reason}`);

describe("footnote-mismatch: 注の無い印と、印の無い注", () => {
  it("※ の印に注が無い、注を指す印が無い", () => {
    assert.deepEqual(findingsOf("営業運行※1を開始し、料金※2は無料です。\n\n※1 特定の走行環境条件での運行\n※3 予約が必要です\n"), [
      "「※2」の注がありません",
      "注「※3」を本文のどこも指していません",
    ]);
  });

  it("Markdown の脚注", () => {
    assert.deepEqual(findingsOf("The pilot starts in May[^1] and is free[^2].\n\n[^1]: On weekdays only.\n[^3]: Booking required.\n", en), [
      'There is no note for "[^2]"',
      'Nothing in the text points to the note "[^3]"',
    ]);
  });

  it("注の行は字下げ、箇条書き、括弧付きでもよい。全角の番号も同じ注", () => {
    assert.deepEqual(slipsIn("給与 ※１ と手当（※2）。\n- ※1 日給額\n  （※2）手当"), []);
  });

  it("合っている注は言わない", () => {
    assert.deepEqual(slipsIn("運行※1と料金※2。\n※1 平日のみ\n※2 期間中"), []);
    assert.deepEqual(noteSlips("A[^a] and B[^A].\n\n[^a]: Shared note.", []), []);
  });

  it("※ の注が一つも無い文書では、※ の印を言わない", () => {
    assert.deepEqual(slipsIn("料金※1は無料です。詳細は別紙を参照。"), []);
  });

  it("Markdown の脚注は、注が一つも無くても言う", () => {
    assert.deepEqual(
      noteSlips("Free[^1].", []).map((slip) => slip.reason),
      ["missing"],
    );
  });

  it("※ の後ろに長い数が続くもの（年度）は注の番号ではない", () => {
    assert.deepEqual(slipsIn("※2018～2019年度入学生は別です。\n※1 平日のみ"), ["※1:unused"]);
    assert.deepEqual(slipsIn("倍率は※1.2倍です。\n※1 補足です"), ["※1:unused"]);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("例：`free[^9]` と書きます。\n", en), []);
  });

  it("空の文字列", () => {
    assert.deepEqual(noteSlips("", ["※"]), []);
  });
});
