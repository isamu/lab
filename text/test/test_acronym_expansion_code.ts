import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { expansionsIn } from "../packages/chaff/src/acronym-expansions.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 符号の中の略語（CC BY-NC-SA の SA）の後ろの括弧は、符号全体の名前で、その略語だけの展開ではない。例文はすべて自作。

const conflictsOf = (source: string): readonly string[] => namedRuleRun("acronym-expansion-conflict", source, ja, "a.md", "docs/manual").findings;

const acronymsOf = (text: string): string[] => expansionsIn({ start: 0, text }).map((expansion) => expansion.acronym);

describe("acronym-expansion-conflict: ハイフンでつないだ符号の名前", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("ハイフンかスラッシュで英数字につないだ略語の後ろの括弧は、その略語の展開に読まない", () => {
    assert.deepEqual(acronymsOf("この資料は XY-AB（表示-継承）で配る。"), []);
    assert.deepEqual(acronymsOf("この資料は XY-QR-AB（表示-非営利-継承）で配る。"), []);
    assert.deepEqual(acronymsOf("通信は ABC/DEF（転送の手順）で送る。"), []);
    const source = ["# 配布", "", "前の版は XY-AB（表示-継承）で配った。", "", "今の版は XY-QR-AB（表示-非営利-継承）で配る。", ""].join("\n");
    assert.deepEqual(conflictsOf(source), []);
  });

  it("単独で書いた略語の展開は、これまでどおり読み、二通りなら指す", () => {
    assert.deepEqual(acronymsOf("運用は SRE（サイト信頼性工学）が担う。"), ["SRE"]);
    assert.deepEqual(acronymsOf("運用は-SRE（サイト信頼性工学）が担う。"), ["SRE"]);
    // 符号の中の略語でも、頭文字がその略語と揃う英字の名前は、その略語の展開。
    assert.deepEqual(acronymsOf("規格は IEEE-SA (Standards Association) が定める。"), ["SA"]);
    const source = ["# 体制", "", "運用は SRE（サイト信頼性工学）が担う。", "", "障害の対応も SRE（現場の保守班）が受ける。", ""].join("\n");
    assert.equal(conflictsOf(source).length, 1);
  });
});
