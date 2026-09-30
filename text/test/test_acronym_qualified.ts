import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { expansionAt, type DefinitionWords } from "../packages/chaff/src/detectors/acronym-expansion.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 括弧の中が略語と、それに添えた大文字で始まる語（Partnership On Wide Energy and Resources Resilience Asia (POWERR Asia)）。
// 添えた語が名前の終わりにもあれば、それを除いた名前の頭文字が略語と揃うとき、展開と見なす。例文はすべて自作。

const NO_WORDS: DefinitionWords = { markers: [], verbs: [] };

const explained = (text: string, acronym: string): boolean => expansionAt(NO_WORDS)(text, acronym, text.indexOf(acronym));

/** [何の形か, 例文, 見る略語]。 */
type Case = readonly [string, string, string];

const EXPLAINED: readonly Case[] = [
  ["添えた語が名前の終わりにもある", "It launched the Partnership On Wide Energy and Resources Resilience Asia (POWERR Asia) to help.", "POWERR"],
  ["添えた語が名前に無い", "It joined the Zero Emission Community (ZEC Initiative) last year.", "ZEC"],
  ["添えた語が 2 語", "The Clean Water Fund Pacific Islands (CWF Pacific Islands) opened.", "CWF"],
  ["引用符に包む", "The Clean Water Fund (“CWF Asia”) opened.", "CWF"],
];

const REPORTED: readonly Case[] = [
  ["名前の頭文字が揃わない", "The Goddard Space Flight Center (NASA Goddard) hosted it.", "NASA"],
  ["添えた語が小文字", "The Clean Water Fund (CWF data) opened.", "CWF"],
  ["添えた語の後ろに数字", "The regulation on data (GDPR Article 5) applies.", "GDPR"],
  ["括弧が閉じない", "The Clean Water Fund (CWF Asia and more", "CWF"],
  ["括弧が開いていない", "The Clean Water Fund CWF Asia) opened.", "CWF"],
  ["添えた語が括弧の前の名前の終わりにあるだけで、頭文字が揃わない", "The Water Asia (CWF Asia) opened.", "CWF"],
];

describe("括弧の中の略語に語を添えた形", () => {
  EXPLAINED.forEach(([form, text, acronym]) => {
    it(`valid: ${form}`, () => assert.ok(explained(text, acronym), text));
  });

  REPORTED.forEach(([form, text, acronym]) => {
    it(`invalid: ${form}`, () => assert.equal(explained(text, acronym), false, text));
  });

  it("本文の端でも落ちない", () => {
    assert.equal(explained("(CWF Asia", "CWF"), false);
    assert.equal(explained("(CWF Asia)", "CWF"), false);
  });
});

describe("undefined-acronym: 語を添えた括弧", () => {
  it("POWERR は展開済み、NASA は数える", () => {
    const body =
      "It launched the Partnership On Wide Energy and Resources Resilience Asia (POWERR Asia). Later, POWERR grew. The Goddard Space Flight Center (NASA Goddard) hosted it.";
    assert.deepEqual(reportedAcronyms(en, `# Energy\n\n${body}\n`), ["NASA"]);
  });
});
