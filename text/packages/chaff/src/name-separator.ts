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
const FIELD_LABEL = /^[ \t]*(?:[-*+][ \t]+)?[^\s：:。\d]{1,12}[：:][ \t\u3000]*/u;

/** 文の終わり。値を文で書いた行（会場：本社 5階で行います。）の空白は、文の中の空け方として数える。 */
const SENTENCE_END = /[。！？]/u;

/** 値を句で書いた行（目標：参加者 100人を想定）に出る品詞。名前と番号を並べた値には出ない。 */
const CLAUSE_POS = new Set(["VERB", "AUX", "ADP"]);

/** 数の前に書いて量の一部になる語（約 3 か月、およそ 3 日、全 5 店舗）や、文の中の語（本社は 5階）の品詞。 */
const QUANTITY_LEAD_POS = new Set(["ADJ", "ADV", "ADP", "AUX", "VERB", "SCONJ", "PART"]);

/** 値の組の最も短い長さ。1 字の語（計 5件）は量の前置き。 */
const MIN_PART_LENGTH = 2;

/** 組を囲む字（括弧・表の升目の線）。組が囲みの中で読点で並ぶこともある（電話 03-1234-5678、内線 3839）。 */
const LAST_ENCLOSURE_OPEN = /[（(｜|][^（(｜|]*$/u;
const ENCLOSURE_CLOSE = /[）)｜|]/u;

/** 組と組を分ける読点。数の桁の区切り（1,000）のコンマは除く。 */
const PAIR_COMMA = /[、，]|(?<!\d),|,(?!\d)/gu;

/** 行の頭の字下げと箇条書きの印（「- 」「1. 」）。 */
const PAIR_LEAD = /^[ \t\u3000]*(?:(?:[-*+]|\d{1,3}[.．)）])[ \t\u3000]+)?/u;

/** 項目名: 空白・数字・区切りの字を含まない短い語。値: 数字で始まり、空白も区切りも文の終わりも含まない一続き（桁の区切りのコンマは含む）。 */
const PAIR_LABEL = /^[^\s\d、，,（）()｜|：:。！？]{2,12}$/u;
const PAIR_VALUE = /^\d(?:[^\s、，,（）()｜|。！？]|(?<=\d),(?=\d))*$/u;

/** 項目名に出る品詞。名詞だけで、助詞・副詞（およそ）・接頭の語（約）を含めば、量の前置きか文。 */
const PAIR_LABEL_POS = new Set(["NOUN", "PROPN"]);

const SPACE_RUN = /^[ \t\u3000]*/u;

/** at を含む囲み: 括弧か表の升目の線の内側、無ければ行（字下げと箇条書きの印の後ろ）。 */
const enclosureAround = (text: string, line: Span, at: number): Span => {
  const open = LAST_ENCLOSURE_OPEN.exec(text.slice(line.start, at));
  const start = open === null ? line.start + (PAIR_LEAD.exec(text.slice(line.start, line.end))?.[0].length ?? 0) : line.start + open.index + 1;
  const close = text.slice(at, line.end).search(ENCLOSURE_CLOSE);
  return { start, end: close === -1 ? line.end : at + close };
};

/** 囲みの中で at を含む組。読点で区切り、前後の空白を除く。 */
const pairAround = (text: string, enclosure: Span, at: number): Span => {
  const commas = [...text.slice(enclosure.start, enclosure.end).matchAll(PAIR_COMMA)].map((match) => enclosure.start + match.index);
  const rawStart = (commas.filter((comma) => comma < at).at(-1) ?? enclosure.start - 1) + 1;
  const rawEnd = commas.find((comma) => comma > at) ?? enclosure.end;
  const start = rawStart + (SPACE_RUN.exec(text.slice(rawStart, at))?.[0].length ?? 0);
  return { start, end: rawStart + text.slice(rawStart, rawEnd).trimEnd().length };
};

/**
 * 「最高速度 40km/h」「（内線 3839～40）」「- 定員 30名」のように、短い項目名と、それが名指す値を空白一つで並べただけの組の、名と値のあいだの空白。
 * 組は行・括弧の中・表の升目にそれだけで書くか、読点で並べる。項目の区切りで、文の中の空け方ではない。
 * 囲みの中に助詞や動詞がある（定員 30名で行います、参加者 30名、来場者50名を見込みます）、値の後ろに語が続く（内線 3839 まで）、
 * 項目名が 1 字（約 30名）か名詞でない語を含む組は、文の中の空白として数える。
 */
const isLabelledValue = (text: string, boundary: Boundary, tokens: readonly Token[], base: number): boolean => {
  const enclosure = enclosureAround(text, lineAround(text, boundary.offset), boundary.offset);
  const pair = pairAround(text, enclosure, boundary.offset);
  const label = { start: pair.start, end: boundary.offset };
  if (!PAIR_LABEL.test(text.slice(label.start, label.end)) || !PAIR_VALUE.test(text.slice(boundary.offset + 1, pair.end))) return false;
  if (SENTENCE_END.test(text.slice(enclosure.start, enclosure.end))) return false;
  const labelTokens = tokensIn(tokens, label, base);
  return (
    labelTokens.length > 0 &&
    labelTokens.every((token) => PAIR_LABEL_POS.has(token.pos)) &&
    !tokensIn(tokens, enclosure, base).some((token) => CLAUSE_POS.has(token.pos))
  );
};

/** 項目名とコロンの後ろに値の組を並べた行の、組と、数で始まる次の組のあいだの空白か。 */
const isColonFieldPart = (text: string, boundary: Boundary, tokens: readonly Token[], base: number): boolean => {
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
 * 項目と値を分ける空白。「所属：経済学部 経済学科 1年」「振込先：みなと銀行 普通 1234567」のように項目名とコロンの後ろに値の組を並べた行の組と組のあいだか、
 * 「最高速度 40km/h」「（内線 3839）」のように短い項目名と値を並べただけの組の、名と値のあいだ。値の区切りで、日本語と数字のあいだの空け方ではない。
 * boundary は空けた数字の前の境目（text[offset] が空白）。tokens は文書全体の座標で、base は text の先頭の位置。
 */
export const isFieldSeparator = (text: string, boundary: Boundary, tokens: readonly Token[] | undefined, base: number): boolean => {
  if (tokens === undefined || boundary.kind !== "before-digit" || !boundary.spaced) return false;
  return isColonFieldPart(text, boundary, tokens, base) || isLabelledValue(text, boundary, tokens, base);
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
