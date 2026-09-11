import { test } from "node:test";
import assert from "node:assert/strict";
import { viewOf } from "../packages/scoria/src/source-view.ts";

test("コードとコメントを分け、行番号を保つ", () => {
  const view = viewOf(["const a = 1; // note", "const b = 2;"]);
  assert.equal(view.code.length, 2);
  assert.equal(view.comments.length, 2);
  assert.match(view.code[0] ?? "", /const a = 1;/);
  assert.doesNotMatch(view.code[0] ?? "", /note/);
  assert.match(view.comments[0] ?? "", /note/);
  assert.equal((view.comments[1] ?? "").trim(), "");
});

test("文字列リテラルの中身はコードから外れる", () => {
  const view = viewOf(['const marker = "eslint-disable";']);
  assert.doesNotMatch(view.code[0] ?? "", /eslint-disable/);
  assert.doesNotMatch(view.comments[0] ?? "", /eslint-disable/);
});

test("ブロックコメントが複数行にまたがっても行がずれない", () => {
  const view = viewOf(["/*", " * @ts-ignore の説明", " */", "const a = 1;"]);
  assert.equal(view.code.length, 4);
  assert.match(view.comments[1] ?? "", /@ts-ignore/);
  assert.doesNotMatch(view.code[1] ?? "", /@ts-ignore/);
  assert.match(view.code[3] ?? "", /const a = 1;/);
});
