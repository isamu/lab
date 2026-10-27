import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { hasTwoEndings, isKnownWord, type Speller } from "../packages/chaff/src/spelling.ts";
import {
  addressWordsOf,
  besideForeignWord,
  hasDrugStem,
  inSearchTermList,
  isClosedCompound,
  isMention,
  usedOnce,
} from "../packages/chaff/src/detectors/unknown-word-context.ts";

// unknown-word on the shapes of words that are not slips: a word built from dictionary words, a word the document uses in
// another form, a name in quotes, brackets or an address, a list of search terms, a foreign phrase. The excerpts are US
// federal documents (Section 508, the National Park Service, the Federal Reserve, House hearings, Supreme Court opinions,
// a US patent, the 18F handbook) or self-written.

const unknown = (source: string): readonly string[] => namedRuleRun("unknown-word", `${source}\n`, en).findings;

const typo = (word: string, suggestion: string): string => `"${word}" is not in the dictionary; did you mean "${suggestion}"?`;

describe("unknown-word: words built from dictionary words", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("the follower of a doctrine and the doctrine, and the adjective of an -ion noun, are known", () => {
    assert.deepEqual(unknown("Second, the bioterrorist threat, to which we need to respond."), []);
    assert.deepEqual(unknown("A relativist reads it one way, a particularist another; generalism has its own view."), []);
    assert.deepEqual(unknown("The claim has propositional content."), []);
  });

  it("an inflection on a derived word is known, but not an ending on an inflection or on a doubled consonant", () => {
    assert.deepEqual(unknown("The framework operationalises the agenda."), []);
    assert.deepEqual(unknown("The overseers met. Sundry gifts were made to the oversers of the college."), [typo("oversers", "overseers")]);
    assert.deepEqual(unknown("The product was visuallized by staining with ethidium bromide."), [typo("visuallized", "visualized")]);
  });

  it("two dictionary words written as one are not read as a compound: a dropped letter at the joint is a typo", () => {
    assert.deepEqual(unknown("Select the table in the toolbar and choose a style."), []);
    assert.deepEqual(unknown("We opened ten issues last month and openend five more."), [typo("openend", "opened")]);
    assert.deepEqual(unknown("The pipline restarted."), [typo("pipline", "pipeline")]);
  });

  it("two words of four letters or more written as one are a closed compound, but a slip inside one half is still reported", () => {
    assert.deepEqual(unknown("Platform crowdwork pays by the task, and the crowdworkers rate the answers."), []);
    assert.deepEqual(unknown("The award went to the best teamwrok of the year."), [typo("teamwrok", "teamwork")]);
    assert.deepEqual(unknown("It has been held to apply to misappropriation as well as misrepresenation."), [typo("misrepresenation", "misrepresentation")]);
  });

  it("a drug's name is read by its international stem, but a slip in the stem is still reported", () => {
    assert.deepEqual(unknown("Any medications (e.g., paroxetine, sertraline) taken in the past month should be listed."), []);
    assert.deepEqual(unknown("The patients were given telmisartan daily."), []);
    assert.deepEqual(unknown("Take ibuprofin with food."), [typo("ibuprofin", "ibuprofen")]);
  });

  it("a word the document also writes with another ending is its own term, but a known word's odd stem is not", () => {
    assert.deepEqual(unknown("The review aims to help rightsize the plan. We need to have this rightsized soon."), []);
    assert.deepEqual(unknown("We refactored the parser and will refactore the module."), [typo("refactore", "refactored")]);
  });

  it("a function word takes no ending, so a slip on one is reported", () => {
    assert.deepEqual(unknown("In thoses areas where coverage is found, not all providers offer service to those who visit."), [typo("thoses", "those")]);
  });

  it("ordinary words a dictionary carries are known", () => {
    assert.deepEqual(unknown("If anyone needs to get ahold of me, they can. There was grift and corruption."), []);
    assert.deepEqual(unknown("Our barista posted a mockup of the new menu, amidst talk of doxing and synch rights."), []);
    assert.deepEqual(unknown("The mythos of agentic tools grew as each distro shipped upserts."), []);
  });
});

describe("unknown-word: words whose place makes them a name or a term", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("a word alone in quotes or brackets is named as such", () => {
    assert.deepEqual(unknown('The "mailto" scheme is allowed.'), []);
    assert.deepEqual(unknown("James Chaplin (jchaplin) was added to the committee."), []);
    assert.deepEqual(unknown('He wrote "the report is attched" in the log.'), [typo("attched", "attached")]);
  });

  it("a word in a list of search terms with a wildcard is a term", () => {
    assert.deepEqual(unknown("president, congress, maga, biden, democrat*, republican*, policy"), []);
    assert.deepEqual(unknown("president, congress, maga, biden, policy"), [typo("biden", "bidet")]);
  });

  it("a word beside a word of another language belongs to that phrase", () => {
    assert.deepEqual(unknown("Interpreting data is that old bête noire for economists."), []);
  });

  it("a word the document also writes in a URL names what it points at", () => {
    assert.deepEqual(unknown("Built a tool to [analyze strace output](https://example.com/tools/strace-parser)."), []);
    assert.deepEqual(unknown("Built a tool to analyze strace output."), [typo("strace", "strafe")]);
  });

  it("a word with a bracketed letter, a word folded around a bracket, and a variable before = are not words", () => {
    assert.deepEqual(unknown('He had authority "to contest the assertion and handl[e] all aspects of any cases."'), []);
    assert.deepEqual(unknown("Harassment based on neuro(a)typicality is not allowed."), []);
    assert.deepEqual(unknown("Bootstrap intervals (nboot=2,000; seed 42)."), []);
  });
});

describe("unknown-word context: the pieces", () => {
  const speller: Speller = {
    words: [new Set(["tool", "operational", "those", "receive", "th"])],
    suffixes: [
      { suffix: "s", replacement: "", inflection: true },
      { suffix: "ier", replacement: "y", inflection: true },
      { suffix: "ise", replacement: "" },
      { suffix: "y", replacement: "" },
    ],
    prefixes: [],
    uninflected: new Set(["those"]),
  };

  it("hasTwoEndings: an inflection on a derived word whose stem keeps four letters", () => {
    assert.deepEqual(
      ["operationalises", "operationalise", "operationalss", "thier", "toolss", "", "s"].map((word) => hasTwoEndings(word, speller)),
      [true, false, false, false, false, false, false],
    );
  });

  it("isClosedCompound: two listed words of four letters or more, the second inflected but neither prefixed nor derived", () => {
    const compounds: Speller = { ...speller, words: [new Set(["crowd", "work", "open", "end", "pipe", "line", "operational"])], prefixes: ["re"] };
    assert.deepEqual(
      ["crowdwork", "crowdworks", "pipeline", "openend", "crowdwrok", "crowdrework", "workoperationalise", "crowd", "", "s"].map((word) =>
        isClosedCompound(word, compounds),
      ),
      [true, true, true, false, false, false, false, false, false, false],
    );
  });

  it("hasDrugStem: a stem with three letters or more before it", () => {
    assert.deepEqual(
      ["paroxetine", "oxetine", "abolol", "abcolol", "parox", ""].map((word) => hasDrugStem(word, ["oxetine", "olol"])),
      [true, false, false, true, false, false],
    );
    assert.equal(hasDrugStem("paroxetine", []), false);
  });

  it("an uninflected word takes no ending", () => {
    assert.deepEqual(
      ["those", "thoses", "receives"].map((word) => isKnownWord(word, speller)),
      [true, false, true],
    );
  });

  it("usedOnce: a word and its forms count together; a known word adds only itself", () => {
    const words = (list: string[]) => list.map((word, offset) => ({ offset, word }));
    assert.deepEqual(
      usedOnce(words(["rightsize", "rightsizes", "zzq"]), speller).map(({ word }) => word),
      ["zzq"],
    );
    assert.deepEqual(
      usedOnce(words(["tools", "toolss"]), speller).map(({ word }) => word),
      ["tools", "toolss"],
    );
    assert.deepEqual(usedOnce(words(["zzq", "zzq"]), speller), []);
    assert.deepEqual(usedOnce([], speller), []);
  });

  it("isMention: the word alone in a pair of quotes or brackets", () => {
    assert.ok(isMention('a "mailto" b', 3, "mailto"));
    assert.ok(isMention("a “mailto” b", 3, "mailto"));
    assert.ok(isMention("(kusal)", 1, "kusal"));
    assert.ok(!isMention('"mailto b', 1, "mailto"));
    assert.ok(!isMention("(kusal]", 1, "kusal"));
    assert.ok(!isMention("kusal", 0, "kusal"));
  });

  it("inSearchTermList: the line holds a search stem", () => {
    assert.ok(inSearchTermList("a, biden, vaccin*", 3));
    assert.ok(inSearchTermList("intro\na, biden, vaccin*\nnext", 9));
    assert.ok(!inSearchTermList("a, biden\nvaccin*", 3));
    assert.ok(!inSearchTermList("a *biden* word", 3));
    assert.ok(!inSearchTermList("", 0));
  });

  it("besideForeignWord: a neighbour with a Latin letter outside a–z", () => {
    assert.ok(besideForeignWord("old bête noire for", 9, "noire"));
    assert.ok(besideForeignWord("noire café", 0, "noire"));
    assert.ok(!besideForeignWord("old black noire for", 10, "noire"));
    assert.ok(!besideForeignWord("“noire”", 1, "noire"));
    assert.ok(!besideForeignWord("noire", 0, "noire"));
  });

  it("addressWordsOf: the letters of URLs and email addresses", () => {
    assert.deepEqual(
      [...addressWordsOf("see https://x.org/strace-parser and tison@apache.org, not plain")].toSorted((left, right) => left.localeCompare(right)),
      ["apache", "https", "org", "parser", "strace", "tison", "x"],
    );
    assert.deepEqual([...addressWordsOf("")], []);
  });
});
