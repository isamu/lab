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

type Stretch = { readonly start: number; readonly end: number; readonly known: boolean };

/** start から始まる最も長い知っている語の終わり。連なり全体（0 から最後まで）は問わない。無ければ undefined。 */
const knownEnd = (length: number, start: number, isKnown: IsKnown): number | undefined =>
  Array.from({ length: length - start }, (_, offset) => length - offset).find((end) => !(start === 0 && end === length) && isKnown(start, end));

const stretchesFrom = (length: number, start: number, isKnown: IsKnown): Stretch[] => {
  if (start >= length) return [];
  const end = knownEnd(length, start, isKnown);
  const stretch = end === undefined ? { start, end: start + 1, known: false } : { start, end, known: true };
  return [stretch, ...stretchesFrom(length, stretch.end, isKnown)];
};

/**
 * words（連なりの語の字、順に）を頭から読み、各位置で最も長い知っている語を外した残りの一続き。
 * 連なり全体が知っている語かは、呼び出し側が先に決めている。
 */
export const unknownPieces = (words: readonly string[], isKnown: IsKnown): Piece[] =>
  stretchesFrom(words.length, 0, isKnown).reduce<Piece[]>((pieces, stretch, at, stretches) => {
    if (stretch.known) return pieces;
    const text = words.slice(stretch.start, stretch.end).join("");
    const joins = at > 0 && stretches[at - 1]?.known === false;
    const last = pieces.at(-1);
    return joins && last !== undefined ? [...pieces.slice(0, -1), { ...last, text: last.text + text }] : [...pieces, { text, first: stretch.start === 0 }];
  }, []);

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
