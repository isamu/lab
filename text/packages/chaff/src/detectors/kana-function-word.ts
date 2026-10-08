import type { Detector, Finding, Lexicon, LexiconEntry, Token } from "../plugin.ts";

// A helper verb or formal noun written in kanji where a style writes it in kana (見て下さい → 見てください). The word
// list says which words and how each is told apart from its main use (資料を下さい, 本を置く, 事が起きる); this file
// reads that off the tagger's marks. Pure: the tokens and the word list come in.

export type KanaSpelling = { readonly written: string; readonly preferred: string; readonly offset: number };

const TE_FORM = new Set(["て", "で"]);

const followsTeForm = (previous: Token | undefined): boolean => previous?.pos === "SCONJ" && TE_FORM.has(previous.surface);

const isBound = (token: Token): boolean => token.features?.["Bound"] === "Yes";

const isFormalNoun = (token: Token): boolean => token.features?.["NounType"] === "Dependent";

const TOPIC = "は";
const CASE_NI = "に";

/** 〜時は and 〜時には: a condition. 〜時から, 〜時に (a point in time) are not. */
const beforeTopic = (tokens: readonly Token[], index: number): boolean =>
  tokens[index + 1]?.surface === TOPIC || (tokens[index + 1]?.surface === CASE_NI && tokens[index + 2]?.surface === TOPIC);

/** Whether the word at index is used as the list's group says: a helper after て, a formal noun, a condition (〜時は, 〜時には). */
const usedAsFunctionWord = (group: string | undefined, tokens: readonly Token[], index: number): boolean => {
  const token = tokens[index];
  if (token === undefined) return false;
  if (group === "auxiliary") return isBound(token) || followsTeForm(tokens[index - 1]);
  if (group === "after-te") return followsTeForm(tokens[index - 1]);
  if (group === "formal-noun") return isFormalNoun(token);
  if (group === "conditional") return isFormalNoun(token) && beforeTopic(tokens, index);
  return false;
};

const KANJI = /^\p{Script=Han}+/u;

/** The written word with its kanji stem in kana: 下さい with 下さる → くださる gives ください. Undefined when the entry or the word does not fit. */
export const inKana = (written: string, entry: LexiconEntry): string | undefined => {
  const stem = KANJI.exec(entry.pattern)?.[0];
  const rewrite = entry.rewrite;
  if (stem === undefined || rewrite === undefined || !written.startsWith(stem)) return undefined;
  const okurigana = entry.pattern.slice(stem.length);
  if (!rewrite.endsWith(okurigana)) return undefined;
  return `${rewrite.slice(0, rewrite.length - okurigana.length)}${written.slice(stem.length)}`;
};

const entryFor = (token: Token, lexicon: Lexicon): LexiconEntry | undefined =>
  lexicon.find((entry) => entry.pattern === token.lemma && token.surface.startsWith(entry.pattern.charAt(0)));

/** Each word in the tokens that the word list writes in kana, used as its group says. */
export const kanaSpellingsIn = (tokens: readonly Token[], lexicon: Lexicon): KanaSpelling[] =>
  tokens.flatMap((token, index) => {
    const entry = entryFor(token, lexicon);
    if (entry === undefined || !usedAsFunctionWord(entry.group, tokens, index)) return [];
    const preferred = inKana(token.surface, entry);
    return preferred === undefined ? [] : [{ written: token.surface, preferred, offset: token.span.start }];
  });

export const kanaFunctionWord: Detector = (doc, options): Finding[] => {
  const lexicon = options.lexicon ?? [];
  const found = doc.sentences.flatMap((sentence) => kanaSpellingsIn(sentence.tokens ?? [], lexicon).map((spelling) => ({ sentence, spelling })));
  if (found.length < options.limit) return [];
  return found.map(({ sentence, spelling }) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: sentence.text.trim(),
    values: { matched: spelling.written, preferred: spelling.preferred, offset: spelling.offset },
  }));
};
