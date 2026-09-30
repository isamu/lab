import { spanOf, type MarkdownNode } from "./markdown-node.ts";
import { headingText } from "./heading-text.ts";
import { eachPreOrder } from "./tree-walk.ts";
import type { Markup, MarkupHeading, MarkupImage, MarkupLink, Span } from "./plugin.ts";

/** mdast の節のうち、ここで読む値。MarkdownNode の型には無いものを、型を見て取り出す。 */
const fieldOf = (node: MarkdownNode, field: string): unknown => (field in node ? Reflect.get(node, field) : undefined);

const numberField = (node: MarkdownNode, field: string): number | undefined => {
  const value = fieldOf(node, field);
  return typeof value === "number" ? value : undefined;
};

const stringField = (node: MarkdownNode, field: string): string | undefined => {
  const value = fieldOf(node, field);
  return typeof value === "string" ? value : undefined;
};

// 見出しの末尾に付けた名前。属性（`{#step1 .class}`）と、MDX のコメント（`{/*step1*/}`）。
type NamedHeading = { readonly text: string; readonly id: string | undefined };

const MDX_COMMENT_OPEN = "/*";
const MDX_COMMENT_CLOSE = "*/";

/** 見出しの言葉（textOf の結果）から、末尾の名前を外す。名前が無ければ id は undefined。 */
export const namedHeading = (written: string): NamedHeading => {
  const trimmed = written.trim();
  const open = trimmed.lastIndexOf("{");
  if (!trimmed.endsWith("}") || open === -1) return { text: trimmed, id: undefined };
  const inner = trimmed.slice(open + 1, -1).trim();
  const before = trimmed.slice(0, open).trim();
  if (inner.startsWith("#")) return { text: before, id: inner.slice(1).split(/\s/u)[0] };
  const isComment = inner.startsWith(MDX_COMMENT_OPEN) && inner.endsWith(MDX_COMMENT_CLOSE);
  return isComment ? { text: before, id: inner.slice(MDX_COMMENT_OPEN.length, -MDX_COMMENT_CLOSE.length).trim() } : { text: trimmed, id: undefined };
};

/** HTML の id・name 属性の値。 */
const HTML_ID = /\b(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/giu;

const IMG_TAG = /<img\b[^>]*>/giu;
const ALT_ATTRIBUTE = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))?/iu;

/** 中を字のまま見せない節。リンクの中の字はリンクで、コードと HTML は字ではない。 */
const NOT_TEXT = new Set(["link", "linkReference", "code", "inlineCode", "html", "yaml", "toml", "definition"]);

type Walk = {
  readonly headings: MarkupHeading[];
  readonly images: MarkupImage[];
  readonly links: MarkupLink[];
  readonly ids: Set<string>;
  readonly texts: Span[];
};

const plainText = (node: MarkdownNode, source: string): string => {
  const parts: string[] = [];
  eachPreOrder(node, (child) => {
    const span = spanOf(child);
    if ((child.type === "text" || child.type === "inlineCode") && span !== undefined) parts.push(source.slice(span.start, span.end));
  });
  return parts.join("");
};

/** ATX の見出しの閉じの `#`。 */
const ATX_CLOSING = /\s#+\s*$/u;

/** MDX のコメントの `*` を強調の印として外した後に残る `{/…/}` を外す。 */
const withoutMdxComment = (text: string): string => {
  const open = text.lastIndexOf("{/");
  return text.endsWith("/}") && open !== -1 ? text.slice(0, open).trimEnd() : text;
};

const firstLineOf = (text: string): string => text.split("\n", 1)[0] ?? "";

const readHeading = (node: MarkdownNode, span: Span, source: string, walk: Walk): void => {
  // 名前は書いたままの行から読む。MDX のコメントの `*` は、解析すると強調の印になって消える。
  const { id } = namedHeading(firstLineOf(source.slice(span.start, span.end)).replace(ATX_CLOSING, ""));
  if (id !== undefined && id !== "") walk.ids.add(id);
  const text = withoutMdxComment(headingText(plainText(node, source)));
  walk.headings.push({ depth: numberField(node, "depth") ?? 1, text, start: span.start, end: span.end });
};

const readHtml = (value: string, span: Span, walk: Walk): void => {
  [...value.matchAll(HTML_ID)].forEach((match) => walk.ids.add(match[1] ?? match[2] ?? match[3] ?? ""));
  [...value.matchAll(IMG_TAG)].forEach((match) => {
    const alt = ALT_ATTRIBUTE.exec(match[0]);
    const start = span.start + match.index;
    walk.images.push({ alt: alt === null ? undefined : (alt[1] ?? alt[2] ?? alt[3] ?? ""), start, end: start + match[0].length });
  });
};

const readNode = (node: MarkdownNode, span: Span, source: string, walk: Walk): void => {
  if (node.type === "heading") readHeading(node, span, source, walk);
  else if (node.type === "image" || node.type === "imageReference") walk.images.push({ alt: stringField(node, "alt") ?? "", ...span });
  else if (node.type === "link" || node.type === "definition") walk.links.push({ destination: node.url ?? "", ...span });
  else if (node.type === "html") readHtml(node.value ?? "", span, walk);
  else if (node.type === "text") walk.texts.push(span);
};

const startsInside = (span: Span, regions: readonly Span[]): boolean => regions.some((region) => span.start >= region.start && span.start < region.end);

/**
 * Markdown の記法の手がかりを集める。outside（メールの引用した返信）の中は、ほかの人の文書なので読まない。
 * リンクの中へは下りない（リンクの字は字のまま見える範囲ではない）。
 */
export const markdownMarkup = (root: MarkdownNode, source: string, outside: readonly Span[] = []): Markup => {
  const walk: Walk = { headings: [], images: [], links: [], ids: new Set(), texts: [] };
  const pending: MarkdownNode[] = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    const span = spanOf(node);
    if (span !== undefined && startsInside(span, outside)) continue;
    if (span !== undefined) readNode(node, span, source, walk);
    if (!NOT_TEXT.has(node.type)) (node.children ?? []).toReversed().forEach((child) => pending.push(child));
  }
  return { markdown: true, ...walk };
};

/** Markdown でない文書。記法は無く、文書全体が字のまま見える。 */
export const plainMarkup = (source: string): Markup => ({
  markdown: false,
  headings: [],
  images: [],
  links: [],
  ids: new Set(),
  texts: [{ start: 0, end: source.length }],
});

const built = new WeakMap<MarkdownNode, Markup>();

/** 文書の記法を、文書ごとに一度だけ作る。root は文書を解析した木で、文書ごとに一つ。 */
export const documentMarkup = (root: MarkdownNode, source: string, markdown: boolean, outside: readonly Span[]): Markup => {
  const cached = built.get(root);
  if (cached !== undefined) return cached;
  const markup = markdown ? markdownMarkup(root, source, outside) : plainMarkup(source);
  built.set(root, markup);
  return markup;
};
