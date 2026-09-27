import { XMLParser } from "fast-xml-parser";

// legislation.gov.uk's XML (CLML) as plain text: 「PART 1 Preliminary」, 「CHAPTER 2 …」, 「Section 3 Terms …」,
// then subsections 「(1) …」 and paragraphs 「(a) …」 each on their own line, as the site lists them.
// Schedules, commencement notes and annotations are left out, and so are two blocks inside a section: text quoted
// into another Act (BlockAmendment) and tables (Tabular). Both are about another Act — their "section 18" is that
// Act's — and a line-by-line reader cannot tie them back to the lead-in that says so.

type Node = Readonly<Record<string, unknown>>;

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);

const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: true, trimValues: true, removeNSPrefix: true });

const tagOf = (node: Node): string => Object.keys(node).find((key) => key !== ":@") ?? "";

const childrenOf = (node: Node): readonly Node[] => {
  const value = node[tagOf(node)];
  return Array.isArray(value) ? value.filter(isNode) : [];
};

/** Skipped inside text: footnote and commentary references, which the site shows as superscript marks. */
const INLINE_SKIPPED = new Set(["CommentaryRef", "FootnoteRef"]);

const textOf = (node: Node): string => {
  if (typeof node["#text"] === "string" || typeof node["#text"] === "number") return String(node["#text"]);
  if (INLINE_SKIPPED.has(tagOf(node))) return "";
  return childrenOf(node).map(textOf).join(" ");
};

const clean = (text: string): string =>
  text
    .replace(/\s+/gu, " ")
    .replace(/ ([,.;:)”’])/gu, "$1")
    .replace(/([(“‘]) /gu, "$1")
    .trim();

const firstChild = (node: Node, tag: string): Node | undefined => childrenOf(node).find((child) => tagOf(child) === tag);

const labelOf = (node: Node): string => {
  const number = firstChild(node, "Pnumber");
  return number === undefined ? "" : clean(textOf(number));
};

/** One block inside a section or subsection. AppendText is the text after a list: "…, and the goods are delivered." */
const blockLines = (part: Node): string[] => {
  const tag = tagOf(part);
  if (tag === "Text" || tag === "AppendText") return [clean(textOf(part))];
  if (/^P[2-6]$/u.test(tag)) return provisionLines(part);
  if (tag === "UnorderedList" || tag === "OrderedList") return childrenOf(part).map((item) => clean(textOf(item)));
  return [];
};

/** A P2/P3/P4 and what it holds: its number in brackets before its first text, then nested levels. */
const provisionLines = (node: Node): string[] => {
  const tag = tagOf(node);
  const para = firstChild(node, `${tag}para`);
  if (para === undefined) return [];
  const parts = childrenOf(para);
  const label = labelOf(node);
  const firstText = parts.findIndex((part) => tagOf(part) === "Text");
  return parts.flatMap((part, index) => (index === firstText && label !== "" ? [`(${label}) ${clean(textOf(part))}`] : blockLines(part)));
};

const sectionLines = (group: Node): string[] => {
  const title = firstChild(group, "Title");
  return childrenOf(group)
    .filter((child) => tagOf(child) === "P1")
    .flatMap((section) => {
      const para = firstChild(section, "P1para");
      const body = para === undefined ? [] : childrenOf(para).flatMap(blockLines);
      return [`Section ${labelOf(section)} ${title === undefined ? "" : clean(textOf(title))}`.trim(), ...body, ""];
    });
};

const headingLine = (node: Node, word: string): string[] => {
  const number = firstChild(node, "Number");
  const title = firstChild(node, "Title");
  const numberText = number === undefined ? "" : clean(textOf(number)).replace(/^(?:PART|Part|CHAPTER|Chapter)\s*/u, "");
  return ["", `${word} ${numberText} ${title === undefined ? "" : clean(textOf(title))}`.trim(), ""];
};

const SKIPPED = new Set(["Metadata", "Schedules", "Commentaries", "Footnotes", "PrimaryPrelims", "Contents"]);

const linesOf = (node: Node): string[] => {
  const tag = tagOf(node);
  if (SKIPPED.has(tag)) return [];
  if (tag === "Part") return [...headingLine(node, "PART"), ...childrenOf(node).flatMap(linesOf)];
  if (tag === "Chapter") return [...headingLine(node, "CHAPTER"), ...childrenOf(node).flatMap(linesOf)];
  if (tag === "P1group") return sectionLines(node);
  return childrenOf(node).flatMap(linesOf);
};

/** Pure: the Act's text from legislation.gov.uk's XML. */
export const ukText = (xml: string): string => {
  const parsed: unknown = parser.parse(xml);
  const roots = Array.isArray(parsed) ? parsed.filter(isNode) : [];
  return roots
    .flatMap(linesOf)
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
    .concat("\n");
};
