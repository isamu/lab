import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { frontmatter } from "micromark-extension-frontmatter";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { maskSpans } from "./mask.ts";
import type { LanguageAdapter, ProseDocument, Section, Sentence, Span } from "./plugin.ts";

type Place = { readonly offset?: number | undefined };
type Node = {
  readonly type: string;
  readonly position?: { readonly start: Place; readonly end: Place } | undefined;
  readonly children?: readonly Node[] | undefined;
};

/**
 * 本文として数えないもの。
 *
 * コードは文章ではなく、表は文章の形をしていない。
 * **引用は自分の文章ではない。** chaff が言えるのは「2 文に割ってください」までで、
 * 引用文にそれはできない。直せないものを指摘しても、書いた人は動けない。
 */
const NOT_PROSE = new Set(["code", "inlineCode", "html", "yaml", "toml", "table", "blockquote", "thematicBreak", "definition", "image", "imageReference"]);

const spanOf = (node: Node): Span | undefined => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? undefined : { start, end };
};

const walk = (node: Node, visit: (node: Node) => void): void => {
  visit(node);
  (node.children ?? []).forEach((child) => walk(child, visit));
};

const parse = (source: string): Node =>
  fromMarkdown(source, { extensions: [gfmTable(), frontmatter(["yaml"])], mdastExtensions: [gfmTableFromMarkdown(), frontmatterFromMarkdown(["yaml"])] });

/** link は `[text](url)` の外側だけを覆う。表示される文字は本文なので残す。 */
const linkChrome = (node: Node): Span[] => {
  const whole = spanOf(node);
  const first = node.children?.[0];
  const last = node.children?.at(-1);
  const inner = first === undefined || last === undefined ? undefined : { start: spanOf(first)?.start, end: spanOf(last)?.end };
  if (whole === undefined || inner?.start === undefined || inner.end === undefined) return whole === undefined ? [] : [whole];
  return [
    { start: whole.start, end: inner.start },
    { start: inner.end, end: whole.end },
  ];
};

/**
 * 強調の記号（`**` `*` `_` `~~`）だけを覆う。囲まれた文字は本文なので残す。
 *
 * 残すと解析器が `**。` を 1 語の名詞として拾い、文の終わりが消える。
 * 実文書で「文末が名詞」の誤検知を追って見つけた。文長にも同じだけ効いている。
 */
const MARKER = /^[*_~]+/u;

const emphasisChrome = (node: Node, source: string): Span[] => {
  const whole = spanOf(node);
  if (whole === undefined) return [];
  const width = MARKER.exec(source.slice(whole.start, whole.end))?.[0].length ?? 0;
  if (width === 0) return [];
  return [
    { start: whole.start, end: whole.start + width },
    { start: whole.end - width, end: whole.end },
  ];
};

const EMPHASIS = new Set(["strong", "emphasis", "delete"]);

/**
 * `:::note` `:::` のようなディレクティブ。Zenn・Docusaurus・VitePress が使う記法で、
 * 標準の Markdown には無いため段落として解析される。囲みの指定であって文章ではない。
 */
const DIRECTIVE = /^:::[^\n]*/gmu;

const directiveSpans = (source: string): Span[] => [...source.matchAll(DIRECTIVE)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

const collectMasks = (root: Node, source: string): Span[] => {
  const spans: Span[] = [...directiveSpans(source)];
  walk(root, (node) => {
    if (node.type === "link" || node.type === "linkReference") {
      spans.push(...linkChrome(node));
      return;
    }
    if (!NOT_PROSE.has(node.type) && node.type !== "heading") return;
    const span = spanOf(node);
    if (span !== undefined) spans.push(span);
  });
  return spans;
};

const emphasisSpans = (root: Node, source: string): Span[] => {
  const spans: Span[] = [];
  walk(root, (node) => {
    if (EMPHASIS.has(node.type)) spans.push(...emphasisChrome(node, source));
  });
  return spans;
};

const textOf = (node: Node, source: string): string => {
  const parts: string[] = [];
  walk(node, (child) => {
    if (child.type !== "text" && child.type !== "inlineCode") return;
    const span = spanOf(child);
    if (span !== undefined) parts.push(source.slice(span.start, span.end));
  });
  return parts.join("");
};

type Heading = { readonly depth: number; readonly text: string; readonly start: number; readonly end: number };

const headingsOf = (root: Node, source: string): Heading[] => {
  const found: Heading[] = [];
  walk(root, (node) => {
    if (node.type !== "heading") return;
    const span = spanOf(node);
    const depth = typeof node === "object" && "depth" in node && typeof node.depth === "number" ? node.depth : 1;
    if (span !== undefined) found.push({ depth, text: textOf(node, source).trim(), start: span.start, end: span.end });
  });
  return found;
};

const startsInside = (span: Span, regions: readonly Span[]): boolean => regions.some((region) => span.start >= region.start && span.start < region.end);

/**
 * 本文の強調だけを数える。
 *
 * 表のセルや見出しの中の太字はラベルであって強調ではない。
 * 「太字は読者の目を止める道具」という bold-density の理屈が当てはまらない。
 * 「本文でないもの」の定義は覆う範囲（collectMasks）に 1 つだけ置き、ここはそれを使う。
 */
const strongSpans = (root: Node, masked: readonly Span[]): Span[] => {
  const found: Span[] = [];
  walk(root, (node) => {
    if (node.type !== "strong") return;
    const span = spanOf(node);
    if (span !== undefined && !startsInside(span, masked)) found.push(span);
  });
  return found;
};

const within = (span: Span, from: number, to: number): boolean => span.start >= from && span.start < to;

const spansOfType = (root: Node, type: string): Span[] => {
  const found: Span[] = [];
  walk(root, (node) => {
    if (node.type !== type) return;
    const span = spanOf(node);
    if (span !== undefined) found.push(span);
  });
  return found;
};

/**
 * 文の分割は**段落ごと**に行う。
 *
 * 文書全体を一度に渡すと、句点で終わらない行（「条件:」のような見出し的な行）が、
 * 覆った表やコードブロックを越えて次の句点まで飲み込む。段落は文が跨がない境界なので、
 * ここで切れば構造的に起きない。
 */
const shift = (span: Span, by: number): Span => ({ start: by + span.start, end: by + span.end });

const sentencesOf = (prose: string, paragraphs: readonly Span[], adapter: LanguageAdapter): Sentence[] =>
  paragraphs.flatMap((paragraph) =>
    adapter
      .segment(prose.slice(paragraph.start, paragraph.end))
      .sentences.filter((sentence) => sentence.text.trim().length > 0)
      .map((sentence) => ({
        span: shift(sentence.span, paragraph.start),
        text: sentence.text,
        ...(sentence.tokens === undefined ? {} : { tokens: sentence.tokens.map((token) => ({ ...token, span: shift(token.span, paragraph.start) })) }),
      })),
  );

const sectionsOf = (headings: readonly Heading[], sentences: readonly Sentence[], strongs: readonly Span[], length: number): Section[] => {
  const bounds = headings.map((heading, index) => ({ heading, from: heading.end, to: headings[index + 1]?.start ?? length }));
  const lead = { heading: { depth: 0, text: "", start: 0, end: 0 }, from: 0, to: headings[0]?.start ?? length };
  return [lead, ...bounds]
    .filter((bound) => bound.to > bound.from)
    .map(({ heading, from, to }) => {
      const inside = sentences.filter((sentence) => within(sentence.span, from, to));
      return {
        depth: heading.depth,
        heading: heading.text,
        span: { start: from, end: to },
        sentences: inside,
        strongCount: strongs.filter((span) => within(span, from, to)).length,
        firstSentence: inside[0],
      };
    });
};

export const buildDocument = (path: string, source: string, adapter: LanguageAdapter): ProseDocument => {
  const root = parse(source);
  // 強調の記号は「本文でないもの」だが、太字の数を数えるときの「覆われた場所」ではない。
  // 同じ集合にすると、太字が自分の記号のせいで覆われた場所にあることになり、1 つも数えられなくなる。
  const blocks = collectMasks(root, source);
  const masked = [...blocks, ...emphasisSpans(root, source)];
  const prose = maskSpans(source, masked);
  const sentences = sentencesOf(prose, spansOfType(root, "paragraph"), adapter);
  return {
    path,
    source,
    language: adapter.id,
    lengthUnit: adapter.capabilities.lengthUnit,
    capabilities: adapter.capabilities,
    sections: sectionsOf(headingsOf(root, source), sentences, strongSpans(root, blocks), source.length),
    sentences,
    listSpans: spansOfType(root, "listItem"),
    lexicons: adapter.lexicons,
  };
};
