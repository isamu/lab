import type { Span, Token } from "../plugin.ts";
import { isFullName } from "./name-run.ts";

/**
 * 漢字の連なりを、読み手がもう知っている語（組織の名前、文書がほかで単独で使う組織の名前、決まった語）で割った残り。
 * 知っている語は、連なりの中でも語の切れ目を見せる。残りのそれぞれが、読み手が切れ目を探す長さ。
 */

/** 連なりの語のうち、知っている語で覆われなかった一続き。first は、連なりの頭から始まるか。 */
export type Piece = { readonly text: string; readonly first: boolean };

/** words の [start, end) が 1 つの知っている語か。 */
export type IsKnown = (start: number, end: number) => boolean;

/** 組織の語の前に要る字数（organisation-run と同じ）。 */
const MIN_BODY_LENGTH = 2;

/**
 * start から始まる最も長い知っている語の終わり。語は maxWords 語まで（知っている語の長さの上限）。連なり全体（0 から最後まで）は
 * 問わない。無ければ undefined。
 */
const knownEnd = (length: number, start: number, maxWords: number, isKnown: IsKnown): number | undefined =>
  Array.from({ length: Math.min(maxWords, length - start) }, (_, offset) => Math.min(length, start + maxWords) - offset).find(
    (end) => !(start === 0 && end === length) && isKnown(start, end),
  );

/**
 * words（連なりの語の字、順に）を頭から読み、各位置で最も長い知っている語（maxWords 語まで）を外した残りの一続き。
 * 連なりは文書ほどにも長くなり得るので、位置を一つずつ進める（語ごとに呼び直さない）。連なり全体が知っている語かは、呼び出し側が先に決めている。
 */
export const unknownPieces = (words: readonly string[], maxWords: number, isKnown: IsKnown): Piece[] => {
  const pieces: Piece[] = [];
  const cursor = { at: 0, pieceStart: -1 };
  const close = (end: number): void => {
    if (cursor.pieceStart >= 0) pieces.push({ text: words.slice(cursor.pieceStart, end).join(""), first: cursor.pieceStart === 0 });
    cursor.pieceStart = -1;
  };
  while (cursor.at < words.length) {
    const end = knownEnd(words.length, cursor.at, maxWords, isKnown);
    if (end === undefined) {
      if (cursor.pieceStart < 0) cursor.pieceStart = cursor.at;
      cursor.at += 1;
    } else {
      close(cursor.at);
      cursor.at = end;
    }
  }
  close(words.length);
  return pieces;
};

/**
 * 文書が単独の連なりとして使う名前（組織の名前の安全保障理事会、書式の名前の提供依頼申出書）のうち、字数が min から max までのもの。
 * 名前は、組織の語か題を閉じる語（endings: 理事会、申出書）で閉じ、その前に 2 字以上あるもの。短い語（改革、決議）と、
 * 名前の形をしない普通の複合語（内閣総理大臣、電子化手数料）は、単独で出ても割る手がかりにならない。上限を超える名前はそれ自体を数える。
 */
export const standaloneNames = (runs: readonly string[], min: number, max: number, endings: readonly string[]): Set<string> =>
  new Set(
    runs.filter((run) => {
      const length = [...run].length;
      return length >= min && length <= max && endings.some((ending) => run.endsWith(ending) && length - [...ending].length >= MIN_BODY_LENGTH);
    }),
  );

/** 語の、範囲（span）の中の字。連なりの頭や尻で外した語にまたがる語は、範囲の中だけ。 */
export const surfaceWithin = (token: Token, span: Span): string =>
  token.surface.slice(Math.max(0, span.start - token.span.start), Math.max(0, span.end - token.span.start));

const isNumber = (token: Token | undefined): boolean => token?.features?.["NumType"] === "Card";

/**
 * 連なりの語（runTokens、その字が words）の [start, end) が、漢数字と街区の単位（units: 丁目）だけの番地（駅前大通二丁目の「二丁目」）か。
 * 算用数字（2丁目）なら連なりはそこで切れるので、読み手はその前と後ろの切れ目を迷わない。後ろが 1 字だけ（新橋二丁目課）なら、
 * その字は番地に付いた語で、切れ目にならない。
 */
export const isBlockNumber = (runTokens: readonly Token[], words: readonly string[], piece: Span, units: readonly string[]): boolean =>
  piece.end - piece.start >= 2 &&
  units.includes(words[piece.end - 1] ?? "") &&
  runTokens.slice(piece.start, piece.end - 1).every(isNumber) &&
  [...words.slice(piece.end).join("")].length !== 1;

/** words の [from, to) が決まった語（内閣総理大臣）か。 */
const isKnownWordAt = (words: readonly string[], from: number, to: number, knownWords: ReadonlySet<string>): boolean =>
  from >= 0 && to <= words.length && knownWords.has(words.slice(from, to).join(""));

/**
 * 連なりの語（runTokens、その字が words）の piece が、決まった職名（knownWords: 内閣総理大臣）のすぐ前かすぐ後ろに立つ人の姓と名
 * （小泉純一郎内閣総理大臣、内閣総理大臣石破茂）か。職名は maxWords 語まで。人の名前と職名の組は、読み手が切れ目を知っている。
 * 職名の無い名前の並び（田中一郎山田花子）は割らない。
 */
export const isTitledPerson = (
  runTokens: readonly Token[],
  words: readonly string[],
  piece: Span,
  knownWords: ReadonlySet<string>,
  maxWords: number,
): boolean => {
  if (!isFullName(runTokens.slice(piece.start, piece.end))) return false;
  const lengths = Array.from({ length: maxWords }, (_, offset) => offset + 1);
  return lengths.some(
    (length) => isKnownWordAt(words, piece.end, piece.end + length, knownWords) || isKnownWordAt(words, piece.start - length, piece.start, knownWords),
  );
};

/** words の index の語が、連なりの頭でも尻でもない、並べた物の後ろに付く語（高齢運転者等専用駐車区間の「等」）か。語の終わりを見せる。 */
export const isInnerSuffix = (words: readonly string[], index: number, suffixes: readonly string[]): boolean =>
  index > 0 && index < words.length - 1 && suffixes.includes(words[index] ?? "");

/** 連なりの中で語の切れ目を見せる印: 中ほどの並べた物の後ろに付く語と前を指す語（suffixes）と、漢数字の後ろの街区の単位（blockUnits）。 */
export type BreakMarks = { readonly suffixes: readonly string[]; readonly blockUnits: readonly string[] };

/** 連なりの語の [start, end) が、切れ目を見せる印（中ほどの「等」、漢数字の番地）か。 */
export const isBreakMark = (runTokens: readonly Token[], words: readonly string[], piece: Span, marks: BreakMarks): boolean =>
  (piece.end === piece.start + 1 && isInnerSuffix(words, piece.start, marks.suffixes)) || isBlockNumber(runTokens, words, piece, marks.blockUnits);

/** 連なりの語（runTokens、その字が words）が、知っている語（known）か切れ目を見せる印を含むか。含まなければ、連なりをまるごと数える。 */
export const holdsKnown = (runTokens: readonly Token[], words: readonly string[], known: readonly string[], marks: BreakMarks): boolean => {
  const whole = words.join("");
  return (
    known.some((word) => whole.includes(word)) ||
    words.some((word, index) => isInnerSuffix(words, index, marks.suffixes) || (index > 0 && marks.blockUnits.includes(word) && isNumber(runTokens[index - 1])))
  );
};
