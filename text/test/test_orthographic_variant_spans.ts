import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { acronymExpansionSpans } from "../packages/chaff/src/acronym-expansion.ts";
import { titleCaseNameRuns } from "../packages/chaff/src/title-case-name.ts";
import { withoutQuotedSpellings, type Quoted } from "../packages/chaff/src/quoted-spelling.ts";
import { lawTitleSpans } from "../packages/chaff/src/law-title.ts";
import { quoteGlossSpans } from "../packages/chaff/src/quote-gloss.ts";
import { nameEndingRuns, namesWrittenOneWay } from "../packages/chaff/src/name-ending-run.ts";
import { isNameInCapitals } from "../packages/chaff/src/capitals-with-small.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// The spans orthographic-variant leaves out: an acronym's expansion, a capitalised name, a statute's title, a quotation's gloss,
// a facility's name and a roster's surname in capitals. Self-written text, and statute titles from Japanese law.

const textsOf = (text: string, spans: readonly { start: number; end: number }[]): string[] => spans.map(({ start, end }) => text.slice(start, end));

describe("acronymExpansionSpans", () => {
  it("the expansion before an acronym in brackets", () => {
    const text = "Ask for Communication Access Realtime Translation (CART) or an American Sign Language (ASL) interpreter.";
    assert.deepEqual(textsOf(text, acronymExpansionSpans(text)), ["Communication Access Realtime Translation", "American Sign Language"]);
  });

  it("the expansion in brackets after an acronym, in any order of its letters (axle)", () => {
    const vader = "We used VADER (Valence Aware Dictionary and sEntiment Reasoner) here.";
    assert.deepEqual(textsOf(vader, acronymExpansionSpans(vader)), ["Valence Aware Dictionary and sEntiment Reasoner"]);
    const axle = "a stage, axle (Axis-guided eXperience ELicitation).";
    assert.deepEqual(textsOf(axle, acronymExpansionSpans(axle)), ["Axis-guided eXperience ELicitation"]);
  });

  it("no expansion: brackets that spell nothing, an empty or unclosed bracket, no text", () => {
    assert.deepEqual(acronymExpansionSpans("Module Three (Processor to Sub-Processor) applies."), []);
    assert.deepEqual(acronymExpansionSpans("the plan (CART) was late"), []);
    assert.deepEqual(acronymExpansionSpans("an empty () bracket and (an unclosed one"), []);
    assert.deepEqual(acronymExpansionSpans("(ASL)"), []);
    assert.deepEqual(acronymExpansionSpans(""), []);
  });
});

describe("titleCaseNameRuns", () => {
  const joiners = ["of", "and", "for", "in"];
  const runsOf = (text: string): { name: string; quoted: string | undefined }[] =>
    titleCaseNameRuns(text, joiners).map(({ name, quoted }) => ({
      name: text.slice(name.start, name.end),
      quoted: quoted === undefined ? undefined : text.slice(quoted.start, quoted.end),
    }));

  it("runs of two capitalised words or more, across the small words", () => {
    assert.deepEqual(runsOf("the Interagency Group shall report to the Twenty-Nine Palms Band of Mission Indians."), [
      { name: "Interagency Group", quoted: "Interagency Group" },
      { name: "Twenty-Nine Palms Band of Mission Indians", quoted: "Twenty-Nine Palms Band of Mission Indians" },
    ]);
  });

  it("the first word of the sentence is not quoted, and a name does not end on a small word", () => {
    assert.deepEqual(runsOf("Real-Time Data Pipelines"), [{ name: "Real-Time Data Pipelines", quoted: "Data Pipelines" }]);
    assert.deepEqual(runsOf("Co-working Space - Monthly"), [{ name: "Co-working Space", quoted: undefined }]);
    assert.deepEqual(runsOf("ask the Office of the clerk"), []);
  });

  it("no name: one capitalised word, lower-case text, no text", () => {
    assert.deepEqual(runsOf("we met the Interagency team"), []);
    assert.deepEqual(runsOf("all in lower case"), []);
    assert.deepEqual(runsOf(""), []);
  });
});

describe("withoutQuotedSpellings", () => {
  type Word = { key: string; spelling: string; quoted: Quoted | undefined; name: string | undefined };
  const word = (spelling: string, quoted?: Quoted, name?: string): Word => ({ key: "k", spelling, quoted, name });
  const DICTIONARY = new Set(["factors"]);
  const isWord = (spelling: string): boolean => DICTIONARY.has(spelling);

  it("drops quoted words where the spellings differ only in hyphens", () => {
    const words = [word("inter-agency"), word("interagency", "name", "Interagency Group"), word("interagency", "cited")];
    assert.deepEqual(withoutQuotedSpellings(words, isWord), [word("inter-agency")]);
  });

  it("keeps the words of a name the document writes two ways (Co-working Space, Coworking Space)", () => {
    const words = [word("co-working"), word("coworking", "name", "Coworking Space"), word("co-working", "name", "Co-working Space")];
    assert.deepEqual(withoutQuotedSpellings(words, isWord), words);
  });

  it("drops a cited ordinary word in small letters (factors beside FACTors), not a name", () => {
    assert.deepEqual(withoutQuotedSpellings([word("fACTors"), word("factors", "cited")], isWord), [word("fACTors")]);
    const named = [word("fACTors"), word("factors", "name", "Factors Group")];
    assert.deepEqual(withoutQuotedSpellings(named, isWord), named);
  });

  it("keeps a capital the citing lost (arxiv beside arXiv), a name differing by capitals, and words not quoted", () => {
    const lost = [word("arXiv"), word("arxiv", "cited")];
    assert.deepEqual(withoutQuotedSpellings(lost, isWord), lost);
    const capitals = [word("gitHub"), word("github", "name", "Github Actions")];
    assert.deepEqual(withoutQuotedSpellings(capitals, isWord), capitals);
    const plain = [word("inter-agency"), word("interagency")];
    assert.deepEqual(withoutQuotedSpellings(plain, isWord), plain);
    assert.deepEqual(withoutQuotedSpellings([], isWord), []);
  });
});

describe("lawTitleSpans", () => {
  const numbers = [/[（(](?:昭和|平成|令和)[元0-9０-９]+年法律第[0-9０-９]+号[）)]/u];

  it("the title before a statute's number, with a short name in brackets between", () => {
    const text = "愛がん動物用飼料の安全性の確保に関する法律（ペットフード安全法）（平成20年法律第83号）の内容を周知した。";
    assert.deepEqual(textsOf(text, lawTitleSpans(text, numbers)), ["愛がん動物用飼料の安全性の確保に関する法律（ペットフード安全法）（平成20年法律第83号）"]);
  });

  it("the title starts after a comma or a quotation mark", () => {
    const text = "また、愛玩動物看護師法（令和元年法律第50号）に基づき試験を実施した。";
    assert.deepEqual(textsOf(text, lawTitleSpans(text, numbers)), ["愛玩動物看護師法（令和元年法律第50号）"]);
  });

  it("nothing without a number, or with the number alone after a boundary", () => {
    assert.deepEqual(lawTitleSpans("愛がん動物の法律を守る。", numbers), []);
    assert.deepEqual(lawTitleSpans("、（平成20年法律第83号）", numbers), []);
    assert.deepEqual(lawTitleSpans("", numbers), []);
    assert.deepEqual(lawTitleSpans("法律）（平成20年法律第83号）", numbers), []);
  });
});

describe("quoteGlossSpans", () => {
  it("a bracket right after a closing quotation mark", () => {
    const text = "いわゆる「天子有道」（天子に道有らば）です。";
    assert.deepEqual(textsOf(text, quoteGlossSpans(text)), ["（天子に道有らば）"]);
  });

  it("not a bracket after other text, a space or an unclosed bracket", () => {
    assert.deepEqual(quoteGlossSpans("道有らば（天子に道有らば）"), []);
    assert.deepEqual(quoteGlossSpans("「天子有道」 （天子に道有らば）"), []);
    assert.deepEqual(quoteGlossSpans("「天子有道」（天子に"), []);
    assert.deepEqual(quoteGlossSpans(""), []);
  });
});

describe("nameEndingRuns", () => {
  const tokenOf = (surface: string, start: number, pos = "NOUN"): Token => ({ surface, pos, span: { start, end: start + surface.length } });
  const spansOf = (tokens: readonly Token[]): { start: number; end: number }[] => nameEndingRuns(tokens, ["園"]).map(({ start, end }) => ({ start, end }));

  it("a run of nouns that ends on a closing word", () => {
    const runs = nameEndingRuns([tokenOf("こども", 0), tokenOf("動物園", 3), tokenOf("は", 6, "ADP")], ["園"]);
    assert.deepEqual(runs, [{ start: 0, end: 6, written: "こども動物園", reading: "こども動物園" }]);
  });

  it("not a run broken by a particle or a space, nor nouns that end otherwise, nor nothing", () => {
    assert.deepEqual(spansOf([tokenOf("こども", 0), tokenOf("の", 3, "ADP"), tokenOf("園", 4)]), []);
    assert.deepEqual(spansOf([tokenOf("こども", 0), tokenOf("動物園", 4)]), [{ start: 4, end: 7 }]);
    assert.deepEqual(spansOf([tokenOf("子ども", 0), tokenOf("食堂", 3)]), []);
    assert.deepEqual(spansOf([]), []);
  });
});

describe("namesWrittenOneWay", () => {
  const name = (written: string, reading: string): { start: number; end: number; written: string; reading: string } => ({ start: 0, end: 1, written, reading });

  it("keeps a name written one way, and leaves out a reading written two ways", () => {
    const names = [name("こども動物園", "コドモドウブツエン"), name("こども家庭庁", "コドモカテイチョウ"), name("子ども家庭庁", "コドモカテイチョウ")];
    assert.deepEqual([...namesWrittenOneWay(names)], ["こども動物園"]);
    assert.deepEqual([...namesWrittenOneWay([])], []);
  });
});

describe("isNameInCapitals", () => {
  it("a surname in capitals after its prefix, after a given name in capitals", () => {
    const text = "MICHAEL T. McCAUL, Texas";
    assert.equal(isNameInCapitals(text, text.indexOf("McCAUL"), "McCAUL"), true);
    const chair = "SCOTT DesJARLAIS, Tennessee, Chairman";
    assert.equal(isNameInCapitals(chair, chair.indexOf("DesJARLAIS"), "DesJARLAIS"), true);
  });

  it("not after a title or a name in small letters, not another shape, not at the start", () => {
    const title = "Mr. McCAUL spoke.";
    assert.equal(isNameInCapitals(title, title.indexOf("McCAUL"), "McCAUL"), false);
    assert.equal(isNameInCapitals("McCAUL", 0, "McCAUL"), false);
    assert.equal(isNameInCapitals("MICHAEL McCaul", 8, "McCaul"), false);
  });
});
