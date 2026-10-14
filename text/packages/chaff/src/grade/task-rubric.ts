import type { Rubric } from "./rubric.ts";

// The rubric one item is graded by: the top-level rubric with its task's rubric laid over it. Pure.
// A key the task writes replaces the top-level key whole (`facts`, `citations`, `contexts` are not merged field by
// field); a key it does not write is inherited. `rules` is merged per rule id: the task's entry for an id replaces the
// top-level entry for that id, and every other top-level id still applies.

/** The task names a rubric defines; none without a rubric or without `tasks`. */
export const taskNamesOf = (rubric: Rubric | undefined): readonly string[] => Object.keys(rubric?.tasks ?? {});

/** Each rule id the rubric names and where, from the rubric's top level: `rules`, or `tasks.<name>.rules`. */
export const rubricRuleEntries = (rubric: Rubric | undefined): readonly { readonly path: string; readonly id: string }[] => [
  ...Object.keys(rubric?.rules ?? {}).map((id) => ({ path: "rules", id })),
  ...Object.entries(rubric?.tasks ?? {}).flatMap(([name, task]) => Object.keys(task.rules).map((id) => ({ path: `tasks.${name}.rules`, id }))),
];

/** Every rule id the rubric names, at the top level or in any task: the rules whose rise is a regression. */
export const rubricRuleIds = (rubric: Rubric | undefined): ReadonlySet<string> => new Set(rubricRuleEntries(rubric).map((entry) => entry.id));

const overlay = (top: Rubric, task: Rubric): Rubric => ({
  rules: { ...top.rules, ...task.rules },
  requiredSections: task.requiredSections ?? top.requiredSections,
  facts: task.facts ?? top.facts,
  citations: task.citations ?? top.citations,
  contexts: task.contexts ?? top.contexts,
  penalty: task.penalty ?? top.penalty,
});

/**
 * The rubric for an item of `task`. Without a task, the rubric as it is. A task the rubric does not define is refused
 * when the items are read, so here it cannot happen; it throws rather than fall back to the top level silently.
 */
export const rubricForTask = (rubric: Rubric | undefined, task: string | undefined): Rubric | undefined => {
  if (task === undefined) return rubric;
  const own = rubric?.tasks?.[task];
  if (rubric === undefined || own === undefined) throw new Error(`chaff grade: no rubric for task "${task}"`);
  return overlay(rubric, own);
};
