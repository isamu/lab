import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";

import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// no-mixed-desumasu: ですます調のブログで、書き手が気持ちを漏らす常体の一文（形容詞で言い切る、「〜し、」で並べてこぼす）は指さない。
// 動詞で言い切る報告の常体と、ブログでない文書は今までどおり指す。である調の文書でページの読み手に詳しい所を示す丁寧な案内も指さない。例文は自作。

const findingsOf = (source: string, genre = "blog/tech"): readonly string[] => namedRuleRun("no-mixed-desumasu", source, ja, "a.md", genre).findings;

const polite = ["先週、手元のブランチを整理しました。", "練習用のブランチがたくさん残っていました。", "そこで、まとめて消すコマンドを打ちました。"].join("");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("no-mixed-desumasu: ブログの気持ちの声", () => {
  it("形容詞で言い切る常体の一文を指さない", () => {
    assert.deepEqual(findingsOf(`# 話\n\n${polite}ここまでは、手元の話なのでまだよかった。\n`), []);
  });

  it("「〜し、」で並べてこぼす常体の一文を指さない", () => {
    assert.deepEqual(findingsOf(`# 話\n\n${polite}画面は止まるし、音も途切れると言われる。\n`), []);
  });

  it("動詞で言い切る報告の常体は指す", () => {
    assert.equal(findingsOf(`# 話\n\n${polite}翌週に作業の手順を見直した。\n`).length, 1);
  });

  it("ブログでない文書では形容詞で言い切る常体も指す", () => {
    assert.equal(findingsOf(`# 報告\n\n${polite}ここまでは、手元の話なのでまだよかった。\n`, "business/report").length, 1);
  });
});

const plain = ["委員から資料の説明があった。", "主な意見は次のとおりである。", "工程の見直しが必要との意見があった。"].join("");

describe("no-mixed-desumasu: ページの読み手への案内", () => {
  it("である調の議事録の前の「概要は、…をご覧ください。」を指さない", () => {
    assert.deepEqual(
      findingsOf(`# 第4回会議\n\n## 概要\n\n本会議の概要は、会議の紹介ページをご覧ください。\n\n## 議事\n\n${plain}\n`, "business/meeting-notes"),
      [],
    );
  });

  it("案内の語の無い「資料をご覧ください。」は指す", () => {
    assert.equal(findingsOf(`# 第4回会議\n\n## 議事\n\n${plain}配布した資料をご覧ください。\n`, "business/meeting-notes").length, 1);
  });
});
