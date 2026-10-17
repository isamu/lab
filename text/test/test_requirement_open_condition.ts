import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { glossesCondition } from "../packages/chaff/src/detectors/open-end-condition.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { Sentence } from "../packages/chaff/src/plugin.ts";

// requirement-smell: an open list in brackets right after a condition word (不要な場合（一つの表だけを読むとき等）も付ける
// こと) gives examples of when the requirement applies, and is not reported. Self-written sentences only.

const RULE = "requirement-smell";

const found = (body: string): string[] =>
  runRules(buildDocument("t.md", `# 規約\n\n${body}\n`, ja), loadRules(ja.id), { [RULE]: "normal" }, false, "technical/spec")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${finding.variant ?? ""}:${String(finding.values["matched"])}`);

const sentenceOf = (text: string): Sentence => ({ span: { start: 100, end: 100 + text.length }, text });

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("glossesCondition", () => {
  const CONDITIONS = ["場合", "とき"];
  const at = (text: string, word: string): boolean => glossesCondition(sentenceOf(text), 100 + text.indexOf(word), CONDITIONS);

  it("is true inside brackets that open right after a condition word, nested brackets included", () => {
    assert.equal(at("不要な場合（一つの表だけを読むとき等）も付けること。", "等"), true);
    assert.equal(at("不要な場合 (一つの表だけを読むとき等) も付けること。", "等"), true);
    assert.equal(at("不要な場合（表（一つ）だけを読むとき等）も付けること。", "等"), true);
    assert.equal(at("不要な場合（一つの表（索引等）だけを読むとき）も付けること。", "等"), true);
  });

  it("closes a bracket only with its own kind", () => {
    assert.equal(at("不要な場合（一つの表)、ログ等を残すこと。", "等"), true);
    assert.equal(at("不要な場合(一つの表)、ログ等を残すこと。", "等"), false);
  });

  it("is false outside brackets, after a closed bracket, and in brackets after another word", () => {
    assert.equal(at("ログ等を保存すること。", "等"), false);
    assert.equal(at("不要な場合（一つの表）も、ログ等を残すこと。", "等"), false);
    assert.equal(at("必要書類（住民票等）を出すこと。", "等"), false);
  });
});

describe("requirement-smell (ja): an open list that gives examples of a condition", () => {
  it("valid: 等 in brackets right after 場合 or とき is not reported", () => {
    assert.deepEqual(found("別名が要らない場合（一つの表だけを読むとき等）も、必ず別名を付けること。"), []);
    assert.deepEqual(found("値が無いとき（取得に失敗したとき等）は、空欄にすること。"), []);
  });

  it("invalid: 等 in brackets that name what is required is reported", () => {
    assert.deepEqual(found("必要書類（住民票等）を必ず提出すること。"), ["open-end:等"]);
    assert.deepEqual(found("別名が要らない場合も、ログ等に必ず別名を残すこと。"), ["open-end:等"]);
  });
});
