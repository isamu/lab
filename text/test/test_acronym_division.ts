import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notAcronymSpansOf, type NotationWords } from "../packages/chaff/src/detectors/acronym-context.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 区切りの名前のすぐ後ろのローマ数字（Part II、Section VIII）は番号で、略語ではない。例文はすべて自作。

const listOf = (adapter: LanguageAdapter, id: string): string[] => (adapter.lexicons[id] ?? []).map((entry) => entry.pattern);

const NONE: NotationWords = { meridiem: [], timeZones: [], currencies: [], usStates: [], emphasis: [], divisions: [], honorifics: [], dateTimeUnits: [] };
const spans = notAcronymSpansOf({ ...NONE, divisions: listOf(en, "numbered-division") });

/** 範囲にまるごと覆われた、大文字だけの語。 */
const covered = (text: string): string[] =>
  [...text.matchAll(/(?<![A-Za-z])[A-Z]+(?![A-Za-z])/gu)]
    .filter((match) => spans(text).some((span) => span.start <= match.index && match.index + match[0].length <= span.end))
    .map((match) => match[0]);

const DIGITS: readonly (readonly [number, string])[] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** 検査の側で作る、正しい書き方のローマ数字。 */
const romanOf = (value: number): string =>
  DIGITS.reduce<{ readonly rest: number; readonly parts: readonly string[] }>(
    ({ rest, parts }, [unit, letters]) => ({ rest: rest % unit, parts: [...parts, letters.repeat(Math.floor(rest / unit))] }),
    { rest: value, parts: [] },
  ).parts.join("");

const LARGEST = 4999;

describe("区切りの名前の後ろのローマ数字", () => {
  it("valid: I から MMMMCMXCIX まで、どの数も番号として覆う", () => {
    const missed = Array.from({ length: LARGEST }, (_, index) => romanOf(index + 1)).filter((numeral) => covered(`see Section ${numeral} below`).length === 0);
    assert.deepEqual(missed, []);
  });

  it("valid: 語彙表のどの語でも、字面どおりでも全部大文字でも", () => {
    listOf(en, "numbered-division")
      .flatMap((word) => [word, word.toUpperCase()])
      .forEach((word) => assert.deepEqual(covered(`under ${word} VIII of the plan`).at(-1), "VIII", word));
  });

  it("valid: 全部大文字の名前は、名前ごと覆う（PART II の PART も略語ではない）", () => {
    assert.deepEqual(covered("PART II GENERAL"), ["PART", "II"]);
  });

  it("valid: 番号のあとの句読点・ハイフン・括弧", () => {
    ["Section VI.", "Chapter VII,", "Part III:", "Title IX)", "Exhibit III-1", "Part\u00a0II"].forEach((text) =>
      assert.equal(covered(text).length > 0, true, text),
    );
  });

  [
    ["崩れた書き方（IIII、VX、IC、XD、LLVM、MMMMM）", "Section IIII, Section VX, Part IC, Part XD, Part LLVM, Volume MMMMM"],
    ["番号の後ろに英字・数字・&が続く", "Section IIa, Part IIIB, Section CIA, Part II2, Part CD&R"],
    ["区切りの名前が語の一部", "COUNTERPART II, SUBSECTION IV, PARTS II"],
    ["小文字の名前（本文の part）", "the part II of it, section VI"],
    ["名前と番号の間に別の語", "Section on CI, Part of CD"],
    ["名前が無い", "CI, CD, DC, CV, MD, MIX, DIV, CLI, LV, DX, IV, MM, XL"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual(covered(String(text)), []));
  });

  it("異常な入力: 空文字、名前だけ、空の語彙表", () => {
    assert.deepEqual(spans(""), []);
    assert.deepEqual(spans("Section "), []);
    assert.deepEqual(notAcronymSpansOf(NONE)("Part II"), []);
  });
});

const reported = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "undefined-acronym": "strict" }, true, "business/report")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

const without = (adapter: LanguageAdapter, word: string): LanguageAdapter => ({
  ...adapter,
  lexicons: { ...adapter.lexicons, "numbered-division": (adapter.lexicons["numbered-division"] ?? []).filter((entry) => entry.pattern !== word) },
});

/** ローマ数字として読める略語は、番号の位置でなければ数える。通じる略語（CLI など）は、もとから数えない。 */
const COLLISIONS = ["CD", "CI", "DC", "CV", "MD", "MIX", "DIV", "CLI", "LV", "DX", "IV", "MM"];

const DOCS: Readonly<Record<string, (phrase: string) => string>> = {
  en: (phrase) => `# Notes\n\nThe grant is covered in ${phrase} today. The SRE joins.\n`,
  ja: (phrase) => `# 手引き\n\n助成は ${phrase} で扱います。SREも見ます。\n`,
};

[en, ja].forEach((adapter) => {
  const doc = DOCS[adapter.id] ?? ((phrase: string) => phrase);
  describe(`undefined-acronym と区切りの番号（${adapter.id}）`, () => {
    it("valid: 番号のローマ数字は数えず、SRE は数える", () => {
      ["Part II", "Section VIII", "Title IV", "Chapter XI", "Appendix III", "PART II"].forEach((phrase) =>
        assert.deepEqual(reported(adapter, doc(phrase)), ["SRE"], phrase),
      );
    });

    it("invalid: ローマ数字として読める略語も、番号の位置でなければ数える", () => {
      const common = new Set(listOf(adapter, "common-acronym"));
      COLLISIONS.filter((word) => !common.has(word)).forEach((word) => assert.deepEqual(reported(adapter, doc(`the ${word} report`)), [word, "SRE"], word));
    });

    it("invalid: 語彙表から抜いた名前の後ろでは数える", () => {
      assert.deepEqual(reported(without(adapter, "Part"), doc("PART VIII")), ["PART", "VIII", "SRE"]);
    });
  });
});
