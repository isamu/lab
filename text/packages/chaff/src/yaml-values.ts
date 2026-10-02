import { extname } from "node:path";
import { isScalar, parseAllDocuments, visit, type Scalar } from "yaml";
import { maskSpans } from "./mask.ts";
import type { Span } from "./plugin.ts";

const YAML: ReadonlySet<string> = new Set([".yaml", ".yml"]);

/** A YAML file is checked by its string values: keys, quotes, comments and punctuation are not prose. */
export const isYamlPath = (path: string): boolean => YAML.has(extname(path).toLowerCase());

/** The characters of a string scalar that are its text: inside the quotes, below a block scalar's header line. */
const textOf = (node: Scalar, source: string): Span | undefined => {
  const [start, end] = node.range ?? [];
  if (start === undefined || end === undefined || typeof node.value !== "string") return undefined;
  if (node.type === "QUOTE_DOUBLE" || node.type === "QUOTE_SINGLE") return { start: start + 1, end: end - 1 };
  if (node.type === "BLOCK_LITERAL" || node.type === "BLOCK_FOLDED") {
    const body = source.indexOf("\n", start);
    return body === -1 || body >= end ? undefined : { start: body + 1, end };
  }
  return { start, end };
};

/** Trailing line breaks and spaces are not the value's text: a block scalar's range runs to the next key. */
const trimmed = (span: Span, source: string): Span => {
  const text = source.slice(span.start, span.end);
  return { start: span.start, end: span.start + text.trimEnd().length };
};

/**
 * Every string value's text in a YAML file, keys left out, in document order. Each is one paragraph: two values are never one
 * sentence. Undefined when the file is not valid YAML, which is then read as plain text.
 */
export const yamlValueSpans = (source: string): Span[] | undefined => {
  const documents = parseAllDocuments(source);
  if (!Array.isArray(documents) || documents.some((document) => document.errors.length > 0)) return undefined;
  const spans: Span[] = [];
  documents.forEach((document) =>
    visit(document, {
      Scalar: (key, node) => {
        const span = key === "key" || !isScalar(node) ? undefined : textOf(node, source);
        const text = span === undefined ? undefined : trimmed(span, source);
        if (text !== undefined && text.end > text.start) spans.push(text);
      },
    }),
  );
  return spans.toSorted((left, right) => left.start - right.start);
};

/** What lies outside the values, in order: keys, quotes, comments, punctuation. values: sorted and apart, as yamlValueSpans gives them. */
export const outsideValues = (values: readonly Span[], length: number): Span[] => {
  const gaps: Span[] = [];
  const cursor = values.reduce((at, span) => {
    if (span.start > at) gaps.push({ start: at, end: span.start });
    return Math.max(at, span.end);
  }, 0);
  if (cursor < length) gaps.push({ start: cursor, end: length });
  return gaps;
};

/** The file with only its values left where they stand: everything else blanked to spaces, line breaks kept. */
export const valuesText = (source: string, values: readonly Span[]): string => maskSpans(source, outsideValues(values, source.length));
