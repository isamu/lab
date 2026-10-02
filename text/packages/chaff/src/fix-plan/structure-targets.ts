import type { FeatureId } from "../structure-shape/features.ts";
import type { Placement, StructureScore } from "../structure-shape/score.ts";

/** How many section headings the document has, and how many a human article of its length has at most and usually. */
export type HeadingBudget = { readonly now: number; readonly most: number; readonly usual: number };

/** One structure measure to bring back into the human range: where it is, where the human limit is, and the median. */
export type StructureTarget = {
  readonly id: FeatureId;
  readonly value: number;
  readonly limit: number;
  readonly median: number;
  readonly detail?: string;
  /** For heading density only: the measure turned into a count of headings for this document's length. */
  readonly headings?: HeadingBudget;
};

const PER = 1000;

const budgetOf = (placement: Placement, value: number, length: number): HeadingBudget => ({
  now: placement.feature.count ?? Math.round((value * length) / PER),
  most: Math.floor(((placement.limit ?? 0) * length) / PER),
  usual: Math.round(((placement.median ?? 0) * length) / PER),
});

const targetOf = (placement: Placement, length: number): StructureTarget[] => {
  const { value, detail, id } = placement.feature;
  if (!placement.beyond || value === undefined || placement.limit === undefined || placement.median === undefined) return [];
  return [
    {
      id,
      value,
      limit: placement.limit,
      median: placement.median,
      ...(detail === undefined ? {} : { detail }),
      ...(id === "heading-density" ? { headings: budgetOf(placement, value, length) } : {}),
    },
  ];
};

/**
 * The measures past the human limit, each as a target from the baseline's numbers. `length` is the document's length in
 * its unit (characters or words), which turns the heading density into a count of headings.
 */
export const structureTargetsOf = (score: StructureScore, length: number): StructureTarget[] =>
  score.placements.flatMap((placement) => targetOf(placement, length));
