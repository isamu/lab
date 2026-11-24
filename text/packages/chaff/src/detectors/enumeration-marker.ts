import type { Detector, Finding } from "../plugin.ts";
import { findingAt } from "./markup-finding.ts";
import { enumerationMinorities, enumerationRuns } from "../enumeration-marks.ts";

/**
 * Item numbers written in mixed forms at one level of one list or one run of numbered paragraphs (1. 2. 3) 4.): the items in
 * the run's minority form that count on with the others. Code and markup are read as the reader sees them (the prose view).
 */
export const enumerationMarkerMix: Detector = (doc): Finding[] =>
  enumerationRuns(doc.prose ?? doc.source).flatMap((items) =>
    enumerationMinorities(items).map(({ item, usual, count }) =>
      findingAt(doc, { start: item.start, end: item.lineEnd }, { mark: item.mark, usual: usual.mark, count }),
    ),
  );
