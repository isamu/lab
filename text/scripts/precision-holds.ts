// A rule file's precision_hold: the groups its judged precision is low in, where it stays on because a narrowing fix is
// due, each with why. `yarn rules:precision` lists them instead of turning the rule off. Pure.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The groups a rule's precision_hold names, checked against the groups genres.yaml knows; empty when it has none. */
export const precisionHoldsOf = (rule: string, raw: unknown, groups: readonly string[]): string[] => {
  if (raw === undefined || raw === null) return [];
  if (!isRecord(raw)) throw new Error(`${rule}: precision_hold must map a group to why the rule stays on`);
  return Object.entries(raw).map(([group, reason]) => {
    if (!groups.includes(group)) throw new Error(`${rule}: precision_hold names ${group}, which is no group`);
    if (typeof reason !== "string" || reason.trim() === "") throw new Error(`${rule}: precision_hold.${group} needs a reason`);
    return group;
  });
};
