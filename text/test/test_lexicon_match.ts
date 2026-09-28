import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { entryIn, entryOpens } from "../packages/chaff/src/detectors/lexicon-match.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, LexiconEntry, Sentence, Token } from "../packages/chaff/src/plugin.ts";

// 語彙表の語を、文の語の並びと原形で照らす。例文はすべて自作。

const token = (surface: string, pos: string, lemma?: string): Token => ({
  span: { start: 0, end: 0 },
  surface,
  pos,
  ...(lemma === undefined ? {} : { lemma }),
});
const sentence = (text: string, tokens?: readonly Token[]): Sentence => ({
  span: { start: 0, end: text.length },
  text,
  ...(tokens === undefined ? {} : { tokens }),
});
const entry = (pattern: string, tokens?: readonly Token[]): LexiconEntry => ({ pattern, ...(tokens === undefined ? {} : { tokens }) });

const ITADAKU = [token("さ", "VERB", "する"), token("せ", "VERB", "せる"), token("て", "SCONJ", "て"), token("いただく", "VERB", "いただく")];

describe("entryIn: 語の並びで照らす", () => {
  it("原形で書いた語は、活用した形に当たる", () => {
    const written = [
      token("さ", "VERB", "する"),
      token("せ", "VERB", "せる"),
      token("て", "SCONJ", "て"),
      token("いただき", "VERB", "いただく"),
      token("ます", "AUX", "ます"),
    ];
    assert.equal(entryIn(sentence("させていただきます", written), entry("させていただく", ITADAKU)), true);
  });

  it("原形が違う動詞には当たらない（いただく は くださる に当たらない）", () => {
    const written = [token("さ", "VERB", "する"), token("せ", "VERB", "せる"), token("て", "SCONJ", "て"), token("ください", "VERB", "くださる")];
    assert.equal(entryIn(sentence("させてください", written), entry("させていただく", ITADAKU)), false);
  });

  it("活用した形で書いた語は、その形だけ（could は can に当たらない）", () => {
    const could = [token("it", "PRON"), token("could", "AUX", "can"), token("be", "AUX", "be")];
    const can = [token("It", "PRON"), token("can", "AUX", "can"), token("be", "AUX", "be")];
    assert.equal(entryIn(sentence("It can be", can), entry("it could be", could)), false);
    assert.equal(
      entryIn(sentence("It could be", [token("It", "PRON"), token("could", "AUX", "can"), token("be", "AUX", "be")]), entry("it could be", could)),
      true,
    );
  });

  it("活用しない品詞は原形で広げない（best は good に当たらない）", () => {
    assert.equal(entryIn(sentence("good", [token("good", "ADJ", "good")]), entry("good", [token("good", "ADJ", "good")])), true);
    assert.equal(entryIn(sentence("the best", [token("the", "DET"), token("best", "ADJ", "good")]), entry("good", [token("good", "ADJ", "good")])), false);
  });

  it("原形で広げるのは、語彙表の語も文の語も活用する品詞のときだけ", () => {
    assert.equal(entryIn(sentence("notes", [token("notes", "NOUN", "note")]), entry("note", [token("note", "VERB", "note")])), false);
    assert.equal(entryIn(sentence("noted", [token("noted", "VERB", "note")]), entry("note", [token("note", "NOUN", "note")])), false);
    assert.equal(entryIn(sentence("noted", [token("noted", "VERB", "note")]), entry("note", [token("note", "VERB", "note")])), true);
  });

  it("語の途中には当たらない（また は またいで・たまたま に当たらない）", () => {
    const mata = entry("また", [token("また", "CCONJ", "また")]);
    assert.equal(entryIn(sentence("またいで", [token("またい", "VERB", "またぐ"), token("で", "SCONJ", "で")]), mata), false);
    assert.equal(entryIn(sentence("たまたま", [token("たまたま", "ADV", "たまたま")]), mata), false);
  });

  it("品詞が無ければ文字列で照らす。大文字と小文字は区別しない", () => {
    assert.equal(entryIn(sentence("It Could Be"), entry("it could be", [token("it", "PRON")])), true);
    assert.equal(entryIn(sentence("たまたま", [token("たまたま", "ADV", "たまたま")]), entry("また")), true);
    assert.equal(entryIn(sentence("別の文"), entry("また")), false);
  });

  it("語に分けられなかった語は文字列で照らす", () => {
    assert.equal(entryIn(sentence("また", [token("また", "CCONJ", "また")]), entry("また", [])), true);
    assert.equal(entryIn(sentence("別の文", [token("別", "NOUN")]), entry("また", [])), false);
  });

  it("文の最後で途切れた並びには当たらない", () => {
    assert.equal(entryIn(sentence("させて", ITADAKU.slice(0, 3)), entry("させていただく", ITADAKU)), false);
  });
});

describe("entryOpens: 文頭の語", () => {
  const mata = entry("また", [token("また", "CCONJ", "また")]);

  it("文頭の記号を飛ばして、最初の語から照らす", () => {
    assert.equal(entryOpens(sentence("「また", [token("「", "PUNCT"), token("また", "CCONJ", "また")]), mata), true);
  });

  it("文の途中の語は文頭ではない", () => {
    assert.equal(entryOpens(sentence("今日もまた", [token("今日", "NOUN"), token("も", "ADP"), token("また", "CCONJ", "また")]), mata), false);
  });

  it("記号しか無い文は何にも当たらない", () => {
    assert.equal(entryOpens(sentence("「」", [token("「", "PUNCT"), token("」", "PUNCT")]), mata), false);
  });

  it("品詞が無ければ文字列の前方一致", () => {
    assert.equal(entryOpens(sentence("  またいで"), entry("また")), true);
    assert.equal(entryOpens(sentence("今日もまた"), entry("また")), false);
    assert.equal(entryOpens(sentence("今日", [token("今日", "NOUN")]), entry("また", [])), false);
  });
});

const idsFor = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/report").findings.map((finding) => finding.rule);

describe("語彙表の rule が原形で照らす（解析器あり）", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("語彙表の語は文書を読むときに語に分けられる", () => {
    const lexicon = buildDocument("t.md", "文です。", ja).lexicons["sasete-itadaku"] ?? [];
    assert.ok(lexicon.every((each) => (each.tokens?.length ?? 0) > 0));
  });

  it("「させていただく」は、ました・たい・た の形でも数える", () => {
    const source = "報告させていただきました。確認させていただきたい。調整させていただいた。検討させていただきます。";
    assert.ok(idsFor(source, ja).includes("sasete-itadaku"));
  });

  it("二重敬語は、過去の形でも見つける", () => {
    assert.ok(idsFor("先方がご覧になられた。", ja).includes("double-keigo"));
    assert.ok(!idsFor("先方がご覧になった。", ja).includes("double-keigo"));
  });

  it("「また」で始まる段落は続けば数え、またいで で始まる段落は数えない", () => {
    const opened = ["また晴れた。", "また降った。", "また晴れた。", "また降った。", "また晴れた。"];
    assert.ok(idsFor(opened.join("\n\n"), ja).includes("repeated-conjunction"));
    const lookalike = ["またいで渡る。", "またいで戻る。", "またいで帰る。", "またいで渡る。", "またいで戻る。"];
    assert.ok(!idsFor(lookalike.join("\n\n"), ja).includes("repeated-conjunction"));
  });

  it("英語の語彙表も原形で照らす（it may be は it might be にも当たる）", () => {
    const lexicon = buildDocument("t.md", "A sentence.", en).lexicons["excessive-hedging"] ?? [];
    const may = lexicon.find((each) => each.pattern === "it may be");
    const doc = buildDocument("t.md", "It might be late.", en);
    assert.ok(may !== undefined && doc.sentences[0] !== undefined && entryIn(doc.sentences[0], may));
    const could = lexicon.find((each) => each.pattern === "it could be");
    const can = buildDocument("t.md", "It can be late.", en);
    assert.ok(could !== undefined && can.sentences[0] !== undefined && !entryIn(can.sentences[0], could));
  });
});
