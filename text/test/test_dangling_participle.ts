import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { danglingOpenerIn } from "../packages/chaff/src/detectors/dangling-opener.ts";

// 主語の無い分詞の句（dangling-participle）。例文はすべて自作。

const RULE = "dangling-participle";

const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun(RULE, `${source}\n`, adapter).findings;

describe("dangling-participle: 主語の無い分詞の句", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("分詞の句の後ろが形だけの it か there の文を言う", () => {
    assert.deepEqual(findingsOf("Having reviewed the code, it is ready."), [
      '"Having reviewed the code" has no one to attach to; the subject is an empty "it"',
    ]);
    assert.deepEqual(findingsOf("Looking at the totals, there is a gap of 40 hours."), [
      '"Looking at the totals" has no one to attach to; the subject is an empty "there"',
    ]);
    assert.deepEqual(findingsOf("Having checked the logs, it can be said that the job failed."), [
      '"Having checked the logs" has no one to attach to; the subject is an empty "it"',
    ]);
  });

  it("have been の形も言う", () => {
    assert.deepEqual(findingsOf("Having checked the logs, it has been clear since Monday."), [
      '"Having checked the logs" has no one to attach to; the subject is an empty "it"',
    ]);
  });

  it("過去分詞の句、挿入句の it is、決まった言い方は言わない", () => {
    assert.deepEqual(findingsOf("Configured with SSO, it is ready for enterprise customers."), []);
    assert.deepEqual(findingsOf("Testing the integration, it is worth noting, requires a staging account."), []);
    assert.deepEqual(findingsOf("Seeing as the deploy failed, it is safer to roll back."), []);
  });

  it("主語が名詞や人の文は言わない", () => {
    assert.deepEqual(findingsOf("Having reviewed the code, the team approved it."), []);
    assert.deepEqual(findingsOf("Having finished, we left early."), []);
    assert.deepEqual(findingsOf("After reviewing the code, it is ready."), []);
  });

  it("決まった言い方の句は言わない", () => {
    assert.deepEqual(findingsOf("Based on the data, it is clear that sales rose."), []);
    assert.deepEqual(findingsOf("Given the delay, it is wise to wait."), []);
    assert.deepEqual(findingsOf("Having said that, it is still early."), []);
    assert.deepEqual(findingsOf("Generally speaking, there are two options."), []);
  });

  it("語の無い文と、日本語の文書", () => {
    assert.equal(danglingOpenerIn("", [], new Set(["it"]), []), undefined);
    assert.deepEqual(findingsOf("コードを確認したところ、問題はありません。", ja), []);
  });
});
