import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { laterAlternatives, laterJoined } from "../packages/chaff/src/alternative-words.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// teki-overuse: 「連続的か断続的か、一時的」は一つの選びの選択肢で、一つと数える。続けて書いた組（信仰的主観的）も一つ、文の中の箇条
// （①…、②…）は項目ごとに数える。例文は自作か、気象庁の公開文、寺田寅彦（青空文庫、著作権切れ）から短く採った。

const RULES = loadRules("ja");

const counts = (source: string): number[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn("docs/faq"), true, "docs/faq")
    .findings.filter((finding) => finding.rule === "teki-overuse")
    .map((finding) => Number(finding.values?.["count"]));

const tokensOf = (...words: readonly (readonly [string, string])[]): Token[] =>
  words.reduce<Token[]>((tokens, [surface, pos]) => {
    const start = tokens.at(-1)?.span.end ?? 0;
    return [...tokens, { surface, pos, span: { start, end: start + surface.length } }];
  }, []);

describe("laterAlternatives", () => {
  it("か の後ろの、名詞と読点だけを挟んだ次の語", () => {
    const tokens = tokensOf(
      ["連続", "NOUN"],
      ["的", "NOUN"],
      ["か", "PART"],
      ["断続", "NOUN"],
      ["的", "NOUN"],
      ["か", "PART"],
      ["、", "PUNCT"],
      ["一時", "NOUN"],
      ["的", "NOUN"],
    );
    assert.deepEqual([...laterAlternatives(tokens, [1, 4, 8])], [4, 8]);
  });

  it("か が無いか、名詞でない語を挟めば別に数える", () => {
    const listed = tokensOf(["経済", "NOUN"], ["的", "NOUN"], ["、", "PUNCT"], ["社会", "NOUN"], ["的", "NOUN"]);
    assert.deepEqual([...laterAlternatives(listed, [1, 4])], []);
    const apart = tokensOf(["論理", "NOUN"], ["的", "NOUN"], ["か", "PART"], ["を", "ADP"], ["具体", "NOUN"], ["的", "NOUN"]);
    assert.deepEqual([...laterAlternatives(apart, [1, 5])], []);
    assert.deepEqual([...laterAlternatives([], [])], []);
  });
});

describe("laterJoined", () => {
  it("名詞だけを挟んで続けて書いた次の「〜的」", () => {
    const pair = tokensOf(["信仰", "NOUN"], ["的", "NOUN"], ["主観", "NOUN"], ["的", "NOUN"], ["で", "AUX"]);
    assert.deepEqual([...laterJoined(pair, [1, 3])], [3]);
    const compound = tokensOf(["気候", "NOUN"], ["学", "NOUN"], ["的", "NOUN"], ["地理", "NOUN"], ["学", "NOUN"], ["的", "NOUN"]);
    assert.deepEqual([...laterJoined(compound, [2, 5])], [5]);
  });

  it("助詞、読点、な を挟めば別に数える", () => {
    const and = tokensOf(["効果", "NOUN"], ["的", "NOUN"], ["かつ", "CCONJ"], ["効率", "NOUN"], ["的", "NOUN"]);
    assert.deepEqual([...laterJoined(and, [1, 4])], []);
    const listed = tokensOf(["経済", "NOUN"], ["的", "NOUN"], ["、", "PUNCT"], ["社会", "NOUN"], ["的", "NOUN"]);
    assert.deepEqual([...laterJoined(listed, [1, 4])], []);
    const adjacent = tokensOf(["的", "NOUN"], ["的", "NOUN"]);
    assert.deepEqual([...laterJoined(adjacent, [0, 1])], []);
    assert.deepEqual([...laterJoined([], [])], []);
  });
});

describe("teki-overuse: 続けて書いた組と、文の中の箇条", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 続けて書いた組（信仰的主観的、顕在的実践的）は一つと数える（寺田寅彦）", () => {
    assert.deepEqual(counts("前者は信仰的主観的であるが、後者は懐疑的客観的だからかもしれない。\n"), []);
    assert.deepEqual(counts("それが人間の人間としての顕在的実践的な活動の原動力としてはたらくときにはじめて現実的の意義がある。\n"), []);
  });

  it("invalid: 組の外に「〜的」が重なれば指す（自作）", () => {
    assert.deepEqual(counts("前者は信仰的主観的であるが、後者は懐疑的で、具体的な根拠を論理的に求める。\n"), [4]);
  });

  it("valid: 文の中の箇条（①…、②…）は項目ごとに数える（自作）", () => {
    const items =
      "新しい制度の具体的な内容として、①経済的支援：低所得の世帯への金銭的な給付、②社会的支援：地域の見守りと金銭的な相談の窓口、の二つが示された。\n";
    assert.deepEqual(counts(items), []);
  });

  it("invalid: 印の無い並び、一つの項目に重なった「〜的」は指す（自作）", () => {
    const unmarked =
      "新しい制度の具体的な内容として、経済的支援：低所得の世帯への金銭的な給付、社会的支援：地域の見守りと金銭的な相談の窓口、の二つが示された。\n";
    assert.deepEqual(counts(unmarked), [5]);
    const crowded = "新しい制度の内容として、①経済的支援：低所得の世帯への金銭的で継続的な給付、②地域の見守り、の二つが示された。\n";
    assert.deepEqual(counts(crowded), [3]);
  });
});

describe("teki-overuse: 選択肢", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 連続的か断続的か、一時的", () => {
    assert.deepEqual(counts("降水確率は、降水が連続的か断続的か、一時的とすればどこかなどは示していません。\n"), []);
  });

  it("invalid: 読点で並べた「〜的」、選択肢の外の「〜的」", () => {
    assert.deepEqual(counts("経済的、社会的、文化的な影響を総合的に見る。\n"), [4]);
    assert.deepEqual(counts("論理的か感覚的かを問わず、具体的で効果的な方法を選ぶ。\n"), [3]);
  });
});
