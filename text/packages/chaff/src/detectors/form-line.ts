// Lines at the top of a form or a letter that are not sentences: a field ("Invoice number: INV-2026-0318",
// 「見積番号：RF-731852」) or a name standing alone (a letterhead, 「有限会社つばめ野リフォーム」). Pure.
import { labelLine } from "./number-unit.ts";
import type { Token } from "../plugin.ts";

/** Parts of speech a name is made of: no verb, adjective, determiner or particle. */
const NAME_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN", "NUM", "PUNCT", "SYM", "X"]);
/** A value with one of these says something ("Note: this page is a sample."); it is a sentence behind a label. */
const PREDICATE_POS: ReadonlySet<string> = new Set(["VERB", "AUX"]);

const isNameOnly = (tokens: readonly Token[]): boolean => tokens.some((token) => token.pos !== "PUNCT") && tokens.every((token) => NAME_POS.has(token.pos));

/** "Label: value" whose value states nothing: a number, a date, a name. */
const isField = (line: string, start: number, tokens: readonly Token[]): boolean => {
  const field = labelLine(line, start);
  return field !== undefined && !tokens.some((token) => token.span.start >= field.at && PREDICATE_POS.has(token.pos));
};

type Line = { readonly text: string; readonly start: number };

const linesOf = (text: string, start: number): Line[] =>
  text.split("\n").reduce<Line[]>((lines, line) => {
    const last = lines.at(-1);
    return [...lines, { text: line, start: last === undefined ? start : last.start + last.text.length + 1 }];
  }, []);

const isFormLine = (line: Line, tokens: readonly Token[]): boolean => {
  const inLine = tokens.filter((token) => token.span.start >= line.start && token.span.start < line.start + line.text.length);
  return isNameOnly(inLine) || isField(line.text, line.start, inLine);
};

/**
 * Every line of the block gives a field and its value, or only a name: the top of a form or a letterhead, not a sentence.
 * `start` is where the text starts in the coordinates of the tokens' spans. Without tokens no block is read as a form.
 */
export const isFormBlock = (text: string, start: number, tokens: readonly Token[] | undefined): boolean => {
  const lines = linesOf(text, start).filter((line) => line.text.trim() !== "");
  return tokens !== undefined && lines.length > 0 && lines.every((line) => isFormLine(line, tokens));
};

/** What a form block gives: the tokens after each field's label, and every token of a name line. */
export const formValueTokens = (text: string, start: number, tokens: readonly Token[]): Token[] =>
  linesOf(text, start).flatMap((line) => {
    const field = labelLine(line.text, line.start);
    const from = field?.at ?? line.start;
    return tokens.filter((token) => token.span.start >= from && token.span.start < line.start + line.text.length);
  });
