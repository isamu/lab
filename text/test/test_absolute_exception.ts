import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { actOf, contradictedAbsolutes, type Statement } from "../packages/chaff/src/structure/absolute-exception.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { REASONS } from "../packages/chaff/src/reasons.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { namedRuleRun } from "./rule-run.ts";

// absolute-exception: a rule stated without exception, and an exception for the same act elsewhere. Self-written text.

const RULE = "absolute-exception";

const statement = (overrides: Partial<Statement>): Statement => ({
  offset: 0,
  words: ["vendor", "share", "log", "party"],
  absolute: undefined,
  exception: undefined,
  obligation: false,
  act: undefined,
  unit: 0,
  ...overrides,
});

const RULE_STATEMENT = statement({ absolute: "never", obligation: true, act: "share" });
const LATER_EXCEPTION = statement({ offset: 100, unit: 100, exception: "except", words: ["audit", "vendor", "share", "log", "party"] });

describe("contradictedAbsolutes", () => {
  it("pairs an absolute obligation with a later exception in another unit for the same act", () => {
    const [found] = contradictedAbsolutes([RULE_STATEMENT, LATER_EXCEPTION]);
    assert.equal(found?.exception.offset, 100);
    assert.deepEqual(found?.shared, ["vendor", "share", "log", "party"]);
  });

  it("leaves an exception in the same unit: it is the rule's own proviso", () => {
    assert.deepEqual(contradictedAbsolutes([RULE_STATEMENT, { ...LATER_EXCEPTION, unit: 0 }]), []);
  });

  it("leaves an exception before the rule", () => {
    assert.deepEqual(contradictedAbsolutes([{ ...RULE_STATEMENT, offset: 200, unit: 200 }, LATER_EXCEPTION]), []);
  });

  it("leaves a rule that carries its own exception, or is no obligation", () => {
    assert.deepEqual(contradictedAbsolutes([{ ...RULE_STATEMENT, exception: "unless" }, LATER_EXCEPTION]), []);
    assert.deepEqual(contradictedAbsolutes([{ ...RULE_STATEMENT, obligation: false }, LATER_EXCEPTION]), []);
    assert.deepEqual(contradictedAbsolutes([{ ...RULE_STATEMENT, absolute: undefined }, LATER_EXCEPTION]), []);
  });

  it("leaves an exception that does not name the act", () => {
    assert.deepEqual(contradictedAbsolutes([RULE_STATEMENT, { ...LATER_EXCEPTION, words: ["audit", "vendor", "log", "party"] }]), []);
    assert.deepEqual(contradictedAbsolutes([{ ...RULE_STATEMENT, act: undefined }, LATER_EXCEPTION]), []);
  });

  it("needs most of the rule's words: at least two, and 60 percent", () => {
    assert.deepEqual(contradictedAbsolutes([RULE_STATEMENT, { ...LATER_EXCEPTION, words: ["share", "log"] }]), []);
    assert.equal(contradictedAbsolutes([RULE_STATEMENT, { ...LATER_EXCEPTION, words: ["share", "log", "vendor"] }]).length, 1);
    const fiveWords = { ...RULE_STATEMENT, words: ["vendor", "share", "log", "party", "day"] };
    assert.equal(contradictedAbsolutes([fiveWords, { ...LATER_EXCEPTION, words: ["share", "log", "vendor"] }]).length, 1);
    assert.deepEqual(contradictedAbsolutes([{ ...RULE_STATEMENT, words: ["share"] }, LATER_EXCEPTION]), []);
    const twoWords = { ...RULE_STATEMENT, words: ["share", "log"] };
    assert.deepEqual(contradictedAbsolutes([twoWords, { ...LATER_EXCEPTION, words: ["share"] }]), []);
  });

  it("reports each rule once, with the first exception", () => {
    const found = contradictedAbsolutes([RULE_STATEMENT, LATER_EXCEPTION, { ...LATER_EXCEPTION, offset: 300, unit: 300 }]);
    assert.equal(found.length, 1);
    assert.equal(found[0]?.exception.offset, 100);
  });

  it("is empty for nothing", () => assert.deepEqual(contradictedAbsolutes([]), []));
});

const token = (surface: string, pos: string, start: number, lemma = surface): Token => ({ surface, pos, lemma, span: { start, end: start + surface.length } });

describe("actOf", () => {
  const light = new Set(["be", "する"]);

  it("takes the verb right after an English modal", () => {
    const tokens = [token("Staff", "NOUN", 0), token("must", "AUX", 6), token("send", "VERB", 11), token("receipts", "NOUN", 16, "receipt")];
    assert.equal(actOf(tokens, { start: 6, end: 10 }, [], light), "send");
  });

  it("takes the word right before a Japanese marker, past a light verb", () => {
    const tokens = [token("情報", "NOUN", 0), token("は", "ADP", 2), token("消滅", "NOUN", 3), token("する", "VERB", 5), token("ものとする", "AUX", 7)];
    assert.equal(actOf(tokens, { start: 7, end: 12 }, [], light), "消滅");
  });

  it("on a tie, the verb", () => {
    const tokens = [token("Use", "NOUN", 0), token("must", "AUX", 4), token("comply", "VERB", 9)];
    assert.equal(actOf(tokens, { start: 4, end: 8 }, [], light), "comply");
  });

  it("a verb before beats a noun after; between two nouns, the one after", () => {
    const verbBefore = [token("負う", "VERB", 0), token("ものとする", "AUX", 2), token("旨", "NOUN", 7)];
    assert.equal(actOf(verbBefore, { start: 2, end: 7 }, [], light), "負う");
    const nouns = [token("Use", "NOUN", 0), token("must", "AUX", 4), token("Product", "NOUN", 9)];
    assert.equal(actOf(nouns, { start: 4, end: 8 }, [], light), "product");
  });

  it("skips the words already read (the absolute word), and gives nothing with no content word", () => {
    const tokens = [token("must", "AUX", 0), token("never", "NOUN", 5), token("be", "VERB", 11)];
    assert.equal(actOf(tokens, { start: 0, end: 4 }, [{ start: 5, end: 10 }], light), undefined);
    assert.equal(actOf([], { start: 0, end: 4 }, [], light), undefined);
  });
});

describe("absolute-exception, through the rule", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  const findings = (source: string, adapter: typeof ja): readonly string[] => namedRuleRun(RULE, source, adapter, "a.md", "legal/contract").findings;

  const JA =
    "# 経費規程\n\n## 第1条（提出）\n\n社員は、すべての経費の領収書を経理部に提出しなければならない。\n\n## 第2条（少額の経費）\n\n千円未満の経費は、領収書を経理部に提出する対象から除く。\n";

  it("reports the absolute rule in Japanese", () => {
    assert.deepEqual(findings(JA, ja), ["「すべて」と言い切っていますが、9 行目に同じ行為の例外（「除く」）があります"]);
  });

  it("reports the absolute rule in English", () => {
    const source =
      "# Expenses\n\n## 1. Receipts\n\nStaff must always send the receipt for each expense to the finance team.\n\n## 2. Small expenses\n\nStaff need not send the receipt to the finance team for an expense under ten dollars, except for travel.\n";
    assert.deepEqual(findings(source, en), ['This says "always", but line 9 makes an exception ("except") for the same act']);
  });

  it("reads an article nested in another as a unit of its own", () => {
    const source =
      "# Policy\n\n## 1. General\n\nStaff must always send the receipts to the finance team.\n\n### 1.1 Exception\n\nExcept for travel, staff send the receipts to the finance team later.\n";
    assert.equal(findings(source, en).length, 1);
  });

  it("leaves an exception in another paragraph of the same article", () => {
    const source =
      "# 経費規程\n\n第1条（提出）\n社員は、すべての経費の領収書を経理部に提出しなければならない。\n\n２　千円未満の経費は、領収書を経理部に提出する対象から除く。\n\n第2条（保管）\n経理部は、領収書を保管する。\n";
    assert.deepEqual(findings(source, ja), []);
  });

  it("leaves a permission: only must and must not are rules to break", () => {
    const source =
      "# 経費規程\n\n## 第1条（提出）\n\n社員は、すべての経費の領収書を経理部に提出することができる。\n\n## 第2条（少額の経費）\n\n千円未満の経費は、領収書を経理部に提出する対象から除く。\n";
    assert.deepEqual(findings(source, ja), []);
  });

  it("leaves a proviso in the same paragraph", () => {
    const source = "# 経費\n\n社員は、すべての経費の領収書を経理部に提出しなければならない。ただし、千円未満の経費の領収書は経理部に提出する対象から除く。\n";
    assert.deepEqual(findings(source, ja), []);
  });

  it("leaves a rule that carries its own exception", () => {
    const source =
      "# 経費規程\n\n## 第1条（提出）\n\n社員は、次条に定めるものを除き、すべての経費の領収書を経理部に提出しなければならない。\n\n## 第2条（少額の経費）\n\n千円未満の経費は、領収書を経理部に提出する対象から除く。\n";
    assert.deepEqual(findings(source, ja), []);
  });

  it("leaves an exception for another act", () => {
    const source =
      "# 経費規程\n\n## 第1条（提出）\n\n社員は、すべての経費の領収書を経理部に提出しなければならない。\n\n## 第2条（保管）\n\n経理部は、千円未満の経費を除き、領収書を保管する。\n";
    assert.deepEqual(findings(source, ja), []);
  });

  it("leaves words in quotation marks", () => {
    const source =
      "# 経費規程\n\n## 第1条（提出）\n\n社員は、「すべて」の経費の領収書を経理部に提出しなければならない。\n\n## 第2条（少額の経費）\n\n千円未満の経費は、領収書を経理部に提出する対象から除く。\n";
    assert.deepEqual(findings(source, ja), []);
  });

  it("does not run on literature: a character who says never and later bends is the story", () => {
    const result = runRules(buildDocument("a.md", JA, ja), loadRules("ja"), {}, true, "literature/fiction");
    assert.equal(result.skipped.find((entry) => entry.rule === RULE)?.why, REASONS.ja.presetOff("literature/fiction"));
  });
});
