import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { narrow, wordsFrom } from "../packages/chaff/src/look-at.ts";
import { wholeDocument } from "../packages/chaff/src/semantic.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

const SOURCE = [
  "# 報告",
  "",
  "売上が前年から20%向上しました。担当者にご確認ください。",
  "体制は来月から変わります。詳細は別紙のとおりです。",
  "コストを15%削減できました。期限までにお願いします。",
].join("\n");

const doc = buildDocument("t.md", SOURCE, ja);

const textsFor = (lookAt: string | undefined): string[] => narrow(doc, lookAt, wholeDocument).candidates.map((candidate) => candidate.text);

describe("look_at を絞り込みに変える", () => {
  it("括弧の中の語を取り出す", () => {
    assert.deepEqual(wordsFrom("「お願いします」「ご確認ください」を含む文"), ["お願いします", "ご確認ください"]);
    assert.deepEqual(wordsFrom('"deadline" and "owner" in the same sentence'), ["deadline", "owner"]);
  });

  it("同じ語を 2 度数えない", () => {
    assert.deepEqual(wordsFrom("「期限」と「期限」"), ["期限"]);
  });

  it("括弧が無ければ語は取れない", () => {
    assert.deepEqual(wordsFrom("文書の最後のほう"), []);
    assert.deepEqual(wordsFrom(undefined), []);
  });

  it("語を含む文だけを渡す", () => {
    assert.deepEqual(textsFor("「お願いします」「ご確認ください」を含む文"), ["担当者にご確認ください。", "期限までにお願いします。"]);
  });

  it("「数値」と書いてあれば、数字のある文に限る", () => {
    // 「向上」だけなら 1 文だが、数字を要求すると同じ 1 文。数字の無い文が混ざらないことを見る。
    assert.deepEqual(textsFor("数値と「向上」「削減」などの語が同じ文にあるところ"), ["売上が前年から20%向上しました。", "コストを15%削減できました。"]);
  });

  it("絞り込めなければ文書全体を渡し、そのことを返す", () => {
    const result = narrow(doc, "文書の最後のほう", wholeDocument);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.narrowing.words.length, 0);
    assert.equal(result.narrowing.kept, result.narrowing.total);
  });

  it("絞り込めたら、いくつ渡したかを返す", () => {
    const result = narrow(doc, "「お願いします」を含む文", wholeDocument);
    assert.equal(result.narrowing.kept, 1);
    assert.equal(result.narrowing.total, 6);
  });

  it("どの語にも当たらなければ 1 つも渡さない", () => {
    // 全文を読ませるより、何も聞かないほうがよい。spec §14。
    assert.deepEqual(textsFor("「該当しない語」を含む文"), []);
  });
});
