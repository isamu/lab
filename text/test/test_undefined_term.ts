import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { undefinedTerms, type TermWords } from "../packages/chaff/src/detectors/undefined-term.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Token } from "../packages/chaff/src/plugin.ts";

// undefined-term: a Japanese term written with the document's prefix for defined terms (本成果物) that the document
// defines nowhere. Self-written text.

const termsIn = (adapter: LanguageAdapter, source: string, genre = "legal/contract"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === "undefined-term")
    .map((finding) => String(finding.values["term"]));

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const HEAD = ["# 業務委託契約書", "", "第1条　甲は、ウェブサイトの保守の業務（以下「本業務」という。）を乙に委託する。", ""];
const ja_ = (...lines: string[]): string => [...HEAD, ...lines, ""].join("\n");

describe("undefined-term", () => {
  it("reports a term in the defined form that the document never defines, once", () => {
    assert.deepEqual(termsIn(ja, ja_("第2条　乙は、本成果物を甲に提出する。", "", "第3条　甲は、本成果物を検査する。")), ["本成果物"]);
    assert.deepEqual(termsIn(ja, ja_("第2条　本規約は、本アプリの利用に適用する。")), ["本アプリ"]);
  });

  it("does not report defined terms, their other-prefix forms, or terms that start with one", () => {
    assert.deepEqual(termsIn(ja, ja_("第2条　乙は、本業務を誠実に行う。")), []);
    assert.deepEqual(termsIn(ja, ja_("第2条　乙は、本件業務を誠実に行う。")), []);
    assert.deepEqual(termsIn(ja, ja_("第2条　乙は、本業務上知り得た情報を守る。")), []);
  });

  it("does not report the document's names for itself and its parts, quoted terms, or single words", () => {
    assert.deepEqual(termsIn(ja, ja_("第2条　本条及び本項の定めは、本契約の終了後も効力を有する。")), []);
    assert.deepEqual(termsIn(ja, ja_("第2条　本利用規約と本サイトの定めに従う。")), []);
    assert.deepEqual(termsIn(ja, ja_("第2条　乙が作成した情報（以下、本条において「本情報」といいます。）は、本情報として扱う。")), []);
    assert.deepEqual(termsIn(ja, ja_("第2条　本人は、本日、本社に出向く。")), []);
  });

  it("does not read a document that defines no term with the prefix, nor outside the contract genres, nor English", () => {
    assert.deepEqual(termsIn(ja, "第1条　甲は、業務（以下「対象業務」という。）を委託する。\n\n第2条　乙は、本成果物を提出する。\n"), []);
    assert.deepEqual(termsIn(ja, ja_("第2条　本件建物を明け渡す。"), "legal/judgment"), []);
    assert.deepEqual(termsIn(ja, ja_("第2条　乙は、本成果物を甲に提出する。"), "business/report"), []);
    const english = ['1. The Supplier provides the services (the "Services").', "", "2. The Customer and its Affiliates may use the Services.", ""].join("\n");
    assert.deepEqual(termsIn(en, english), []);
  });
});

describe("undefinedTerms", () => {
  const token = (surface: string, pos: string, start: number): Token => ({ surface, pos, span: { start, end: start + surface.length } });
  /** Tokens for a run of [surface, pos] pairs written one after the other from 0. */
  const tokens = (...parts: [string, string][]): Token[] =>
    parts.reduce<Token[]>((all, [surface, pos]) => [...all, token(surface, pos, all.at(-1)?.span.end ?? 0)], []);
  const words = (overrides: Partial<TermWords> = {}): TermWords => ({
    prefixes: ["本", "本件"],
    prefixGroups: [["本", "本件"]],
    selfNouns: ["条", "契約"],
    isQuoted: () => false,
    ...overrides,
  });
  const SOURCE = "本成果物を出す";
  const SENTENCE = tokens(["本", "ADJ"], ["成果", "NOUN"], ["物", "NOUN"], ["を", "ADP"], ["出す", "VERB"]);

  it("reads the prefix and the nouns right after it, and reports each term's first use", () => {
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本業務"], words()), [{ offset: 0, term: "本成果物" }]);
    assert.deepEqual(undefinedTerms(`${SOURCE}${SOURCE}`, [SENTENCE, SENTENCE], ["本業務"], words()).length, 1);
  });

  it("reads nothing where the document defines no term with a prefix, or the prefix is not followed by a noun", () => {
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["対象業務"], words()), []);
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本"], words()), []);
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本人", "本日"], words()), []);
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本人", "本業務"], words()).length, 1);
    const inWord = [token("基", "NOUN", 0), token("本", "ADJ", 1), token("成果", "NOUN", 2)];
    assert.deepEqual(undefinedTerms("基本成果", [inWord], ["本業務"], words()), []);
    const afterSpace = [token("基", "NOUN", 0), token("本", "ADJ", 2), token("成果", "NOUN", 3)];
    assert.deepEqual(undefinedTerms("基 本成果", [afterSpace], ["本業務"], words()), [{ offset: 2, term: "本成果" }]);
    assert.deepEqual(undefinedTerms("本を出す", [tokens(["本", "NOUN"], ["を", "ADP"], ["出す", "VERB"])], ["本業務"], words()), []);
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本業務"], words({ prefixes: [""] })), []);
    assert.deepEqual(undefinedTerms("", [], ["本業務"], words()), []);
  });

  it("stops the term at a gap between nouns", () => {
    const gapped = [token("本", "ADJ", 0), token("成果", "NOUN", 1), token("物", "NOUN", 4)];
    assert.deepEqual(undefinedTerms("本成果 物", [gapped], ["本業務"], words()), [{ offset: 0, term: "本成果" }]);
  });

  it("leaves defined terms, their other-prefix forms, longer and shorter forms, self names and quoted terms", () => {
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本成果物"], words()), []);
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本件成果物"], words()), []);
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本成果"], words()), []);
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本成果物一覧"], words()), []);
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本業務"], words({ selfNouns: ["物"] })), []);
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本業務"], words({ selfNouns: ["成果"] })), []);
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本業務"], words({ selfNouns: [""] })).length, 1);
    assert.deepEqual(undefinedTerms(SOURCE, [SENTENCE], ["本業務"], words({ isQuoted: (term) => term === "本成果物" })), []);
  });
});
