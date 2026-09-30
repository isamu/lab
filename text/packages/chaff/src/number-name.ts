import { HYPHEN_CHARS, hyphenGroups, isHyphen } from "./orthography.ts";
import type { Span, Token } from "./plugin.ts";

/**
 * 数量ではなく名前として書かれた数（番号・識別子）。鉤括弧で引いた「3.1 リサーチの原則」の節番号、※1 のような注の番号、
 * 「〒100-8916 東京都」の郵便番号、「紀尾井町1-3 東京ガーデンテラス」の番地は、後ろの空白が番号と題・項目の区切りで、「3回」「3 回」のような空け方の好みではない。
 * 空け方を数える材料にしない。
 *
 * 形で名前と読むのは六つだけ。0 で始まる組を含むハイフンつなぎの番号、※・〒や鉤括弧のすぐ後ろの番号、市・区・町まで下りた地名のすぐ後ろのハイフンつなぎの番号、
 * 文頭の階層つきの節番号（2.1、3.1.2）、続き番号になった行や番号の並ぶ箇条書きの頭の番号（白書の注、関連コード）、「問3」のように番号の前に書く語のすぐ後ろの番号。
 * 文頭でも「223 言語」「1ターン」は数量なので、階層の無い数は文頭というだけでは名前と読まない。
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

/** at を含む、数字・小数点・ハイフン（全角の「－」なども）の並び。at が並びの中に無ければ undefined。並びは本文ほど長くなれるので、1 字ずつ呼び直さずに進む。 */
export const digitRunAround = (text: string, at: number): Span | undefined => {
  if (!isRunChar(text[at])) return undefined;
  let start = at;
  while (start > 0 && isRunChar(text[start - 1])) start -= 1;
  let end = at;
  while (end < text.length && isRunChar(text[end])) end += 1;
  return { start, end };
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

const noteSequenceStarts = (text: string): number[] => {
  const lines = [...text.matchAll(NUMBERED_LINE)].map((match) => {
    const number = match.groups?.["number"] ?? "";
    return { start: match.index + match[0].indexOf(number), value: Number(number) };
  });
  const continues = (index: number): boolean =>
    lines[index - 1]?.value === (lines[index]?.value ?? 0) - 1 || lines[index + 1]?.value === (lines[index]?.value ?? 0) + 1;
  return lines.flatMap((line, index) => (continues(index) ? [line.start] : []));
};

/**
 * 箇条書きの項目の頭の番号（- 1122 医療費控除…、- 3-1個人情報…）。番号の後ろに「.」を書く番号付きの箇条書き（1. 概要）は、番号が印なので入れない。
 * 階層は「.」かハイフンでつなぐ。
 */
const LIST_ITEM_NUMBER = new RegExp(`^[ \\t]*[-*+][ \\t]+(?<number>\\d+(?:[.${HYPHEN_CHARS}]\\d+)*)(?![\\d.．])`, "gmu");
const LEVEL_SEPARATOR = new RegExp(`[.${HYPHEN_CHARS}]`, "u");

/** 番号の並び以外で、番号の付いた項目と数える最少の数。二つだけでは「3 言語」「5 ユーザー」のような数量の並びと見分けがつかない。 */
const MIN_LIST_ITEMS = 3;

/** 階層の無い番号だけの並びを、コードの並びと読む最少の桁。「- 3 ユーザー」「- 5 チーム」「- 8 アカウント」は数量の並び。 */
const MIN_CODE_DIGITS = 3;

/** コードの並びで、次の項目までに増える数の上限。コードは近い番号を並べ（1122、1124、1126）、数量の並びは飛ぶ（100、200、300）。 */
const MAX_CODE_STEP = 9;

type ListItem = {
  readonly start: number;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly number: string;
  readonly levels: readonly number[];
};

const listItems = (text: string): ListItem[] =>
  [...text.matchAll(LIST_ITEM_NUMBER)].map((match) => {
    const number = match.groups?.["number"] ?? "";
    const lineEnd = text.indexOf("\n", match.index);
    return {
      start: match.index + match[0].length - number.length,
      lineStart: match.index,
      lineEnd: lineEnd === -1 ? text.length : lineEnd,
      number,
      levels: number.split(LEVEL_SEPARATOR).map(Number),
    };
  });

/** 目次の順で earlier が later より前か（2-19 → 3 → 3-1 → 3-1-1）。 */
const comesBefore = (earlier: readonly number[], later: readonly number[]): boolean => {
  const differs = earlier.findIndex((level, index) => level !== later[index]);
  if (differs === -1) return earlier.length < later.length;
  return (earlier[differs] ?? 0) < (later[differs] ?? -1);
};

/** 空行だけを挟んで次の項目が続き、番号が増えているか。 */
const followsItem = (text: string, previous: ListItem, item: ListItem): boolean =>
  text.slice(previous.lineEnd, item.lineStart).trim() === "" && comesBefore(previous.levels, item.levels);

/**
 * 前の項目と同じ見出しの下に次の番号が続くか（3 → 3-1、2-18 → 2-19）。並びの番号は増えていくので、頭が同じなら後ろは段を持つ。
 * 「5 → 8-10」は範囲で、目次の段ではない。
 */
const isOutlineStep = (previous: ListItem | undefined, item: ListItem): boolean => previous !== undefined && previous.levels[0] === item.levels[0];

/** 同じ桁数（MIN_CODE_DIGITS 以上）で、MAX_CODE_STEP までずつ増えていくコードの並び（1122、1124、1126）。 */
const isCodeRun = (run: readonly ListItem[]): boolean => {
  const width = run[0]?.number.length ?? 0;
  const closeToPrevious = (item: ListItem, index: number): boolean => index === 0 || (item.levels[0] ?? 0) - (run[index - 1]?.levels[0] ?? 0) <= MAX_CODE_STEP;
  return width >= MIN_CODE_DIGITS && run.every((item, index) => item.number.length === width && closeToPrevious(item, index));
};

/**
 * 番号の並びとして読める項目の並び。目次の段を含む並び（2-19、3、3-1）か、コードの並び（1122、1124）。
 * 階層の無い数が増えていくだけの並び（3、5、8 や 100、200、300）は、数量を並べたものと見分けがつかない。
 */
const isLabelRun = (run: readonly ListItem[]): boolean =>
  run.length >= MIN_LIST_ITEMS && (run.some((item, index) => isOutlineStep(run[index - 1], item)) || isCodeRun(run));

/**
 * 箇条書きの項目の頭に番号を置き、下へ番号が増えていく並び（国税庁の関連コード 1122、1124、…、ガイドラインの目次 2-19、3、3-1）。
 * 番号は飛んでもよいが、isLabelRun の並びだけを番号と読む。
 */
const numberedListStarts = (text: string): number[] =>
  listItems(text)
    .reduce<ListItem[][]>((runs, item) => {
      const run = runs.at(-1);
      const previous = run?.at(-1);
      if (run !== undefined && previous !== undefined && followsItem(text, previous, item)) run.push(item);
      else runs.push([item]);
      return runs;
    }, [])
    .filter(isLabelRun)
    .flatMap((run) => run.map((item) => item.start));

export const sequenceLabelStarts = (text: string): ReadonlySet<number> => new Set([...noteSequenceStarts(text), ...numberedListStarts(text)]);

const isGeoUnit = (token: Token): boolean => token.features?.["NameType"] === "GeoUnit";
const isPlaceWord = (token: Token): boolean => isGeoUnit(token) || token.features?.["NameType"] === "Geo";

/** 終わりの位置ごとの、その位置で終わる最初の地名の語。Map は NaN を NaN の鍵で引けるが、位置の NaN はどこにも等しくないので入れない。 */
const placesByEnd = (tokens: readonly Token[]): ReadonlyMap<number, Token> => {
  const byEnd = new Map<number, Token>();
  tokens.forEach((token) => {
    if (isPlaceWord(token) && !Number.isNaN(token.span.end) && !byEnd.has(token.span.end)) byEnd.set(token.span.end, token);
  });
  return byEnd;
};

/**
 * end で終わる、間を空けずに続く地名と地名の単位（東京都千代田区紀尾井町）。近いほうから。
 * 連なりは本文ほど長くなれるので、語を 1 度だけ読む。同じ語に戻れば（幅の無い語。adapter が壊れているとき）そこで止める。
 */
export const placeChainBefore = (tokens: readonly Token[], end: number): Token[] => {
  const byEnd = placesByEnd(tokens);
  const chain = new Set<Token>();
  for (let last = byEnd.get(end); last !== undefined && !chain.has(last); last = byEnd.get(last.span.start)) chain.add(last);
  return [...chain];
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

/** 「問3」「図2」: 番号のすぐ前（空白を挟まない）の語が、番号の前に書いて名前を付ける語。「質問3」の「問」は語ではない。 */
const followsLabelWord = (run: Span, tokens: readonly Token[], base: number, labelWords: ReadonlySet<string>): boolean =>
  tokens.some((token) => token.span.end === base + run.start && labelWords.has(token.surface));

/**
 * 文書全体で一度だけ読むもの。sequence は sequenceLabelStarts の結果、topUnits は都道府県の単位、
 * labelWords は番号の前に書いて名前を付ける語（語彙表 numbered-label の before）。
 */
export type NameContext = {
  readonly sequence?: ReadonlySet<number>;
  readonly topUnits?: ReadonlySet<string>;
  readonly labelWords?: ReadonlySet<string>;
};

/**
 * text の run が名前として書かれた数か。tokens は文書全体の座標で、base は text の先頭の位置。
 * 後ろの語が読めない（品詞が無い、語の切れ目が合わない）ときは、数量として数え続ける。
 */
export const isNumberName = (text: string, run: Span, tokens: readonly Token[] | undefined, base: number, context: NameContext = {}): boolean => {
  const inSequence = context.sequence?.has(base + run.start) ?? false;
  if (tokens === undefined) return false;
  const shaped =
    inSequence ||
    isNameShaped(text, run) ||
    isAddressNumber(text, run, tokens, base, context.topUnits ?? new Set()) ||
    followsLabelWord(run, tokens, base, context.labelWords ?? new Set());
  if (!shaped) return false;
  const next = wordAfter(tokens, text, run, base);
  if (next === undefined) return false;
  return !isBoundToNumber(next) || (inSequence && CONJUNCTIONS.has(next.pos));
};

/** 「第」と番号の後ろに書く区切りの語（第1節、第 2 章）。 */
const DIVISION_LABEL = /第 ?\d+ ?(?<unit>[^\s\d第]+)$/u;

/**
 * before が「第1節」「第4章第2節」のように、「第」と番号と区切りの語（語彙表 numbered-label の after）で終わるか。
 * その後ろの空白は題との区切りで、空け方の好みではない（第1節 AI の…）。
 */
export const endsWithDivisionLabel = (before: string, units: ReadonlySet<string>): boolean => {
  const unit = DIVISION_LABEL.exec(before)?.groups?.["unit"];
  return unit !== undefined && units.has(unit);
};
