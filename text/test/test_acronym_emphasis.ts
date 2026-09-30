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

describe("lang-en: 大文字で書いた、副詞としてしか引けない語", () => {
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
  ].forEach(([text, surface]) => {
    it(`印を付けない: ${String(surface)} in ${String(text)}`, () => assert.equal(tokenOf(String(text), String(surface))?.features?.["Emph"], undefined));
  });
});
