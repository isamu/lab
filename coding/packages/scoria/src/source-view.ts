/**
 * Splits a source file into a code-only view and a comment-only view.
 *
 * Where a suppression can legitimately appear depends on its kind:
 *   `as any` / `it.skip`           only ever in code; must not match in comments or strings
 *   `@ts-ignore` / eslint-disable  directives, so always inside a comment
 *
 * Scanning lines naively counts this probe's own explanatory comments and regex literals as
 * suppressions. The first run against this repository produced four such false positives.
 *
 * A scanner that walks from an opening token to its close is both more accurate and cheaper than
 * one regex alternating over every case. The difference that matters is not mistaking `//` inside
 * a string for the start of a comment.
 *
 * Excluded ranges are replaced with spaces so line numbers survive; newlines are kept.
 */

type Kind = "code" | "comment" | "string";

interface Token {
  readonly open: string;
  readonly close: string;
  readonly kind: Kind;
  readonly escapes: boolean;
}

const TOKENS: readonly Token[] = [
  { open: "/*", close: "*/", kind: "comment", escapes: false },
  { open: "//", close: "\n", kind: "comment", escapes: false },
  { open: '"', close: '"', kind: "string", escapes: true },
  { open: "'", close: "'", kind: "string", escapes: true },
  { open: "`", close: "`", kind: "string", escapes: true },
];

const OPENING_CHARACTERS = new Set(["/", '"', "'", "`"]);
const ESCAPE_WIDTH = 2;

interface Span {
  readonly start: number;
  readonly end: number;
  readonly kind: Kind;
}

export interface SourceView {
  readonly code: readonly string[];
  readonly comments: readonly string[];
}

const openerAt = (text: string, index: number): Token | undefined =>
  OPENING_CHARACTERS.has(text[index] ?? "") ? TOKENS.find((token) => text.startsWith(token.open, index)) : undefined;

/** The index just past the closing token, or the end of the text if it never closes. */
const closeOf = (text: string, token: Token, from: number): number => {
  // A character scanner, so the cursor is the one thing that is reassigned.
  let cursor = from;
  while (cursor < text.length) {
    if (token.escapes && text[cursor] === "\\") {
      cursor += ESCAPE_WIDTH;
    } else if (text.startsWith(token.close, cursor)) {
      return cursor + token.close.length;
    } else {
      cursor += 1;
    }
  }
  return text.length;
};

const spansOf = (text: string): readonly Span[] => {
  const spans: Span[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const token = openerAt(text, cursor);
    if (token === undefined) {
      cursor += 1;
    } else {
      const end = closeOf(text, token, cursor + token.open.length);
      spans.push({ start: cursor, end, kind: token.kind });
      cursor = end;
    }
  }
  return spans;
};

const kindsOf = (text: string): readonly Kind[] => {
  const kinds: Kind[] = Array.from({ length: text.length }, (): Kind => "code");
  spansOf(text).forEach((span) => kinds.fill(span.kind, span.start, span.end));
  return kinds;
};

const project = (text: string, kinds: readonly Kind[], want: Kind): readonly string[] =>
  [...text]
    .map((character, index) => (character === "\n" || kinds[index] === want ? character : " "))
    .join("")
    .split("\n");

export const viewOf = (lines: readonly string[]): SourceView => {
  const text = lines.join("\n");
  const kinds = kindsOf(text);
  return { code: project(text, kinds, "code"), comments: project(text, kinds, "comment") };
};
