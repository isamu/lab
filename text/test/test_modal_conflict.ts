import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { contentKey, modalConflicts, modalStatements, type ModalStatement, type Obligation } from "../packages/chaff/src/structure/modal-conflict.ts";
import { listLeadIns } from "../packages/chaff/src/structure/list-lead-in.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import type { Sentence, Span, Token } from "../packages/chaff/src/plugin.ts";

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

/** 導入の行と、その下に 1 行 1 項目で並べた項目。 */
const UNDER_TWO_CONDITIONS_JA = [
  "## 第5条（報告書）",
  "",
  "委託者が報告書を承認した場合：",
  "① 受託者は、報告書を公表しなければならない。",
  "② 受託者は、写しを保管する。",
  "委託者が報告書の修正を求めた場合：",
  "① 受託者は、報告書を公表してはならない。",
  "② 受託者は、報告書を作り直す。",
  "",
].join("\n");

const UNDER_TWO_CONDITIONS_EN = [
  "Section 7 Approval of the plan",
  "(1) If the Board rejects the plan—",
  "(a) the Manager must not publish the plan, and",
  "(b) the Manager must prepare another plan.",
  "(2) If the Board approves the plan—",
  "(a) the Manager must publish the plan, and",
  "(b) the plan takes effect after 21 days.",
  "",
].join("\n");

const UNDER_ONE_CONDITION_EN = [
  "Section 7 Approval of the plan",
  "(1) If the Board approves the plan—",
  "(a) the Manager must publish the plan, and",
  "(b) the Manager must not publish the plan.",
  "",
].join("\n");

/**
 * 1 行を項目の文として、adapter の segment と structure.obligations で読んだ様相の文の食い違い。en の adapter が 1 行 1 項目の
 * 箇条書きを項目の文に切るかどうかに関わらず、項目の文を作って比べる。
 */
const lineItemConflicts = (source: string, adapter = en): number => {
  const lines = [...source.matchAll(/[^\n]+/gu)].map((match) => ({ line: match[0], start: match.index }));
  const shifted =
    (start: number) =>
    (span: Span): Span => ({ start: span.start + start, end: span.end + start });
  const sentences: Sentence[] = lines.flatMap(({ line, start }) =>
    adapter.segment(line).sentences.map((sentence) => ({
      ...sentence,
      ...(line.startsWith("(") ? { listItem: true as const } : {}),
      span: shifted(start)(sentence.span),
      tokens: (sentence.tokens ?? []).map((token) => ({ ...token, span: shifted(start)(token.span) })),
    })),
  );
  const obligations: Obligation[] = lines.flatMap(({ line, start }) =>
    (adapter.structure?.obligations(line) ?? []).map((found) => ({
      ...shifted(start)(found),
      type: String(found.attrs["type"] ?? ""),
      marker: String(found.attrs["marker"] ?? ""),
    })),
  );
  return modalConflicts(modalStatements(obligations, sentences, listLeadIns(source, sentences))).length;
};

describe("modal-conflict: 箇条書きの項目は導入の条件の下で比べる", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("項目が違う導入（条件）の下にあれば食い違いではない", () => {
    assert.deepEqual(conflicts(UNDER_TWO_CONDITIONS_JA, ja), []);
  });

  it("同じ導入の下の二つの項目が逆なら出す。項目の番号は中身に数えない", () => {
    assert.deepEqual(
      conflicts(
        [
          "## 第5条（報告書）",
          "",
          "委託者が報告書を承認した場合：",
          "① 受託者は、報告書を公表しなければならない。",
          "② 受託者は、報告書を公表してはならない。",
          "",
        ].join("\n"),
        ja,
      ),
      ["「してはならない」と書いていますが、4 行目では同じ行為を「しなければならない」と書いています"],
    );
  });

  it("導入の無い項目は、別の条の文と比べる", () => {
    assert.equal(
      conflicts(sections("① 受託者は、本件業務を第三者に委託してはならない。", "② 受託者は、本件業務を第三者に委託することができる。"), ja).length,
      1,
    );
  });

  it("English items under different lead-ins are not a conflict; under one lead-in they are", () => {
    assert.equal(lineItemConflicts(UNDER_TWO_CONDITIONS_EN), 0);
    assert.equal(lineItemConflicts(UNDER_ONE_CONDITION_EN), 1);
  });

  it("English through the whole pipeline, once the adapter reads one item a line as its own sentence", (context) => {
    const itemized = buildDocument("a.md", UNDER_ONE_CONDITION_EN, en).sentences.some((sentence) => sentence.listItem === true);
    if (!itemized) {
      context.skip("the English adapter does not split one-item-a-line lists yet");
      return;
    }
    assert.deepEqual(conflicts(UNDER_TWO_CONDITIONS_EN), []);
    assert.equal(conflicts(UNDER_ONE_CONDITION_EN).length, 1);
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
