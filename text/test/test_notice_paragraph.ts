import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 断り書きの段落（免責・変更の予告）は、である調の文書でもですます調で書く決まり文句なので、文末の調子を本文と比べない。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("no-mixed-desumasu", source, ja, "a.md", "technical/spec").findings;

const body = [
  "# 前提",
  "",
  "本規約は社内の開発チームを対象とする。",
  "命名は英小文字とハイフンで書く。",
  "環境名は名前の先頭に置く。",
  "略語は一覧に載せたものだけを使う。",
  "例外は各チームの判断で定める。",
  "",
].join("\n");

describe("no-mixed-desumasu: 断り書きの段落は本文と比べない", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("ですます調でそろえた断り書きの段落は、である調の本文の中でも指さない", () => {
    const notice = [
      "本規約は誰でも無償で利用できます。",
      "ただし、利用に伴う損害について、作成者は一切の責任を負いません。",
      "また、内容は予告なく変更することがありますので、あらかじめご了承ください。",
      "",
    ].join("\n");
    assert.deepEqual(findingsOf(`${notice}\n${body}`), []);
    assert.deepEqual(findingsOf(`${body}\n${notice}`), []);
  });

  it("断りの語が一文だけの段落、調子の混ざった段落、断りの語の無い段落は、これまでどおり指す", () => {
    const single = "内容は予告なく変更することがあります。\n";
    assert.equal(findingsOf(`${single}\n${body}`).length, 1);
    const mixed = "本規約は無償で利用できる。\n内容は予告なく変更することがありますので、ご了承ください。\n";
    assert.equal(findingsOf(`${mixed}\n${body}`).length, 1);
    const plain = "本規約は誰でも利用できます。\n分からない点は窓口に問い合わせてください。\n";
    assert.equal(findingsOf(`${plain}\n${body}`).length, 2);
  });
});
