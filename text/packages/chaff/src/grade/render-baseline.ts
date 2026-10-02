import type { LengthUnit } from "../plugin.ts";
import type { Comparison, ItemChange, RuleMovement } from "./baseline.ts";
import type { BaselineText } from "./baseline-text.ts";
import { block } from "./render.ts";

const UNITS: readonly LengthUnit[] = ["word", "char"];

const listed = (ids: readonly string[], text: BaselineText): string => (ids.length === 0 ? text.none : ids.join(", "));

const signed = (value: number): string => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

const movementLine = (movement: RuleMovement, width: number, text: BaselineText): string =>
  [
    `  ${movement.rule.padEnd(width)}  ${movement.before.toFixed(1)} → ${movement.after.toFixed(1)}  (${signed(movement.after - movement.before)})`,
    ...(movement.increasedIn.length === 0 ? [] : [text.more(movement.increasedIn.join(", "))]),
    ...(movement.decreasedIn.length === 0 ? [] : [text.fewer(movement.decreasedIn.join(", "))]),
    ...(movement.inRubric ? [text.inRubric] : []),
  ].join("  ");

const movementBlocks = (comparison: Comparison, text: BaselineText): string[] =>
  UNITS.flatMap((unit) => {
    const movements = comparison.rules.filter((movement) => movement.unit === unit);
    const width = movements.reduce((widest, movement) => Math.max(widest, movement.rule.length), 0);
    return block(
      text.ratesHeading(text.unit[unit]),
      movements.map((movement) => movementLine(movement, width, text)),
    );
  });

const factsOf = (facts: ItemChange["dropped"], text: BaselineText): string =>
  facts.length === 0 ? text.none : facts.map((fact) => `${fact.kind} ${fact.text}`).join(", ");

const itemLine = (change: ItemChange, text: BaselineText): string =>
  [
    `  ${change.id}: ${text.droppedAdded(factsOf(change.dropped, text), factsOf(change.added, text))}`,
    ...(change.citations.length === 0 ? [] : [text.newCitations(change.citations.map((citation) => `${citation.source} ${citation.address}`).join(", "))]),
  ].join(text.separator);

const unpairedLines = (comparison: Comparison, text: BaselineText): string[] =>
  comparison.onlyBefore.length + comparison.onlyAfter.length + comparison.readOtherwise.length === 0
    ? []
    : [text.unpaired(listed(comparison.onlyBefore, text), listed(comparison.onlyAfter, text), listed(comparison.readOtherwise, text))];

const regressionLines = (comparison: Comparison, text: BaselineText): string[] =>
  comparison.regressions.length === 0
    ? ["", text.noRegression]
    : block(
        text.regressionsHeading(comparison.regressions.length),
        comparison.regressions.map((reason) => `  ✗ ${reason}`),
      );

/** For a person: what was paired, how each rule moved and where, what newly failed or passed, new facts, and the verdict. */
export const renderComparison = (path: string, comparison: Comparison, text: BaselineText): string =>
  [
    text.heading(path, comparison.paired),
    ...unpairedLines(comparison, text),
    ...movementBlocks(comparison, text),
    "",
    text.newlyFailed(listed(comparison.newlyFailed, text)),
    text.newlyPassed(listed(comparison.newlyPassed, text)),
    ...(comparison.penalty === undefined ? [] : [text.penalty(comparison.penalty.before, comparison.penalty.after)]),
    ...block(
      text.newFactsHeading,
      comparison.items.map((change) => itemLine(change, text)),
    ),
    ...regressionLines(comparison, text),
  ].join("\n");

/** For a CI log: one line per regression, then the verdict. */
export const renderComparisonCompact = (comparison: Comparison, text: BaselineText): string =>
  [
    ...comparison.regressions.map((reason) => `regression\t${reason}`),
    comparison.regressions.length === 0 ? text.noRegression : text.regressionsHeading(comparison.regressions.length),
  ].join("\n");
