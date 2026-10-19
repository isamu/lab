// A grammar written in ABNF inside the text (a plain-text specification lays its rules out as prose lines): the lines of
// its rules and comments, and the names it defines. Capitals there are rule names (CRLF, DIGIT, VCHAR) and hex values
// (%x80-FFFFF), not acronyms to spell out. Pure.

type Span = { readonly start: number; readonly end: number };

/** One element of a rule's right-hand side: a value, a string, a prose value, a rule name, a repeat, a group or a slash. */
const ELEMENT = String.raw`%[bdxBDX][0-9A-Fa-f]+(?:[-.][0-9A-Fa-f]+)*(?![0-9A-Fa-f])|(?:%[siSI])?"[^"\n]*"|<[^>\n]*>|[A-Za-z][A-Za-z0-9-]*(?![A-Za-z0-9-])|[\d*]+(?![\d*])|[()[\]/]`;
const ELEMENTS = String.raw`(?:[ \t]*(?:${ELEMENT}))+[ \t]*(?:;.*)?`;
/** name = elements, or name =/ elements. */
const RULE = new RegExp(String.raw`^(?<indent>[ \t]*)(?<name>[A-Za-z][A-Za-z0-9-]*)[ \t]+=\/?[ \t]*${ELEMENTS}$`, "u");
/** A line that continues a rule: elements only, or a comment. */
const CONTINUATION = new RegExp(String.raw`^${ELEMENTS}$|^[ \t]*;.*$`, "u");
const COMMENT = /^[ \t]*;/u;
/** Only a value or a quoted string tells a grammar from prose that happens to read "x = y". */
const GRAMMAR_ONLY = /%[bdxBDX][0-9A-Fa-f]|"[^"\n]*"/u;
/** How many rules with a value or a string make the text a grammar. */
const MIN_GRAMMAR_RULES = 2;

type Line = { readonly text: string; readonly start: number; readonly length: number };

/** The lines of the text with their offsets; a carriage return before the line feed is not part of the line. */
const linesOf = (source: string): Line[] =>
  source.split("\n").reduce<Line[]>((lines, raw) => {
    const last = lines.at(-1);
    const start = last === undefined ? 0 : last.start + last.length + 1;
    lines.push({ text: raw.endsWith("\r") ? raw.slice(0, -1) : raw, start, length: raw.length });
    return lines;
  }, []);

const indentOf = (text: string): number => (/^[ \t]*/u.exec(text)?.[0] ?? "").length;

type Grammar = { readonly lines: readonly Line[]; readonly names: readonly string[] };

/**
 * The rule lines, the lines that continue a rule (indented deeper than its name, until a blank line or prose) and the
 * comment lines of a grammar. Prose that reads "x = y" is not a grammar: at least two rules must hold a value or a string.
 */
const grammarOf = (source: string): Grammar => {
  const lines = linesOf(source);
  const rules = lines.map((line) => RULE.exec(line.text));
  const valued = rules.filter((rule, index) => rule !== null && GRAMMAR_ONLY.test(lines[index]?.text ?? "")).length;
  if (valued < MIN_GRAMMAR_RULES) return { lines: [], names: [] };
  const NO_RULE = -1;
  // Forward: a rule, the lines that continue it, and the comments inside it.
  const inRule = lines.reduce<{ readonly ruleIndent: number; readonly kept: boolean[] }>(
    ({ ruleIndent, kept }, line, index) => {
      const rule = rules[index];
      const indent = rule === null || rule === undefined ? NO_RULE : (rule.groups?.["indent"] ?? "").length;
      const isComment = COMMENT.test(line.text);
      const continues = ruleIndent !== NO_RULE && line.text.trim() !== "" && indentOf(line.text) > ruleIndent && CONTINUATION.test(line.text);
      const inside = isComment && ruleIndent !== NO_RULE;
      kept.push(indent !== NO_RULE || inside || continues);
      if (indent !== NO_RULE) return { ruleIndent: indent, kept };
      return { ruleIndent: continues || inside ? ruleIndent : NO_RULE, kept };
    },
    { ruleIndent: NO_RULE, kept: [] },
  ).kept;
  // A comment right before a rule, or before more comments and then a rule (; UTF8 rules from RFC 3629, then UTF8-octets = …).
  const precedesRule = (index: number): boolean => {
    const next = lines.slice(index + 1).findIndex((line) => !COMMENT.test(line.text));
    return next !== -1 && (rules[index + 1 + next] ?? null) !== null;
  };
  const kept = lines.map((line, index) => (inRule[index] ?? false) || (COMMENT.test(line.text) && precedesRule(index)));
  const inGrammar = lines.filter((_, index) => kept[index]);
  return { lines: inGrammar, names: rules.flatMap((rule) => (rule?.groups?.["name"] === undefined ? [] : [rule.groups["name"]])) };
};

/** A numeric value anywhere in the text (%x0D, %x21-7E, %x80-FFFFF): the notation of a grammar, also in its prose. */
const VALUE = /%[bdxBDX][0-9A-Fa-f]+(?:[-.][0-9A-Fa-f]+)*/gu;

/** The spans of a grammar's lines and of every numeric value in the text. */
export const grammarSpans = (source: string): Span[] => [
  ...grammarOf(source).lines.map((line) => ({ start: line.start, end: line.start + line.text.length })),
  ...[...source.matchAll(VALUE)].map((match) => ({ start: match.index, end: match.index + match[0].length })),
];

/** The rule names a grammar in the text defines (CRLF, VCHAR). Prose that names one (CRLF / %x0D %x0A) names the rule. */
export const grammarRuleNames = (source: string): string[] => [...grammarOf(source).names];
