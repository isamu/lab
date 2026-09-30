// Whether a team's regular expression can run away. JavaScript's engine backtracks, so a pattern such as (a+)+ takes time
// exponential in the length of a line that almost matches. Pure: the pattern is read as text, never run on a document.

/** Longer patterns are refused: a rule that needs one is better written as several. */
export const MAX_PATTERN_LENGTH = 500;

export type RegexRefusal = "too-long" | "nested-quantifier" | "backreference" | "empty-match" | "invalid";

/** An open group: whether it holds a repeat without bound, or an alternation. */
type Group = { unbounded: boolean; alternation: boolean };

type Scan = { at: number; readonly stack: Group[] };

const QUANTIFIER_START: ReadonlySet<string> = new Set(["*", "+", "?", "{"]);
const BRACE = /^\{(\d+)(,(\d*))?\}\??/u;
const BACKREFERENCE = /^\\(?:[1-9]|k<)/u;
const CLASS_BODY = /^\^?\]?(?:\\.|[^\]\\])*\]/u;

/** The quantifier at pattern[at], and whether it repeats without bound (*, +, {n,}). undefined when none is there. */
const quantifierAt = (pattern: string, at: number): { readonly length: number; readonly unbounded: boolean } | undefined => {
  const char = pattern[at];
  if (char === undefined || !QUANTIFIER_START.has(char)) return undefined;
  if (char !== "{") return { length: pattern[at + 1] === "?" ? 2 : 1, unbounded: char !== "?" };
  const brace = BRACE.exec(pattern.slice(at));
  if (brace === null) return undefined;
  return { length: brace[0].length, unbounded: brace[2] !== undefined && brace[3] === "" };
};

/** Just past the "]" that closes the character class opened at pattern[at]. */
const classEnd = (pattern: string, at: number): number => {
  const close = CLASS_BODY.exec(pattern.slice(at + 1));
  return close === null ? pattern.length : at + 1 + close[0].length;
};

const innermost = (scan: Scan): Group => scan.stack[scan.stack.length - 1] ?? { unbounded: false, alternation: false };

/** After an atom that ends at end (closed is the group it closes, if any): a group that repeats a repeat is refused. */
const afterAtom = (pattern: string, scan: Scan, end: number, closed: Group | undefined): RegexRefusal | undefined => {
  const quantifier = quantifierAt(pattern, end);
  scan.at = end + (quantifier?.length ?? 0);
  if (closed !== undefined && (closed.unbounded || closed.alternation) && quantifier?.unbounded === true) return "nested-quantifier";
  if (quantifier?.unbounded === true || closed?.unbounded === true) innermost(scan).unbounded = true;
  return undefined;
};

/** Reads one escape, class, bracket or character at scan.at. */
const step = (pattern: string, scan: Scan): RegexRefusal | undefined => {
  const char = pattern[scan.at];
  if (char === "\\") return BACKREFERENCE.test(pattern.slice(scan.at)) ? "backreference" : afterAtom(pattern, scan, scan.at + 2, undefined);
  if (char === "[") return afterAtom(pattern, scan, classEnd(pattern, scan.at), undefined);
  if (char === "(") {
    scan.stack.push({ unbounded: false, alternation: false });
    scan.at += 1;
    return undefined;
  }
  if (char === ")") return afterAtom(pattern, scan, scan.at + 1, scan.stack.length > 1 ? scan.stack.pop() : undefined);
  if (char === "|") innermost(scan).alternation = true;
  return afterAtom(pattern, scan, scan.at + 1, undefined);
};

/**
 * A group repeated without bound that holds a repeat without bound or an alternation ((a+)+, (a|aa)*, (\w+\s?)*) is the shape
 * that backtracks exponentially. The pattern is read once, left to right, with a stack of open groups.
 */
const nestedRepeat = (pattern: string): RegexRefusal | undefined => {
  const scan: Scan = { at: 0, stack: [{ unbounded: false, alternation: false }] };
  while (scan.at < pattern.length) {
    const refusal = step(pattern, scan);
    if (refusal !== undefined) return refusal;
  }
  return undefined;
};

/** Why the pattern is refused, or undefined when it may run. flags are the ones the rule runs with ("u", "iu"). */
export const regexRefusal = (pattern: string, flags: string): RegexRefusal | undefined => {
  if (pattern.length > MAX_PATTERN_LENGTH) return "too-long";
  try {
    if (new RegExp(pattern, flags).test("")) return "empty-match";
  } catch {
    return "invalid";
  }
  return nestedRepeat(pattern);
};
