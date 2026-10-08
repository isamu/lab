import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { closedListWordsOf, openWordsOnClosedLists } from "../packages/chaff/src/nado-closed-list.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 「等」で開いた一覧を「限ります」で閉じている所（nado-closed-list）。例文は自作。

const RULE = "nado-closed-list";

const found = (source: string, adapter: LanguageAdapter, genre = "business/report"): number[] =>
  runRules(buildDocument("notice.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => finding.line);

const notice = (...lines: string[]): string => ["# お知らせ", "", ...lines, ""].join("\n");

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

describe("nado-closed-list", () => {
  it("ja: 「等」「など」のすぐ後ろの「に限り」「のみ」「だけ」を指す", () => {
    assert.deepEqual(found(notice("収集の対象は、家具、寝具及び自転車等に限ります。"), ja), [3]);
    assert.deepEqual(found(notice("本人確認の書類は、運転免許証及び健康保険証等のみ受け付けます。"), ja), [3]);
    assert.deepEqual(found(notice("申込みは、電話などに限ります。"), ja), [3]);
    assert.deepEqual(found(notice("対象は、市内の店舗等に限定します。"), ja), [3]);
    assert.deepEqual(found(notice("対象は、机、椅子等々に限ります。"), ja), [3]);
  });

  it("ja: 限らない言い方と、閉じていない一覧は指さない", () => {
    assert.deepEqual(found(notice("収集の対象は、家具、寝具及び自転車に限ります。"), ja), []);
    assert.deepEqual(found(notice("家具、寝具等に限らず、収集します。"), ja), []);
    assert.deepEqual(found(notice("家具等のみならず、家電も収集します。"), ja), []);
    assert.deepEqual(found(notice("家具等だけでなく、家電も収集します。"), ja), []);
    assert.deepEqual(found(notice("収集の対象は、家具、寝具等です。"), ja), []);
    assert.deepEqual(found(notice("対象は正社員等に限られません。"), ja), []);
    assert.deepEqual(found(notice("本人確認書類などのみでは手続きできません。"), ja), []);
    assert.deepEqual(found(notice("健康診査の結果等に限定されるものではなく、人間ドックの結果も該当する。"), ja), []);
  });

  it("ja: 語の一部の「等」と等級は指さない", () => {
    assert.deepEqual(found(notice("性能が同等に限ります。"), ja), []);
    assert.deepEqual(found(notice("賞品の交換は、1等に限ります。"), ja), []);
    assert.deepEqual(found(notice("機会は平等に限らず与えます。"), ja), []);
  });

  it("en: etc. right before only, or at the end of a list that only or limited to governs", () => {
    const en1 = (...lines: string[]): string => ["# Notice", "", ...lines, ""].join("\n");
    assert.deepEqual(found(en1("Collection covers furniture, bedding, bicycles, etc. only."), en), [3]);
    assert.deepEqual(found(en1("We accept only a driving licence, a health insurance card, etc. as proof of identity."), en), [3]);
    assert.deepEqual(found(en1("Entry is limited to residents, students and so on."), en), [3]);
  });

  it("en: not a list the limit governs, not a negated limit, not a closed list", () => {
    const en1 = (...lines: string[]): string => ["# Notice", "", ...lines, ""].join("\n");
    assert.deepEqual(found(en1("Collection covers furniture, bedding and bicycles only."), en), []);
    assert.deepEqual(found(en1("Only members may use the gym, the pool, etc."), en), []);
    assert.deepEqual(found(en1("It covers fees, including but not limited to tuition, books, etc."), en), []);
    assert.deepEqual(found(en1("It covers not only tuition, books, etc. but also travel."), en), []);
    assert.deepEqual(found(en1("Bring pens, paper, etc. Only one bag is allowed."), en), []);
    assert.deepEqual(found(en1("Only current employees, not only directors, officers, etc., are eligible."), en), []);
    assert.deepEqual(found(en1("A person employed only in private households (a cleaner, gardener, babysitter, etc.) is not counted."), en), []);
  });

  it("does not run in literature", () => {
    assert.deepEqual(found(notice("収集の対象は、家具、寝具及び自転車等に限ります。"), ja, "literature/fiction"), []);
  });
});

describe("openWordsOnClosedLists", () => {
  const words = closedListWordsOf([
    { pattern: "等", group: "open" },
    { pattern: "etc.", group: "open" },
    { pattern: "に限り", group: "limit", position: "after" },
    { pattern: "only", group: "limit", position: "after" },
    { pattern: "only", group: "limit", position: "before" },
    { pattern: "に限らず", group: "not-limit" },
    { pattern: "not only", group: "not-limit" },
  ]);

  it("reads the words by group and position", () => {
    assert.deepEqual(words, { open: ["等", "etc."], limitsAfter: ["に限り", "only"], limitsBefore: ["only"], notLimits: ["に限らず", "not only"] });
  });

  it("names the longest limit written", () => {
    const both = closedListWordsOf([
      { pattern: "etc.", group: "open" },
      { pattern: "only", group: "limit", position: "after" },
      { pattern: "only if", group: "limit", position: "after" },
    ]);
    assert.deepEqual(openWordsOnClosedLists("bikes, beds, etc. only if paid", [], both), [{ offset: 13, open: "etc.", limit: "only if" }]);
  });

  it("reads a Japanese open word only with tokens, which tell 等 from 同等", () => {
    assert.deepEqual(openWordsOnClosedLists("自転車等に限り受け付けます。", [], words), []);
  });

  it("finds a Latin open word with a limit after it, without tokens", () => {
    assert.deepEqual(openWordsOnClosedLists("bikes, beds, etc., only", [], words), [{ offset: 13, open: "etc.", limit: "only" }]);
    assert.deepEqual(openWordsOnClosedLists("only bikes, beds, etc.", [], words), [{ offset: 18, open: "etc.", limit: "only" }]);
  });

  it("gives nothing for empty, unrelated or negated text", () => {
    assert.deepEqual(openWordsOnClosedLists("", [], words), []);
    assert.deepEqual(openWordsOnClosedLists("自転車に限り受け付けます。", [], words), []);
    assert.deepEqual(openWordsOnClosedLists("自転車等に限らず受け付けます。", [], words), []);
    assert.deepEqual(openWordsOnClosedLists("not only bikes, beds, etc.", [], words), []);
    assert.deepEqual(openWordsOnClosedLists("only bikes etc.", [], words), []);
    assert.deepEqual(openWordsOnClosedLists("bikes, beds, etc.", [], closedListWordsOf([])), []);
  });

  it("reads etc. only as a whole word", () => {
    assert.deepEqual(openWordsOnClosedLists("onlyx, etcetera only", [], words), []);
  });
});
