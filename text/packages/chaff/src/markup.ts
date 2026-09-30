import { spanOf, type MarkdownNode } from "./markdown-node.ts";
import { headingText } from "./heading-text.ts";
import { eachPreOrder } from "./tree-walk.ts";
import { alertReader } from "./template-syntax.ts";
import { cutSpans } from "./span-cut.ts";
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

/** HTML の id・name 属性の値。属性の前は空白なので、data-id は数えない。 */
const HTML_ID = /\s(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/giu;

/** `<img …>`。引用符の中の `>`（title="2 > 1"）では閉じない。 */
const IMG_TAG = /<img\b(?:"[^"]*"|'[^']*'|[^"'>])*>/giu;
const ALT_ATTRIBUTE = /\salt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))?/iu;

/** 中の字が、字のまま見える範囲にならない節。リンクの字はリンクで（中の画像は読む）。 */
const LINKS = new Set(["link", "linkReference"]);

type Walk = {
  readonly headings: MarkupHeading[];
  readonly images: MarkupImage[];
  readonly links: MarkupLink[];
  readonly ids: Set<string>;
  readonly texts: Span[];
  /** 参照の定義（`[label]: url`）を名前ごとに。使われた定義だけが、読み手の押すリンクになる。 */
  readonly definitions: Map<string, MarkupLink>;
  /** 参照の形のリンクと画像が使った名前。 */
  readonly referenced: Set<string>;
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

/** 属性の値の文字参照のうち、名前に書かれるもの。ほかの名前の参照は id にまず現れない。 */
const NAMED_REFERENCES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const CHARACTER_REFERENCE = /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/giu;

const HEX = 16;

/** Unicode の字の番号の上限。 */
const LAST_CODE_POINT = 0x10ffff;

/** 番号の字。字の番号でなければ（&#999999999;）undefined で、参照は書いたまま残す。 */
const characterOf = (codePoint: number): string | undefined =>
  Number.isSafeInteger(codePoint) && codePoint > 0 && codePoint <= LAST_CODE_POINT ? String.fromCodePoint(codePoint) : undefined;

/** 属性の値の文字参照（&amp;、&#38;、&#x26;）を字に戻す。ブラウザが名前として読むのは戻した字。 */
export const decodedAttribute = (value: string): string =>
  value.replace(CHARACTER_REFERENCE, (whole: string, decimal?: string, hex?: string, name?: string) => {
    if (decimal !== undefined) return characterOf(Number(decimal)) ?? whole;
    if (hex !== undefined) return characterOf(Number.parseInt(hex, HEX)) ?? whole;
    return NAMED_REFERENCES[(name ?? "").toLowerCase()] ?? whole;
  });

/** HTML のコメント。中の要素は表示されない。 */
const HTML_COMMENT = /<!--[\s\S]*?-->/gu;

/** コメントを同じ長さの空白にする。位置は変えない。 */
const withoutComments = (html: string): string => html.replace(HTML_COMMENT, (comment) => " ".repeat(comment.length));

/** 中身が表示されない要素（`<script>`、`<style>`）で始まる HTML。中の `<img>` や id は字の並びで、ページの要素ではない。 */
const SOURCE_ELEMENT = /^\s*<(?:script|style)\b/iu;

const readHtml = (written: string, span: Span, walk: Walk): void => {
  if (SOURCE_ELEMENT.test(written)) return;
  const value = withoutComments(written);
  [...value.matchAll(HTML_ID)].forEach((match) => walk.ids.add(decodedAttribute(match[1] ?? match[2] ?? match[3] ?? "")));
  [...value.matchAll(IMG_TAG)].forEach((match) => {
    const alt = ALT_ATTRIBUTE.exec(match[0]);
    const start = span.start + match.index;
    walk.images.push({ alt: alt === null ? undefined : (alt[1] ?? alt[2] ?? alt[3] ?? ""), start, end: start + match[0].length });
  });
};

/** リンクと参照の定義。定義は、使われたかを最後に見るので別に持つ。 */
const readLink = (node: MarkdownNode, span: Span, walk: Walk): void => {
  if (node.type === "link") walk.links.push({ destination: node.url ?? "", ...span });
  else if (node.type === "definition") walk.definitions.set(node.identifier ?? "", { destination: node.url ?? "", ...span });
  else if (node.type === "linkReference") walk.referenced.add(node.identifier ?? "");
};

const LINK_NODES = new Set(["link", "definition", "linkReference"]);

const readNode = (node: MarkdownNode, span: Span, source: string, walk: Walk, inLink: boolean): void => {
  if (node.type === "heading") readHeading(node, span, source, walk);
  else if (node.type === "image" || node.type === "imageReference") walk.images.push({ alt: stringField(node, "alt") ?? "", ...span });
  else if (LINK_NODES.has(node.type)) readLink(node, span, walk);
  else if (node.type === "html") readHtml(node.value ?? "", span, walk);
  else if (node.type === "text" && !inLink) walk.texts.push(span);
};

const startsInside = (span: Span, regions: readonly Span[]): boolean => regions.some((region) => span.start >= region.start && span.start < region.end);

type Pending = { readonly node: MarkdownNode; readonly inLink: boolean };

/**
 * Markdown の記法の手がかりを集める。outside（メールの引用した返信と、MDX の import やテンプレートの記法）と、
 * 引用（`>`）の中は読まない。返信と引用はほかの人の文書で、記法は読み手に見えない。
 * GitHub の注記（`> [!NOTE]`）は書き手の言葉なので読む。本文の組み立て（document.ts）と同じ線引き。
 */
export const markdownMarkup = (root: MarkdownNode, source: string, outside: readonly Span[] = []): Markup => {
  const walk: Walk = { headings: [], images: [], links: [], ids: new Set(), texts: [], definitions: new Map(), referenced: new Set() };
  const alertOf = alertReader(source);
  const pending: Pending[] = [{ node: root, inLink: false }];
  while (pending.length > 0) {
    const next = pending.pop();
    if (next === undefined) break;
    const { node, inLink } = next;
    const span = spanOf(node);
    if (span !== undefined && startsInside(span, outside)) continue;
    if (node.type === "blockquote" && alertOf(node) === undefined) continue;
    if (span !== undefined) readNode(node, span, source, walk, inLink);
    const childInLink = inLink || LINKS.has(node.type);
    (node.children ?? []).toReversed().forEach((child) => pending.push({ node: child, inLink: childInLink }));
  }
  const { definitions, referenced, ...found } = walk;
  const used = [...definitions].filter(([name]) => referenced.has(name)).map(([, link]) => link);
  // 字の節の途中から始まる記法（`{{ … }}`）も、字のまま見える範囲から切り取る。
  const texts = cutSpans(found.texts, outside);
  return { markdown: true, ...found, texts, links: [...found.links, ...used].toSorted((left, right) => left.start - right.start) };
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
