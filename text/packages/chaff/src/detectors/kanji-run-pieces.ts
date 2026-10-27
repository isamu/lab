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
 * 文書が単独の連なりとして使う組織の名前（安全保障理事会）のうち、字数が min から max までのもの。
 * 名前は、組織の語（理事会、委員会）で閉じ、その前に 2 字以上あるもの。短い語（改革、決議）はどの文書にも単独で出るので、
 * 割る手がかりにならない。上限を超える名前はそれ自体を数える。
 */
export const standaloneNames = (runs: readonly string[], min: number, max: number, units: readonly string[]): Set<string> =>
  new Set(
    runs.filter((run) => {
      const length = [...run].length;
      return length >= min && length <= max && units.some((unit) => run.endsWith(unit) && length - [...unit].length >= MIN_BODY_LENGTH);
    }),
  );

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
