import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// イギリスとアメリカの綴りの混在（spelling-consistency）。例文はすべて自作。

const RULE = "spelling-consistency";

const findingsOf = (source: string, genre = "business/report"): readonly string[] => namedRuleRun(RULE, source, en, "a.md", genre).findings;

const BRITISH = "The colour of the logo is blue. The colour of the button is green. Our behaviour is calm.\n\n";

describe("spelling-consistency: イギリスとアメリカの綴りが混ざっている", () => {
  it("イギリスの綴りの文書の中のアメリカの綴り", () => {
    assert.deepEqual(findingsOf(`${BRITISH}The color of the link is red.\n`), ['"color" here, where the document usually spells it "colour" (1 of 4)']);
  });

  it("アメリカの綴りの文書の中のイギリスの綴り（活用した形も同じ語の綴り）", () => {
    assert.deepEqual(findingsOf("The center opens at nine. The center closes at five. The meeting was canceled. We traveled by train. The centres moved.\n"), [
      '"centres" here, where the document usually spells it "centers" (1 of 5)',
    ]);
  });

  it("-ise と -ize は別に比べる（Oxford の綴りの colour と organize はそろっている）", () => {
    assert.deepEqual(findingsOf(`${BRITISH}In our favour, the centre is open. We organize the files.\n`), []);
  });

  it("文の途中で大文字で始まる名前と、引用符で引いた語は数えない", () => {
    assert.deepEqual(
      findingsOf(`${BRITISH}We met at the Lincoln Center. The guide says to use ‘colour’ not ‘color’. He wrote "the color is red" in his note.\n`),
      [],
    );
  });

  it("文の頭の大文字は名前ではない", () => {
    assert.deepEqual(findingsOf(`${BRITISH}Color matters here.\n`), ['"Color" here, where the document usually spells it "colour" (1 of 4)']);
  });

  it("少ないほうが三分の一を超えれば、使い分けと見て言わない", () => {
    assert.deepEqual(findingsOf("The colour is blue. The color is red.\n"), []);
  });

  it("文学のジャンルは既定で止める", () => {
    const source = `${BRITISH}The color of the link is red.\n`;
    assert.ok(firedRules(en, source, "business/report").includes(RULE));
    assert.ok(!firedRules(en, source, "literature/fiction").includes(RULE));
  });

  it("そろっていれば何も言わない", () => {
    assert.deepEqual(findingsOf(BRITISH), []);
  });

  it("日本語の文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "申込書を送ります。\n", ja).skipped, ["ja 向けの rule ではないため"]);
  });
});
