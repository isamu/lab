import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// no-mixed-desumasu: インタビューの答えは話した言葉の書き起こし。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("no-mixed-desumasu", source, ja, "a.md", "blog/owned-media").findings;

const interview = (answer: string, intro = "今回は、店長の田中さんにお話を聞きました。"): string =>
  [
    "# 店長インタビュー",
    "",
    intro,
    "",
    "## 店を任されて",
    "",
    "――店長になって、何が変わりましたか？",
    "",
    `最初は戸惑いました。${answer}いまは楽しんでいます。`,
    "",
    "## これから",
    "",
    "――今後の目標を教えてください。",
    "",
    "地元の人に長く通ってもらえる店にしたいです。",
    "",
  ].join("\n");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("no-mixed-desumasu: インタビューの答え", () => {
  it("聞き手の「――」の後の答えの中の常体の文は指さない", () => {
    assert.deepEqual(findingsOf(interview("お客さんの顔を見ると、何を出せばいいか、だいたい分かる。")), []);
  });

  it("最初の問いより前の書き手の紹介文と、インタビューでない文書は今までどおり指す", () => {
    assert.equal(findingsOf(interview("", "今回は、店長の田中さんに話を聞いた。")).length, 1);
    const plain = "# 店の話\n\n最初は戸惑いました。お客さんの顔を見ると、何を出せばいいか、だいたい分かる。いまは楽しんでいます。\n";
    assert.equal(findingsOf(plain).length, 1);
  });
});
