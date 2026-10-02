import type { Lexicon, NamedDocument } from "chaffjs/plugin";

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

/** 名前の後ろの括弧書きが収まる長さ。name-note の最も長い形（略称・公布の番号・「以下…という。」）が収まり、後ろ向きに読む長さを抑える。 */
const MAX_NOTE_LENGTH = 130;

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

/** 名前が種類の語で終わり、種類の語より長い（「民法」。「契約」だけではどの文書か決まらない）。 */
const endsWithKind = (name: string, kinds: readonly string[]): boolean => {
  const kind = kinds.find((candidate) => name.endsWith(candidate));
  return kind !== undefined && name.length > kind.length;
};

/**
 * reference の直前に書かれた文書名。「民法第709条」「民法の第709条」なら「民法」、「この規則の別表」「本規約第3条」ならこの文書（self）。
 * 名前が種類の語だけ（「契約第3条」）のときは、どの文書か決まらないので undefined にする。
 * 公布の番号を添えた名前（「…に関する基準(昭和五十八年厚生省告示第十四号)第二条」）は、種類の語が無くても文書の名前。
 */
export const namedDocument = (text: string, reference: number, vocabulary: CitationVocabulary): NamedDocument | undefined => {
  const afterName = beforeJoiner(text, reference, vocabulary.joiners);
  const at = beforeNote(text, afterName, vocabulary.notes);
  const plain = nameBefore(text, at, NAME_CHAR);
  const name = vocabulary.kanaTitleKinds.includes(plain) ? nameBefore(text, at, TITLE_CHAR) : plain;
  const self = namesThisDocument(text, at - name.length, name, vocabulary.selfPrefixes);
  if (self && vocabulary.kinds.some((kind) => name.endsWith(kind))) return { name, self };
  const numbered = at !== afterName && name !== "";
  if (!numbered && !endsWithKind(name, vocabulary.kinds)) return undefined;
  return { name, self };
};

/** reference の直前に書かれた他の文書の名前。この文書を指すか、名前が無ければ undefined。 */
export const citedDocument = (text: string, reference: number, vocabulary: CitationVocabulary): string | undefined => {
  const named = namedDocument(text, reference, vocabulary);
  return named === undefined || named.self ? undefined : named.name;
};

/** 自分を指す頭の語の長さの上限（この・本・当）。後ろ向きに読む長さを抑える。 */
const MAX_PREFIX_LENGTH = 4;

/** 名前が自分を指す頭の語で始まるか、そのすぐ前に仮名の頭の語がある（「この基準(…号)第9条」の「この」）。 */
const namesThisDocument = (text: string, nameStart: number, name: string, selfPrefixes: readonly string[]): boolean => {
  const lead = text.slice(Math.max(0, nameStart - MAX_PREFIX_LENGTH), nameStart);
  return selfPrefixes.some((prefix) => name.startsWith(prefix) || lead.endsWith(prefix));
};
