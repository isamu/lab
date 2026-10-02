import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { formOf, itemSentences } from "../packages/chaff/src/detectors/list-parallel.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// list-item-form-mix: one list whose items do not share a form. Every example is self-written.

const RULE = "list-item-form-mix";

const findingsOf = (adapter: LanguageAdapter, source: string, genre = "blog/tech"): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.filter((finding) => finding.rule === RULE);

const flagged = (adapter: LanguageAdapter, source: string, genre?: string): string[] =>
  findingsOf(adapter, source, genre).map((finding) => `${finding.variant ?? ""}:${String(finding.values["written"])}`);

const list = (...items: string[]): string => ["# 題", "", ...items.map((item) => "- " + item), ""].join("\n");

/** The form of the only item in a one-item list, as the detector reads it. */
const formOfItem = (adapter: LanguageAdapter, axis: "ending" | "head", item: string): string | undefined => {
  const doc = buildDocument("t.md", `- ${item}\n`, adapter);
  const span = doc.lists[0]?.itemSpans[0];
  return span === undefined ? undefined : formOf(axis, itemSentences(doc, span), adapter.id);
};

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("formOf: how an item ends (Japanese)", () => {
  const cases: readonly (readonly [string, string | undefined])[] = [
    ["申込書を出します。", "sentence"],
    ["支払いを済ませる", "sentence"],
    ["画面が速い", "sentence"],
    ["期限は月末", "phrase"],
    ["書類を確認すること", "phrase"],
    ["手数料の支払い", "phrase"],
    ["健康診断書（3か月以内に受診したものに限る）", "phrase"],
    ["書類を出す（郵送でもよい）", "sentence"],
    ["東京や大阪など", undefined],
  ];
  cases.forEach(([item, form]) => {
    it(`${item} → ${String(form)}`, () => assert.equal(formOfItem(ja, "ending", item), form));
  });
  it("has no head axis", () => assert.equal(formOfItem(ja, "head", "申込書を出します。"), undefined));
});

describe("formOf: how an item ends and opens (English)", () => {
  const endings: readonly (readonly [string, string | undefined])[] = [
    ["The team writes the docs.", "sentence"],
    ["Run the tests. Then deploy.", "sentence"],
    ["Fast startup", "phrase"],
    ["Smaller downloads", "phrase"],
    ["Running tests is easy", undefined],
    ["Fast startup.", undefined],
  ];
  endings.forEach(([item, form]) => {
    it(`ending: ${item} → ${String(form)}`, () => assert.equal(formOfItem(en, "ending", item), form));
  });
  const heads: readonly (readonly [string, string | undefined])[] = [
    ["Install the package", "verb"],
    ["Running the tests", "verb"],
    ["Generated files in the folder", undefined],
    ["The configuration file", "noun"],
    ["Smaller downloads", "noun"],
    ["Fast startup", undefined],
    ["Cover Letter", undefined],
    ["Design the courseware", undefined],
  ];
  heads.forEach(([item, form]) => {
    it(`head: ${item} → ${String(form)}`, () => assert.equal(formOfItem(en, "head", item), form));
  });
});

describe("itemSentences: an item's own text, without a list nested in it", () => {
  it("leaves out the nested items", () => {
    const doc = buildDocument("t.md", "- Install the package\n  - first nested\n  - second nested\n- Run it\n", en);
    const outer = doc.lists.find((entry) => entry.itemSpans.length === 2);
    const first = outer?.itemSpans[0];
    assert.ok(first !== undefined);
    assert.deepEqual(
      itemSentences(doc, first).map((sentence) => sentence.text),
      ["Install the package"],
    );
  });
});

describe("list-item-form-mix: the minority form in one list", () => {
  it("reports a sentence among noun phrases (ja)", () =>
    assert.deepEqual(flagged(ja, list("申込書の記入", "本人確認書類の用意", "手数料を払う")), ["ending-sentence:手数料を払う"]));

  it("reports a noun phrase among sentences (ja)", () =>
    assert.deepEqual(flagged(ja, list("毎朝ログを確認する", "週に一度バックアップを取る", "月末の請求書の発行")), ["ending-phrase:月末の請求書の発行"]));

  it("reports a noun-first item among verb-first ones (en)", () =>
    assert.deepEqual(flagged(en, list("Install the command-line tool", "Create an account on the website", "The configuration file in your home folder")), [
      "head-noun:The configuration file in your home folder",
    ]));

  it("reports a sentence among phrases (en)", () =>
    assert.deepEqual(flagged(en, list("Faster downloads", "Smaller files", "The settings page has been redesigned.")), [
      "ending-sentence:The settings page has been redesigned.",
    ]));

  it("says how many items are in the minority, of how many", () => {
    const finding = findingsOf(ja, list("申込書の記入", "本人確認書類の用意", "手数料を払う"))[0];
    assert.equal(finding?.values["count"], 1);
    assert.equal(finding?.values["of"], 3);
    assert.equal(finding?.line, 5);
  });

  it("does not report a list in one form", () => assert.deepEqual(flagged(ja, list("申込書の記入", "本人確認書類の用意", "手数料の支払い")), []));

  it("does not report a list of two", () => assert.deepEqual(flagged(ja, list("申込書の記入", "手数料を払う")), []));

  it("does not report a list that uses both forms evenly", () =>
    assert.deepEqual(flagged(ja, list("申込書の記入", "本人確認書類を用意する", "手数料の支払い", "結果を待つ")), []));

  it("does not judge labelled items, one-word items or items with code", () => {
    assert.deepEqual(flagged(ja, list("期限：月末", "申込書の記入", "本人確認書類の用意", "手数料を払う。")), ["ending-sentence:手数料を払う。"]);
    assert.deepEqual(flagged(en, list("Resume", "Install the tool", "Create an account")), []);
    assert.deepEqual(flagged(ja, list("`npm install` を実行する", "申込書の記入", "本人確認書類の用意")), []);
  });

  it("does not judge a labelled item or a one-word item, which would otherwise be the odd one", () => {
    assert.deepEqual(flagged(ja, list("申込書を出す", "書類を送る", "結果を待つ", "期限：月末")), []);
    assert.deepEqual(flagged(ja, list("申込書を出す", "書類を送る", "結果を待つ", "完了")), []);
  });

  it("does not report a list that is one sentence split into items", () =>
    assert.deepEqual(flagged(en, `# T\n\nYou must give:\n\n- your full name,\n- the address of your office, And\n- you sign the form.\n`), []));

  it("does not report a quoted list", () => assert.deepEqual(flagged(ja, "# 題\n\n> - 申込書の記入\n> - 本人確認書類の用意\n> - 手数料を払う\n"), []));

  it("does not run in minutes or a contract", () => {
    const source = list("申込書の記入", "本人確認書類の用意", "手数料を払う");
    assert.deepEqual(flagged(ja, source, "business/meeting-notes"), []);
    assert.deepEqual(flagged(ja, source, "legal/contract"), []);
  });
});
