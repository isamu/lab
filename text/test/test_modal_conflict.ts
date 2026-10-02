import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { contentKey, modalConflicts, type ModalStatement } from "../packages/chaff/src/structure/modal-conflict.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// 同じ行為への逆の決まり（modal-conflict）。例文はすべて自作。

const conflicts = (source: string, adapter = en): readonly string[] => namedRuleRun("modal-conflict", source, adapter, "a.md", "legal/contract").findings;

const sections = (first: string, second: string): string => `## 5. One\n\n${first}\n\n## 9. Two\n\n${second}\n`;

describe("modal-conflict: 同じ行為への逆の決まり", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("must not, then may, about the same act", () => {
    assert.deepEqual(
      conflicts(
        sections(
          "The Supplier must not disclose Confidential Information to third parties.",
          "The Supplier may disclose Confidential Information to third parties.",
        ),
      ),
      ['This says "may", but line 3 says "must not" about the same act'],
    );
  });

  it("shall, then shall not", () => {
    assert.equal(conflicts(sections("The Customer shall pay the fees monthly.", "The Customer shall not pay the fees monthly.")).length, 1);
  });

  it("a condition or another object changes the act, so the pair is not reported", () => {
    assert.deepEqual(
      conflicts(
        sections(
          "The Supplier must not disclose Confidential Information to third parties.",
          "The Supplier may disclose Confidential Information to its legal advisers.",
        ),
      ),
      [],
    );
    assert.deepEqual(
      conflicts(
        sections(
          "The Supplier must not disclose Confidential Information to third parties.",
          "The Supplier may disclose Confidential Information to third parties if a court orders it.",
        ),
      ),
      [],
    );
  });

  it("must and may agree; the same modality twice agrees", () => {
    assert.deepEqual(conflicts(sections("The Customer must pay the fees monthly.", "The Customer may pay the fees monthly.")), []);
    assert.deepEqual(conflicts(sections("The Customer must not resell the Service.", "The Customer must not resell the Service.")), []);
  });

  it("a sentence with two modal markers is left out", () => {
    assert.deepEqual(
      conflicts(sections("The Customer must not resell the Service.", "The Customer may resell the Service, but must not resell it twice.")),
      [],
    );
  });

  it("日本語の してはならない と することができる", () => {
    assert.deepEqual(conflicts(sections("受託者は、本件業務を第三者に委託してはならない。", "受託者は、本件業務を第三者に委託することができる。"), ja), [
      "「することができる」と書いていますが、3 行目では同じ行為を「してはならない」と書いています",
    ]);
    assert.deepEqual(
      conflicts(
        sections("受託者は、本件業務を第三者に委託してはならない。", "受託者は、委託者の書面による承諾を得て、本件業務を第三者に委託することができる。"),
        ja,
      ),
      [],
    );
  });
});

describe("the reading behind modal-conflict", () => {
  const token = (surface: string, pos: string, start: number, lemma?: string): Token => ({
    surface,
    pos,
    span: { start, end: start + surface.length },
    ...(lemma === undefined ? {} : { lemma }),
  });

  it("contentKey keeps nouns, verbs and adjectives by lemma, without the marker", () => {
    const tokens = [
      token("The", "DET", 0),
      token("Supplier", "PROPN", 4, "supplier"),
      token("shall", "AUX", 13),
      token("pays", "VERB", 19, "pay"),
      token("fees", "NOUN", 24, "fee"),
    ];
    assert.equal(contentKey(tokens, [{ start: 13, end: 18 }]), "fee pay supplier");
    assert.equal(contentKey(tokens, [{ start: 19, end: 23 }]), "fee supplier");
  });

  it("modalConflicts reports the later of an opposite pair, against the first of its kind", () => {
    const at = (offset: number, type: string, key = "fee pay supplier"): ModalStatement => ({ offset, type, marker: type, key });
    const found = modalConflicts([at(30, "must-not"), at(0, "must"), at(60, "must-not"), at(90, "may", "other words")]);
    assert.deepEqual(
      found.map(({ statement, earlier }) => `${String(statement.offset)}<${String(earlier.offset)}`),
      ["30<0", "60<0"],
    );
  });
});
