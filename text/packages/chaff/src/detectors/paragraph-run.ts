import type { Detector, Finding } from "../plugin.ts";
import { oneSentenceRuns } from "../paragraph-runs.ts";
import { referenceListSpans } from "../reference-lists.ts";

/** How much of the run's first paragraph the finding quotes. */
const QUOTE_LENGTH = 80;

/**
 * Runs of one-sentence paragraphs longer than the limit: every sentence set apart as its own paragraph, so nothing is grouped
 * and the reader cannot see which points belong together. One finding per run, at its first paragraph. A reference list's
 * entries are a list, and are not counted.
 */
export const oneSentenceParagraphRun: Detector = (doc, options): Finding[] =>
  oneSentenceRuns(
    doc.source,
    doc.paragraphs,
    referenceListSpans(
      doc.source,
      (doc.lexicons["reference-list-heading"] ?? []).map((entry) => entry.pattern),
    ),
  )
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
          quote: doc.source.slice(first.span.start, first.span.start + QUOTE_LENGTH).trim(),
          values: { count: run.length, limit: options.limit, offset: first.span.start },
        },
      ];
    });
