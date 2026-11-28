import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 段落の頭に (1)(2)(3) と順に番号を付けた注や文献の一覧は、名前や題を並べた項目で、本文の体言止めに数えない。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("taigen-dome-in-prose", source, ja, "a.md", "academic/paper", "strict").findings;

const body = ["# 概要", "", "本稿は図書館の契約の動向を扱う。", "契約の数は年ごとに増えている。", ""].join("\n");

const notes = [
  "(1) 山田太郎. 図書館の契約の歴史. 図書館の研究. 2020.",
  "",
  "(2) 鈴木花子. 電子資料の価格の推移. 情報の科学. 2021.",
  "",
  "(3) 佐藤次郎. 大学の予算の見通し. 大学の経営. 2022.",
  "",
].join("\n");

describe("taigen-dome-in-prose: 番号を付けた注の一覧", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("1 から順に番号を付けた三つ以上の段落は、注の一覧として数えない", () => {
    assert.deepEqual(findingsOf(`${body}\n${notes}`), []);
  });

  it("番号の段落のあいだの、番号の無い続きの段落も一覧に入れる", () => {
    const continued = notes.replace("(2) 鈴木花子.", "(2) 次の文献に詳しい。\n\n田中一郎. 雑誌の契約の行方. 図書館の雑誌. 2019.\n鈴木花子.");
    assert.deepEqual(findingsOf(`${body}\n${continued}`), []);
  });

  it("番号が 1 から始まらない段落、二つだけの段落、番号の無い段落は本文として数える", () => {
    const shifted = notes.replace("(1)", "(4)").replace("(2)", "(5)").replace("(3)", "(6)");
    assert.equal(findingsOf(`${body}\n${shifted}`).length, 1);
    const unlabelled = notes.replaceAll(/\(\d\) /gu, "");
    assert.equal(findingsOf(`${body}\n${unlabelled}`).length, 1);
    const two = notes.split("\n\n(3)")[0] ?? "";
    assert.equal(findingsOf(`${body}\n${two}\n\n今後の課題は予算。\n`).length, 1);
    // 出典の印（URL、西暦の年）の無い (1)(2)(3) は、本文の列挙。
    const enumerated = notes.replaceAll(/ \d{4}\./gu, "");
    assert.equal(findingsOf(`${body}\n${enumerated}`).length, 1);
  });
});

// 表の注（（注1）…をもって算定。）と、箇条書きへ渡す文（以下のとおり説明。）も、名詞で止めるのが書き方。例文はすべて自作。
describe("taigen-dome-in-prose: 表の注と、箇条書きへ渡す文", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const tableNotes = [
    "（注1）各年度の末の数をもって算定。",
    "",
    "（注2）「施設数」は利用者が千人以上の施設を計上。",
    "",
    "注3：駅と港の施設を合わせて計上。",
    "",
  ].join("\n");

  it("注の語と番号で始まる段落は、表の注として数えない", () => {
    assert.deepEqual(findingsOf(`${body}\n${tableNotes}`), []);
  });

  it("注の語で始まっても、番号や括弧の無い段落（注意、注目）は本文として数える", () => {
    const plain = ["注意の対象は駅の施設。", "", "注目の点は港の施設の数。", "", "残りの課題は空港の施設。", ""].join("\n");
    assert.equal(findingsOf(`${body}\n${plain}`).length, 1);
  });

  const minutes = (lead: string): string => ["# 議事概要", "", `${lead}`, "", "- 費用の見込みを示した。", "- 日程の案を示した。", ""].join("\n");

  it("箇条書きのすぐ前の文は、箇条書きへ渡す案内として数えない", () => {
    const source = [minutes("資料について事務局より以下のとおり説明。"), minutes("主な意見は以下の通り。"), minutes("今後の進め方について座長より説明。")].join(
      "\n",
    );
    assert.deepEqual(findingsOf(source), []);
  });

  it("箇条書きとの間に別の文がある名詞止めは、本文として数える", () => {
    const source = [
      "# 議事概要",
      "",
      "資料について事務局より説明。",
      "",
      "次に日程を確認。",
      "",
      "最後に費用を確認。",
      "",
      "そのうえで次の点を話した。",
      "",
      "- 費用",
      "- 日程",
      "",
    ].join("\n");
    assert.equal(findingsOf(source).length, 1);
  });
});
