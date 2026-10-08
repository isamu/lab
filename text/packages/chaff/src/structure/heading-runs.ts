/**
 * Headings at one depth under one parent heading, as a changelog's version or dated headings stand. A shallower heading
 * closes the runs deeper than it; a deeper heading (### Added) ends none. A heading pointOf turns down still closes the
 * deeper runs but joins no run and opens none, so "## Install" between two version headings does not split them.
 */
export const siblingHeadingRunsOf = <Heading extends { readonly depth: number }, Point>(
  headings: readonly Heading[],
  pointOf: (heading: Heading) => Point | undefined,
): Point[][] => {
  const runs: Point[][] = [];
  const open = new Map<number, Point[]>();
  headings.forEach((heading) => {
    [...open.keys()].filter((depth) => depth > heading.depth).forEach((depth) => open.delete(depth));
    const point = pointOf(heading);
    if (point === undefined) return;
    const run = open.get(heading.depth) ?? [];
    if (!open.has(heading.depth)) {
      open.set(heading.depth, run);
      runs.push(run);
    }
    run.push(point);
  });
  return runs;
};
