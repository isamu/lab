import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { editsOf, isKnownWord, isSplitWord, suggestionFor, wordsToCheck, type Speller } from "../packages/chaff/src/spelling.ts";
import { unknownWord } from "../packages/chaff/src/detectors/unknown-word.ts";
import { buildDocument, type TeamRules } from "../packages/chaff/src/document.ts";

// 辞書に無い語（unknown-word）。例文はすべて自作。

const unknown = (source: string): readonly string[] => namedRuleRun("unknown-word", `${source}\n`, en).findings;

describe("unknown-word: a word not in the dictionary, one letter from one that is", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("reports a typo with the nearest dictionary word", () => {
    assert.deepEqual(unknown("The report is attched to this email."), ['"attched" is not in the dictionary; did you mean "attached"?']);
    assert.deepEqual(unknown("The thresholds were recalibrated and the pipline restarted."), ['"pipline" is not in the dictionary; did you mean "pipeline"?']);
  });

  it("inflected, prefixed and listed words are known", () => {
    assert.deepEqual(unknown("We refactored the backend, reuploaded the datasets and stopped the unshipped orders whilst testing."), []);
  });

  it("the rest of a word split by emphasis or a bracketed letter is not a word", () => {
    assert.deepEqual(unknown("Your avatar is a **G**lobally **R**ecognized image."), []);
    assert.deepEqual(unknown('The court said that "[e]xpressions in the opinion" were dicta.'), []);
    assert.deepEqual(unknown("The **report** is attched to this email."), ['"attched" is not in the dictionary; did you mean "attached"?']);
    assert.deepEqual(unknown("See [the notes] attched below."), ['"attched" is not in the dictionary; did you mean "attached"?']);
  });

  it("a Greek plural and common web words are known", () => {
    assert.deepEqual(unknown("Coal workers' pneumoconioses rose. Embed the page in an iframe, read the ebook, and ask whomever you like."), []);
    assert.deepEqual(unknown("Both hypothses failed."), ['"hypothses" is not in the dictionary; did you mean "hypotheses"?']);
  });

  it("words of everyday AI evaluation are known (#621)", () => {
    assert.deepEqual(unknown("Read the guide on running evals over a model's outputs."), []);
  });

  it("names, code, URLs, words used twice, and words with no near dictionary word are not reported", () => {
    assert.deepEqual(unknown("Ask Attched Ltd. about it."), []);
    assert.deepEqual(unknown("Run `attched` now, or open https://example.com/attched today."), []);
    assert.deepEqual(unknown("The attched step and the attched list."), []);
    assert.deepEqual(unknown("The xqzvwk value."), []);
  });

  it("leaves a misspelling known-misspelling lists to that rule", () => {
    assert.deepEqual(unknown("We will recieve the signed contract on Friday."), []);
  });

  it("a team name is known", () => {
    const words = (team: TeamRules): unknown[] =>
      unknownWord(buildDocument("a.md", "Our pipline is fine.\n", en, team), { limit: 1 }).map((finding) => finding.values["word"]);
    assert.deepEqual(words({ jargon: [], requiredSections: [] }), ["pipline"]);
    assert.deepEqual(words({ jargon: [], requiredSections: [], names: ["Pipline"] }), []);
  });

  it("does not run on Japanese", () => {
    assert.deepEqual(namedRuleRun("unknown-word", "We will attched it.\n", ja).findings, []);
  });
});

describe("spelling: the pieces", () => {
  const speller: Speller = {
    words: [new Set(["receive", "stop", "carry", "ship", "test", "toast", "x"]), new Set(["pipeline", "hipline"])],
    suffixes: [
      { suffix: "ed", replacement: "" },
      { suffix: "ied", replacement: "y" },
      { suffix: "s", replacement: "" },
    ],
    prefixes: ["un"],
  };

  it("isKnownWord takes off endings, a doubled consonant and one prefix", () => {
    assert.deepEqual(
      ["receive", "stopped", "carried", "unshipped", "ships", "recieve", "un", "ed", "xs", ""].map((word) => isKnownWord(word, speller)),
      [true, true, true, true, true, false, false, false, false, false],
    );
  });

  it("editsOf: swaps, replacements, drops and inserts, without the word itself", () => {
    const edits = editsOf("ab");
    assert.equal(edits[0], "ba");
    assert.ok(edits.includes("a") && edits.includes("abc") && edits.includes("xb"));
    assert.ok(!edits.includes("ab"));
    assert.deepEqual(editsOf(""), [..."abcdefghijklmnopqrstuvwxyz"]);
  });

  it("suggestionFor prefers a word the document uses, then the same first letter", () => {
    assert.equal(suggestionFor("recieve", speller, new Set()), "receive");
    assert.equal(suggestionFor("pipline", speller, new Set()), "pipeline");
    assert.equal(suggestionFor("tost", speller, new Set(["toast"])), "toast");
    assert.equal(suggestionFor("tost", speller, new Set()), "test");
    assert.equal(suggestionFor("xqzvwk", speller, new Set()), undefined);
    assert.equal(suggestionFor("stoppd", speller, new Set()), undefined);
  });

  it("wordsToCheck: lower-case Latin words only, outside addresses and file names", () => {
    const text = "The Recieve file index.html and mail a@b.co and https://x.y/abcde and don't stop well-known &mdash; abcdefghijkl";
    assert.deepEqual(
      wordsToCheck(text, 4, 10).map((found) => found.word),
      ["file", "mail", "stop"],
    );
    assert.deepEqual(wordsToCheck("", 4, 10), []);
  });

  it("isSplitWord: the rest of a word whose first letter is set apart", () => {
    const at = (source: string, word: string): boolean => isSplitWord(source, source.indexOf(word));
    assert.equal(at("a **G**lobally b", "lobally"), true);
    assert.equal(at("a _G_lobally b", "lobally"), true);
    assert.equal(at('said "[e]xpressions"', "xpressions"), true);
    assert.equal(at("a **globally** b", "globally"), false);
    assert.equal(at("see [1] report", "report"), false);
    assert.equal(at("see [note]report", "report"), false);
    assert.equal(at("report", "report"), false);
    assert.equal(isSplitWord("", 0), false);
  });
});
