import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { isInCapitalsPassage } from "../packages/chaff/src/capitals-passage.ts";
import { givenNameBefore } from "../packages/chaff/src/name-given-before.ts";
import { companyGroupBases, type CompanyMention } from "../packages/chaff/src/company-names.ts";

// name-variant: two things that are apart, though written alike (two people, two group companies, a passage in capitals).
// Every example is self-written.

const variants = (source: string, adapter = en): readonly string[] => namedRuleRun("name-variant", source, adapter, "a.md").findings;

const spanOf = (text: string, word: string): readonly [number, number] => {
  const start = text.indexOf(word);
  return [start, start + word.length];
};

describe("isInCapitalsPassage: a word set in the capitals of its passage", () => {
  it("a name among words in capitals, and a line of capitals alone", () => {
    const disclaimer = "(c) AOBA AND ITS SUPPLIERS MAKE NO WARRANTY, and aOBA keeps the rest.";
    assert.equal(isInCapitalsPassage(disclaimer, ...spanOf(disclaimer, "AOBA")), true);
    const header = "Page 3\naOBA SYSTEMS CORPORATION\nThe parties agree.";
    assert.equal(isInCapitalsPassage(header, ...spanOf(header, "aOBA SYSTEMS CORPORATION")), true);
    const clause = "7. Warranty. THE aOBA SYSTEMS ARE PROVIDED AS IS.";
    assert.equal(isInCapitalsPassage(clause, ...spanOf(clause, "aOBA")), true);
    const word = "aOBA SYSTEMS CORPORATION";
    assert.equal(isInCapitalsPassage(word, 0, "aOBA".length), true);
  });

  it("a name among ordinary words, a short line, another line, and Japanese text are not a passage in capitals", () => {
    const prose = "The order goes to aOBA once the team signs it.";
    assert.equal(isInCapitalsPassage(prose, ...spanOf(prose, "aOBA")), false);
    assert.equal(isInCapitalsPassage("aOBA SYSTEMS", 0, "aOBA".length), false);
    const lines = "WARRANTY TERMS APPLY\naOBA ships the order\nNO OTHER TERMS";
    assert.equal(isInCapitalsPassage(lines, ...spanOf(lines, "aOBA")), false);
    const japanese = "株式会社 青葉 システム 部 aOBA";
    assert.equal(isInCapitalsPassage(japanese, ...spanOf(japanese, "aOBA")), false);
    assert.equal(isInCapitalsPassage("", 0, 0), false);
  });
});

const token = (surface: string, start: number, pos = "PROPN"): Token => ({ surface, pos, span: { start, end: start + surface.length } });

/** Tokens of the words of text, each with its part of speech. */
const tokensOf = (text: string, tags: readonly (readonly [string, string])[]): Token[] =>
  tags.reduce<{ tokens: Token[]; from: number }>(
    ({ tokens, from }, [surface, pos]) => {
      const start = text.indexOf(surface, from);
      return { tokens: [...tokens, token(surface, start, pos)], from: start + surface.length };
    },
    { tokens: [], from: 0 },
  ).tokens;

describe("givenNameBefore: the given name written right before a surname", () => {
  it("a given name, with or without one initial between", () => {
    const text = "Jeffrey D. Walker and Christopher J Waller and Anna Paulson";
    const tokens = tokensOf(text, [
      ["Jeffrey", "PROPN"],
      ["D", "PROPN"],
      [".", "PUNCT"],
      ["Walker", "PROPN"],
      ["and", "CCONJ"],
      ["Christopher", "PROPN"],
      ["J", "PROPN"],
      ["Waller", "PROPN"],
      ["and", "CCONJ"],
      ["Anna", "PROPN"],
      ["Paulson", "PROPN"],
    ]);
    assert.equal(givenNameBefore(tokens, 3, text), "Jeffrey");
    assert.equal(givenNameBefore(tokens, 7, text), "Christopher");
    assert.equal(givenNameBefore(tokens, 10, text), "Anna");
  });

  it("no given name: a word that is not a name, a word in capitals, another line, the first word, an index past the end", () => {
    const text = "Keep Pawsly away. ACME Walker\nJeffrey\nWalker";
    const tokens = tokensOf(text, [
      ["Keep", "VERB"],
      ["Pawsly", "PROPN"],
      ["away", "ADV"],
      [".", "PUNCT"],
      ["ACME", "PROPN"],
      ["Walker", "PROPN"],
      ["Jeffrey", "PROPN"],
      ["Walker", "PROPN"],
    ]);
    assert.equal(givenNameBefore(tokens, 1, text), undefined);
    assert.equal(givenNameBefore(tokens, 5, text), undefined);
    assert.equal(givenNameBefore(tokens, 7, text), undefined);
    assert.equal(givenNameBefore(tokens, 0, text), undefined);
    assert.equal(givenNameBefore(tokens, 99, text), undefined);
  });
});

const company = (base: string, form: string, offset: number): CompanyMention => ({
  surface: `${base} ${form}`,
  offset,
  base,
  form,
  position: "after",
});

describe("companyGroupBases: a name written with three forms or more is a group of companies", () => {
  it("three forms of one name make a group; the same form many times does not", () => {
    const group = [company("Aoba", "inc", 0), company("Aoba", "ltd", 20), company("Aoba", "gmbh", 40), company("Minato", "inc", 60)];
    assert.deepEqual([...companyGroupBases(group)], ["aoba"]);
    assert.deepEqual([...companyGroupBases([company("Aoba", "inc", 0), company("Aoba", "ltd", 20), company("Aoba", "ltd", 40)])], []);
    assert.deepEqual([...companyGroupBases([])], []);
  });
});

describe("name-variant: names that are apart", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("two people with surnames a letter apart and different given names", () => {
    const minutes =
      "Members present:\n\nNora K. Fielder, Chair\n\nSamuel T. Fielden\n\nVoting against this action: Nora K. Fielder.\n\nNora K. Fielder asked for a vote.\n";
    assert.deepEqual(variants(minutes), []);
  });

  it("a surname a letter apart under the same given name, or without one, is still reported", () => {
    assert.deepEqual(variants("Nora K. Fielder chairs the board. Nora K. Fielder opened the meeting. Later Nora K. Fieldre closed it.\n"), [
      '"Fieldre" is one letter away from "Fielder", which the document uses more than once',
    ]);
    assert.deepEqual(variants("Contact Mobimagic for refunds. Mobimagic answers within a day. Send the receipt to Mobimaigc.\n"), [
      '"Mobimaigc" is one letter away from "Mobimagic", which the document uses more than once',
    ]);
  });

  it("a word and its form with a doubled last letter, one of them written in lower case: License and Licensee", () => {
    assert.deepEqual(
      variants(
        "1. GRANT. 1.1 Grant of License. Licensor grants to Licensee a license to use the marks.\n\nLicensee pays a fee for the license. Licensee keeps the records.\n",
      ),
      [],
    );
  });

  it("a doubled last letter dropped from a name never written in lower case is still reported", () => {
    assert.deepEqual(variants("Name: Olivia Bennett\n\nOlivia Bennett passed every course.\n\nThis is the record of Olivia Bennet.\n"), [
      '"Olivia Bennet" is one letter away from "Olivia Bennett", which the document uses more than once',
    ]);
  });

  it("a company name inside a passage in capitals", () => {
    const contract =
      "aOBA SYSTEMS CORPORATION\n\nThis agreement is between aObA Systems Corporation and the Customer. aObA Systems hosts the service.\n\n7. Warranty. THE aOBA SYSTEMS ARE PROVIDED AS IS, AND aOBA MAKES NO OTHER WARRANTY.\n\naOBA SYSTEMS CORPORATION\n";
    assert.deepEqual(variants(contract), []);
  });

  it("a name with other capitals in ordinary text is still reported", () => {
    assert.deepEqual(variants("Orders go to aObA Systems. aObA Systems ships them, and AObA Systems sends the invoice.\n"), [
      '"AObA Systems" is written "aObA Systems" elsewhere in the document (case, width or punctuation)',
    ]);
  });

  it("a link's bracket inside a name is not part of the name", () => {
    assert.deepEqual(
      variants(
        "Data is handled as outlined in the Aoba [Data Handling Standard](/policies/data/), with one exception.\n\nAccess to private data, as defined by the [Aoba Data Handling Standard](/policies/data/), is limited.\n",
      ),
      [],
    );
  });

  it("the companies of a group, each with its own form and country", () => {
    const policy =
      "Expenses for Aoba Inc, Aoba Ltd (UK), Aoba GmbH (Germany) and Aoba LTD (Ireland) are paid monthly.\n\nAoba Ltd team members file by the fifth.\n\nAoba GmbH (Germany) follows the local page.\n";
    assert.deepEqual(variants(policy), []);
  });

  it("one company written with two forms is still reported", () => {
    assert.deepEqual(variants("# Proposal\n\nFrom: Aoba Systems Inc.\n\nFor questions, contact the sales team at Aoba Systems Ltd.\n"), [
      '"Aoba Systems Ltd" is written "Aoba Systems Inc", with another company form, elsewhere in the document',
    ]);
  });

  it("Japanese names are not read as a passage in capitals", () => {
    assert.deepEqual(variants("担当の斎藤です。\n\n資料は斉藤までご連絡ください。\n", ja), [
      "「斉藤」は、ほかの所では字体の違う同じ字で「斎藤」と書いています",
    ]);
  });
});
