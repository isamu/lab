// Pure: the parts of a guide page that scripts/guide-screens.ts runs chaff for, and the comparison of a screen with what
// chaff prints. A guide page shows chaff's screen in a code block that starts with "$ npx chaffjs <args>". Lines that
// change with every new rule are not kept on the page: "{not-run}" stands for the list of rules that did not run (with
// the hint under it, which names one of them), "{not-run: <rule>}" for that rule's line of such a list (a column padded
// to the longest id), and "{counts}" for the last line of --compact ("3 findings, 97 rules not run"). The site fills
// them in at build.
// A screen's documents are the page's ```<lang> file=<name> blocks, then the files in site/src/screens/<lang>/<page>/;
// a "<!-- chaff-screen: <name> -->" line just above the screen adds site/src/screens/<lang>/<page>--<name>/ over them.

import { COUNTS_MARKER, NOT_RUN_MARKER, notRunRowMarker, rowMarkerRule, type ScreenFills } from "../site/src/lib/screenFills.ts";

const PROMPT = "$ npx chaffjs ";
// A fence may be indented, as under a list item, and longer than three backticks, to hold ``` in its body. It closes
// at the same indent and length; the body loses the indent.
const FENCE = /^(?:[ \t]*<!-- chaff-screen: (\S+) -->\n)?( *)(`{3,})([^`\n]*)\n([\s\S]*?)^\2\3[ \t]*$/gmu;
const FILE_META = /(?:^|\s)file=(\S+)/u;
const NOT_RUN_HEADER = /^ *(?:\d+ rules? did not run:|\d+ 件の rule は動いていません:)$/u;
const LIST_ENTRY = /^ {6}\S/u;
/** The line under the list that names the first rule off only because it is experimental. */
const ALONE_HINT = /^ *(?:Turn on one experimental rule alone by naming it:|試験中のルールを 1 つだけ動かすには、)/u;
/** fix-plan's section of the rules that did not run, which runs to the next section. */
const PLAN_NOT_RUN_HEADER = /^## (?:Rules that did not run|動かなかったルール)$/u;
const PLAN_SECTION = /^## /u;
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
/** The rules a screen's "{not-run: <rule>}" lines name. */
const rowRules = (shown: string): string[] => shown.split("\n").flatMap((line) => rowMarkerRule(line) ?? []);

export const hasFill = (shown: string): boolean => hasLine(shown, NOT_RUN_MARKER) || hasLine(shown, COUNTS_MARKER) || rowRules(shown).length > 0;

/** The end of the "N rules did not run:" list that starts at `start`: past its rule lines, and the hint under them. */
const listEnd = (lines: readonly string[], start: number): number => {
  const afterEntries = lines.findIndex((line, at) => at > start && !LIST_ENTRY.test(line));
  if (afterEntries === -1) return lines.length;
  return lines[afterEntries] === "" && ALONE_HINT.test(lines[afterEntries + 1] ?? "") ? afterEntries + 2 : afterEntries;
};

/** The end of fix-plan's section that starts at `start`: the next section, less the blank lines before it. */
const sectionEnd = (lines: readonly string[], start: number): number => {
  const next = lines.findIndex((line, at) => at > start && PLAN_SECTION.test(line));
  const lastText = lines.slice(0, next === -1 ? lines.length : next).findLastIndex((line) => line.trim() !== "");
  return Math.max(lastText + 1, start + 1);
};

/**
 * The list of rules that did not run, from chaff's screen: the "N rules did not run:" line, the rule lines under it and
 * the hint under them, or fix-plan's section of them. Undefined when the screen has none.
 */
export const notRunBlock = (output: string): string | undefined => {
  const lines = output.split("\n");
  const list = lines.findIndex((line) => NOT_RUN_HEADER.test(line));
  if (list !== -1) return lines.slice(list, listEnd(lines, list)).join("\n");
  const section = lines.findIndex((line) => PLAN_NOT_RUN_HEADER.test(line));
  return section === -1 ? undefined : lines.slice(section, sectionEnd(lines, section)).join("\n");
};

/** The line chaff printed for one rule that did not run, padded as printed: the indented line whose first word is the id. */
export const notRunRow = (output: string, rule: string): string | undefined =>
  output.split("\n").find((line) => /^\s/u.test(line) && line.trim().split(/\s+/u)[0] === rule);

const rowsFor = (shown: string, output: string): Record<string, string> =>
  Object.fromEntries(
    rowRules(shown).flatMap((rule) => {
      const row = notRunRow(output, rule);
      return row === undefined ? [] : [[rule, row] as const];
    }),
  );

/** The last line of a --compact screen ("3 findings, 97 rules not run"); undefined when there is none. */
export const countsLine = (output: string): string | undefined => output.split("\n").findLast((line) => COUNTS_LINE.test(line));

/** The markers a screen keeps that the fills have nothing for. */
export const missingFills = (shown: string, fills: ScreenFills): string[] => [
  ...(hasLine(shown, NOT_RUN_MARKER) && fills.notRun === undefined ? [NOT_RUN_MARKER] : []),
  ...(hasLine(shown, COUNTS_MARKER) && fills.counts === undefined ? [COUNTS_MARKER] : []),
  ...rowRules(shown)
    .filter((rule) => fills.rows?.[rule] === undefined)
    .map(notRunRowMarker),
];

/** What a screen's markers are filled with, from what chaff printed for it; only the markers the screen has. */
export const fillsFor = (shown: string, output: string): ScreenFills => {
  const notRun = hasLine(shown, NOT_RUN_MARKER) ? notRunBlock(output) : undefined;
  const counts = hasLine(shown, COUNTS_MARKER) ? countsLine(output) : undefined;
  const rows = rowsFor(shown, output);
  return {
    ...(notRun === undefined ? {} : { notRun }),
    ...(counts === undefined ? {} : { counts }),
    ...(Object.keys(rows).length === 0 ? {} : { rows }),
  };
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
