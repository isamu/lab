import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// no-doubled-joshi and the marks between two phrases (=, :, →). Every example is self-written.

const countFor = (source: string): number => firedRules(ja, source).filter((id) => id === "no-doubled-joshi").length;

describe("no-doubled-joshi: a mark between phrases ends the run", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: an equals sign, a colon or an arrow between two phrases ends the run", () => {
    ["=", "＝", ":", "：", "→", "⇒", "->", " = ", "==", ":="].forEach((mark) => {
      assert.equal(countFor(`インスタンス名の制限${mark}タグの制限のため、短くします。`), 0, mark);
    });
  });

  it("invalid: a run on one side of the mark is still reported", () => {
    assert.equal(countFor("制限=弊社の新製品の販売の計画のため、短くします。"), 1);
    assert.equal(countFor("弊社の新製品の販売の計画→見直し"), 1);
  });

  it("invalid: a run with no mark in it is still reported", () => {
    assert.equal(countFor("インスタンス名の制限のタグの制限のため、短くします。"), 1);
    assert.equal(countFor("本社の営業部の第二課の方針を確認しました。"), 1);
  });

  it("invalid: a mark that is not in the list does not end the run", () => {
    assert.equal(countFor("インスタンス名の制限+タグの制限のため、短くします。"), 1);
  });
});
