import type { Lexicon } from "chaffjs/plugin";

// 他の文書を指す参照。「民法第709条」の第709条はこの文書の条ではない。どの語が文書の名前を作るかは語彙表が持つ。

export type CitationVocabulary = {
  /** 文書の種類の語。長いものから当てる。 */
  readonly kinds: readonly string[];
  /** 題名に平仮名を挟む種類。 */
  readonly kanaTitleKinds: readonly string[];
  /** 名前と番地のあいだに挟まる括弧書き。 */
  readonly notes: readonly RegExp[];
  /** 名前と番地を繋ぐ助詞（「前契約の第9条」の「の」）。 */
  readonly joiners: readonly string[];
  /** この文書自身を指す名前の頭。 */
  readonly selfPrefixes: readonly string[];
};

const patternsOf = (lexicon: Lexicon | undefined): string[] => (lexicon ?? []).map((entry) => entry.pattern);

export const citationVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): CitationVocabulary => ({
  kinds: patternsOf(lexicons["document-kind"]).toSorted((left, right) => right.length - left.length),
  kanaTitleKinds: patternsOf(lexicons["kana-title-kind"]),
  notes: patternsOf(lexicons["name-note"]).map((pattern) => new RegExp(`(?:${pattern})$`, "u")),
  joiners: patternsOf(lexicons["name-joiner"]),
  selfPrefixes: patternsOf(lexicons["self-prefix"]),
});

const NAME_CHAR = /[\p{Script=Han}\p{Script=Katakana}ー・A-Za-z0-9]/u;
const TITLE_CHAR = /[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}ー・A-Za-z0-9]/u;

/** 名前は長くても数十字。後ろ向きに読む長さを抑え、長い行で遅くならないようにする。 */
const MAX_NAME_LENGTH = 30;

/** 名前の後ろの括弧書きが収まる長さ。後ろ向きに読む長さを抑える。 */
const MAX_NOTE_LENGTH = 100;

const nameBefore = (text: string, at: number, char: RegExp): string => {
  let start = at;
  while (start > 0 && at - start < MAX_NAME_LENGTH && char.test(text[start - 1] ?? "")) start -= 1;
  return text.slice(start, at);
};

const beforeNote = (text: string, at: number, notes: readonly RegExp[]): number => {
  const window = text.slice(Math.max(0, at - MAX_NOTE_LENGTH), at);
  const note = notes.flatMap((pattern) => pattern.exec(window) ?? [])[0];
  return note === undefined ? at : at - note.length;
};

const beforeJoiner = (text: string, at: number, joiners: readonly string[]): number => {
  const joiner = joiners.find((candidate) => text.endsWith(candidate, at));
  return joiner === undefined ? at : at - joiner.length;
};

/**
 * reference の直前に書かれた文書名。「民法第709条」「民法の第709条」なら「民法」。この文書の条を指すなら undefined。
 * 名前が種類の語だけ（「契約第3条」）のときも、どの文書か決まらないので undefined にする。
 */
export const citedDocument = (text: string, reference: number, vocabulary: CitationVocabulary): string | undefined => {
  const at = beforeNote(text, beforeJoiner(text, reference, vocabulary.joiners), vocabulary.notes);
  const plain = nameBefore(text, at, NAME_CHAR);
  const name = vocabulary.kanaTitleKinds.includes(plain) ? nameBefore(text, at, TITLE_CHAR) : plain;
  const kind = vocabulary.kinds.find((candidate) => name.endsWith(candidate));
  if (kind === undefined || name.length === kind.length) return undefined;
  return vocabulary.selfPrefixes.some((prefix) => name.startsWith(prefix)) ? undefined : name;
};
