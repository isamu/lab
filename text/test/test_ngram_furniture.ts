import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { charWindows, wordWindows } from "../packages/chaff/src/detectors/gram-windows.ts";
import { furnitureMask, isFurniture } from "../packages/chaff/src/detectors/gram-furniture.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Span } from "../packages/chaff/src/plugin.ts";

// ngram-repetition は書き手が繰り返す言い回しを見る。ひな形が繰り返す飾り（括弧の札、リンクの文字、記号）は数えない。
// 英語の窓は語の切れ目にそろえる。語の途中で始まる "roductivity change a" は読み手に言い回しとして見えない。

const sliced = (text: string, windows: readonly Span[]): string[] => windows.map((window) => text.slice(window.start, window.end));

describe("wordWindows", () => {
  it("語の頭で始まり語の尾で終わる、minLength 文字に届く最短の窓", () => {
    assert.deepEqual(sliced("it is important to note", wordWindows("it is important to note", 10)), ["it is important", "is important", "important to"]);
  });

  it("届かない末尾の語からは窓を作らない", () => {
    assert.deepEqual(sliced("alpha beta", wordWindows("alpha beta", 20)), []);
  });

  it("1 語で届けば、その語だけの窓", () => {
    assert.deepEqual(sliced("internationalization ok", wordWindows("internationalization ok", 20)), ["internationalization"]);
  });

  it("語の前後の句読点と括弧は窓に入れない。語の間のものは入る", () => {
    const text = "(the participant described, it)";
    assert.deepEqual(sliced(text, wordWindows(text, 20)), ["the participant described", "participant described"]);
  });

  it("空の文には窓が無い", () => {
    assert.deepEqual(wordWindows("", 20), []);
  });
});

describe("charWindows", () => {
  it("1 文字ずつずらした幅 width の窓", () => {
    assert.deepEqual(sliced("あいうえ", charWindows("あいうえ", 3)), ["あいう", "いうえ"]);
  });

  it("文が幅より短ければ窓は無い", () => {
    assert.deepEqual(charWindows("あい", 3), []);
  });
});

const none = (): boolean => false;
const furnitureOf = (text: string, window: string, linked: (index: number) => boolean = none): boolean => {
  const start = text.indexOf(window);
  return isFurniture(text, furnitureMask(text, linked), { start, end: start + window.length });
};

describe("furnitureMask / isFurniture", () => {
  it("括弧でくくった札（1 語か、1 語ずつの並び）だけの窓は飾り", () => {
    assert.ok(furnitureOf("[69] arXiv:2305.11207 (replaced) [pdf, html, other]", "(replaced) [pdf, html,"));
  });

  it("括弧の中が言い回し（if applicable）なら札ではない", () => {
    assert.ok(!furnitureOf("Select Save (if applicable).", "Save (if applicable)."));
  });

  it("括弧の外の語が過半なら飾りではない", () => {
    assert.ok(!furnitureOf("the release (LTM) was published on time", "(LTM) was published on"));
  });

  it("飾りがちょうど半分なら飾りではない。過半で初めて飾り", () => {
    assert.ok(!furnitureOf("(ab) cdef", "(ab) cdef"));
    assert.ok(furnitureOf("(abc) def", "(abc) def"));
  });

  it("記号と句読点が過半なら飾り", () => {
    assert.ok(furnitureOf("go -> -> -> ... => => to", "-> -> -> ... => =>"));
  });

  it("リンクの文字は飾り", () => {
    const text = "See Read the full story here. Next";
    const from = text.indexOf("Read");
    const to = text.indexOf(" Next");
    assert.ok(furnitureOf(text, "Read the full story here.", (index) => index >= from && index < to));
    assert.ok(!furnitureOf(text, "Read the full story here."));
  });

  it("日本語の括弧の中に平仮名があれば札ではない", () => {
    assert.ok(!furnitureOf("手順（詳しくはこちらをご覧ください）", "（詳しくはこちらを"));
    assert.ok(furnitureOf("手順（ＰＤＦ、ＨＴＭＬ）", "（ＰＤＦ、ＨＴＭＬ）"));
  });

  it("空白は数えない。空白だけの窓は飾りではない", () => {
    assert.ok(!isFurniture("   ", furnitureMask("   ", none), { start: 0, end: 3 }));
  });
});

const worstOf = async (adapter: LanguageAdapter, source: string): Promise<string | undefined> => {
  await adapter.prepare?.({ pos: true });
  const finding = runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/report").findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

// どの語も重ならない埋め草。これ自体は繰り返しにならない。
const FILLER = Array.from({ length: 60 }, (_, index) => `Zq${String(index)}a Yk${String(index)}b Xm${String(index)}c Wp${String(index)}d.`).join(" ");
const TOPICS = ["dust", "stars", "gas", "planets", "comets", "galaxies", "quasars", "pulsars"];

describe("ngram-repetition: 一覧の飾り", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("valid: 項目ごとの札（(replaced) [pdf, html, other]）は、何度出ても数えない", async () => {
    // arXiv の新着一覧の形。項目ごとに番号と識別子だけが違う。
    const entries = Array.from(
      { length: 27 },
      (_, index) =>
        `[${String(index + 1)}]  arXiv:2501.${String(10000 + index)}  (replaced) [pdf, html, other]\n\nTitle: Notes on ${TOPICS[index % 8] ?? ""} ${String(index)}`,
    ).join("\n\n");
    assert.equal(await worstOf(en, `# Listing\n\n${entries}\n\n${FILLER}\n`), undefined);
  });

  it("valid: 繰り返されるリンクの文字（Read the full story here）は数えない", async () => {
    const items = Array.from(
      { length: 8 },
      (_, index) => `- News ${String(index)} about ${TOPICS[index] ?? ""}. [Read the full story here](https://example.com/${String(index)})`,
    ).join("\n");
    assert.equal(await worstOf(en, `# News\n\n${items}\n\n${FILLER}\n`), undefined);
  });

  it("invalid: 書き手の言い回しは、一覧の項目の中でも数える", async () => {
    const items = TOPICS.map((topic) => `- The team is required to submit the report on ${topic}.`).join("\n");
    assert.match((await worstOf(en, `# Tasks\n\n${items}\n\n${FILLER}\n`)) ?? "", /is required/u);
  });

  it("invalid: リンクの外の言い回しは、リンクと並んでも数える", async () => {
    const items = TOPICS.map((topic, index) => `- It is important to note that ${topic} [matter](https://example.com/${String(index)}).`).join("\n");
    assert.match((await worstOf(en, `# Notes\n\n${items}\n\n${FILLER}\n`)) ?? "", /is important/u);
  });
});

describe("ngram-repetition: 英語の窓は語の切れ目にそろう", () => {
  it("報告する語句は語の頭で始まり語の尾で終わる", async () => {
    const contexts = [
      "Congress changed",
      "Economists study",
      "Governors defend",
      "Critics attack",
      "Analysts track",
      "Voters discuss",
      "Reports cover",
      "Lawmakers keep",
    ];
    const body = contexts.map((context) => `${context} it, and it is important to note that.`).join(" ");
    const source = `# Report\n\n${body} ${FILLER}`;
    const word = (await worstOf(en, source)) ?? "";
    assert.notEqual(word, "");
    assert.ok(new RegExp(String.raw`(?:^|\s)${word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:\s|$)`, "u").test(body), word);
  });

  it("invalid: 文頭の大文字と文中の小文字は同じ言い回しとして数え、書かれたままの形で報告する", async () => {
    // NSF の募集要項（nsf-19-582）の形。4 回は文頭、2 回は文中。
    const body = TOPICS.slice(0, 6)
      .map((topic, index) => (index < 4 ? `Proposals are submitted via ${topic}.` : `All proposals are submitted via ${topic}.`))
      .join(" ");
    assert.equal(await worstOf(en, `# Solicitation\n\n${body} ${FILLER}\n`), "Proposals are submitted");
  });

  it("invalid: 前後の語が毎回違っても、18 文字の言い回し（juxtaposed to said）は数える", async () => {
    // 特許の請求項（US 6004596）の形。文字で切っていた頃は前後の空白ごと 20 文字の窓に収まっていた。
    const nouns = ["food", "layer", "crust", "filling", "edge", "rim"];
    const body = nouns.map((noun, index) => `A ${noun} juxtaposed to said ${TOPICS[index] ?? ""} holds.`).join(" ");
    assert.equal(await worstOf(en, `# Claims\n\n${body} ${FILLER}\n`), "juxtaposed to said");
  });

  it("invalid: 語の後ろの句読点が違っても同じ言い回しとして数える", async () => {
    // 論文（arxiv 2609.27842）の形。"described," と "described" を分けて数えると 5 回に満たない。
    const body = TOPICS.slice(0, 6)
      .map((topic, index) => (index % 2 === 0 ? `So the participant described it as ${topic}.` : `Then the participant described, again, ${topic}.`))
      .join(" ");
    assert.equal(await worstOf(en, `# Study\n\n${body} ${FILLER}\n`), "the participant described");
  });
});

describe("ngram-repetition: 日本語の言い回しは今までどおり", () => {
  it("valid: 繰り返されるリンクの文字（詳しくはこちらをご覧ください）は、日本語でも数えない", async () => {
    const filler = Array.from({ length: 80 }, (_, index) => `資料${String(index)}番号${String(index)}。`).join("");
    const items = ["画面", "一覧", "表", "図", "枠", "欄", "箱", "列"]
      .map((place, index) => `- ${place}${String(index)}番。[詳しくはこちらをご覧ください](https://example.com/${String(index)})`)
      .join("\n");
    assert.doesNotMatch((await worstOf(ja, `# 見出し\n\n${items}\n\n${filler}\n`)) ?? "", /こちら|ご覧/u);
  });

  it("invalid: 括弧の札の後ろに続く言い回しは数える", async () => {
    const filler = Array.from({ length: 80 }, (_, index) => `資料${String(index)}番号${String(index)}。`).join("");
    const body = ["画面", "一覧", "表", "図", "枠", "欄", "箱", "列"].map((place) => `${place}（ＰＤＦ）の中にあるコンポーネントを選びます。`).join("");
    assert.match((await worstOf(ja, `# 見出し\n\n${body}${filler}`)) ?? "", /の中にあ/u);
  });
});
