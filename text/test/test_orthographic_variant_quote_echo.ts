import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { echoesQuotation, quotationsIn } from "../packages/chaff/src/quote-echo.ts";

// orthographic-variant: 引用した句を地の文でそのまま繰り返した所は、引用の書き方を保つ。例文は自作。

const findingsOf = (source: string, genre = "speech/address"): readonly string[] => namedRuleRun("orthographic-variant", source, ja, "a.md", genre).findings;

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("echoesQuotation", () => {
  const quotations = ["仕事は勇気と真心をもって真実を語ることだ"];
  it("語とその前後の字が、引用の中にそのままあれば繰り返し", () => {
    const text = "勇気と真心をもって真実を語り、信頼を得ます。";
    const start = text.indexOf("もっ");
    assert.equal(echoesQuotation(text, { start, end: start + 2 }, quotations), true);
  });

  it("語だけが同じで前後が違う、短すぎる、引用が無い、は繰り返しでない", () => {
    const text = "権限をもって判断します。";
    const start = text.indexOf("もっ");
    assert.equal(echoesQuotation(text, { start, end: start + 2 }, quotations), false);
    assert.equal(echoesQuotation("もって", { start: 0, end: 2 }, ["もって"]), false);
    assert.equal(echoesQuotation(text, { start, end: start + 2 }, []), false);
  });

  it("quotationsIn は引用の中身を返す", () => {
    assert.deepEqual(quotationsIn("彼は「はい」と言った。", [{ start: 3, end: 5 }]), ["はい"]);
    assert.deepEqual(quotationsIn("", []), []);
  });
});

describe("orthographic-variant: 引用を繰り返した句", () => {
  it("引用の中の句を地の文で繰り返した所は、引用の書き方のまま比べない", () => {
    assert.deepEqual(
      findingsOf(
        "# 演説\n\n先輩の「仕事は勇気と真心をもって真実を語ることだ」との言葉を胸に刻みました。熱意を持って支援します。透明性を持って公開します。誠実さを持って決めます。勇気と真心をもって真実を語り、信頼を取り戻します。\n",
      ),
      [],
    );
  });

  it("引用に無い所の書き方の違いは今までどおり言う", () => {
    assert.equal(
      findingsOf(
        "# 演説\n\n先輩の「仕事は勇気と真心をもって真実を語ることだ」との言葉を胸に刻みました。熱意を持って支援します。透明性を持って公開します。誠実さを持って決めます。勇気をもって説明します。\n",
      ).length,
      1,
    );
  });
});
