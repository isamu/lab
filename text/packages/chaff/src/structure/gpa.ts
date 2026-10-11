// gpa-mismatch: a written grade-point average ("GPA: 3.00") that the course rows of the same document do not give, as
// Σ(grade points × credits) / Σ credits. Columns are named by heading words, grade points come from the document's own
// grading key ("S (4), A (3)") or from one unambiguous scale of the grade-point lexicon. Pure.
import type { StructureIssue } from "./issues.ts";
import { holds, plain, type ChangeTable, type TableCell } from "./change-rate-table.ts";
import { escapeRegExp } from "../orthography.ts";

export type TranscriptRole = "points" | "grade" | "credits" | "course" | "total";
export type TranscriptWord = { readonly pattern: string; readonly role: TranscriptRole };
/** A grade word on one scale, with its points; undefined points is a grade that carries none (Pass, 認定). */
export type GradeWord = { readonly pattern: string; readonly scale: string; readonly points?: number };
export type GpaLabel = { readonly pattern: string; readonly part: boolean };
export type GpaWords = {
  readonly columns: readonly TranscriptWord[];
  readonly grades: readonly GradeWord[];
  readonly labels: readonly GpaLabel[];
};
export type TextLine = { readonly text: string; readonly start: number };

/** Grade-points columns first, so "Grade points" is not the grade column. */
const ROLE_ORDER: readonly TranscriptRole[] = ["points", "grade", "credits", "course"];

const roleOf = (heading: string, words: readonly TranscriptWord[]): TranscriptRole | undefined => {
  const key = plain(heading).toLowerCase();
  return ROLE_ORDER.find((role) => words.some((word) => word.role === role && holds(key, word.pattern)));
};

type CourseColumns = { readonly grade: number; readonly credits: number };

/** A course table: at least one course column, and exactly one grade and one credits column. */
export const courseColumnsOf = (headings: readonly string[], words: readonly TranscriptWord[]): CourseColumns | undefined => {
  const roles = headings.map((heading) => roleOf(heading, words));
  const all = (role: TranscriptRole): number[] => roles.flatMap((found, index) => (found === role ? [index] : []));
  const [grades, credits] = [all("grade"), all("credits")];
  const [grade, credit] = [grades[0], credits[0]];
  if (all("course").length === 0 || grades.length !== 1 || credits.length !== 1 || grade === undefined || credit === undefined) return undefined;
  return { grade, credits: credit };
};

/** One course row as written: its grade word and its credits cell. */
export type CourseRow = { readonly grade: string; readonly credits: string };

const holdsAny = (text: string, patterns: readonly string[]): boolean => patterns.some((pattern) => holds(plain(text).toLowerCase(), pattern));

/** The course rows of every course table; a total row and a row that writes the GPA itself are not courses. */
export const courseRowsOf = (tables: readonly ChangeTable[], words: GpaWords): CourseRow[] => {
  const skip = [...words.columns.filter((word) => word.role === "total"), ...words.labels.filter((label) => !label.part)].map((word) => word.pattern);
  return tables.flatMap((table) => {
    const columns = courseColumnsOf(
      table.header.map((cell) => cell.text),
      words.columns,
    );
    if (columns === undefined) return [];
    const rows = table.rows.filter((row) => row.length === table.header.length && !holdsAny(row[0]?.text ?? "", skip));
    const textOf = (row: readonly TableCell[], index: number): string => plain(row[index]?.text ?? "");
    return rows
      .filter((row) => row.some((cell) => plain(cell.text) !== ""))
      .map((row) => ({ grade: textOf(row, columns.grade), credits: textOf(row, columns.credits) }));
  });
};

const CREDITS = /^\d+(?:\.\d+)?$/u;

type GradedRow = { readonly grade: string; readonly credits: number };

/** The rows that carry points; undefined when a row's grade is on no scale or its credits are not a number. */
export const gradedRowsOf = (rows: readonly CourseRow[], grades: readonly GradeWord[]): GradedRow[] | undefined => {
  const noPoints = new Set(grades.filter((word) => word.points === undefined).map((word) => word.pattern));
  const onScale = new Set(grades.filter((word) => word.points !== undefined).map((word) => word.pattern));
  const counted = rows.filter((row) => !noPoints.has(row.grade));
  if (counted.some((row) => !onScale.has(row.grade) || !CREDITS.test(row.credits))) return undefined;
  return counted.map((row) => ({ grade: row.grade, credits: Number(row.credits) }));
};

/** Above this, a number beside a grade is a range of marks (S (90)), not grade points. */
const GRADE_POINT_CEILING = 5;

const keyPattern = (grades: readonly GradeWord[]): RegExp => {
  const words = [...new Set(grades.filter((word) => word.points !== undefined).map((word) => word.pattern))].toSorted(
    (left, right) => right.length - left.length,
  );
  const number = String.raw`(\d+(?:\.\d+)?)`;
  return new RegExp(
    String.raw`(?<![A-Za-z0-9])(${words.map(escapeRegExp).join("|")})\s*(?:\(\s*${number}\s*(?:点|pts?\.?|points?)?\s*\)|=\s*${number}\s*点?)`,
    "gu",
  );
};

/**
 * The grade points a key line writes: a line naming grades (評価, Grades) with "S（4）" or "A = 4" pairs, so "Room A (4)"
 * is not read. "conflict" when the document gives one grade two different points, or numbers too large to be points.
 */
export const gradingKeyOf = (lines: readonly TextLine[], grades: readonly GradeWord[], cues: readonly string[]): ReadonlyMap<string, number> | "conflict" => {
  const pattern = keyPattern(grades);
  const keyLines = lines.filter((line) => holdsAny(line.text, cues));
  const pairs = keyLines.flatMap((line) =>
    [...plain(line.text).matchAll(pattern)].map((match) => ({ grade: match[1] ?? "", points: Number(match[2] ?? match[3]) })),
  );
  const key = new Map<string, number>();
  const clash = pairs.some(({ grade, points }) => {
    const known = key.get(grade);
    key.set(grade, points);
    return points > GRADE_POINT_CEILING || (known !== undefined && known !== points);
  });
  return clash ? "conflict" : key;
};

/** The points every lexicon scale holding all the grades agrees on; undefined when no scale holds them or two disagree. */
export const scalePointsOf = (used: readonly string[], grades: readonly GradeWord[]): ReadonlyMap<string, number> | undefined => {
  const scales = [...new Set(grades.flatMap((word) => (word.points === undefined ? [] : [word.scale])))];
  const pointsIn = (scale: string, grade: string): number | undefined => grades.find((word) => word.scale === scale && word.pattern === grade)?.points;
  const fitting = scales.filter((scale) => used.every((grade) => pointsIn(scale, grade) !== undefined));
  const points = new Map(used.map((grade) => [grade, new Set(fitting.map((scale) => pointsIn(scale, grade)))]));
  if (fitting.length === 0 || [...points.values()].some((values) => values.size !== 1)) return undefined;
  return new Map(used.map((grade) => [grade, [...(points.get(grade) ?? [])][0] ?? 0]));
};

/**
 * The document's key when it gives every used grade its points; otherwise the lexicon's scale, when the key gives none
 * of the used grades points other than the scale's.
 */
export const pointsFor = (
  used: readonly string[],
  key: ReadonlyMap<string, number> | "conflict",
  grades: readonly GradeWord[],
): ReadonlyMap<string, number> | undefined => {
  if (key === "conflict") return undefined;
  if (used.every((grade) => key.has(grade))) return key;
  const scale = scalePointsOf(used, grades);
  return scale !== undefined && used.every((grade) => !key.has(grade) || key.get(grade) === scale.get(grade)) ? scale : undefined;
};

/** A written GPA: where its number starts, the number as written, and its decimals. */
export type GpaStatement = { readonly offset: number; readonly text: string; readonly value: number; readonly decimals: number };

const LINE_MARK = /^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?/u;
const COLON = /[:：]/u;
const BRACKET = /[()]/u;
const WRITTEN_GPA = /^(\s*)(\d+(?:\.(\d+))?)/u;

/** A label without what it writes in brackets: 「評価平均(gpa)」 is 「評価平均」. */
const outsideBrackets = (label: string): string =>
  label
    .split(BRACKET)
    .filter((_, index) => index % 2 === 0)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();

/** What one "label: value" line says of a GPA: a statement, one of a part of the record, another figure, or nothing. */
type GpaLine = { readonly kind: "statement"; readonly statement: GpaStatement } | { readonly kind: "part" | "other" } | undefined;

const gpaLineOf = (line: TextLine, labels: readonly GpaLabel[]): GpaLine => {
  const mark = LINE_MARK.exec(line.text)?.[0] ?? "";
  const colon = line.text.slice(mark.length).search(COLON);
  if (colon <= 0) return undefined;
  const label = plain(line.text.slice(mark.length, mark.length + colon)).toLowerCase();
  const named = (part: boolean): boolean => labels.some((word) => word.part === part && holds(label, word.pattern));
  if (!named(false)) return undefined;
  if (named(true)) return { kind: "part" };
  const valueFrom = mark.length + colon + 1;
  const number = WRITTEN_GPA.exec(line.text.slice(valueFrom));
  if (number === null) return undefined;
  const outside = outsideBrackets(label);
  if (!labels.some((word) => !word.part && plain(word.pattern).toLowerCase() === outside)) return { kind: "other" };
  const [, space = "", text = "", fraction = ""] = number;
  return { kind: "statement", statement: { offset: line.start + valueFrom + space.length, text, value: Number(text), decimals: fraction.length } };
};

/** The written GPAs; none when a line gives one part of the record's, or a GPA figure under another label, or two values. */
export const gpaStatementsOf = (lines: readonly TextLine[], labels: readonly GpaLabel[]): GpaStatement[] => {
  const read = lines.flatMap((line) => gpaLineOf(line, labels) ?? []);
  const statements = read.flatMap((found) => (found.kind === "statement" ? [found.statement] : []));
  if (read.some((found) => found.kind !== "statement") || new Set(statements.map((statement) => statement.value)).size > 1) return [];
  return statements;
};

const DECIMAL_BASE = 10;
const SLACK = 1e-9;
/** Decimals of the computed GPA shown beside a GPA written as a whole number. */
const WHOLE_SHOWN_DECIMALS = 2;

/** The written GPA is the computed one rounded, or cut off, to the written decimals. */
export const withinRounding = (written: GpaStatement, computed: number): boolean => {
  const step = DECIMAL_BASE ** -written.decimals;
  const rounded = Math.abs(computed - written.value) <= step / 2 + SLACK;
  const cutOff = written.value <= computed + SLACK && computed - written.value < step - SLACK;
  return rounded || cutOff;
};

/** Σ(points × credits) / Σ credits, undefined with no credits. */
export const averageOf = (rows: readonly GradedRow[], points: ReadonlyMap<string, number>): number | undefined => {
  const credits = rows.reduce((sum, row) => sum + row.credits, 0);
  if (credits === 0) return undefined;
  return rows.reduce((sum, row) => sum + (points.get(row.grade) ?? 0) * row.credits, 0) / credits;
};

const computedGpa = (tables: readonly ChangeTable[], lines: readonly TextLine[], words: GpaWords): number | undefined => {
  const rows = gradedRowsOf(courseRowsOf(tables, words), words.grades);
  if (rows === undefined || rows.length === 0) return undefined;
  const cues = words.columns.filter((word) => word.role === "grade" || word.role === "points").map((word) => word.pattern);
  const points = pointsFor([...new Set(rows.map((row) => row.grade))], gradingKeyOf(lines, words.grades, cues), words.grades);
  return points === undefined ? undefined : averageOf(rows, points);
};

/** Each written GPA the document's course rows do not give, with the GPA they do give. */
export const gpaMismatches = (tables: readonly ChangeTable[], lines: readonly TextLine[], words: GpaWords): StructureIssue[] => {
  const statements = gpaStatementsOf(lines, words.labels);
  if (statements.length === 0) return [];
  const computed = computedGpa(tables, lines, words);
  if (computed === undefined) return [];
  return statements
    .filter((statement) => !withinRounding(statement, computed))
    .map((statement) => ({
      offset: statement.offset,
      values: { gpa: statement.text, computed: computed.toFixed(statement.decimals === 0 ? WHOLE_SHOWN_DECIMALS : statement.decimals) },
    }));
};
