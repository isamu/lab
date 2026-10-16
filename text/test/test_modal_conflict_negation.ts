import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { contentKey } from "../packages/chaff/src/structure/modal-conflict.ts";
import { negatedWords, negationsMarked, negationWords } from "../packages/chaff/src/structure/negated-act.ts";
import type { Sentence, Token } from "../packages/chaff/src/plugin.ts";

// modal-conflict と、行為や条件の中の打ち消し。例文はすべて自作。

const conflicts = (source: string, adapter = en): readonly string[] => namedRuleRun("modal-conflict", source, adapter, "a.md", "legal/contract").findings;

const sections = (first: string, second: string): string => `## 5. One\n\n${first}\n\n## 9. Two\n\n${second}\n`;

describe("modal-conflict: a negation inside the act is part of the act", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("may reject goods that do not conform, may not reject goods that do conform: not a conflict", () => {
    assert.deepEqual(
      conflicts(
        sections(
          "The consumer may reject goods that do not conform to the contract.",
          "The consumer may not reject any goods that do conform to the contract.",
        ),
      ),
      [],
    );
  });

  it("a negated condition and a plain one decide different things", () => {
    assert.deepEqual(
      conflicts(
        sections("The Supplier must issue an invoice if the goods are not delivered.", "The Supplier must not issue an invoice if the goods are delivered."),
      ),
      [],
    );
    assert.deepEqual(
      conflicts(sections("The Customer may assign the contract without consent.", "The Customer must not assign the contract with consent.")),
      [],
    );
  });

  it("the same act with the opposite modal is still a conflict", () => {
    assert.deepEqual(conflicts(sections("The Supplier must issue an invoice to the Customer.", "The Supplier must not issue an invoice to the Customer.")), [
      'This says "must not", but line 3 says "must" about the same act',
    ]);
  });

  it("the same negation on both sides is still a conflict", () => {
    assert.equal(
      conflicts(
        sections(
          "The consumer may reject goods that do not conform to the contract.",
          "The consumer must not reject goods that do not conform to the contract.",
        ),
      ).length,
      1,
    );
    assert.equal(conflicts(sections("The Buyer must pay for goods that don't conform.", "The Buyer must not pay for goods that do not conform.")).length, 1);
  });

  it("日本語: 承認した場合と承認しなかった場合は、違う条件", () => {
    assert.deepEqual(
      conflicts(
        sections("受託者は、委託者が承認した場合、報告書を提出しなければならない。", "受託者は、委託者が承認しなかった場合、報告書を提出してはならない。"),
        ja,
      ),
      [],
    );
    assert.deepEqual(
      conflicts(sections("受託者は、検査に合格しない場合、納品してはならない。", "受託者は、検査に合格した場合、納品しなければならない。"), ja),
      [],
    );
  });

  it("日本語: 同じ行為の 提出しなければならない と 提出してはならない は食い違い", () => {
    assert.deepEqual(conflicts(sections("受託者は、報告書を委託者に提出しなければならない。", "受託者は、報告書を委託者に提出してはならない。"), ja), [
      "「してはならない」と書いていますが、3 行目では同じ行為を「しなければならない」と書いています",
    ]);
    assert.equal(
      conflicts(
        sections(
          "受託者は、委託者が承認しなかった場合、報告書を提出しなければならない。",
          "受託者は、委託者が承認しなかった場合、報告書を提出してはならない。",
        ),
        ja,
      ).length,
      1,
    );
  });
});

describe("the reading of negation behind modal-conflict", () => {
  const token = (surface: string, pos: string, start: number, lemma?: string): Token => ({
    surface,
    pos,
    span: { start, end: start + surface.length },
    ...(lemma === undefined ? {} : { lemma }),
  });
  const word = (text: string, negation = false): { readonly word: string; readonly negation: boolean } => ({ word: text, negation });

  it("negatedWords marks the word before a negation, or the next one at the start", () => {
    assert.deepEqual(negatedWords([word("do"), word("not", true), word("conform")]), ["do¬", "conform"]);
    assert.deepEqual(negatedWords([word("no", true), word("party"), word("assign")]), ["party¬", "assign"]);
    assert.deepEqual(negatedWords([word("pay"), word("not", true), word("not", true)]), ["pay¬"]);
    assert.deepEqual(negatedWords([word("not", true)]), []);
    assert.deepEqual(negatedWords([]), []);
    assert.deepEqual(negatedWords([word("pay"), word("fee")]), ["pay", "fee"]);
  });

  it("negationWords takes the plain words of a lexicon, lower-cased, without prefixes", () => {
    assert.deepEqual([...negationWords([{ pattern: "Not" }, { pattern: "不", group: "prefix" }, { pattern: "ない" }])], ["not", "ない"]);
    assert.deepEqual([...negationWords(undefined)], []);
  });

  it("contentKey: a negation outside the marker marks a word; one inside the marker does not", () => {
    const words = new Set(["not"]);
    const sentence: Sentence = {
      span: { start: 0, end: 30 },
      text: "",
      tokens: [token("may", "AUX", 0), token("not", "ADV", 4), token("reject", "VERB", 8, "reject"), token("goods", "NOUN", 15, "good")],
    };
    const [marked] = negationsMarked([sentence], words);
    assert.equal(contentKey(marked?.tokens ?? [], [{ start: 0, end: 7 }]), "good reject");
    assert.equal(contentKey(marked?.tokens ?? [], [{ start: 0, end: 3 }]), "good reject¬");
    assert.equal(contentKey(sentence.tokens ?? [], [{ start: 0, end: 3 }]), "good reject");
  });

  it("negationsMarked leaves a sentence without tokens alone, and a negating content word stays a word", () => {
    const bare: Sentence = { span: { start: 0, end: 3 }, text: "abc" };
    assert.deepEqual(negationsMarked([bare], new Set(["ない"])), [bare]);
    const [marked] = negationsMarked(
      [{ span: { start: 0, end: 5 }, text: "", tokens: [token("必要", "NOUN", 0), token("ない", "ADJ", 3, "ない")] }],
      new Set(["ない"]),
    );
    assert.equal(contentKey(marked?.tokens ?? [], []), "ない 必要");
  });
});
