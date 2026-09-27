import { XMLParser } from "fast-xml-parser";

// e-Gov's statute XML as the plain text a reader sees on the site: chapter titles, 「（見出し）」, 「第一条 …」,
// paragraph numbers (「２ …」, or a full-width space where an old statute leaves them unnumbered), items (「一 …」).
// The table of contents and the supplementary provisions are left out: the first repeats the chapters, the second
// numbers its own articles and cites old article numbers of other statutes.

type Node = Readonly<Record<string, unknown>>;

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);

const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: true, trimValues: true });

const tagOf = (node: Node): string => Object.keys(node).find((key) => key !== ":@") ?? "";

const childrenOf = (node: Node): readonly Node[] => {
  const value = node[tagOf(node)];
  return Array.isArray(value) ? value.filter(isNode) : [];
};

/** All the text inside, with the whitespace the XML puts between elements removed. */
const textOf = (node: Node): string => {
  if (typeof node["#text"] === "string" || typeof node["#text"] === "number") return String(node["#text"]).trim();
  return childrenOf(node).map(textOf).join("");
};

const firstChild = (node: Node, tag: string): Node | undefined => childrenOf(node).find((child) => tagOf(child) === tag);

const TITLES = new Set(["PartTitle", "ChapterTitle", "SectionTitle", "SubsectionTitle", "DivisionTitle"]);
const SKIPPED = new Set(["TOC", "SupplProvision", "LawNum", "EnactStatement", "Preamble"]);

const itemLines = (paragraph: Node): string[] =>
  childrenOf(paragraph)
    .filter((child) => tagOf(child) === "Item")
    .flatMap((item) => {
      const title = firstChild(item, "ItemTitle");
      const sentence = firstChild(item, "ItemSentence");
      return [`${title === undefined ? "" : textOf(title)}\u3000${sentence === undefined ? "" : textOf(sentence)}`];
    });

/** The article title on the first paragraph, the paragraph number on the others; empty when there is none. */
const headOf = (node: Node | undefined): string => (node === undefined ? "" : textOf(node));

const articleLines = (article: Node): string[] => {
  const caption = firstChild(article, "ArticleCaption");
  const title = firstChild(article, "ArticleTitle");
  const paragraphs = childrenOf(article).filter((child) => tagOf(child) === "Paragraph");
  const body = paragraphs.flatMap((paragraph, index) => {
    const number = firstChild(paragraph, "ParagraphNum");
    const sentence = firstChild(paragraph, "ParagraphSentence");
    const head = headOf(index === 0 ? title : number);
    // An old statute leaves the later paragraphs unnumbered; they start with a full-width space instead.
    return [`${head}\u3000${sentence === undefined ? "" : textOf(sentence)}`, ...itemLines(paragraph)];
  });
  const withoutParagraphs = paragraphs.length === 0 && title !== undefined ? [textOf(title)] : [];
  return [...(caption === undefined ? [] : [textOf(caption)]), ...body, ...withoutParagraphs, ""];
};

const linesOf = (node: Node): string[] => {
  const tag = tagOf(node);
  if (SKIPPED.has(tag)) return [];
  if (tag === "LawTitle") return [textOf(node), ""];
  if (TITLES.has(tag)) return ["", textOf(node), ""];
  if (tag === "Article") return articleLines(node);
  return childrenOf(node).flatMap(linesOf);
};

/** Pure: the statute's text from e-Gov's XML. */
export const lawText = (xml: string): string => {
  const parsed: unknown = parser.parse(xml);
  const roots = Array.isArray(parsed) ? parsed.filter(isNode) : [];
  return roots
    .flatMap(linesOf)
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
    .concat("\n");
};
