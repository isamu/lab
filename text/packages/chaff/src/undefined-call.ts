// A function called in a code example that the page never defines, where the page documents one whose name it extends:
// wrapText( on a page about wrap, wrapLines( after import { wrap }. Pure; reads the Markdown source. The global functions
// of programming languages (parseInt, setTimeout) come from a lexicon, so a page about parse may call parseInt.
import { codeFences } from "./detectors/code-fences.ts";

/** A call to a name the page does not define, where it is written, and the documented name it is likely a slip of. */
export type UndefinedCall = { readonly name: string; readonly offset: number; readonly documented: string };

const CALL = /(?<![\w$.])([A-Za-z_$][\w$]*)[ \t]*\(/gu;
const WORD = /[A-Za-z_$][\w$]*/gu;
const LEADING_WORD = /^[A-Za-z_$][\w$]*/u;
/** import { wrap, type Options, measure as m } from "wrapkit" (JavaScript) and from wrapkit import wrap, measure (Python). */
const IMPORT_BRACES = /\bimport[ \t]*\{([^}]*)\}/gu;
const FROM_IMPORT = /\bfrom[ \t]+[\w.]+[ \t]+import[ \t]+([\w, \t]+)/gu;
const TYPE_MODIFIER = /^type[ \t]+/u;
/** A name right after one of these is being declared, not called: function wrapText(, def wrap_text(. */
const DECLARING = /\b(?:function\*?|def|fn|func|class|new)[ \t]+$/u;
/** Where a line comment starts: a call after it is commented out. */
const LINE_COMMENT = /\/\/|(?:^|[ \t])#/u;
/** The shortest documented name a call is compared with: shorter ones (id, get) are prefixes of too many names. */
const MIN_DOCUMENTED = 4;

/** Each specifier's own name: `type Options` is Options, `measure as m` is measure. */
const specifiers = (list: string): string[] =>
  list.split(",").flatMap((specifier) => LEADING_WORD.exec(specifier.trim().replace(TYPE_MODIFIER, ""))?.[0] ?? []);

const importedNames = (source: string): string[] =>
  [...source.matchAll(IMPORT_BRACES), ...source.matchAll(FROM_IMPORT)].flatMap((match) => specifiers(match[1] ?? ""));

/** Names the page documents: the first word of a heading (## wrap, ### `wrap()`) and the names it imports. */
const documentedNames = (source: string, headings: readonly string[]): Set<string> => {
  const fromHeadings = headings.flatMap((heading) => LEADING_WORD.exec(heading.replace(/[`*]/gu, "").trim())?.[0] ?? []);
  return new Set([...fromHeadings, ...importedNames(source)].filter((name) => name.length >= MIN_DOCUMENTED));
};

const countWords = (source: string): Map<string, number> =>
  [...source.matchAll(WORD)].reduce((counts, match) => counts.set(match[0], (counts.get(match[0]) ?? 0) + 1), new Map<string, number>());

/** Whether the call at `at` in `code` is declared there or commented out. */
const isDeclaredOrCommented = (code: string, at: number): boolean => {
  const lineStart = code.lastIndexOf("\n", at - 1) + 1;
  const before = code.slice(lineStart, at);
  return DECLARING.test(before) || LINE_COMMENT.test(before);
};

/**
 * Every call in a code block to a name written nowhere else on the page, when a documented name is its stem
 * (wrap → wrapText). A name used twice (defined and called, or called twice) is the example's own. headings are the page's
 * Markdown headings; globals the language functions every page may call.
 */
export const undefinedCalls = (source: string, headings: readonly string[], globals: readonly string[] = []): UndefinedCall[] => {
  const documented = documentedNames(source, headings);
  if (documented.size === 0) return [];
  const counts = countWords(source);
  const known = new Set([...documented, ...globals]);
  return codeFences(source).flatMap((fence) => {
    const code = source.slice(fence.start, fence.end);
    return [...code.matchAll(CALL)].flatMap((match) => {
      const name = match[1] ?? "";
      const stem = [...documented].find((candidate) => name !== candidate && name.startsWith(candidate));
      if (stem === undefined || known.has(name) || (counts.get(name) ?? 0) > 1 || isDeclaredOrCommented(code, match.index)) return [];
      return [{ name, offset: fence.start + match.index, documented: stem }];
    });
  });
};
