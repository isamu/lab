// Pure: the parts of a guide page that scripts/guide-screens.ts runs chaff for, and the comparison of a screen with what
// chaff prints. A guide page shows chaff's screen in a code block that starts with "$ npx chaffjs <args>". Lines that
// change with every new rule are not kept on the page: "{not-run}" stands for the list of rules that did not run, and
// "{counts}" for the last line of --compact ("3 findings, 97 rules not run"). The site fills both in at build.
// A screen's documents are the page's ```<lang> file=<name> blocks, then the files in site/src/screens/<lang>/<page>/;
// a "<!-- chaff-screen: <name> -->" line just above the screen adds site/src/screens/<lang>/<page>--<name>/ over them.

import { COUNTS_MARKER, NOT_RUN_MARKER, type ScreenFills } from "../site/src/lib/screenFills.ts";

const PROMPT = "$ npx chaffjs ";
// A fence may be indented, as under a list item, and longer than three backticks, to hold ``` in its body. It closes
// at the same indent and length; the body loses the indent.
const FENCE = /^(?:[ \t]*<!-- chaff-screen: (\S+) -->\n)?( *)(`{3,})([^`\n]*)\n([\s\S]*?)^\2\3[ \t]*$/gmu;
const FILE_META = /(?:^|\s)file=(\S+)/u;
const NOT_RUN_HEADER = /^ *(?:\d+ rules? did not run:|\d+ 件の rule は動いていません:)$/u;
const LIST_ENTRY = /^ {6}\S/u;
const COUNTS_LINE = /^(?:\d+ findings?(?:, \d+ rules? not run)?|指摘 \d+ 件(?:、動いていない rule \d+ 件)?)$/u;
/** A line of a screen that stands for any number of lines chaff printed, the page showing only part of the screen. */
export const ELISION = "…";

/** A screen: the command as the page writes it, the arguments chaff gets, its extra files, and what the page shows. */
export type Screen = { readonly command: string; readonly args: readonly string[]; readonly setup?: string; readonly shown: string };

export type PageScreens = { readonly documents: Readonly<Record<string, string>>; readonly screens: readonly Screen[] };

const ARG = /"([^"]*)"|'([^']*)'|((?:\\.|[^\s"'\\])+)/gu;
const ESCAPED = /\\(.)/gu;

/** The arguments a shell would pass for the command: split at spaces, a quoted argument kept whole without its quotes. */
export const argsOf = (command: string): string[] =>
  [...command.slice(PROMPT.length).matchAll(ARG)].map(([, double, single, bare]) => double ?? single ?? bare?.replace(ESCAPED, "$1") ?? "");

const dedent = (body: string, indent: string): string =>
  indent === ""
    ? body
    : body
        .split("\n")
        .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line.trimStart()))
        .join("\n");

/** The documents (```<lang> file=<name>) and every screen ("$ npx chaffjs ...") of one guide page, in page order. */
export const screensIn = (page: string): PageScreens => {
  const blocks = [...page.matchAll(FENCE)].map(([, setup, indent = "", , info = "", body = ""]) => ({ setup, info, body: dedent(body, indent) }));
  const documents = Object.fromEntries(
    blocks.flatMap(({ info, body }) => {
      const name = FILE_META.exec(info)?.[1];
      return name === undefined ? [] : [[name, body]];
    }),
  );
  const screens = blocks
    .filter(({ body }) => body.startsWith(PROMPT))
    .map(({ setup, body }) => {
      const command = body.split("\n")[0] ?? "";
      return { command, args: argsOf(command), ...(setup === undefined ? {} : { setup }), shown: body };
    });
  return { documents, screens };
};

const indented = (body: string, indent: string): string =>
  indent === ""
    ? body
    : body
        .split("\n")
        .map((line) => (line === "" ? line : `${indent}${line}`))
        .join("\n");

/**
 * The page with its screens' text replaced, in page order: `bodies[n]` for the n-th screen, which stays as it is where
 * that is undefined. A screen's text is what `screensIn` gives as `shown`, and goes back under the fence's indent.
 */
export const replaceScreens = (page: string, bodies: readonly (string | undefined)[]): string => {
  const seen = { screens: 0 };
  return page.replace(FENCE, (whole: string, _setup: unknown, indent: string, _ticks: unknown, _info: unknown, body: string) => {
    if (!dedent(body, indent).startsWith(PROMPT)) return whole;
    const replacement = bodies[seen.screens];
    seen.screens += 1;
    if (replacement === undefined) return whole;
    const closing = whole.slice(whole.lastIndexOf("\n") + 1);
    const opening = whole.slice(0, whole.length - closing.length - body.length);
    return `${opening}${indented(replacement, indent)}${closing}`;
  });
};

const hasLine = (code: string, marker: string): boolean => code.split("\n").some((line) => line.trim() === marker);

/** Whether the screen keeps a line for the site to fill in. */
export const hasFill = (shown: string): boolean => hasLine(shown, NOT_RUN_MARKER) || hasLine(shown, COUNTS_MARKER);

/** The "N rules did not run:" line and the rule lines under it, from chaff's screen; undefined when the screen has none. */
export const notRunBlock = (output: string): string | undefined => {
  const lines = output.split("\n");
  const start = lines.findIndex((line) => NOT_RUN_HEADER.test(line));
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => !LIST_ENTRY.test(line));
  return lines.slice(start, start + 1 + (end === -1 ? rest.length : end)).join("\n");
};

/** The last line of a --compact screen ("3 findings, 97 rules not run"); undefined when there is none. */
export const countsLine = (output: string): string | undefined => output.split("\n").findLast((line) => COUNTS_LINE.test(line));

/** The markers a screen keeps that the fills have nothing for. */
export const missingFills = (shown: string, fills: ScreenFills): string[] => [
  ...(hasLine(shown, NOT_RUN_MARKER) && fills.notRun === undefined ? [NOT_RUN_MARKER] : []),
  ...(hasLine(shown, COUNTS_MARKER) && fills.counts === undefined ? [COUNTS_MARKER] : []),
];

/** What a screen's markers are filled with, from what chaff printed for it; only the markers the screen has. */
export const fillsFor = (shown: string, output: string): ScreenFills => {
  const notRun = hasLine(shown, NOT_RUN_MARKER) ? notRunBlock(output) : undefined;
  const counts = hasLine(shown, COUNTS_MARKER) ? countsLine(output) : undefined;
  return { ...(notRun === undefined ? {} : { notRun }), ...(counts === undefined ? {} : { counts }) };
};

/** What chaff prints for a command, as a page would show it: the prompt line, one blank line, then the output. */
export const asScreen = (command: string, output: string): string => [command, "", output.replace(/^\n+/u, "")].join("\n");

const linesOf = (text: string): string[] => {
  const [prompt = "", ...output] = text.split("\n").map((line) => line.trimEnd());
  const first = output.findIndex((line) => line !== "");
  const last = output.findLastIndex((line) => line !== "");
  return [prompt, ...(first === -1 ? [] : output.slice(first, last + 1))];
};

/** The places in chaff's lines that one more line of the screen can leave the match at, from the places before it. */
const step =
  (actual: readonly string[]) =>
  (reached: ReadonlySet<number>, line: string): Set<number> => {
    if (line.trim() === ELISION) {
      const from = Math.min(...reached);
      return new Set(Array.from({ length: Math.max(actual.length - from + 1, 0) }, (_, skip) => from + skip));
    }
    return new Set([...reached].filter((at) => actual[at] === line).map((at) => at + 1));
  };

/**
 * Whether a screen as the page shows it (markers filled in) is what chaff printed: line for line, ignoring trailing
 * spaces and the blank lines around the output, where a line holding only "…" stands for any number of chaff's lines.
 */
export const screenMatches = (shown: string, actual: string): boolean => {
  const actualLines = linesOf(actual);
  return linesOf(shown)
    .reduce(step(actualLines), new Set([0]))
    .has(actualLines.length);
};
