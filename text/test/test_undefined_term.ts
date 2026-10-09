import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { undefinedTerms, type TermWords } from "../packages/chaff/src/detectors/undefined-term.ts";
import { capitalisedTerms, namedWords, readableText, setApartSpans, type CapitalisedInput } from "../packages/chaff/src/detectors/capitalised-term.ts";
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

  it("does not read a document that defines no term with the prefix, nor outside the contract genres", () => {
    assert.deepEqual(termsIn(ja, "第1条　甲は、業務（以下「対象業務」という。）を委託する。\n\n第2条　乙は、本成果物を提出する。\n"), []);
    assert.deepEqual(termsIn(ja, ja_("第2条　本件建物を明け渡す。"), "legal/judgment"), []);
    assert.deepEqual(termsIn(ja, ja_("第2条　乙は、本成果物を甲に提出する。"), "business/report"), []);
  });
});

const EN_HEAD = [
  "# Services Agreement",
  "",
  'This Services Agreement (this "Agreement") is made between Harbour Works Ltd (the "Supplier") and Northwind Retail Inc. (the "Customer").',
  "",
  '1.1 The Supplier shall provide the hosting services described in Schedule A (the "Services").',
  "",
];
const en_ = (...lines: string[]): string => [...EN_HEAD, ...lines.flatMap((line) => [line, ""])].join("\n");

describe("undefined-term in English", () => {
  it("reports a capitalised term used inside a sentence that the document never defines, once", () => {
    assert.deepEqual(termsIn(en, en_("1.2 The Supplier shall provide the Services to the Customer and its Affiliates.")), ["Affiliates"]);
    const twice = en_("1.2 Each party may disclose Proprietary Data to the other.", "1.3 Each party shall protect Proprietary Data.");
    assert.deepEqual(termsIn(en, twice), ["Proprietary Data"]);
  });

  it("does not read a document with fewer than two definitions written with a defining word, nor outside the contract genres", () => {
    const one = ['1. The Supplier provides the services (the "Services").', "", "2. The Customer and its Affiliates may use the Services.", ""].join("\n");
    assert.deepEqual(termsIn(en, one), []);
    const bare = ['1. Harbour Works Ltd ("Harbour") serves Northwind ("Northwind").', "", "2. Harbour serves Northwind and its Affiliates.", ""].join("\n");
    assert.deepEqual(termsIn(en, bare), []);
    assert.deepEqual(termsIn(en, en_("1.2 The Customer and its Affiliates may use the Services."), "business/report"), []);
  });

  it("does not report defined, quoted or bold terms in any case or number, nor runs holding one", () => {
    assert.deepEqual(termsIn(en, en_("1.2 The Customer and its customers may use the Services and the Customer Portal.")), []);
    assert.deepEqual(termsIn(en, en_('"Affiliate" means an entity that controls a party.', "1.2 The Customer and its Affiliates may use the Services.")), []);
    assert.deepEqual(termsIn(en, en_("1.2 The Supplier keeps the **Security Measures** in force.", "1.3 The Supplier may change the Security Measures.")), []);
    assert.deepEqual(
      termsIn(en, en_('1.2 A "Commercial AI System" may not use the Services.', "1.3 The Customer may not resell any Commercial AI System.")),
      [],
    );
    assert.deepEqual(termsIn(en, en_('"Third-Party Platform" means a service run by another.', "1.2 The Customer may connect Third-Party Platforms.")), []);
  });

  it("does not report names: laws, bodies, places, parties, weekdays, the Internet", () => {
    const names = [
      "1.2 The Supplier complies with the Federal Trade Commission Act and the Department of Commerce rules.",
      "1.3 This Agreement is governed by the laws of the State of New York and of California.",
      "1.4 The Supplier is not liable for an outage of the Internet, and the Vendor shall report on Monday.",
      "1.5 The Supplier and the Customer, together the Parties, agree to these terms.",
    ];
    assert.deepEqual(termsIn(en, en_(...names)), []);
  });

  it("counts a lower-case use only where a reader sees it, not in a link's destination", () => {
    const linked = en_("1.2 See the [setup guide](https://example.com/admin-portal).", "1.3 The Customer may use the Admin Portal.");
    assert.deepEqual(termsIn(en, linked), ["Admin Portal"]);
    const readable = readableText("[a](https://x.example/b) and <https://y.example> c");
    assert.equal(readable.length, "[a](https://x.example/b) and <https://y.example> c".length);
    assert.equal(readable.replaceAll(/\s+/gu, " "), "[a and c");
  });

  it("does not report references, a word at a sentence start or after a mark, a modifier, or a word also written in lower case", () => {
    assert.deepEqual(termsIn(en, en_("1.2 Section 4.1 and Sections 2 and 3 survive, as does Schedule B.")), []);
    assert.deepEqual(termsIn(en, en_("Upon notice, the Supplier stops.", "1.2 A breach of Section 3 (Accounts) ends the Services.")), []);
    assert.deepEqual(termsIn(en, en_("1.2 The Customer may buy the Premium plan.")), []);
    assert.deepEqual(termsIn(en, en_("1.2 The Customer may close its account.", "1.3 The Customer is responsible for its Account.")), []);
  });

  it("does not report what markup sets apart: headings, links, tables, list labels, HTML elements", () => {
    const marked = [
      "## 2. Fees for the Hosting Plan",
      "1.2 The Customer may [read the Usage Guide](https://example.com/guide).",
      "| Fee | Amount |\n| --- | --- |\n| the Hosting Fee | $10 |",
      "- the Support Desk: open on weekdays.",
      '1.3 The Customer may contact the <span class="x">Help Center</span>.',
    ];
    assert.deepEqual(termsIn(en, en_(...marked)), []);
  });
});

describe("capitalisedTerms", () => {
  const token = (surface: string, pos: string, start: number): Token => ({ surface, pos, span: { start, end: start + surface.length } });
  /** Tokens for the words of a source split at spaces, with a part of speech by word. */
  const sentence = (source: string, pos: Readonly<Record<string, string>> = {}): Token[] =>
    [...source.matchAll(/\S+/gu)].map((match) => token(match[0], pos[match[0]] ?? "X", match.index));
  const DEFINED = [{ term: "Services" }, { term: "Customer" }];
  const WORDS = { names: ["Act"], divisions: ["Section"], joiners: ["of"] };
  const terms = (source: string, overrides: Partial<CapitalisedInput> = {}): string[] =>
    capitalisedTerms({
      source,
      readable: source,
      sentences: [sentence(source, { plan: "NOUN" })],
      defined: DEFINED,
      named: [],
      marked: [],
      words: WORDS,
      ...overrides,
    }).map((use) => use.term);

  it("reads a run of capitalised words, joined across a joiner, after a lower-case word", () => {
    assert.deepEqual(terms("to its Affiliates ."), ["Affiliates"]);
    assert.deepEqual(terms("under the Statement of Work ."), ["Statement of Work"]);
    assert.deepEqual(terms("Affiliates may ."), []);
    assert.deepEqual(terms("( Affiliates ) may ."), []);
    assert.deepEqual(terms("the Premium plan ."), []);
    assert.deepEqual(terms(""), []);
  });

  it("needs two definitions with a defining word", () => {
    assert.deepEqual(terms("to its Affiliates .", { defined: [{ term: "Services" }] }), []);
    assert.deepEqual(terms("to its Affiliates .", { defined: [{ term: "Services" }, { term: "GPC", bare: true }] }), []);
    assert.deepEqual(terms("to its Affiliates .", { defined: [{ term: "Services" }, { term: "control" }] }), []);
  });

  it("leaves names, divisions, named, marked and lower-case words, and reports each term once", () => {
    assert.deepEqual(terms("under the Trade Act ."), []);
    assert.deepEqual(terms("under the Sections ."), []);
    assert.deepEqual(terms("to its Affiliates .", { named: ["Affiliate"] }), []);
    assert.deepEqual(terms("to its Affiliates .", { marked: [{ start: 7, end: 17 }] }), []);
    assert.deepEqual(terms("to its Affiliates and affiliates ."), []);
    assert.deepEqual(terms("to its Customer Services ."), []);
    assert.deepEqual(terms("to its Affiliates or its Affiliate ."), ["Affiliates"]);
  });
});

describe("setApartSpans and namedWords", () => {
  it("finds bold, HTML elements, table rows and list labels, and the words set in quotes or bold", () => {
    const source = '**Fees**. A <b>Hold</b> on "Account," and “**Cover Page**”.\n| a | b |\n- Term: one';
    assert.deepEqual(
      setApartSpans(source).map((span) => source.slice(span.start, span.end)),
      ["**Fees**", "**Cover Page**", "<b>Hold</b>", "| a | b |", "- Term:"],
    );
    assert.deepEqual(namedWords(source), ["Fees", "Cover Page", "Account", "Cover Page"]);
    assert.deepEqual(namedWords(""), []);
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
