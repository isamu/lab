import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { danglingReferences, duplicateDefinitions, type StructureIssue } from "../structure/issues.ts";
import { numberingBreaks } from "../structure/numbering.ts";
import { weekdayMismatches } from "../structure/weekday.ts";

const QUOTE_LENGTH = 80;

/** 指摘の位置から行末までを引用する。条の見出しや参照を含む一行が、読み手の探す手がかりになる。 */
const quoteAt = (source: string, offset: number): string => {
  const end = source.indexOf("\n", offset);
  return source
    .slice(offset, end === -1 ? source.length : end)
    .slice(0, QUOTE_LENGTH)
    .trim();
};

const findingsOf =
  (rule: string, issuesOf: (tree: NonNullable<ProseDocument["structure"]>) => StructureIssue[]): Detector =>
  (doc): Finding[] =>
    doc.structure === undefined
      ? []
      : issuesOf(doc.structure).map((issue) => ({
          rule,
          severity: "error",
          line: 0,
          column: 0,
          quote: quoteAt(doc.source, issue.offset),
          values: { ...issue.values, offset: issue.offset },
        }));

export const danglingReference: Detector = findingsOf("dangling-reference", danglingReferences);
export const numberingGap: Detector = findingsOf("numbering-gap", numberingBreaks);
export const duplicateDefinition: Detector = findingsOf("duplicate-definition", duplicateDefinitions);

/** 曜日の名前は言語パッケージの語彙表（weekday、日曜日から順）から取る。無ければ番号のまま。 */
const dayName = (doc: ProseDocument, day: unknown): string => {
  const index = Number(day);
  return doc.lexicons["weekday"]?.[index]?.pattern ?? String(index);
};

export const dateWeekdayMismatch: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : weekdayMismatches(doc.structure).map((issue) => ({
        rule: "date-weekday-mismatch",
        severity: "error",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, issue.offset),
        values: {
          date: String(issue.values["date"]),
          written: dayName(doc, issue.values["written"]),
          actual: dayName(doc, issue.values["actual"]),
          offset: issue.offset,
        },
      }));
