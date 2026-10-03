import { isMarkdownPath } from "./structure/markdown-path.ts";
import { parse, readMarkdown } from "./markdown-read.ts";
import type { MarkdownNode as Node } from "./markdown-node.ts";
import type { Span } from "./plugin.ts";
import { isYamlPath, outsideValues, valuesText, yamlValueSpans } from "./yaml-values.ts";

/** A paragraph node per YAML value: a value is never read as Markdown (its indentation is not code) nor run into the next. */
const valuesRoot = (values: readonly Span[]): Node => ({
  type: "root",
  children: values.map((span) => ({ type: "paragraph", position: { start: { offset: span.start }, end: { offset: span.end } }, children: [] })),
});

/**
 * How a file is read: Markdown, a YAML file's string values, or plain text. text: what layout and structure read, which for YAML
 * is the values alone, keys and comments blanked in place. extra: what is not prose beyond what the tree says (YAML's keys).
 */
export const readingOf = (path: string, source: string): { root: Node; syntax: readonly Span[]; text: string; extra: readonly Span[] } => {
  if (isMarkdownPath(path)) return { ...readMarkdown(source), text: source, extra: [] };
  const values = isYamlPath(path) ? yamlValueSpans(source) : undefined;
  if (values === undefined) return { root: parse(source), syntax: [], text: source, extra: [] };
  return { root: valuesRoot(values), syntax: [], text: valuesText(source, values), extra: outsideValues(values, source.length) };
};

/** The text a document's structure is read from: the file, or for a YAML file its values alone. */
export const structureText = (path: string, source: string): string => readingOf(path, source).text;
