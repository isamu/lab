import type { Texts } from "./ui.ts";

/** Why a rule did not run, in the document's language. Listed under the findings so "0 findings" is never a silent pass. */
export type Reasons = {
  readonly otherLanguage: (language: string) => string;
  readonly noCapability: (capability: string) => string;
  readonly noTags: string;
  readonly semantic: string;
  readonly experimental: string;
  readonly turnedOff: string;
  readonly noStructure: (language: string) => string;
  readonly noDetector: (name: string) => string;
  readonly noLexicon: (language: string, list: string) => string;
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
    semantic: "意味を読む検査のため（npx chaff test で動きます）",
    experimental: "まだ試験中のため",
    turnedOff: "設定で止めているため",
    noStructure: (language) => `${language} のパッケージは文書の構造を読めないため`,
    noDetector: (name) => `検出器 ${name} がないため`,
    noLexicon: (language, list) => `${language} の語彙表 ${list} が無いため`,
  },
  en: {
    otherLanguage: (language) => `not a rule for ${language}`,
    noCapability: (capability) => `${CAPABILITY_NAME.en[capability] ?? capability} is not available for this language`,
    noTags: "the language package returned no parts of speech",
    semantic: "it reads meaning; npx chaff test runs it",
    experimental: "still experimental",
    turnedOff: "turned off in the settings",
    noStructure: (language) => `the ${language} package cannot read a document's structure`,
    noDetector: (name) => `no detector named ${name}`,
    noLexicon: (language, list) => `the ${language} package has no word list ${list}`,
  },
};
