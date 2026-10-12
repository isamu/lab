import type { Span } from "../plugin.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import { cellsOf, tablesOf } from "./table-facts.ts";
import { withoutEdgeMarks } from "./trim-marks.ts";

/**
 * 文が全体の数として書いた数（「チケットは、合計4枚です」「for 4 tickets in total」）を、その数を数える表の列（枚数、Tickets）と比べる。
 * 文の数は、全体の印（合計、in total）と、列の項目を数える語（枚、tickets）の両方が付いたときだけ読む。「うち2枚は」「2 of the tickets」
 * のような一部の数は印が無いので読まない。
 * 表の側は、合計の行がその列に数を書いていればそれ。書いていなければ、行が別々のものを数える項目（チケット: 一枚は一つの行にだけ
 * 載る）に限って、行の数の和。手数料の行（発券手数料 3枚）は同じチケットを数え直すので足さない。人は足さない: 同じ人が参加の行と
 * 交流会の行の両方に載る。
 */
export type CountWord = { readonly pattern: string; readonly group: string };
export type MarkWord = { readonly pattern: string; readonly position: "before" | "after" };

export type CountWords = {
  /** 数を数える列の見出し（枚数、Tickets）。group が数えるもの。 */
  readonly columns: readonly CountWord[];
  /** 数の後ろの、数えるものの語（枚、tickets）。group が列と同じものだけを比べる。 */
  readonly counters: readonly CountWord[];
  /** 行が別々のものを数える group。この group だけ、行の数を足して表の全体の数にする。 */
  readonly separateRows: readonly string[];
  /** 全体の印。before は数のすぐ前（合計4枚）、after は数えるものの語のすぐ後ろ（4 tickets in total）。 */
  readonly wholeMarks: readonly MarkWord[];
  /** 全体でない数の印。before は文のその数より前のどこか（うち、各、up to）、after は数えるものの語のすぐ後ろ（まで、目）。 */
  readonly notWhole: readonly MarkWord[];
  /** 同じものを数え直す行の名前の語（手数料、fee）。足さない。 */
  readonly restating: readonly string[];
  /** 合計の行の最初の升の語（小計は入れない）。 */
  readonly totalLabels: readonly string[];
  /** 表の一部の合計の行の語（小計）。この行や、合計の語で始まる別の名前の行（合計（税込））がある表は、全体の数がどれか決まらない。 */
  readonly subtotalLabels: readonly string[];
};

export type CountSentence = Span & { readonly text: string };

/** 表の全体の数。sum: 合計の行でなく、行を足した数。rows: 合計の行のほかの行の名前（S席、Stalls）。 */
export type TableCount = { readonly group: string; readonly heading: string; readonly count: number; readonly sum: boolean; readonly rows: readonly string[] };

/** written: 文が書いた数の字（4、４）。数えるものの語はその後ろ。 */
export type WholeCountConflict = Span & { readonly heading: string; readonly written: string; readonly table: TableCount };

const folded = (text: string): string => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

const DIGITS = "[0-9０-９][0-9０-９,，]*";
const LATIN_EDGE = /^[a-z]$/iu;

const numberOf = (written: string): number => Number(written.normalize("NFKC").replaceAll(",", ""));

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** 升の字がちょうど「数 + 数えるものの語」（2枚、2 tickets）のときの数。 */
const cellCount = (text: string, counters: readonly string[]): number | undefined => {
  const cell = folded(withoutEdgeMarks(text));
  const counter = counters.map(folded).find((word) => new RegExp(`^${DIGITS} ?${escaped(word)}$`, "u").test(cell));
  return counter === undefined ? undefined : numberOf(cell.slice(0, cell.length - counter.length).trim());
};

const countersOf = (group: string, words: CountWords): string[] => words.counters.filter((word) => word.group === group).map((word) => word.pattern);

type Row = { readonly label: string; readonly cell: string };

const isTotal = (label: string, words: CountWords): boolean => words.totalLabels.some((word) => folded(word) === label);
const looksTotal = (label: string, words: CountWords): boolean =>
  [...words.totalLabels, ...words.subtotalLabels].some((word) => label.startsWith(folded(word)));
const restates = (label: string, words: CountWords): boolean => words.restating.some((word) => label.includes(folded(word)));
const startsPartial = (label: string, words: CountWords): boolean =>
  words.notWhole.some((word) => word.position === "before" && label.startsWith(folded(word.pattern)));

/** 行を足した数。どの行も数が読めて、一部の行（うち学生）が無いときだけ。 */
const rowSum = (rows: readonly Row[], counters: readonly string[], words: CountWords): number | undefined => {
  const items = rows.filter((row) => !isTotal(row.label, words) && !restates(row.label, words));
  if (items.length === 0 || items.some((row) => startsPartial(row.label, words))) return undefined;
  const counts = items.map((row) => cellCount(row.cell, counters));
  return counts.every((count) => count !== undefined) ? counts.reduce<number>((sum, count) => sum + (count ?? 0), 0) : undefined;
};

const columnCount = (group: string, heading: string, rows: readonly Row[], words: CountWords): TableCount | undefined => {
  const counters = countersOf(group, words);
  const [total, ...moreTotals] = rows.filter((row) => isTotal(row.label, words));
  if (moreTotals.length > 0 || rows.some((row) => !isTotal(row.label, words) && looksTotal(row.label, words))) return undefined;
  const written = total === undefined ? undefined : cellCount(total.cell, counters);
  const labels = rows.map((row) => row.label).filter((label) => label !== "" && !isTotal(label, words));
  if (written !== undefined) return { group, heading, count: written, sum: false, rows: labels };
  if (total !== undefined && folded(withoutEdgeMarks(total.cell)) !== "") return undefined;
  const sum = words.separateRows.includes(group) ? rowSum(rows, counters, words) : undefined;
  return sum === undefined ? undefined : { group, heading, count: sum, sum: true, rows: labels };
};

const rowsAt = (rows: readonly Line[], column: number): Row[] =>
  rows.map((row) => {
    const cells = cellsOf(row);
    return { label: folded(withoutEdgeMarks(cells[0]?.text ?? "")), cell: cells[column]?.text ?? "" };
  });

/** 表の、数を数える列ごとの全体の数。 */
const tableCounts = (source: string, words: CountWords): TableCount[] =>
  tablesOf(linesOf(source)).flatMap((table) =>
    cellsOf(table.header).flatMap((cell, column) => {
      const heading = withoutEdgeMarks(cell.text);
      const group = words.columns.find((word) => folded(word.pattern) === folded(heading))?.group;
      if (group === undefined || column === 0) return [];
      const count = columnCount(group, heading, rowsAt(table.rows, column), words);
      return count === undefined ? [] : [count];
    }),
  );

type Found = Span & { readonly written: string; readonly group: string };

/** 語の端がラテン文字なら、隣がラテン文字でないこと（per と person を分ける）。 */
const bounded = (text: string, start: number, end: number): boolean => {
  const before = text.charAt(start - 1);
  const after = text.charAt(end);
  return !(LATIN_EDGE.test(text.charAt(start)) && LATIN_EDGE.test(before)) && !(LATIN_EDGE.test(text.charAt(end - 1)) && LATIN_EDGE.test(after));
};

const hasWord = (text: string, word: string): boolean => {
  const at = text.indexOf(word);
  return at !== -1 && (bounded(text, at, at + word.length) || hasWord(text.slice(at + 1), word));
};

const notWhole = (text: string, counted: Counted, words: CountWords): boolean => {
  const before = text.slice(0, counted.start);
  const after = text.slice(counted.after).trimStart();
  return words.notWhole.some((word) => {
    const pattern = folded(word.pattern);
    return word.position === "before" ? hasWord(before, pattern) : after.startsWith(pattern) && bounded(after, 0, pattern.length);
  });
};

/** 印 + 数 + 語（合計4枚、a total of 4 tickets）か、数 + 語 + 印（4 tickets in total）。 */
const wholePattern = (mark: MarkWord, counter: string): RegExp => {
  const counted = `(?<counted>${DIGITS} ?${escaped(counter)})`;
  const word = escaped(mark.pattern);
  return new RegExp(mark.position === "before" ? `${word} ?${counted}` : `${counted} ${word}`, "gdu");
};

/** 数と数えるものの語の位置。after: 全体の印も含めた、読んだ所の終わり（4 tickets in total の後ろ）。 */
type Counted = Span & { readonly after: number };

const matchesOf = (text: string, mark: MarkWord, counter: CountWord): Counted[] =>
  [...text.matchAll(wholePattern({ ...mark, pattern: folded(mark.pattern) }, folded(counter.pattern)))].flatMap((match) => {
    const [start, end] = match.indices?.groups?.["counted"] ?? [0, 0];
    const after = match.index + match[0].length;
    if (!bounded(text, match.index, after) || /[0-9.]/u.test(text.charAt(start - 1))) return [];
    return [{ start, end, after }];
  });

const foundIn = (sentence: CountSentence, words: CountWords): Found[] => {
  const text = sentence.text.normalize("NFKC").toLowerCase();
  if (text.length !== sentence.text.length) return [];
  return words.counters.flatMap((counter) =>
    words.wholeMarks.flatMap((mark) =>
      matchesOf(text, mark, counter).flatMap((counted): Found[] => {
        if (notWhole(text, counted, words)) return [];
        const { start, end } = counted;
        const written = sentence.text.slice(start, end);
        const counterAt = end - counter.pattern.length;
        return [{ start: sentence.start + start, end: sentence.start + end, written: written.slice(0, counterAt - start).trim(), group: counter.group }];
      }),
    ),
  );
};

const unique = (found: readonly Found[]): Found[] => found.filter((one, index) => found.findIndex((other) => other.start === one.start) === index);

/**
 * 文が全体として書いた数と、表のその列の全体の数が違う所。数える列が文書に二つ以上ある項目、その表の行の名前を書いた文
 * （S席は合計2枚）は比べない。
 */
export const wholeCountConflicts = (source: string, sentences: readonly CountSentence[], words: CountWords): WholeCountConflict[] => {
  const tables = tableCounts(source, words);
  return sentences.flatMap((sentence) => {
    const text = folded(sentence.text);
    return unique(foundIn(sentence, words)).flatMap((found) => {
      const [table, ...others] = tables.filter((count) => count.group === found.group);
      if (table === undefined || others.length > 0 || numberOf(found.written) === table.count) return [];
      if (table.rows.some((label) => hasWord(text, label))) return [];
      return [{ start: found.start, end: found.end, heading: table.heading, written: found.written, table }];
    });
  });
};
