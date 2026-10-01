import type { Texts } from "./ui.ts";
import { formFor } from "./render/plural.ts";

/** Why a rule did not run, in the document's language. Listed under the findings so "0 findings" is never a silent pass. */
export type Reasons = {
  readonly otherLanguage: (language: string) => string;
  readonly noCapability: (capability: string) => string;
  readonly noTags: string;
  readonly unreadTags: string;
  readonly semantic: string;
  readonly experimental: string;
  readonly turnedOff: string;
  readonly presetOff: (genre: string) => string;
  readonly noStructure: (language: string) => string;
  readonly unreadStructure: (clauses: number, units: number) => string;
  readonly noDetector: (name: string) => string;
  readonly noLexicon: (language: string, list: string) => string;
  readonly noHeadings: string;
  readonly patternTimeout: (budgetMs: number) => string;
  readonly notMarkdown: string;
};

const CAPABILITY_NAME: Texts<Readonly<Record<string, string>>> = {
  ja: { pos: "品詞解析", lemma: "原形" },
  en: { pos: "part-of-speech tagging", lemma: "lemmas" },
};

export const REASONS: Texts<Reasons> = {
  ja: {
    otherLanguage: (language) => `${language} 向けの rule ではないため`,
    noCapability: (capability) => `この言語では${CAPABILITY_NAME.ja[capability] ?? capability}が使えないため`,
    noTags: "アダプタが品詞を返さなかったため",
    unreadTags: "言語のパッケージがこの文書を読めなかったため（品詞の取れない段落があります）",
    semantic: "意味を読む検査のため（npx chaff test で動きます）",
    experimental: "まだ試験中のため",
    turnedOff: "設定で止めているため",
    presetOff: (genre) => `ジャンル ${genre} では見ないため`,
    noStructure: (language) => `${language} のパッケージは文書の構造を読めないため`,
    unreadStructure: (clauses, units) =>
      `条項の番号が本文に ${String(clauses)} 個あるのに、番号として読めたのは ${String(units)} 個のため（深い字下げや、行が本文につながった文書）`,
    noDetector: (name) => `検出器 ${name} がないため`,
    noLexicon: (language, list) => `${language} の語彙表 ${list} が無いため`,
    noHeadings: "表題より下の見出しが無いため",
    patternTimeout: (budgetMs) => `正規表現が ${String(budgetMs)} ms で終わらなかったため（chaff.yaml の pattern を単純にしてください）`,
    notMarkdown: "Markdown の文書ではないため",
  },
  en: {
    otherLanguage: (language) => `not a rule for ${language}`,
    noCapability: (capability) => `${CAPABILITY_NAME.en[capability] ?? capability} is not available for this language`,
    noTags: "the language package returned no parts of speech",
    unreadTags: "the language package could not read this document (some paragraphs have no parts of speech)",
    semantic: "it reads meaning; npx chaff test runs it",
    experimental: "still experimental",
    turnedOff: "turned off in the settings",
    presetOff: (genre) => `the ${genre} genre does not check it`,
    noStructure: (language) => `the ${language} package cannot read a document's structure`,
    unreadStructure: (clauses, units) =>
      `the text has ${String(clauses)} clause numbers but only ${String(units)} ${formFor(units, "was read as a numbered line", "were read as numbered lines")} (deep indents, or lines run into the text)`,
    noDetector: (name) => `no detector named ${name}`,
    noLexicon: (language, list) => `the ${language} package has no word list ${list}`,
    noHeadings: "the document has no headings below its title",
    patternTimeout: (budgetMs) => `the pattern did not finish within ${String(budgetMs)} ms (simplify the pattern in chaff.yaml)`,
    notMarkdown: "the document is not Markdown",
  },
};
