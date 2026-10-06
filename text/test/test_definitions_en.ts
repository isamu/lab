import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { definitions } from "../packages/lang-en/src/definitions.ts";

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
});
