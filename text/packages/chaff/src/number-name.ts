import type { Span, Token } from "./plugin.ts";

/**
 * 数量ではなく名前として書かれた数（番号・識別子）。鉤括弧で引いた「3.1 リサーチの原則」の節番号、※1 のような注の番号、
 * 「073-489-5912 ファックス」の電話番号は、後ろの空白が番号と題・項目の区切りで、「3回」「3 回」のような空け方の好みではない。
 * 空け方を数える材料にしない。
 *
 * 形で名前と読むのは三つだけ。ハイフンでつないだ識別子、※ や鉤括弧のすぐ後ろの番号、文頭の階層つきの節番号（2.1、3.1.2）。
 * 文頭でも「223 言語」「1ターン」は数量なので、階層の無い数は文頭というだけでは名前と読まない。
 * そのうえで、すぐ後ろ（空白 1 つまで）の語が数につく語（助数詞・数・助詞・助動詞）なら数量として数え続ける（「3-5 日」「26.7 万行」）。
 * 品詞が無ければ判断せず、名前とは読まない。
 */

/** 数と結びついて読まれる語。助数詞は NounType=Class、数は NumType=Card で渡る。 */
const BOUND_TO_NUMBER = new Set(["ADP", "PART", "AUX", "SCONJ", "CCONJ"]);

/** 番号が立つ位置の直前: 題を包む鉤括弧、注の印。 */
const LABEL_LEAD = /[「『【※]$/u;

/** 文頭（前に空白と箇条書きの印だけ）。 */
const LINE_HEAD = /^[\s\-*+・•]*$/u;

/** 階層つきの節番号（2.1、3.1.2）。 */
const SECTION_NUMBER = /^\d+(?:\.\d+)+$/u;

/**
 * ハイフンでつないだ識別子（電話番号・郵便番号・日付・図表番号）。二つの数だけの「3-5」は範囲（3-5 営業日）とも読めるので、
 * 三つ以上つないだものか、0 で始まる部品を含むもの（102-0094）だけ。
 */
const MIN_IDENTIFIER_PARTS = 3;

const isHyphenIdentifier = (digits: string): boolean => {
  const parts = digits.split("-").filter((part) => part !== "");
  return parts.length >= MIN_IDENTIFIER_PARTS || (parts.length > 1 && parts.some((part) => part.startsWith("0")));
};

const RUN_CHAR = /[\d.-]/u;

/** at を含む、数字・小数点・ハイフンの並び。at が並びの中に無ければ undefined。 */
export const digitRunAround = (text: string, at: number): Span | undefined => {
  if (!RUN_CHAR.test(text[at] ?? "")) return undefined;
  const startAt = (index: number): number => (index > 0 && RUN_CHAR.test(text[index - 1] ?? "") ? startAt(index - 1) : index);
  const endAt = (index: number): number => (index < text.length && RUN_CHAR.test(text[index] ?? "") ? endAt(index + 1) : index);
  return { start: startAt(at), end: endAt(at) };
};

/** 並びの後ろ（空白 1 つまで）で始まる語。 */
const wordAfter = (tokens: readonly Token[], text: string, run: Span, base: number): Token | undefined => {
  const next = text[run.end] === " " ? run.end + 1 : run.end;
  return tokens.find((token) => token.span.start === base + next);
};

const isBoundToNumber = (token: Token): boolean =>
  token.features?.["NounType"] === "Class" || token.features?.["NumType"] === "Card" || BOUND_TO_NUMBER.has(token.pos);

/** ハイフンでつないだ識別子か、番号の立つ位置の番号か、文頭の節番号か。 */
const isNameShaped = (text: string, run: Span): boolean => {
  const [before, digits] = [text.slice(0, run.start), text.slice(run.start, run.end)];
  return isHyphenIdentifier(digits) || LABEL_LEAD.test(before) || (LINE_HEAD.test(before) && SECTION_NUMBER.test(digits));
};

/**
 * text の run が名前として書かれた数か。tokens は文書全体の座標で、base は text の先頭の位置。
 * 後ろの語が読めない（品詞が無い、語の切れ目が合わない）ときは、数量として数え続ける。
 */
export const isNumberName = (text: string, run: Span, tokens: readonly Token[] | undefined, base: number): boolean => {
  if (tokens === undefined || !isNameShaped(text, run)) return false;
  const next = wordAfter(tokens, text, run, base);
  return next !== undefined && !isBoundToNumber(next);
};
