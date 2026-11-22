import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// no-doubled-joshi and the entries of a reference list. Every example is self-written.

const countFor = (source: string): number => firedRules(ja, source).filter((id) => id === "no-doubled-joshi").length;

const ENTRY = "- [1] 中村由美. 在宅勤務の日の時間の使い方. 2023.\n";

describe("no-doubled-joshi: a reference list", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: a cited title under a references heading is not the writer's to change", () => {
    assert.equal(countFor(`# 手引き\n\n時間の管理が大切です[1]。\n\n## 参考文献\n\n${ENTRY}`), 0);
  });

  it("valid: a references heading as a plain paragraph followed by a list", () => {
    assert.equal(countFor(`時間の管理が大切です[1]。\n\n参考文献\n\n${ENTRY}`), 0);
  });

  it("invalid: the same item under another heading is the writer's own list", () => {
    assert.equal(countFor(`# 手引き\n\n## 今日の予定\n\n${ENTRY}`), 1);
  });

  it("invalid: a run in the body above the reference list is still reported", () => {
    assert.equal(countFor(`# 手引き\n\n本社の営業部の第二課の方針を確認しました[1]。\n\n## 参考文献\n\n${ENTRY}`), 1);
  });

  it("invalid: a run in a section after the reference list is still reported", () => {
    assert.equal(countFor(`# 手引き\n\n## 参考文献\n\n${ENTRY}\n## 付記\n\n本社の営業部の第二課の方針を確認しました。\n`), 1);
  });
});
