// Line and sentence helpers shared by the seeded mistakes of `yarn bench`. Pure.

/** A sample with one planted mistake, and the 1-based line it is on. */
export type Plant = { readonly source: string; readonly line: number };

/**
 * What a mutation needs to know about the run: each rule's limit for the sample's genre, by rule id, and the length of one
 * ordinary sentence for a rule that also measures length (max-paragraph-length's full_sentence).
 */
export type PlantContext = {
  readonly limits: Readonly<Record<string, number>>;
  readonly fullSentences?: Readonly<Record<string, number>>;
  /** The sample's adapter's unit of length. Without it, a mutation guesses from the text. */
  readonly lengthUnit?: "char" | "word" | undefined;
};

type Found = { readonly index: number; readonly line: string };

export const linesOf = (source: string): string[] => source.split("\n");

export const isHeading = (line: string): boolean => line.startsWith("#");
export const isTableRow = (line: string): boolean => line.trimStart().startsWith("|");
export const isListItem = (line: string): boolean => /^\s*[-*]\s/u.test(line);
export const isRow = (line: string): boolean => isTableRow(line) || isListItem(line);
/** 見出しと表を除いた、文を書く行。箇条書きは文として読む。 */
export const isProse = (line: string): boolean => line.trim() !== "" && !isHeading(line) && !isTableRow(line);

export const replaceLine = (lines: readonly string[], index: number, line: string): string => lines.map((old, at) => (at === index ? line : old)).join("\n");

const FENCE = /^\s*(?:```|~~~)/u;

/** コードブロックの行（囲みの行も含む）の番号。コードは文ではないので、誤りを植えない。 */
export const codeLines = (lines: readonly string[]): ReadonlySet<number> =>
  new Set(
    lines.reduce<{ inside: boolean; found: number[] }>(
      (acc, line, index) => {
        const fence = FENCE.test(line);
        return { inside: fence ? !acc.inside : acc.inside, found: fence || acc.inside ? [...acc.found, index] : acc.found };
      },
      { inside: false, found: [] },
    ).found,
  );

/** 行の番号で引く、コードの外の文の行か。 */
export const proseAt = (lines: readonly string[]): ((index: number) => boolean) => {
  const code = codeLines(lines);
  return (index) => !code.has(index) && isProse(lines[index] ?? "");
};

const firstLine = (lines: readonly string[], test: (line: string) => boolean): Found | undefined => {
  const code = codeLines(lines);
  const index = lines.findIndex((line, at) => !code.has(at) && test(line));
  const line = lines[index];
  return line === undefined ? undefined : { index, line };
};

/** 1 行を書き換える。書き換えられない行（undefined）なら植えない。 */
export const rewriteFirst = (source: string, test: (line: string) => boolean, rewrite: (line: string) => string | undefined): Plant | undefined => {
  const lines = linesOf(source);
  const found = firstLine(lines, test);
  const line = found === undefined ? undefined : rewrite(found.line);
  return found === undefined || line === undefined || line === found.line
    ? undefined
    : { source: replaceLine(lines, found.index, line), line: found.index + 1 };
};

export const isJapanese = (text: string): boolean => /[ぁ-んァ-ヶ一-龠]/u.test(text);
export const splitSentences = (line: string): string[] => (isJapanese(line) ? line.split(/(?<=。)/u) : line.split(/(?<=[.!?])\s+(?=[A-Z])/u));

export const lowerFirst = (sentence: string): string => (/^[A-Z][a-z]/u.test(sentence) ? `${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}` : sentence);

const POLITE_ENDING = /(?:です|ます|ました|でした|ません|ください)。/gu;

/** 本文の文末で、丁寧な文末が半分より多いか。 */
export const isPoliteDocument = (source: string): boolean => {
  const body = linesOf(source).filter(isProse).join("\n");
  const polite = body.match(POLITE_ENDING)?.length ?? 0;
  const all = body.match(/。/gu)?.length ?? 0;
  return polite * 2 > all;
};
