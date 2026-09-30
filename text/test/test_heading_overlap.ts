import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { echoedHeadingUnits, trigrams } from "../packages/chaff/src/detectors/heading-overlap.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// heading-echo measures what the first sentence adds as its length minus the part of the heading it repeats. A
// sentence that repeats only part of the heading keeps the rest as its own material.

describe("echoedHeadingUnits in words", () => {
  const cases: readonly (readonly [string, string, number])[] = [
    ["How Do Astronauts Go on Spacewalks?", "When astronauts go on spacewalks, they wear spacesuits to keep themselves safe.", 4],
    ["Why Do Astronauts Go on Spacewalks?", "Astronauts go on spacewalks for many reasons.", 4],
    ["Associate Instructional Designer Job Level", "The Associate Instructional Designer is outlined in the Job Levels resource.", 5],
    ["Problem case #1: references assigned into a variable", "One common problem case is when a reference is assigned into a variable.", 7],
    ["Diversity, Inclusion & Belonging", "Diversity, inclusion and belonging are fundamental.", 3],
    ["Go on", "Going on one.", 1],
    ["Data centre", "Not a server room.", 0],
  ];
  cases.forEach(([heading, sentence, echoed]) => {
    it(`${JSON.stringify(heading)} in ${JSON.stringify(sentence)}: ${String(echoed)}`, () =>
      assert.equal(echoedHeadingUnits(heading, sentence, "word"), echoed));
  });

  it("a word of punctuation alone is never repeated", () => {
    assert.equal(echoedHeadingUnits("🌐 & —", "🌐 & — and more", "word"), 0);
  });

  it("empty or blank input repeats nothing", () => {
    assert.equal(echoedHeadingUnits("", "Anything at all.", "word"), 0);
    assert.equal(echoedHeadingUnits("Heading", "", "word"), 0);
    assert.equal(echoedHeadingUnits("   ", "   ", "word"), 0);
  });
});

describe("echoedHeadingUnits in characters", () => {
  it("counts the heading's characters that a shared trigram covers", () => {
    assert.equal(echoedHeadingUnits("キャッシュの仕組み", "キャッシュの仕組みについて説明します。", "char"), 9);
    assert.equal(echoedHeadingUnits("第12条　けん責、減給又は出勤停止", "次の場合は、けん責、減給又は出勤停止とする。", "char"), 12);
    assert.equal(echoedHeadingUnits("【報道機関等からのお問い合わせ先】", "報道機関等からのお問い合わせは以下へ。", "char"), 14);
  });

  it("folds case and ignores spaces, as the trigrams do", () => {
    assert.equal(echoedHeadingUnits("Cache Design", "the cachedesign", "char"), 11);
  });

  it("a heading shorter than a trigram, or nothing shared, repeats nothing", () => {
    assert.equal(echoedHeadingUnits("税", "税金について", "char"), 0);
    assert.equal(echoedHeadingUnits("休日", "休日です。", "char"), 0);
    assert.equal(echoedHeadingUnits("給与の支払", "TTL が切れるまで待つ。", "char"), 0);
    assert.equal(echoedHeadingUnits("", "何か", "char"), 0);
    assert.equal(echoedHeadingUnits("見出し", "", "char"), 0);
  });
});

/** A small generator of headings and sentences over a few shared words, so that overlaps of every size come up. */
const WORDS = ["Level", "levels", "go", "going", "on", "one", "キャッシュ", "の", "仕組み", "&", "—", "data", "centre", "a", "reference"];
const pick = (seed: number, count: number): string =>
  Array.from({ length: count }, (__unused, index) => WORDS[(seed * 7 + index * 13) % WORDS.length] ?? "").join(seed % 2 === 0 ? " " : "");

const headingLength = (heading: string, unit: "word" | "char"): number =>
  unit === "word" ? heading.split(/\s+/u).filter((word) => word.length > 0).length : heading.replace(/\s+/gu, "").length;

describe("echoedHeadingUnits never exceeds the heading", () => {
  // heading-echo used to subtract the whole heading; subtracting only what is repeated may only report less.
  const seeds = Array.from({ length: 400 }, (__unused, index) => index);
  (["word", "char"] as const).forEach((unit) => {
    it(`${unit}: 0 <= echoed <= the heading's own length, over generated pairs`, () => {
      seeds.forEach((seed) => {
        const heading = pick(seed, 1 + (seed % 5));
        const sentence = pick(seed + 3, 1 + (seed % 9));
        const echoed = echoedHeadingUnits(heading, sentence, unit);
        assert.ok(echoed >= 0 && echoed <= headingLength(heading, unit), `seed ${String(seed)}: ${heading} / ${sentence} → ${String(echoed)}`);
      });
    });
  });

  it("a heading the sentence holds whole is repeated whole", () => {
    seeds.forEach((seed) => {
      const heading = pick(seed, 1 + (seed % 5));
      if (trigrams(heading).size === 0) return;
      assert.equal(echoedHeadingUnits(heading, `${heading} and more`, "char"), headingLength(heading, "char"), `seed ${String(seed)}`);
    });
  });
});

const echoes = (source: string, adapter: LanguageAdapter): number => {
  const doc = buildDocument("a.md", source, adapter);
  return runRules(doc, loadRules(adapter.id), {}, false, "technical/readme").findings.filter((finding) => finding.rule === "heading-echo").length;
};

describe("heading-echo and a sentence that repeats only part of its heading", () => {
  it("valid: the sentence goes on to say something of its own (NASA Knows, Grades K-4)", () => {
    assert.equal(echoes("## How Do Astronauts Go on Spacewalks?\n\nWhen astronauts go on spacewalks, they wear spacesuits to keep themselves safe.\n", en), 0);
    assert.equal(echoes("## How Do Astronauts Train for Spacewalks?\n\nOne way astronauts train for spacewalks is by going for a swim.\n", en), 0);
    assert.equal(echoes("## 第12条　けん責、減給又は出勤停止\n\n従業員が次の各号の一に該当する場合は、けん責、減給又は出勤停止とする。\n", ja), 0);
  });

  it("invalid: the sentence only restates the heading", () => {
    assert.equal(echoes("## Why Do Astronauts Go on Spacewalks?\n\nAstronauts go on spacewalks for many reasons.\n", en), 1);
    assert.equal(echoes("## Job Level\n\nThe job levels are outlined.\n", en), 1);
    assert.equal(echoes("## キャッシュの仕組み\n\nキャッシュの仕組みについて説明します。\n", ja), 1);
    assert.equal(echoes("## 第12条　けん責、減給又は出勤停止\n\n次の場合は、けん責、減給又は出勤停止とする。\n", ja), 1);
  });
});
