// A stated total time (所要時間：60分, Total time: 1 hr) that is not the sum of the times written in the numbered steps. The
// units, the total labels, the rough-figure marks and the marks of a time that is not a step's own come from the language packages.
import { stepTimeSlip, type StepTimeWords } from "../structure/step-times.ts";
import type { Mark } from "../structure/time-marks.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const marksOf = (doc: ProseDocument, id: string): Mark[] =>
  (doc.lexicons[id] ?? []).map((entry) => ({ pattern: entry.pattern, position: entry.position, group: entry.group }));

const unitsWeighing = (doc: ProseDocument, seconds: number): string[] =>
  (doc.lexicons["unit-time"] ?? []).filter((entry) => entry.weight === seconds).map((entry) => entry.pattern);

const RANGE_GROUP = "range";

const wordsOf = (doc: ProseDocument): StepTimeWords => {
  const notOwn = marksOf(doc, "step-time-not-own");
  return {
    lengths: {
      hourUnits: unitsWeighing(doc, SECONDS_PER_HOUR),
      minuteUnits: unitsWeighing(doc, SECONDS_PER_MINUTE),
      halves: patternsOf(doc, "length-half"),
      numberWords: patternsOf(doc, "count-number"),
    },
    totals: marksOf(doc, "step-time-total"),
    approximate: marksOf(doc, "approximate-marker"),
    notOwn: notOwn.filter((mark) => mark.group !== RANGE_GROUP),
    rangeJoiners: notOwn.filter((mark) => mark.group === RANGE_GROUP).map((mark) => mark.pattern),
  };
};

export const stepTimeSumMismatch: Detector = (doc): Finding[] => {
  const slip = stepTimeSlip(doc.source, wordsOf(doc));
  if (slip === undefined) return [];
  return [
    {
      rule: "step-time-sum-mismatch",
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, slip.total.start),
      values: {
        written: doc.source.slice(slip.total.start, slip.total.end),
        sum: slip.sum,
        steps: slip.steps,
        offset: slip.total.start,
      },
    },
  ];
};
