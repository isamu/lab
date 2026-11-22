import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { oneSentenceRuns } from "../paragraph-runs.ts";
import { referenceListSpans } from "../reference-lists.ts";

/** How much of the run's first paragraph the finding quotes when it holds no sentence; it never runs past the paragraph. */
const QUOTE_LENGTH = 80;

/** The headings whose paragraphs are entries, not prose: a reference list's, and a footnotes section's (each note its own paragraph). */
const entryListHeadings = (doc: ProseDocument): string[] =>
  ["reference-list-heading", "note-list-heading"].flatMap((lexicon) => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern));

/**
 * Runs of one-sentence paragraphs longer than the limit: every sentence set apart as its own paragraph, so nothing is grouped
 * and the reader cannot see which points belong together. One finding per run, at its first paragraph. A reference list's
 * entries and a footnotes section's notes are a list, and are not counted.
 */
export const oneSentenceParagraphRun: Detector = (doc, options): Finding[] =>
  oneSentenceRuns(doc.source, doc.paragraphs, referenceListSpans(doc.source, entryListHeadings(doc)))
    .filter((run) => run.length > options.limit)
    .flatMap((run) => {
      const first = run[0];
      if (first === undefined) return [];
      return [
        {
          rule: "",
          severity: "info",
          line: 0,
          column: 0,
          quote: first.sentences[0]?.text.trim() ?? doc.source.slice(first.span.start, Math.min(first.span.start + QUOTE_LENGTH, first.span.end)).trim(),
          values: { count: run.length, limit: options.limit, offset: first.span.start },
        },
      ];
    });
