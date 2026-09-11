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

/** 本文として数えないもの。コードは文章ではなく、表は文章の形をしていない。 */
const NOT_PROSE = new Set(["code", "inlineCode", "html", "yaml", "toml", "table", "thematicBreak", "definition", "image", "imageReference"]);

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

const collectMasks = (root: Node): Span[] => {
  const spans: Span[] = [];
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

const strongSpans = (root: Node): Span[] => {
  const found: Span[] = [];
  walk(root, (node) => {
    if (node.type !== "strong") return;
    const span = spanOf(node);
    if (span !== undefined) found.push(span);
  });
  return found;
};

const within = (span: Span, from: number, to: number): boolean => span.start >= from && span.start < to;

const paragraphSpans = (root: Node): Span[] => {
  const found: Span[] = [];
  walk(root, (node) => {
    if (node.type !== "paragraph") return;
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
const sentencesOf = (prose: string, paragraphs: readonly Span[], adapter: LanguageAdapter): Sentence[] =>
  paragraphs.flatMap((paragraph) =>
    adapter
      .segment(prose.slice(paragraph.start, paragraph.end))
      .sentences.filter((sentence) => sentence.text.trim().length > 0)
      .map((sentence) => ({
        span: { start: paragraph.start + sentence.span.start, end: paragraph.start + sentence.span.end },
        text: sentence.text,
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
  const prose = maskSpans(source, collectMasks(root));
  const sentences = sentencesOf(prose, paragraphSpans(root), adapter);
  return {
    path,
    source,
    language: adapter.id,
    lengthUnit: adapter.capabilities.lengthUnit,
    sections: sectionsOf(headingsOf(root, source), sentences, strongSpans(root), source.length),
    sentences,
  };
};
