// A function's signature in a code block against the parameter table written under it: a row naming a parameter the
// signature does not take, or a parameter of the signature the table leaves out. Pure; reads the Markdown source. The
// header words that make a table a parameter table (Parameter, 引数) come from the language's lexicon.

/** A name, where it is written, and the function it belongs to. */
export type ParameterSlip = { readonly name: string; readonly offset: number; readonly fn: string; readonly side: "table" | "signature" };

type Line = { readonly text: string; readonly start: number };
type Signature = { readonly fn: string; readonly params: readonly { readonly name: string; readonly offset: number }[] };

const FENCE = /^ {0,3}(`{3,}|~{3,})/u;
const HEADING = /^ {0,3}#{1,6}[ \t]/u;
const TABLE_ROW = /^[ \t]{0,3}\|/u;
const DELIMITER_ROW = /^[ \t]{0,3}\|?[ \t]*:?-{3,}/u;

const MODIFIERS = /^[ \t]*(?:(?:export|declare|async)[ \t]+)*/u;
const KEYWORD = /^(?:function\*?|def|fn|func)[ \t]+/u;
const BINDING = /^(?:const|let|var)[ \t]+/u;
/** After a bound name, up to the arrow function's list: `: Wrap = async (`. */
const ARROW_START = /^[^=]*=[ \t]*(?:async[ \t]*)?\(/u;
/** After an arrow function's list: an optional return type, then =>. */
const ARROW_END = /^[ \t]*(?::[^=]*)?=>/u;
const RETURN_TYPE = /^[ \t]*(?::|->)/u;
const GENERICS = /^[ \t]*<[^<>()]*>/u;

const IDENTIFIER = /^[A-Za-z_$][\w$]*/u;
/** What may stand before a parameter's name: a spread (...rest, *args, **kwargs) or a Rust borrow (&self, &mut self, mut x). */
const SPREAD = /^(?:\.\.\.|\*{1,2}|&(?:mut[ \t]+)?|mut[ \t]+)/u;
/** The receiver a method declares first, which a call does not pass. */
const RECEIVERS: ReadonlySet<string> = new Set(["self", "cls", "this"]);
const OPENERS = "([{<";
const CLOSERS = ")]}>";
const ARROW_HEADS = "=-";

const linesOf = (source: string): Line[] => {
  const starts = [0, ...[...source.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return starts.map((start, index) => ({ text: source.slice(start, (starts[index + 1] ?? source.length + 1) - 1), start }));
};

/** The parameters' text split at the commas outside brackets, with where each starts. */
const splitParams = (text: string): { readonly text: string; readonly from: number }[] => {
  const parts: { text: string; from: number }[] = [];
  const state = { depth: 0, from: 0 };
  [...text].forEach((char, index) => {
    if (OPENERS.includes(char)) state.depth += 1;
    // The > of an arrow (=> in a callback's type, -> in a return type) closes no bracket.
    if (CLOSERS.includes(char) && !(char === ">" && ARROW_HEADS.includes(text[index - 1] ?? " "))) state.depth -= 1;
    if (char !== "," || state.depth !== 0) return;
    parts.push({ text: text.slice(state.from, index), from: state.from });
    state.from = index + 1;
  });
  parts.push({ text: text.slice(state.from), from: state.from });
  return parts.filter((part) => part.text.trim() !== "");
};

const skipSpaces = (text: string, at: number): number => at + (text.slice(at).length - text.slice(at).trimStart().length);

/** The index of the ) that closes the ( at `open`, or -1. */
const closingParen = (text: string, open: number): number => {
  const state = { depth: 0, at: -1 };
  Array.from(text.slice(open)).some((char, index) => {
    if (char === "(") state.depth += 1;
    if (char === ")") state.depth -= 1;
    if (state.depth === 0) state.at = open + index;
    return state.depth === 0;
  });
  return state.at;
};

type Declared = { readonly fn: string; readonly params: string; readonly paramsAt: number };

/** The parameter list that opens at `open`, if it closes and `isDeclaration` holds for the text after it. */
const listAt = (line: string, fn: string, open: number, isDeclaration: (after: string) => boolean): Declared | undefined => {
  const close = line[open] === "(" ? closingParen(line, open) : -1;
  return close === -1 || !isDeclaration(line.slice(close + 1)) ? undefined : { fn, params: line.slice(open + 1, close), paramsAt: open + 1 };
};

/** An arrow function bound to a name: `const wrap = (text: string): string[] =>`. */
const arrowOf = (line: string, at: number): Declared | undefined => {
  const binding = BINDING.exec(line.slice(at));
  const fn = binding === null ? undefined : IDENTIFIER.exec(line.slice(at + binding[0].length))?.[0];
  if (binding === null || fn === undefined) return undefined;
  const afterName = at + binding[0].length + fn.length;
  const start = ARROW_START.exec(line.slice(afterName));
  return start === null ? undefined : listAt(line, fn, afterName + start[0].length - 1, (after) => ARROW_END.test(after));
};

/**
 * A declaration: a keyword before the name (function, def, fn, func with a Go receiver or without) or a return type after
 * the list (`): number`, `) -> int`). A call (`wrap(text, 10);`) has neither.
 */
const functionOf = (line: string, at: number): Declared | undefined => {
  const keyword = KEYWORD.exec(line.slice(at))?.[0];
  const afterKeyword = at + (keyword?.length ?? 0);
  const receiverEnd = keyword?.startsWith("func") === true && line[afterKeyword] === "(" ? closingParen(line, afterKeyword) : -1;
  const nameAt = receiverEnd === -1 ? afterKeyword : skipSpaces(line, receiverEnd + 1);
  const fn = IDENTIFIER.exec(line.slice(nameAt))?.[0];
  if (fn === undefined) return undefined;
  const afterName = nameAt + fn.length;
  const generics = GENERICS.exec(line.slice(afterName))?.[0] ?? "";
  const open = skipSpaces(line, afterName + generics.length);
  return listAt(line, fn, open, (after) => keyword !== undefined || RETURN_TYPE.test(after));
};

const declarationOf = (line: string): Declared | undefined => {
  const at = MODIFIERS.exec(line)?.[0].length ?? 0;
  return arrowOf(line, at) ?? functionOf(line, at);
};

/** The signature a line declares; undefined for a call, or for a parameter that is not a plain name (a destructured one). */
export const signatureOf = (line: string, offset = 0): Signature | undefined => {
  const declared = declarationOf(line);
  if (declared === undefined) return undefined;
  const { paramsAt } = declared;
  const params = splitParams(declared.params).map((part) => {
    const lead = part.text.length - part.text.trimStart().length;
    const spread = SPREAD.exec(part.text.trimStart())?.[0] ?? "";
    const name = IDENTIFIER.exec(part.text.trimStart().slice(spread.length))?.[0];
    return { name, offset: offset + paramsAt + part.from + lead + spread.length };
  });
  if (params.some((param) => param.name === undefined)) return undefined;
  return {
    fn: declared.fn,
    params: params.flatMap((param) => (param.name === undefined || RECEIVERS.has(param.name) ? [] : [{ name: param.name, offset: param.offset }])),
  };
};

const cellsOf = (text: string): { readonly text: string; readonly from: number }[] => {
  const bounds = [-1, ...[...text.matchAll(/(?<!\\)\|/gu)].map((match) => match.index), text.length];
  const cells = bounds.slice(1).map((end, index) => ({ text: text.slice((bounds[index] ?? -1) + 1, end), from: (bounds[index] ?? -1) + 1 }));
  return cells.slice(cells[0]?.text.trim() === "" ? 1 : 0);
};

const WRAPPING_MARKS = "`*_";

/** A cell's text without the code and emphasis marks around it (`width`, **width**). */
const unwrap = (text: string): string => {
  const chars = [...text.trim()];
  const from = chars.findIndex((char) => !WRAPPING_MARKS.includes(char));
  return from === -1 ? "" : chars.slice(from, chars.findLastIndex((char) => !WRAPPING_MARKS.includes(char)) + 1).join("");
};

/** A parameter row's name: `options.prefix` is a field of options, `width?` the parameter width. */
const rowName = (line: Line): { readonly name: string; readonly offset: number } | undefined => {
  const cell = cellsOf(line.text)[0];
  if (cell === undefined) return undefined;
  const bare = unwrap(cell.text);
  const name = IDENTIFIER.exec(bare.replace(SPREAD, ""))?.[0];
  return name === undefined ? undefined : { name, offset: line.start + cell.from + cell.text.indexOf(bare) };
};

const isHeaderOf = (line: Line, headers: ReadonlySet<string>): boolean => headers.has(unwrap(cellsOf(line.text)[0]?.text ?? "").toLowerCase());

/** The rows of the table whose header is at `index`, up to the first line that is not a row. */
const rowsFrom = (lines: readonly Line[], index: number): Line[] => {
  const end = lines.findIndex((line, at) => at > index + 1 && !TABLE_ROW.test(line.text));
  return lines.slice(index + 2, end === -1 ? lines.length : end);
};

const compare = (signature: Signature & { readonly line: number }, rows: readonly Line[]): ParameterSlip[] => {
  const named = rows.flatMap((row) => rowName(row) ?? []);
  const inTable = new Set(named.map((row) => row.name));
  const inSignature = new Set(signature.params.map((param) => param.name));
  return [
    ...signature.params.filter((param) => !inTable.has(param.name)).map((param) => ({ ...param, fn: signature.fn, side: "signature" as const })),
    ...named.filter((row) => !inSignature.has(row.name)).map((row) => ({ ...row, fn: signature.fn, side: "table" as const })),
  ].toSorted((left, right) => left.offset - right.offset);
};

type Walk = { fence: string | undefined; signatures: (Signature & { line: number })[]; pending: (Signature & { line: number }) | undefined };

/**
 * Every parameter table that follows a code block declaring exactly one function, before the next heading or code
 * block, compared with that function's signature. headers are the lowercase words a parameter table's first header has.
 */
/** A line inside a code block: a declaration is collected, and the closing fence leaves the block's one signature pending. */
const inBlock = (walk: Walk, line: Line, index: number, fence: string | undefined): void => {
  const open = walk.fence ?? "";
  if (fence !== undefined && fence[0] === open[0] && fence.length >= open.length) {
    walk.pending = walk.signatures.length === 1 ? walk.signatures[0] : undefined;
    walk.fence = undefined;
    return;
  }
  const signature = signatureOf(line.text, line.start);
  if (signature !== undefined) walk.signatures.push({ ...signature, line: index });
};

export const parameterSlips = (source: string, headers: ReadonlySet<string>): ParameterSlip[] => {
  const lines = linesOf(source);
  const walk: Walk = { fence: undefined, signatures: [], pending: undefined };
  return lines.flatMap((line, index) => {
    const fence = FENCE.exec(line.text)?.[1];
    if (walk.fence !== undefined) {
      inBlock(walk, line, index, fence);
      return [];
    }
    if (fence !== undefined || HEADING.test(line.text)) {
      walk.fence = fence;
      walk.signatures = [];
      walk.pending = undefined;
      return [];
    }
    const pending = walk.pending;
    if (pending === undefined || !TABLE_ROW.test(line.text) || !DELIMITER_ROW.test(lines[index + 1]?.text ?? "")) return [];
    walk.pending = undefined;
    return isHeaderOf(line, headers) ? compare(pending, rowsFrom(lines, index)) : [];
  });
};
