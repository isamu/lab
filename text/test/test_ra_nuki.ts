import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// ら抜き言葉（ra-nuki）。例文はすべて自作。

const RULE = "ra-nuki";

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string, genre = "business/report"): readonly string[] => namedRuleRun(RULE, source, ja, "a.md", genre).findings;

describe("ra-nuki: ら抜き言葉", () => {
  it("一段動詞の未然形に付いた「れる」", () => {
    assert.deepEqual(findingsOf("新しい端末なら、動画も食べれる量の資料も起きれます。\n"), [
      "「食べれる」は「ら」の抜けた形です",
      "「起きれ」は「ら」の抜けた形です",
    ]);
  });

  it("解析器が一語で持つ形（見れる・来れる）と、カ変の「これる」", () => {
    assert.deepEqual(findingsOf("資料は明日から見れます。会議には来れる人だけ来てください。明日はこれない。\n"), [
      "「見れ」は「ら」の抜けた形です",
      "「来れる」は「ら」の抜けた形です",
      "「これ」は「ら」の抜けた形です",
    ]);
  });

  it("「られる」の形と、五段動詞の可能（走れる・帰れる）は正しい", () => {
    assert.deepEqual(findingsOf("資料は明日から見られます。会議には来られる人が来ます。駅まで走れるし、すぐ帰れる。\n"), []);
  });

  it("鉤括弧で引いた話し言葉は数えない", () => {
    assert.deepEqual(findingsOf("利用者から「すぐ見れる」との声がありました。\n"), []);
  });

  it("話し言葉と文学のジャンルは既定で止める", () => {
    const source = "資料は明日から見れます。\n";
    assert.ok(firedRules(ja, source, "business/report").includes(RULE));
    ["speech/transcript", "literature/fiction"].forEach((genre) => assert.ok(!firedRules(ja, source, genre).includes(RULE), genre));
  });

  it("英語の文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "A plain sentence.\n", en).skipped, ["not a rule for en"]);
  });
});
