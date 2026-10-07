import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { definitions } from "../packages/lang-en/src/definitions.ts";
import { readsAsExample } from "../packages/lang-en/src/example-name.ts";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// The English definition reader: a bracket that names a thing, and one that gives it several names. Self-written text.

const read = (text: string): string[] =>
  definitions(text).map(
    (mention) =>
      `${String(mention.attrs["term"])}${mention.attrs["placement"] === "inline" ? " inline" : ""}${mention.attrs["form"] === "bare" ? " bare" : ""}`,
  );

describe("English definitions", () => {
  it("reads one name in brackets, with the, these, this, each or collectively before it", () => {
    assert.deepEqual(read('Harbour Works Ltd (the "Supplier") agrees.'), ["Supplier inline"]);
    assert.deepEqual(read('These Terms of Service (these "Terms") govern.'), ["Terms inline"]);
    assert.deepEqual(read('This Agreement (this "Agreement") is made.'), ["Agreement inline"]);
    assert.deepEqual(read('Acme Inc. and Beta LLC (each, a "Party") agree.'), ["Party inline"]);
    assert.deepEqual(read('Acme Inc. and Beta LLC (collectively, the "Parties") agree.'), ["Parties inline"]);
  });

  it("reads a bracket of several names: the first is the inline one, the others are defined there too", () => {
    assert.deepEqual(read('Pinecone Software Ltd ("Pinecone", "we" or "us") provides it.'), ["Pinecone inline bare", "we bare", "us bare"]);
    assert.deepEqual(read('Acme Inc. (the "Company", "we", "us", or "our") runs it.'), ["Company inline", "we", "us", "our"]);
    const [first, second] = definitions('Acme ("Acme" or "we") runs it.');
    assert.equal(first?.start, 5);
    assert.equal(second?.start, 16);
  });

  it("keeps a party named for one section to that section, as the one-name form does", () => {
    const local = definitions('This section applies where a person ("Seller" or "Vendor") sells goods.').map((mention) => mention.attrs["scope"]);
    assert.deepEqual(local, ["local", "local"]);
  });

  it("does not read a bracket of quoted examples, or a list with nothing but one name", () => {
    assert.deepEqual(read('Avoid selective ownership. ("mine", "not mine", "yours")'), []);
    assert.deepEqual(read('Words such as ("always" "never") are vague.'), []);
    assert.deepEqual(read('Set mode to one of ("Read" "Write").'), []);
    assert.deepEqual(read(""), []);
  });

  it("does not read bare brackets that quote a phrase as definitions, alone or as a list", () => {
    assert.deepEqual(read('Openers that announce ("The key point is") pile up.'), []);
    assert.deepEqual(read('| `closing-cliche` | A stock closing ("In conclusion", "I hope this helps") |'), []);
    assert.deepEqual(read('It points at sections ("sections 44 and 45") by number.'), []);
    assert.deepEqual(read('| `a` | A sign-off ("Cheers", "I hope this helps") |'), ["Cheers inline bare"]);
    assert.deepEqual(read('Harbour Cloud Ltd ("Provider", "service provider") hosts the data.'), ["Provider inline bare"]);
  });

  it("still reads a capitalised name, a one-word name and a statute's lower-case party after an article", () => {
    assert.deepEqual(read('The data addendum ("Use of Customer Data") applies.'), ["Use of Customer Data inline bare"]);
    assert.deepEqual(read('Harbour Ltd ("Seller") sells.'), ["Seller inline bare"]);
    assert.deepEqual(read("the period of twelve months (“the annual period”) starts."), ["the annual period inline bare"]);
    assert.deepEqual(read('The client ("Example 4") is shown.'), ["Example 4 inline bare"]);
    assert.deepEqual(read('Banco de Chile S.A. ("Banco de Chile") lends.'), ["Banco de Chile inline bare"]);
    assert.deepEqual(read('The fees ("Fees under this Agreement") are due.'), ["Fees under this Agreement inline bare"]);
    assert.deepEqual(read('Alpha and Beta ("Agreement between the Parties") bind.'), ["Agreement between the Parties inline bare"]);
  });
});

describe("readsAsExample", () => {
  it("several words with a lower-case word a name would capitalise", () => {
    assert.deepEqual(["The key point is", "I hope this helps", "silently fails", "Here's the thing", "virtual projects"].map(readsAsExample), [
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it("one word, a capitalised name with its small words, or an article in lower case before a party", () => {
    assert.deepEqual(
      [
        "Seller",
        "seller",
        "Terms of Use",
        "Proprietary Information Agreement",
        "the seller",
        "a sub-processor",
        "Fetch API",
        "iOS App",
        "2019 Regulations",
        "",
      ].map(readsAsExample),
      [false, false, false, false, false, false, false, false, false, false],
    );
  });
});

describe("duplicate-definition over quoted examples", () => {
  const duplicates = (source: string): readonly string[] => namedRuleRun("duplicate-definition", source, en).findings;

  it("the same example quoted in two table rows is not a term defined twice", () => {
    const table = [
      "| Rule | What it finds |",
      "| --- | --- |",
      '| `assistant-residue` | What is left of a chat reply ("I hope this helps", "As of my last knowledge update") |',
      '| `closing-cliche` | A stock closing ("In conclusion", "I hope this helps") |',
      "",
    ].join("\n");
    assert.deepEqual(duplicates(table), []);
  });

  it("a name defined twice is still reported", () => {
    assert.deepEqual(duplicates('Harbour Ltd ("Seller") sells.\n\nHill Ltd ("Seller") also sells.\n'), ['"Seller" is also defined on line 1']);
  });
});
