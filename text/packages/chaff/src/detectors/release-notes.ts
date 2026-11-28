// A changelog's release notes: the sections of its release list, where a generated changelog opens each entry with its
// commit scope in bold (* **deps:** update all dependencies). Pure: reads the document's source, headings and code fences.
import type { ProseDocument, Span } from "../plugin.ts";
import { codeFences } from "./code-fences.ts";
import { releasesOf } from "../structure/release-list.ts";

/** The sections of the releases the document lists under version headings or items. */
export const releaseSpansOf = (doc: ProseDocument): Span[] =>
  releasesOf(doc.source, doc.markup?.headings ?? [], codeFences(doc.source)).map(({ start, end }) => ({ start, end }));

export const inRelease = (releases: readonly Span[], offset: number): boolean => releases.some((release) => offset >= release.start && offset < release.end);

const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]+$/u;

/** Whether the bold run at `span` opens a list item inside a release's notes: the entry's scope label (**deps:**). */
export const isReleaseScopeLabel = (source: string, releases: readonly Span[], span: Span): boolean => {
  const lineStart = source.lastIndexOf("\n", span.start - 1) + 1;
  return LIST_MARKER.test(source.slice(lineStart, span.start)) && inRelease(releases, span.start);
};
