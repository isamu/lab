import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { laterAlternatives } from "../packages/chaff/src/alternative-words.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// teki-overuse: 「連続的か断続的か、一時的」は一つの選びの選択肢で、一つと数える。例文は自作か、気象庁の公開文から短く採った。

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
