import type { Span } from "./plugin.ts";

// Round brackets that group an arithmetic formula (賃金 × (1 - 時間 ÷ 月平均)) rather than set off an aside in prose.

const OPENING = new Set(["(", "（"]);
const CLOSING = new Set([")", "）"]);
/** Inside the brackets: a multiplication or division sign, or a plus, minus or equals sign with a space on each side. Unspaced, - and = are hyphens and labels (A-1, 2026-04). */
const OPERATOR_INSIDE = /[×÷]|[ \u3000][+＋\-−－=＝][ \u3000]/u;
/** Just before the opening bracket, past spaces: a multiplication or division sign, or a spaced sign. */
const OPERATOR_BEFORE = /(?:[×÷]|[ \u3000][+＋\-−－=＝])[ \u3000]*$/u;
/** Just after the closing bracket, past spaces. An asterisk is not a sign here: in prose it marks a note (*（注）). */
const OPERATOR_AFTER = /^[ \u3000]*(?:[×÷]|[+＋\-−－=＝][ \u3000])/u;

type Scan = { readonly open: number[]; readonly pairs: Span[] };

const step = (scan: Scan, char: string, at: number): Scan => {
  if (OPENING.has(char)) scan.open.push(at);
  const start = CLOSING.has(char) ? scan.open.pop() : undefined;
  if (start !== undefined) scan.pairs.push({ start, end: at + 1 });
  return scan;
};

const isFormula = (text: string, pair: Span): boolean =>
  OPERATOR_INSIDE.test(text.slice(pair.start + 1, pair.end - 1)) ||
  OPERATOR_BEFORE.test(text.slice(0, pair.start)) ||
  OPERATOR_AFTER.test(text.slice(pair.end));

/**
 * The bracket pairs in text that belong to a formula, each span covering both brackets. Full-width and half-width brackets
 * pair with each other. A bracket left unclosed or closing nothing is not part of any pair. Positions count from 0 in text.
 */
export const formulaBracketSpans = (text: string): Span[] =>
  text
    .split("")
    .reduce<Scan>(step, { open: [], pairs: [] })
    .pairs.filter((pair) => isFormula(text, pair));
