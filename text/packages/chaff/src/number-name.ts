import { hyphenGroups, isHyphen } from "./orthography.ts";
import type { Span, Token } from "./plugin.ts";

/**
 * 数量ではなく名前として書かれた数（番号・識別子）。鉤括弧で引いた「3.1 リサーチの原則」の節番号、※1 のような注の番号、
 * 「〒100-8916 東京都」の郵便番号、「紀尾井町1-3 東京ガーデンテラス」の番地は、後ろの空白が番号と題・項目の区切りで、「3回」「3 回」のような空け方の好みではない。
 * 空け方を数える材料にしない。
 *
 * 形で名前と読むのは五つだけ。0 で始まる組を含むハイフンつなぎの番号、※・〒や鉤括弧のすぐ後ろの番号、市・区・町まで下りた地名のすぐ後ろのハイフンつなぎの番号、
 * 文頭の階層つきの節番号（2.1、3.1.2）、続き番号になった行の頭の番号（白書の注）。文頭でも「223 言語」「1ターン」は数量なので、階層の無い数は文頭というだけでは名前と読まない。
 * そのうえで、すぐ後ろ（空白 1 つまで）の語が数につく語（助数詞・数・助詞・助動詞）なら数量として数え続ける（「3-5 日」「26.7 万行」）。
 * 品詞が無ければ判断せず、名前とは読まない。
 */

/** 数と結びついて読まれる語。助数詞は NounType=Class、数は NumType=Card で渡る。 */
const BOUND_TO_NUMBER = new Set(["ADP", "PART", "AUX", "SCONJ", "CCONJ"]);

/** 番号が立つ位置の直前: 題を包む鉤括弧、注の印、郵便番号の印。 */
const LABEL_LEAD = /[「『【※〒]$/u;

/** 文頭（前に空白と箇条書きの印だけ）。 */
const LINE_HEAD = /^[\s\-*+・•]*$/u;

/** 階層つきの節番号（2.1、3.1.2）。 */
const SECTION_NUMBER = /^\d+(?:\.\d+)+$/u;

/**
 * 0 で始まる組を含む、ハイフンでつないだ番号（〒102-0094、03-3501）。二つの数だけの「3-5」は範囲（3-5 営業日）とも読めるので
 * 数え続ける。三つ以上つないだもの（073-489-5909）は、orthography.ts が境目を作る前に外している。
 */
const isHyphenIdentifier = (digits: string): boolean => {
  const parts = hyphenGroups(digits);
  return parts.length > 1 && parts.some((part) => part.startsWith("0"));
};

const DIGIT_OR_POINT = /[\d.]/u;
const isRunChar = (char: string | undefined): boolean => DIGIT_OR_POINT.test(char ?? "") || isHyphen(char);

/** at を含む、数字・小数点・ハイフン（全角の「－」なども）の並び。at が並びの中に無ければ undefined。 */
export const digitRunAround = (text: string, at: number): Span | undefined => {
  if (!isRunChar(text[at])) return undefined;
  const startAt = (index: number): number => (index > 0 && isRunChar(text[index - 1]) ? startAt(index - 1) : index);
  const endAt = (index: number): number => (index < text.length && isRunChar(text[index]) ? endAt(index + 1) : index);
  return { start: startAt(at), end: endAt(at) };
};

/** 並びの後ろ（空白 1 つまで）で始まる語。 */
const wordAfter = (tokens: readonly Token[], text: string, run: Span, base: number): Token | undefined => {
  const next = text[run.end] === " " ? run.end + 1 : run.end;
  return tokens.find((token) => token.span.start === base + next);
};

const isBoundToNumber = (token: Token): boolean =>
  token.features?.["NounType"] === "Class" || token.features?.["NumType"] === "Card" || BOUND_TO_NUMBER.has(token.pos);

/** 「1 又は 2」の接続詞は数どうしをつなぐが、続き番号の注の本文は「31 ただし、…」のように接続詞でも始まる。 */
const CONJUNCTIONS = new Set(["CCONJ", "SCONJ"]);

/**
 * 白書の注（「9 首相に…」「10 日本経済新聞…」）のように、行の頭に階層の無い番号を置き、次の行の頭の番号が 1 つ大きいもの。
 * 一行だけ見ると「223 言語に対応」と区別がつかないので、前後の番号の行と続き番号になっているものだけを番号と読む。
 * 後ろが英字（「15 Federal Bureau…」）の行も並びには数える。値は行の頭の位置（文書全体の座標）。
 */
const NUMBERED_LINE = /^[ \t]*(?:[-*+][ \t]+)?(?<number>\d{1,3})[ \t]+\S/gmu;

export const sequenceLabelStarts = (text: string): ReadonlySet<number> => {
  const lines = [...text.matchAll(NUMBERED_LINE)].map((match) => {
    const number = match.groups?.["number"] ?? "";
    return { start: match.index + match[0].indexOf(number), value: Number(number) };
  });
  const continues = (index: number): boolean =>
    lines[index - 1]?.value === (lines[index]?.value ?? 0) - 1 || lines[index + 1]?.value === (lines[index]?.value ?? 0) + 1;
  return new Set(lines.flatMap((line, index) => (continues(index) ? [line.start] : [])));
};

const isGeoUnit = (token: Token): boolean => token.features?.["NameType"] === "GeoUnit";
const isPlaceWord = (token: Token): boolean => isGeoUnit(token) || token.features?.["NameType"] === "Geo";

/** end で終わる、間を空けずに続く地名と地名の単位（東京都千代田区紀尾井町）。近いほうから。 */
export const placeChainBefore = (tokens: readonly Token[], end: number): Token[] => {
  const last = tokens.find((token) => token.span.end === end && isPlaceWord(token));
  return last === undefined ? [] : [last, ...placeChainBefore(tokens, last.span.start)];
};

/**
 * 住所の番地（千代田区紀尾井町1-3、霞が関2-1）。都道府県より下の単位（市・区・町）まで下りた地名のすぐ後ろの、ハイフンつなぎの番号。
 * 地名だけ（北海道2-3 営業日）や都道府県まで（東京都2-3 営業日）の後ろは、地域ごとの範囲のことがあるので読まない。
 * ハイフンの無い数（千代田区23 番）も読まない。topUnits は都道府県の単位（語彙表 prefecture-unit）。
 */
const isAddressNumber = (text: string, run: Span, tokens: readonly Token[], base: number, topUnits: ReadonlySet<string>): boolean =>
  Array.from(text.slice(run.start, run.end)).some(isHyphen) &&
  placeChainBefore(tokens, base + run.start).some((token) => isGeoUnit(token) && !topUnits.has(token.surface));

/** ハイフンでつないだ識別子か、番号の立つ位置の番号か、文頭の節番号か。 */
const isNameShaped = (text: string, run: Span): boolean => {
  const [before, digits] = [text.slice(0, run.start), text.slice(run.start, run.end)];
  return isHyphenIdentifier(digits) || LABEL_LEAD.test(before) || (LINE_HEAD.test(before) && SECTION_NUMBER.test(digits));
};

/**
 * text の run が名前として書かれた数か。tokens は文書全体の座標で、base は text の先頭の位置。sequence は sequenceLabelStarts の結果、
 * topUnits は都道府県の単位。
 * 後ろの語が読めない（品詞が無い、語の切れ目が合わない）ときは、数量として数え続ける。
 */
export const isNumberName = (
  text: string,
  run: Span,
  tokens: readonly Token[] | undefined,
  base: number,
  sequence: ReadonlySet<number> = new Set(),
  topUnits: ReadonlySet<string> = new Set(),
): boolean => {
  const inSequence = sequence.has(base + run.start);
  if (tokens === undefined || !(inSequence || isNameShaped(text, run) || isAddressNumber(text, run, tokens, base, topUnits))) return false;
  const next = wordAfter(tokens, text, run, base);
  if (next === undefined) return false;
  return !isBoundToNumber(next) || (inSequence && CONJUNCTIONS.has(next.pos));
};
