import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// 大文字で書いて強調した普通の語（will NEVER call）は略語ではない。辞書が小文字の形を副詞としてしか知らない語は、名前にも略語にもならない。
// 名詞や形容詞としても引ける語（FAST、EAGLE、CHEESE）は、天文の観測装置のように略語の名前にもなるので数える。例文はすべて自作。

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
    ["Images were obtained by FAST in the survey.", ["FAST"]],
    ["We compare the run with EAGLE and the CHEESE instrument.", ["CHEESE", "EAGLE"]],
    ["NASA and the GDPR office agreed.", ["GDPR", "NASA"]],
    ["After a handful of LEGAL issues, the count is flat.", ["LEGAL"]],
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
    ["It flies on the GOES and Himawari satellites.", ["GOES"]],
    ["Send the report to the GSA office, US-CERT, and the board.", ["GSA", "US-CERT"]],
    ["The states are: LISTEN, CLOSED.", ["CLOSED", "LISTEN"]],
    ["The loan follows FAR 12.212 for this.", ["FAR"]],
    ["It resumes at SOME/2 later.", ["SOME"]],
    ["The AS number and the AID program are new.", ["AID", "AS"]],
    // 形容詞は、強調（the WHOLE month）と名前（the SAFE framework）を意味でしか見分けられないので数える。
    ["Stay for the WHOLE month under the SAFE framework.", ["SAFE", "WHOLE"]],
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
    ["Images were obtained by FAST in the survey.", "FAST"],
    ["Never call us.", "Never"],
    ["It will never end.", "never"],
    ["The N team met.", "N"],
    ["NASA agreed.", "NASA"],
    ["The IT team met.", "IT"],
    ["AT.", "AT"],
    ["Send it to US-CERT now.", "US"],
  ].forEach(([text, surface]) => {
    it(`印を付けない: ${String(surface)} in ${String(text)}`, () => assert.equal(tokenOf(String(text), String(surface))?.features?.["Emph"], undefined));
  });
});
