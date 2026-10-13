import type { Boundary } from "./orthography.ts";
import type { Span, Token } from "./plugin.ts";

/** 名前を空白で並べた行（署名・連絡先・所属の行）に出る品詞。助詞・動詞・助動詞・連体詞が一つでもあれば、その行は文。 */
const NAME_LINE_POS = new Set(["NOUN", "PROPN", "NUM", "PUNCT", "SYM"]);

/** units は部署・拠点・役目の名前を閉じる語（語彙表 organization-unit）、forms は会社の形の語（語彙表 company-form）。 */
export type OrganizationWords = { readonly units: ReadonlySet<string>; readonly forms: readonly string[] };

/** at を含む行の範囲。 */
const lineAround = (text: string, at: number): Span => {
  const end = text.indexOf("\n", at);
  return { start: text.lastIndexOf("\n", at - 1) + 1, end: end === -1 ? text.length : end };
};

/** 語を区切る空白。 */
const WORD_BREAKS = [" ", "\t", "\n", "\r", "\u00a0", "\u3000"];

/** end の前の、空白で区切った語の頭の位置。 */
const wordStart = (text: string, end: number): number => Math.max(...WORD_BREAKS.map((space) => text.slice(0, end).lastIndexOf(space))) + 1;

/** start からの、空白で区切った語の終わりの位置。 */
const wordEnd = (text: string, start: number): number =>
  Math.min(...WORD_BREAKS.map((space) => text.indexOf(space, start)).map((at) => (at === -1 ? text.length : at)));

/** span の中の語。tokens は文書全体の座標で、base は text の先頭の位置。 */
const tokensIn = (tokens: readonly Token[], span: Span, base: number): Token[] =>
  tokens.filter((token) => token.span.start >= base + span.start && token.span.end <= base + span.end);

/** 行の語がどれも名前の語か。品詞の無い行は名前の並びと読まない。 */
const isNameLine = (lineTokens: readonly Token[]): boolean => lineTokens.length > 0 && lineTokens.every((token) => NAME_LINE_POS.has(token.pos));

/** 空白で区切った語が、組織の名前か。最後の語が部署・拠点・役目の語（経営企画部、IR担当）か、会社の形の語で始まるか終わる（株式会社ABC）。 */
const isOrganizationName = (word: string, wordTokens: readonly Token[], words: OrganizationWords): boolean =>
  words.units.has(wordTokens.at(-1)?.surface ?? "") || words.forms.some((form) => word.length > form.length && (word.startsWith(form) || word.endsWith(form)));

/** 行の頭の項目名とコロン（所属：、振込先：）。項目名は空白も数字も含まない短い語。 */
const FIELD_LABEL = /^[ \t]*(?:[-*+][ \t]+)?[^\s：:。\d]{1,12}[：:][ \t　]*/u;

/** 文の終わり。値を文で書いた行（会場：本社 5階で行います。）の空白は、文の中の空け方として数える。 */
const SENTENCE_END = /[。！？]/u;

/** 値を句で書いた行（目標：参加者 100人を想定）に出る品詞。名前と番号を並べた値には出ない。 */
const CLAUSE_POS = new Set(["VERB", "AUX", "ADP"]);

/** 数の前に書いて量の一部になる語（約 3 か月、およそ 3 日、全 5 店舗）や、文の中の語（本社は 5階）の品詞。 */
const QUANTITY_LEAD_POS = new Set(["ADJ", "ADV", "ADP", "AUX", "VERB", "SCONJ", "PART"]);

/** 値の組の最も短い長さ。1 字の語（計 5件）は量の前置き。 */
const MIN_PART_LENGTH = 2;

/**
 * 「所属：経済学部 経済学科 1年」「物件：メゾンかえで 203号室」「振込先：みなと銀行 普通 1234567」のように、項目名とコロンの後ろに
 * 値の組を空白で並べた行で、組と、数で始まる次の組のあいだの空白。値の区切りで、日本語と数字のあいだの空け方ではない。
 * boundary は空けた数字の前の境目（text[offset] が空白）。tokens は文書全体の座標で、base は text の先頭の位置。
 */
export const isFieldSeparator = (text: string, boundary: Boundary, tokens: readonly Token[] | undefined, base: number): boolean => {
  if (tokens === undefined || boundary.kind !== "before-digit" || !boundary.spaced) return false;
  const line = lineAround(text, boundary.offset);
  const label = FIELD_LABEL.exec(text.slice(line.start, line.end));
  if (label === null || SENTENCE_END.test(text.slice(line.start, line.end))) return false;
  const valueStart = line.start + label[0].length;
  if (tokensIn(tokens, { start: valueStart, end: line.end }, base).some((token) => CLAUSE_POS.has(token.pos))) return false;
  const partStart = Math.max(wordStart(text, boundary.offset), valueStart);
  const partEnd = tokens.find((token) => token.span.end === base + boundary.offset);
  return boundary.offset - partStart >= MIN_PART_LENGTH && partEnd !== undefined && !QUANTITY_LEAD_POS.has(partEnd.pos);
};

/**
 * 「株式会社あおば電子 経営企画部 IR担当」「東京本社 PR室」のように、名前だけを空白で並べた行で、空白の両側がどちらも組織の名前のときの空白。
 * 名前と名前の区切りで、英字の前後の空け方ではない。文の中の空白（この IT システムは）や、組織の名前でない語のあいだ（生成AI 活用事例、Patch リリース）は区切りと読まない。
 * boundary は空けた英字の境目（text[offset] が空白）。tokens は文書全体の座標で、base は text の先頭の位置。
 */
export const isNameSeparator = (text: string, boundary: Boundary, tokens: readonly Token[] | undefined, base: number, words: OrganizationWords): boolean => {
  if (tokens === undefined || boundary.kind !== "letter" || !boundary.spaced) return false;
  const before = { start: wordStart(text, boundary.offset), end: boundary.offset };
  const after = { start: boundary.offset + 1, end: wordEnd(text, boundary.offset + 1) };
  const isName = (span: Span): boolean => isOrganizationName(text.slice(span.start, span.end), tokensIn(tokens, span, base), words);
  return isName(before) && isName(after) && isNameLine(tokensIn(tokens, lineAround(text, boundary.offset), base));
};
