import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { isCapitalisedOrdinaryWord } from "../packages/lang-en/src/emphasis.ts";

// 大文字で書いて強調した普通の語（will NEVER call）は略語ではない。辞書が小文字の形を副詞としてしか知らない語は、名前にも略語にもならない。
// 4 文字以上で、解析器の語彙が普通の語として知る語（START、SAFE、CHEESE）も数えない。略語の名前でもある語（FAST の望遠鏡）は
// 意味でしか見分けられず、精度を先に取って諦める。語彙に無い語や固有名詞としてだけ知る語（NASA、GDPR）は数える。例文はすべて自作。

await en.prepare?.({ pos: true });

const acronymsIn = (body: string): string[] => reportedAcronyms(en, `# Notice\n\n${body}\n`).toSorted((left, right) => left.localeCompare(right, "en"));

const tokenOf = (text: string, surface: string): Token | undefined =>
  en
    .segment(text)
    .sentences.flatMap((sentence) => sentence.tokens ?? [])
    .find((token) => token.surface === surface);

describe("undefined-acronym: 大文字で強調した副詞", () => {
  [
    ["the office will NEVER call you about a prize. The SRE joins.", ["SRE"]],
    ["You must ALWAYS check the seal first. The SRE joins.", ["SRE"]],
    ["We ALSO keep a copy on file. The SRE joins.", ["SRE"]],
    ["Do NOT share the code, and NEVER share it by phone. The SRE joins.", ["SRE"]],
    ["Look for the NEW formula on the shelf. The SRE joins.", ["SRE"]],
    ["The SRE will NEVER call you.", ["SRE"]],
  ].forEach(([body, expected]) => {
    it(`数えない: ${String(body)}`, () => assert.deepEqual(acronymsIn(String(body)), expected));
  });

  [
    ["Images were obtained by NVD in the survey.", ["NVD"]],
    ["We compare the run with KGI and the PMF instrument.", ["KGI", "PMF"]],
    ["NASA and the GDPR office agreed.", ["GDPR", "NASA"]],
    ["Open a SEP account before the deadline.", ["SEP"]],
    ["The NEVERS project and the NVR team met.", ["NEVERS", "NVR"]],
  ].forEach(([body, expected]) => {
    it(`数える: ${String(body)}`, () => assert.deepEqual(acronymsIn(String(body)), expected));
  });
});

describe("undefined-acronym: 文の中で前置詞・接続詞・数詞・代名詞・動詞として読める大文字の語", () => {
  [
    ["The state AFTER the departure is shown. The SRE joins.", ["SRE"]],
    ["The plane flies AROUND the storm. The SRE joins.", ["SRE"]],
    ["In March a hurricane DID form there. The SRE joins.", ["SRE"]],
    ["This is not a virtual NOR a remote position. The SRE joins.", ["SRE"]],
    ["You would see a direct hit in ONE of those visits. The SRE joins.", ["SRE"]],
    ["You must complete ALL required steps. The SRE joins.", ["SRE"]],
    ["The paper has NO calculus and NO equations. The SRE joins.", ["SRE"]],
    ["Version 26 is OUT now. The SRE joins.", ["SRE"]],
  ].forEach(([body, expected]) => {
    it(`数えない: ${String(body)}`, () => assert.deepEqual(acronymsIn(String(body)), expected));
  });

  [
    // 冠詞や所有格の後ろは名前の位置。動詞は主語の直後でなければ名前。
    ["It flies on the GSMX and Himawari satellites.", ["GSMX"]],
    ["Send the report to the GSA office, US-CERT, and the board.", ["GSA", "US-CERT"]],
    ["The states are: LSTN, CLSD.", ["CLSD", "LSTN"]],
    ["The loan follows FAR 12.212 for this.", ["FAR"]],
    ["It resumes at SOM/2 later.", ["SOM"]],
    ["The AS number and the AID program are new.", ["AID", "AS"]],
    // 前後が小文字の語でなければ、文の中で読めない。動詞の後ろの名詞が動詞として引けなければ、大文字の語の名前。
    ["ON Semiconductor parts are available.", ["ON"]],
    ["The user DID token expired.", ["DID"]],
    ["The team uses OR's model.", ["OR"]],
    // 3 文字までの語は略語であることが多い（PIE、GUT）ので、文の中で読めなければ数える。
    ["Build it as a PIE binary under the GUT model.", ["GUT", "PIE"]],
  ].forEach(([body, expected]) => {
    it(`数える: ${String(body)}`, () => assert.deepEqual(acronymsIn(String(body)), expected));
  });
});

describe("lang-en: 大文字で書いた、副詞としてしか引けない語", () => {
  it("AFTER は解析器の読み（前置詞）のまま、強調の印を付ける", () => {
    const token = tokenOf("The state AFTER the departure is shown.", "AFTER");
    assert.equal(token?.pos, "ADP");
    assert.equal(token?.features?.["Emph"], "Yes");
  });

  it("NEVER は副詞として読み、強調の印を付ける", () => {
    const token = tokenOf("the office will NEVER call you.", "NEVER");
    assert.equal(token?.pos, "ADV");
    assert.equal(token?.lemma, "never");
    assert.equal(token?.features?.["Emph"], "Yes");
  });

  [
    ["Images were obtained by NVD in the survey.", "NVD"],
    ["Never call us.", "Never"],
    ["It will never end.", "never"],
    ["The N team met.", "N"],
    ["NASA agreed.", "NASA"],
    ["The IT team met.", "IT"],
    ["AT.", "AT"],
    ["Send it to US-CERT now.", "US"],
    ["Contact the team via IT.", "IT"],
    ["Contact IT's office today.", "IT"],
    ["OR tools are installed.", "OR"],
  ].forEach(([text, surface]) => {
    it(`印を付けない: ${String(surface)} in ${String(text)}`, () => assert.equal(tokenOf(String(text), String(surface))?.features?.["Emph"], undefined));
  });
});

describe("undefined-acronym: 語彙が普通の語として知る、4 文字以上の大文字の語", () => {
  [
    ["The block is inferred to START/2 and ends at the RETURN node. The SRE joins.", ["SRE"]],
    ["The access can be a READ or WRITE, SHALLOW or DEEP. The SRE joins.", ["SRE"]],
    ['Tag the item "TODO" and later "DONE". The SRE joins.', ["SRE"]],
    ["We follow the SAFE framework for the WHOLE month. The SRE joins.", ["SRE"]],
    ["THANK you all. The SRE joins.", ["SRE"]],
  ].forEach(([body, expected]) => {
    it(`数えない: ${String(body)}`, () => assert.deepEqual(acronymsIn(String(body)), expected));
  });

  [
    // 語彙に無い語と、3 文字までの語と、- で繋いだ語の部品は数える。
    ["The KGI and NVD feeds are read by the PMF.", ["KGI", "NVD", "PMF"]],
    ["The NONEX block and the RTRN node.", ["NONEX", "RTRN"]],
    ["The connection waits in LAST-ACK.", ["LAST-ACK"]],
    ["The PIE build runs.", ["PIE"]],
  ].forEach(([body, expected]) => {
    it(`数える: ${String(body)}`, () => assert.deepEqual(acronymsIn(String(body)), expected));
  });
});

describe("lang-en: isCapitalisedOrdinaryWord", () => {
  const tags: Record<string, readonly string[]> = {
    start: ["VB", "NN"],
    none: ["NN"],
    nasa: ["NNP"],
    pie: ["NN"],
    safe: ["JJ", "NN"],
    who: ["WP"],
    paris: ["NNP", "NN"],
  };
  const tagsOf = (word: string): readonly string[] | undefined => tags[word];
  [
    ["START", true],
    ["NONE", true],
    ["SAFE", true],
    ["NASA", false],
    ["PIE", false],
    ["WHO", false],
    ["PARIS", false],
    ["Start", false],
    ["HTTP", false],
    ["", false],
  ].forEach(([surface, expected]) => {
    it(`${String(surface) || "(空)"} → ${String(expected)}`, () => assert.equal(isCapitalisedOrdinaryWord(String(surface), tagsOf), expected));
  });
});
