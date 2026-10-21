import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { endingTokens } from "../packages/chaff/src/sentence-shape.ts";
import { isNeutralPlainShape } from "../packages/chaff/src/detectors/register-neutral-shape.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// no-mixed-desumasu: へりくだる動詞の願い（〜していただきたい。）、常体の問い（〜できているか。）、言いさし（〜たら・・・。）は、
// ですます調にもである調にも数えない。例文は自作と、首相官邸の訓示・政府広報オンライン（PDL-1.0）を縮めたもの。

const findingsOf = (source: string, genre = "speech/address"): readonly string[] => namedRuleRun("no-mixed-desumasu", source, ja, "a.md", genre).findings;

const REQUESTS = [{ pattern: "いただく" }, { pattern: "頂く" }, { pattern: "願う" }];

const neutral = (text: string): boolean => {
  const sentence = buildDocument("a.md", text, ja).sentences[0];
  return sentence !== undefined && isNeutralPlainShape(sentence, endingTokens(sentence), REQUESTS);
};

const polite = ["本日は誠におめでとうございます。", "諸官の努力に敬意を表します。", "国民の期待は大きいものがあります。", "共に歩んでまいります。"].join("");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("isNeutralPlainShape", () => {
  it("へりくだる動詞に「たい」だけが付いた願い、常体の問い、条件の言いさしは調子に数えない", () => {
    [
      "諸官は受け継いでいただきたい。",
      "隊員の声をいかしていただきたい。",
      "ご協力願いたい。",
      "対処できているか。",
      "どうすればよいのだろうか。",
      "いつもと違っていたら・・・。",
      "雨が降ったら…",
    ].forEach((text) => assert.equal(neutral(text), true, text));
  });

  it("自分の望み、願いの過去・丁寧形、問いでない常体、言いさしでない条件は常体のまま", () => {
    [
      "早く帰りたい。",
      "受け継いでいただきたかった。",
      "任務を遂行する。",
      "雨が降ったら中止する。",
      "いつもと違っていたら。",
      "それでよいかどうか検討する。",
    ].forEach((text) => assert.equal(neutral(text), false, text));
  });
});

describe("no-mixed-desumasu: 願い・問い・言いさし", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("ですます調の訓示の「〜していただきたい。」「〜できているか。」を指さない", () => {
    assert.deepEqual(findingsOf(`# 訓示\n\n${polite}諸官は先輩方の努力を受け継いでいただきたい。\n`), []);
    assert.deepEqual(findingsOf(`# 訓示\n\n${polite}有効に対処できているか。その答えは諸官にかかっております。\n`), []);
  });

  it("ですます調の記事の言いさし（〜たら・・・。）を指さない", () =>
    assert.deepEqual(findingsOf(`# 気づき\n\n${polite}もしも、いつもと違っていたら・・・。まず声をかけてください。\n`, "blog/owned-media"), []));

  it("ですます調の中の常体の言い切りと、自分の望みは今までどおり指す", () => {
    assert.equal(findingsOf(`# 訓示\n\n${polite}諸官は任務を遂行する。\n`).length, 1);
    assert.equal(findingsOf(`# 訓示\n\n${polite}私は早く帰りたい。\n`).length, 1);
  });
});
