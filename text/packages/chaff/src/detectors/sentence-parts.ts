// Text the sentence splitter hands over as one sentence although the writer did not write one: lines of labels and values
// (When: Friday / Where: …), a grammar written in a plain-text specification (body = signed / unsigned), a table whose cells
// a converter ran together (…設立1945年７月日染興業…, 39,0439,677…), and a quotation the writer introduces with a colon.
// Each is measured part by part, or not at all. Pure: the text in, the parts out.

import type { Span } from "../plugin.ts";

const LINE_BREAK = /\n/u;
/** A sentence's end on a line: a stop, then any closing quotes or brackets. */
const LINE_ENDS_SENTENCE = /[.?!。？！][\s"'”’)\]）」』]*$/u;
/** A label of a few words, a colon, then the value (When: Friday, 12:30 / 日時：10月1日). */
const LABEL_LINE = /^[^\s:：][^:：]{0,59}[:：]\s*\S/u;
const MIN_LINES = 2;

const linesOf = (text: string): string[] =>
  text
    .split(LINE_BREAK)
    .map((line) => line.trim())
    .filter((line) => line !== "");

/** Two or more lines, each a label and its value, none closed by a stop: each line is measured as one. */
export const labelLineParts = (text: string): readonly string[] | undefined => {
  const lines = linesOf(text);
  if (lines.length < MIN_LINES) return undefined;
  return lines.every((line) => LABEL_LINE.test(line) && !LINE_ENDS_SENTENCE.test(line)) ? lines : undefined;
};

/** A grammar rule (UTF8-char = UTF8-1 / UTF8-2): a name with no space in it, then = between spaces. */
const GRAMMAR_RULE = /^\p{L}[\p{L}\p{N}_-]*\s+=\s/u;
/** A grammar's comment line (; order of fields is not important). */
const GRAMMAR_COMMENT = /^;/u;

/** Most of its lines are grammar rules or a grammar's comments, at least one a rule: code, not a sentence. */
export const isGrammarBlock = (text: string): boolean => {
  const lines = linesOf(text);
  const rules = lines.filter((line) => GRAMMAR_RULE.test(line)).length;
  const comments = lines.filter((line) => GRAMMAR_COMMENT.test(line)).length;
  return rules > 0 && (rules + comments) * 2 > lines.length;
};

/**
 * Cells of numbers run together: a comma group past three digits (39,0439,677), or decimals one after another
 * (62.722.99.713.4). Four stops at least, so that a section number (3.5.3) or an address (192.168.1.1) is not one.
 */
const GLUED_NUMBER = /\d[,，]\d{4}|\d(?:[.．]\d+){4}/u;
/** A run of numbers, signs and empty-cell dashes (39,0439,6773,503…△0.6); it is cut out when it holds glued cells. */
const NUMBER_RUN = /[\d,，.．△▲－−%％-]+/gu;
const CUT = "\n";
/** A date that opens a row, run into the cell before it and the cell after it (…設立1945年７月日染興業…). */
const GLUED_DATE =
  /(?<=[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}ー])(?=[0-9０-９]{4}年[0-9０-９]{1,2}月[\p{Script=Han}\p{Script=Katakana}\p{L}])/gu;
/** Fewer glued dates than this are a sentence that names a date or two, not the rows of a chronology. */
const MIN_GLUED_DATES = 3;

const nonEmpty = (parts: readonly string[]): string[] => parts.map((part) => part.trim()).filter((part) => part !== "");

/** Whether the text holds cells of numbers a converter ran together (39,0439,677). */
export const hasGluedNumbers = (text: string): boolean => GLUED_NUMBER.test(text);

/** Where the text holds numbers of several cells run together (8,45795.7 for 8,457 and 95.7): no digit in them can be read as one number. */
export const gluedNumberSpans = (text: string): Span[] =>
  [...text.matchAll(NUMBER_RUN)].filter((run) => GLUED_NUMBER.test(run[0])).map((run) => ({ start: run.index, end: run.index + run[0].length }));

/** The cells of a table a converter flattened into one sentence, cut at the glued numbers or at each row's date. */
export const flattenedTableParts = (text: string): readonly string[] | undefined => {
  if (hasGluedNumbers(text)) return nonEmpty(text.replace(NUMBER_RUN, (run) => (GLUED_NUMBER.test(run) ? CUT : run)).split(CUT));
  const rows = text.split(GLUED_DATE);
  return rows.length > MIN_GLUED_DATES ? nonEmpty(rows) : undefined;
};

/** A quotation the writer opens after a colon (has observed: "The credibility of money …"), in straight or curly quotes. */
const COLON_QUOTATION = /[:：]\s*["“]([^"“”]+)["”]/gu;

/** The quoted words after a colon and the writer's own words around them, measured apart: the quotation is not the writer's to shorten. */
export const colonQuotationParts = (text: string): readonly string[] | undefined => {
  const quotes = [...text.matchAll(COLON_QUOTATION)].map((match) => match[1] ?? "");
  if (quotes.length === 0) return undefined;
  return nonEmpty([text.replace(COLON_QUOTATION, ":"), ...quotes]);
};

/** A header cell closed by its unit in brackets (所有割合(％), 従業員数（人）, 資本金(百万円)). */
const UNIT_HEADER = /[（(](?:％|%|人|名|株|件|台|社|円|千円|百万円)[）)]/gu;
/** Fewer unit headers than this are a sentence that names a unit or two, not a table's header row. */
const MIN_UNIT_HEADERS = 3;

/** Whether a sentence is a table a converter flattened: glued numbers, rows opened by dates, or a header row of cells closed by units. */
export const isFlattenedTable = (text: string): boolean =>
  flattenedTableParts(text) !== undefined || (text.match(UNIT_HEADER)?.length ?? 0) >= MIN_UNIT_HEADERS;
