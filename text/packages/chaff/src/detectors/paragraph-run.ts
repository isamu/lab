import type { Detector, Finding } from "../plugin.ts";
import { oneSentenceRuns } from "../paragraph-runs.ts";

/** How much of the run's first paragraph the finding quotes. */
const QUOTE_LENGTH = 80;

/**
 * Runs of one-sentence paragraphs longer than the limit: every sentence set apart as its own paragraph, so nothing is grouped
 * and the reader cannot see which points belong together. One finding per run, at its first paragraph.
 */
export const oneSentenceParagraphRun: Detector = (doc, options): Finding[] =>
  oneSentenceRuns(doc.source, doc.paragraphs)
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
