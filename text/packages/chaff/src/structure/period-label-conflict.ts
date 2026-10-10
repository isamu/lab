import { escapeRegExp } from "../orthography.ts";
import { linesOf, type Line } from "./lines.ts";
import { periodLabelsIn, type CompiledFrame, type PeriodLabel } from "./period-labels.ts";
import { afterLabel } from "./stated-period.ts";

// 決算の文書が題で言った期間（2027年3月期 第2四半期、Q2 FY2026）と、今の業績を言う所に書いた同じ種類の別の期間（第3四半期、FY2025）。
// 純関数: 文書の字、文と見出しの範囲、語彙表の語を受け取る。
// 文書の期間は、題（最初の字のある行）が業績の語（決算、業績、Financial Results）と一緒に書いた期間の名前。
// 題に無い種類は、頭の「対象期間：」「Reporting period:」の一行から補う。題に同じ種類の違う期間が二つあれば、その種類は比べない。

export type ReportingWords = {
  readonly frames: readonly CompiledFrame[];
  /** 業績を言う語。題がこれを持つ文書だけを読み、文がこれを持てば今の業績を言う文と読む。 */
  readonly results: readonly string[];
  /** 文書の期間を書く行の頭の語（対象期間、Reporting period）。 */
  readonly periodLines: readonly string[];
  /** 比べる相手の期間を言う語（前年同期、prior year）。 */
  readonly comparisons: readonly string[];
  /** 先の期間の見込みを言う語（通期予想、outlook）。 */
  readonly forecasts: readonly string[];
  /** 今の期間を指す語（当期、当第、this quarter）。 */
  readonly currents: readonly string[];
  /** 今の期間の語を含むが期間を指さない語（当期純利益）。 */
  readonly notCurrents: readonly string[];
};

export type Span = { readonly start: number; readonly end: number };
export type Heading = Span & { readonly text: string };

export type PeriodConflict = { readonly offset: number; readonly label: string; readonly stated: string };

type Unit = {
  readonly start: number;
  readonly text: string;
  readonly headerCell: boolean;
  /** 文書の期間の名前を探す範囲。表の見出しの升なら行全体（| FY2025 | FY2026 | の FY2025 は比べる相手）。 */
  readonly context: string;
  readonly section: string;
};

const HEAD_LINES = 12;
const ASCII_EDGE = /[A-Za-z0-9]/u;

const wordRegex = (word: string): RegExp => {
  const before = ASCII_EDGE.test(word.charAt(0)) ? "(?<![A-Za-z0-9])" : "";
  const after = ASCII_EDGE.test(word.charAt(word.length - 1)) ? "(?![A-Za-z0-9])" : "";
  return new RegExp(`${before}${escapeRegExp(word).replaceAll(" ", "\\s+")}${after}`, "iu");
};

export const hasWord = (text: string, words: readonly string[]): boolean => words.some((word) => word !== "" && wordRegex(word).test(text));

const withoutWords = (text: string, words: readonly string[]): string =>
  words.filter((word) => word !== "").reduce((rest, word) => rest.replace(new RegExp(wordRegex(word).source, "giu"), " "), text);

const sameLabel = (left: PeriodLabel, right: PeriodLabel): boolean => left.kind === right.kind && left.shape === right.shape && left.value === right.value;
const sameSlot = (left: PeriodLabel, right: PeriodLabel): boolean => left.kind === right.kind && left.shape === right.shape;

/** 種類と形ごとに一つの期間。同じ種類と形の違う期間が並べば、どちらが文書の期間か決まらないので落とす。 */
const oneEach = (labels: readonly PeriodLabel[]): PeriodLabel[] =>
  labels.filter(
    (label, index) =>
      labels.every((other) => !sameSlot(other, label) || sameLabel(other, label)) && labels.findIndex((other) => sameLabel(other, label)) === index,
  );

/** 文書の期間。題が業績の語を持たなければ無い。題に無い種類と形だけを、期間の行から補う。 */
export const statedPeriodOf = (title: string, periodLine: string, words: ReportingWords): PeriodLabel[] => {
  if (!hasWord(title, words.results)) return [];
  const fromTitle = oneEach(periodLabelsIn(title, words.frames));
  const fromLine = oneEach(periodLabelsIn(periodLine, words.frames)).filter((label) => !fromTitle.some((other) => sameSlot(other, label)));
  return [...fromTitle, ...fromLine];
};

/** 名前と同じ種類と形で、値の違う文書の期間。 */
export const conflictingStated = (label: PeriodLabel, stated: readonly PeriodLabel[]): PeriodLabel | undefined => {
  const slot = stated.find((other) => sameSlot(other, label));
  return slot === undefined || sameLabel(slot, label) ? undefined : slot;
};

/**
 * 今の業績を言う所の名前か。年の中の一部（四半期、半期）で文書の期間より前のものは、累計の中の一部や比べる相手のことが多いので、
 * 今の期間を指す語（当第1四半期）があるときだけ。ほかは、表の見出しの升ならそれだけで、文なら今の期間か業績の語があるとき。
 */
export const refersToCurrent = (label: PeriodLabel, stated: PeriodLabel, unit: Pick<Unit, "text" | "headerCell">, words: ReportingWords): boolean => {
  const current = hasWord(withoutWords(unit.text, words.notCurrents), words.currents);
  if (label.withinYear && label.order < stated.order) return current;
  return unit.headerCell || current || hasWord(unit.text, words.results);
};

const isAside = (text: string, words: ReportingWords): boolean => hasWord(text, words.comparisons) || hasWord(text, words.forecasts);

const issuesIn = (unit: Unit, stated: readonly PeriodLabel[], words: ReportingWords): PeriodConflict[] => {
  if (isAside(unit.text, words) || isAside(unit.section, words)) return [];
  const named = periodLabelsIn(unit.context, words.frames);
  return periodLabelsIn(unit.text, words.frames).flatMap((label) => {
    const statedLabel = conflictingStated(label, stated);
    if (statedLabel === undefined || named.some((other) => sameLabel(other, statedLabel))) return [];
    if (!refersToCurrent(label, statedLabel, unit, words)) return [];
    return [{ offset: unit.start + label.start, label: label.written, stated: statedLabel.written }];
  });
};

const RULE_CELL = /^:?-{3,}:?$/u;

/** 表の見出しと本体を分ける行（| --- | :---: |）。 */
const isTableRule = (text: string): boolean => {
  const cells = text.trim().replace(/^\|/u, "").replace(/\|$/u, "").split("|");
  return text.includes("-") && cells.every((cell) => RULE_CELL.test(cell.trim()));
};

const cellsOf = (line: Line): { readonly start: number; readonly text: string }[] => {
  const cells: { start: number; text: string }[] = [];
  let at = line.start;
  line.text.split("|").forEach((text) => {
    cells.push({ start: at, text });
    at += text.length + 1;
  });
  return cells.filter((cell) => cell.text.trim() !== "");
};

/** 表の見出しの行（次の行が |---| の行）の升。 */
const headerRows = (lines: readonly Line[]): Line[] =>
  lines.filter((line, index) => line.text.trimStart().startsWith("|") && isTableRule(lines[index + 1]?.text ?? ""));

const sectionAt = (headings: readonly Heading[], offset: number): string => headings.findLast((heading) => heading.start < offset)?.text ?? "";

const headerUnits = (lines: readonly Line[], headings: readonly Heading[]): Unit[] =>
  headerRows(lines).flatMap((row) =>
    cellsOf(row).map((cell) => ({ start: cell.start, text: cell.text, headerCell: true, context: row.text, section: sectionAt(headings, cell.start) })),
  );

const textUnits = (source: string, spans: readonly Span[], headings: readonly Heading[]): Unit[] =>
  spans.map((span) => {
    const text = source.slice(span.start, span.end);
    return { start: span.start, text, headerCell: false, context: text, section: sectionAt(headings, span.start) };
  });

type Head = { readonly title: string; readonly periodLine: string; readonly end: number };

/** 題（最初の字のある行）と、その後ろ、次の見出しまでの頭の行のうち期間の語で始まる一行。 */
const headOf = (lines: readonly Line[], headings: readonly Heading[], words: ReportingWords): Head => {
  const first = lines.find((line) => line.text.trim() !== "");
  const titleEnd = first === undefined ? 0 : first.start + first.text.length;
  const bodyStart = headings.find((heading) => heading.start > titleEnd)?.start ?? Number.POSITIVE_INFINITY;
  const head = lines.filter((line) => line.start > titleEnd && line.start < bodyStart).slice(0, HEAD_LINES);
  const periodLine = head.find((line) => afterLabel(line.text, words.periodLines) !== undefined);
  const end = periodLine === undefined ? titleEnd : periodLine.start + periodLine.text.length;
  return { title: first?.text.replace(/^#+\s*/u, "") ?? "", periodLine: periodLine?.text ?? "", end };
};

/** 題の期間と同じ種類の別の期間を、今の業績を言う文、見出し、表の見出しの升に書いた所。 */
export const periodLabelConflicts = (source: string, sentences: readonly Span[], headings: readonly Heading[], words: ReportingWords): PeriodConflict[] => {
  const lines = linesOf(source);
  const head = headOf(lines, headings, words);
  const stated = statedPeriodOf(head.title, head.periodLine, words);
  if (stated.length === 0) return [];
  const sections = headings.filter((heading) => heading.start > head.end);
  const units = [...textUnits(source, [...sentences, ...sections], sections), ...headerUnits(lines, sections)].filter((unit) => unit.start > head.end);
  return units.flatMap((unit) => issuesIn(unit, stated, words)).toSorted((left, right) => left.offset - right.offset);
};
