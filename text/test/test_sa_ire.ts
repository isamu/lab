import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// さ入れ言葉（sa-ire）。例文はすべて自作。

const RULE = "sa-ire";

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string, genre = "business/report"): readonly string[] => namedRuleRun(RULE, source, ja, "a.md", genre).findings;

describe("sa-ire: さ入れ言葉", () => {
  it("五段動詞の未然形に付いた「させる」", () => {
    assert.deepEqual(findingsOf("資料を読まさせていただきます。明日は休まさせてください。\n"), [
      "「読まさせ」は「さ」の入った形です",
      "「休まさせ」は「さ」の入った形です",
    ]);
    assert.deepEqual(findingsOf("新人を現場に行かさせる。歌わさせるのはやめる。\n"), [
      "「行かさせる」は「さ」の入った形です",
      "「歌わさせる」は「さ」の入った形です",
    ]);
  });

  it("五段動詞の「せる」の形は正しい", () => {
    assert.deepEqual(findingsOf("資料を読ませていただきます。新人を現場に行かせる。話させていただきます。\n"), []);
  });

  it("一段動詞・来させる・サ変動詞の「させる」は正しい", () => {
    assert.deepEqual(findingsOf("子どもに絵を見させる。野菜を食べさせる。友人を家に来させる。結果を説明させていただきます。\n"), []);
  });

  it("鉤括弧で引いた話し言葉は数えない", () => {
    assert.deepEqual(findingsOf("司会者は「では読まさせていただきます」と言った。\n"), []);
  });

  it("英語の文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "A plain sentence.\n", en).skipped, ["not a rule for en"]);
  });
});
