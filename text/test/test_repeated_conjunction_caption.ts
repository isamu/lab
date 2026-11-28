import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// repeated-conjunction: 段落の間に置いた図表の題は本文の段落ではないので、同じ接続詞で始まる段落の並びを切らない。例文はすべて自作。

const findingsOf = (paragraphs: readonly string[]): readonly string[] =>
  namedRuleRun("repeated-conjunction", `# 支援\n\n${paragraphs.join("\n\n")}\n`, ja, "a.md", "business/report").findings;

const OPENING = "窓口では、離職する人の希望に応じて、再就職の相談を受けている。";
const RUN = [
  "また、求職者を対象に、職業生活の設計に係る支援を行った。",
  "さらに、再就職が困難な人の移動を支えるため、助成金を支給した。",
  "また、退職予定者の情報を登録し、事業者に紹介する事業を行った。",
];

describe("repeated-conjunction: a caption between the paragraphs", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("reads the run across a table's caption", () => {
    assert.equal(findingsOf([OPENING, RUN[0] ?? "", "表2－2－1　雇用関係助成金制度の概要", RUN[1] ?? "", RUN[2] ?? ""]).length, 1);
  });

  it("a paragraph of prose between them still ends the run", () => {
    assert.deepEqual(findingsOf([OPENING, RUN[0] ?? "", "制度の概要は、次の表のとおりである。", RUN[1] ?? "", RUN[2] ?? ""]), []);
  });

  it("the run without a caption is reported as before", () => {
    assert.equal(findingsOf([OPENING, ...RUN]).length, 1);
  });
});
