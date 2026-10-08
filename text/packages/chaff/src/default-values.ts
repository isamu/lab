// One parameter's default stated two ways on a page: the signature says `width = 72`, the options table says 72, and the
// prose says "`width` defaults to 80". Pure; reads the Markdown source. The words of a default column (Default, 既定値)
// and of a default in prose (defaults to, の既定値は) come from the language's lexicons.
import { codeFences } from "./detectors/code-fences.ts";

/** Where a default is stated, from the most to the least authoritative: the code, a table, a sentence. */
type Source = "code" | "table" | "prose";
type Stated = { readonly name: string; readonly value: string; readonly offset: number; readonly source: Source };

/** A default that disagrees with the one the code (or else a table) states. */
export type DefaultSlip = { readonly name: string; readonly value: string; readonly offset: number; readonly expected: string };

export type DefaultWords = { readonly headers: readonly string[]; readonly phrases: readonly string[] };

type Line = { readonly text: string; readonly start: number };

const RANK: Readonly<Record<Source, number>> = { code: 0, table: 1, prose: 2 };
/** The values read: a code span, a quoted string, or a literal (a number, true, false, null). */
const QUOTED: readonly RegExp[] = [/^`([^`]+)`/u, /^"([^"]*)"/u, /^'([^']*)'/u];
const LITERAL = /^(?:-?\d+(?:\.\d+)?|true|false|True|False|null|none|None|undefined)(?!\w|\.\d)/u;
const NAME_SPAN = /`([A-Za-z_$][\w$]*)`/gu;
const IDENTIFIER = /^[A-Za-z_$][\w$]*/u;
const SPREAD = /^(?:\.\.\.|\*{1,2})/u;
/** How far after the name a default phrase may start: "`width` defaults to", "`width` の既定値は". */
const PHRASE_REACH = 4;
/** A declaration, not a call: a keyword first, or a return type after the list. A call's width=40 is an argument. */
const KEYWORD_FIRST = /^[ \t]*(?:(?:export|async)[ \t]+)*(?:def|function\*?|fn|func)[ \t]/u;
const RETURN_TYPE = /\)[ \t]*(?::|->)/u;
const DELIMITER_ROW = /^[ \t|:-]+$/u;

const linesOf = (source: string): Line[] => {
  const starts = [0, ...[...source.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return starts.map((start, index) => ({ text: source.slice(start, (starts[index + 1] ?? source.length + 1) - 1), start }));
};

const valueAt = (text: string): string | undefined => {
  const trimmed = text.trimStart();
  const quoted = QUOTED.map((pattern) => pattern.exec(trimmed)?.[1]).find((value) => value !== undefined);
  return quoted ?? LITERAL.exec(trimmed)?.[0];
};

/** The text between a line's first ( and the ) that closes it. */
const parameterList = (text: string): { readonly list: string; readonly from: number } | undefined => {
  const open = text.indexOf("(");
  const state = { depth: 0, close: -1 };
  Array.from(text.slice(open)).some((char, index) => {
    if (char === "(") state.depth += 1;
    if (char === ")") state.depth -= 1;
    if (state.depth === 0) state.close = open + index;
    return state.depth === 0;
  });
  return open === -1 || state.close === -1 ? undefined : { list: text.slice(open + 1, state.close), from: open + 1 };
};

/** width = 72, width: int = 72, *args: a parameter's name and its default value, if it has one. */
const parameterDefault = (part: string): { readonly name: string; readonly value: string } | undefined => {
  const trimmed = part.trim().replace(SPREAD, "");
  const name = IDENTIFIER.exec(trimmed)?.[0];
  const equals = trimmed.search(/=(?!=)/u);
  const value = equals === -1 ? undefined : valueAt(trimmed.slice(equals + 1));
  return name === undefined || value === undefined ? undefined : { name, value };
};

const QUOTES = "\"'`";

/** A parameter list split at its commas, leaving a comma inside quotes or brackets (sep = ", ") in its parameter. */
const splitParameters = (list: string): string[] => {
  const state = { quote: "", depth: 0, from: 0 };
  const parts: string[] = [];
  [...list].forEach((char, index) => {
    if (state.quote !== "") {
      if (char === state.quote) state.quote = "";
      return;
    }
    if (QUOTES.includes(char)) state.quote = char;
    if ("([{".includes(char)) state.depth += 1;
    if (")]}".includes(char)) state.depth -= 1;
    if (char !== "," || state.depth !== 0) return;
    parts.push(list.slice(state.from, index));
    state.from = index + 1;
  });
  return [...parts, list.slice(state.from)];
};

const isDeclaration = (text: string): boolean => KEYWORD_FIRST.test(text) || RETURN_TYPE.test(text);

const inCodeLine = (line: Line, base: number): Stated[] => {
  const params = isDeclaration(line.text) ? parameterList(line.text) : undefined;
  if (params === undefined) return [];
  return splitParameters(params.list).flatMap((part, index, parts) => {
    const found = parameterDefault(part);
    const from = params.from + parts.slice(0, index).reduce((length, earlier) => length + earlier.length + 1, 0);
    return found === undefined ? [] : [{ ...found, offset: base + line.start + line.text.indexOf(found.name, from), source: "code" as const }];
  });
};

const inCode = (source: string): Stated[] =>
  codeFences(source).flatMap((fence) => linesOf(source.slice(fence.start, fence.end)).flatMap((line) => inCodeLine(line, fence.start)));

const cellsOf = (text: string): string[] =>
  text
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());

/** The rows of every table with a default column, as (first cell name, default cell). */
const inTables = (lines: readonly Line[], headers: ReadonlySet<string>): Stated[] =>
  lines.flatMap((line, index) => {
    const column = cellsOf(line.text).findIndex((cell) => headers.has(cell.replace(/[*`]/gu, "").toLowerCase()));
    const delimiter = lines[index + 1]?.text ?? "";
    if (column <= 0 || !delimiter.includes("---") || !DELIMITER_ROW.test(delimiter)) return [];
    const end = lines.findIndex((row, at) => at > index + 1 && !row.text.trimStart().startsWith("|"));
    return lines.slice(index + 2, end === -1 ? lines.length : end).flatMap((row) => {
      const cells = cellsOf(row.text);
      const name = /^`?([A-Za-z_$][\w$]*)`?$/u.exec(cells[0] ?? "")?.[1];
      const value = valueAt(cells[column] ?? "");
      return name === undefined || value === undefined ? [] : [{ name, value, offset: row.start + row.text.indexOf(name), source: "table" as const }];
    });
  });

/** "`width` defaults to 80", "`width` の既定値は 80 文字": a code name, a default phrase right after it, then the value. */
const inProse = (lines: readonly Line[], phrases: readonly string[]): Stated[] =>
  lines.flatMap((line) =>
    [...line.text.matchAll(NAME_SPAN)].flatMap((match) => {
      const after = line.text.slice(match.index + match[0].length);
      const phrase = phrases.map((candidate) => ({ candidate, at: after.toLowerCase().indexOf(candidate) })).find(({ at }) => at !== -1 && at <= PHRASE_REACH);
      const value = phrase === undefined ? undefined : valueAt(after.slice(phrase.at + phrase.candidate.length));
      return value === undefined ? [] : [{ name: match[1] ?? "", value, offset: line.start + match.index + 1, source: "prose" as const }];
    }),
  );

/** Python writes the same literals capitalised: True is true, None is null. */
const LITERAL_SPELLINGS: Readonly<Record<string, string>> = { True: "true", False: "false", None: "null", none: "null" };

const normalized = (value: string): string => LITERAL_SPELLINGS[value] ?? value;

const sameValue = (left: string, right: string): boolean =>
  normalized(left) === normalized(right) || (Number.isFinite(Number(left)) && Number(left) === Number(right) && left !== "" && right !== "");

/**
 * Every stated default that differs from the name's most authoritative statement (the code, else a table). Two
 * sentences that disagree with no code or table to settle it are left alone.
 */
export const defaultSlips = (source: string, words: DefaultWords): DefaultSlip[] => {
  const fences = codeFences(source);
  const lines = linesOf(source).filter((line) => !fences.some((fence) => line.start >= fence.start && line.start < fence.end));
  const stated = [...inCode(source), ...inTables(lines, new Set(words.headers)), ...inProse(lines, words.phrases)];
  return stated.flatMap((statement) => {
    const above = stated.filter((other) => other.name === statement.name && RANK[other.source] < RANK[statement.source]);
    const top = Math.min(...above.map((other) => RANK[other.source]));
    const authorities = above.filter((other) => RANK[other.source] === top);
    // Two functions on one page may give one parameter name two defaults; then no statement settles the others.
    const authority = authorities.every((other) => sameValue(other.value, authorities[0]?.value ?? "")) ? authorities[0] : undefined;
    return authority === undefined || sameValue(authority.value, statement.value)
      ? []
      : [{ name: statement.name, value: statement.value, offset: statement.offset, expected: authority.value }];
  });
};
