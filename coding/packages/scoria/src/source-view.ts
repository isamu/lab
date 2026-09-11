/**
 * ソースを「コードだけの見え方」と「コメントだけの見え方」に分ける。
 *
 * 抑制の種類によって見るべき場所が違う。
 *   `as any` / `it.skip`           コードにしか現れない。コメントや文字列で一致してはならない
 *   `@ts-ignore` / eslint-disable  ディレクティブなので、必ずコメントの中にある
 *
 * 行を素朴に走査すると、この probe 自身の説明コメントや正規表現リテラルが抑制として数えられる。
 * 実際に最初の実行で 4 件の誤検知が出た。
 *
 * 一つの正規表現で全種類を交互に並べるより、開き記号から閉じ記号まで進めるスキャナのほうが正確で安い。
 * 文字列の中の `//` をコメントと誤認しないことが、単純な正規表現との差になる。
 *
 * 行番号を保つため、除外した範囲は空白で置き換える。改行はそのまま残す。
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

/** 閉じ記号の直後の位置を返す。閉じないまま終わったら末尾。 */
const closeOf = (text: string, token: Token, from: number): number => {
  // 文字ごとに進める走査なので、cursor だけは再代入する。
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
  const kinds: Kind[] = new Array<Kind>(text.length).fill("code");
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
