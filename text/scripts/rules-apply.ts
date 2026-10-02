// The edits `yarn rules:measure --apply` makes so the files say what the measurement decided: a rule's status, its
// severity at normal (info), and the groups genres.yaml turns it off for. Pure text edits, so the comments and the
// layout of the YAML stay as written.
import type { MeasuredOff } from "./rule-policy.ts";

const STATUS_LINE = /^status: \w+$/mu;

export const withStatus = (ruleYaml: string, status: "experimental" | "stable"): string => {
  if (!STATUS_LINE.test(ruleYaml)) throw new Error("the rule has no status line");
  return ruleYaml.replace(STATUS_LINE, `status: ${status}`);
};

const SEVERITY_LINE = /^severity: \w+$/mu;
const LEVELS_LINE = /^levels: \{([^}]*)\}$/mu;
const SEVERITIES: readonly string[] = ["info", "warning", "error"];

const lowerOne = (entry: string, steps: number): string => {
  const [level = "", severity = ""] = entry.split(":").map((part) => part.trim());
  return ` ${level}: ${SEVERITIES[Math.max(0, SEVERITIES.indexOf(severity) - steps)] ?? "info"}`;
};

/** Each written severity (" strict: error, normal: warning ") moved down by `steps`, never below info. */
const lowered = (entries: string, steps: number): string =>
  `${entries
    .split(",")
    .map((entry) => lowerOne(entry, steps))
    .join(",")} `;

/**
 * The rule reports at info by default. A rule that counts (its levels are numbers) changes its severity; a rule whose
 * levels are severities moves every level down until normal is info, so strict stays one step above it.
 */
export const withInfoAtNormal = (ruleYaml: string): string => {
  if (!SEVERITY_LINE.test(ruleYaml)) throw new Error("the rule has no severity line");
  const levels = LEVELS_LINE.exec(ruleYaml)?.[1];
  const normal = levels === undefined ? undefined : /normal: (info|warning|error)/u.exec(levels)?.[1];
  const withSeverity = ruleYaml.replace(SEVERITY_LINE, "severity: info");
  if (levels === undefined || normal === undefined) return withSeverity;
  return withSeverity.replace(LEVELS_LINE, `levels: {${lowered(levels, SEVERITIES.indexOf(normal))}}`);
};

const MARK = "# measured";
const MEASURED_LINE = /^ {6}([a-z0-9-]+): off {2}# measured$/u;
const GROUP_LINE = /^ {2}- id: (\S+)$/u;
/** A line of the group's own block: its fields, its rules and their comments, all indented past the "- id:". */
const IN_BLOCK = /^ {4}/u;
const RULES_LINE = "    rules:";
const RULE_INDENT = "      ";

/** genres.yaml's lines split where its genres start: only the groups above may hold a measured off. */
const splitAtGenres = (genresYaml: string): [string[], string[]] => {
  const lines = genresYaml.split("\n");
  const end = lines.indexOf("genres:");
  return end === -1 ? [lines, []] : [lines.slice(0, end), lines.slice(end)];
};

/** The "<rule>: off  # measured" lines of genres.yaml's groups, with the group each sits in. */
export const measuredOffsOf = (genresYaml: string): MeasuredOff[] =>
  splitAtGenres(genresYaml)[0].reduce<{ group: string; found: MeasuredOff[] }>(
    (state, line) => {
      const group = GROUP_LINE.exec(line)?.[1];
      if (group !== undefined) return { group, found: state.found };
      const rule = MEASURED_LINE.exec(line)?.[1];
      return rule === undefined ? state : { group: state.group, found: [...state.found, { group: state.group, rule }] };
    },
    { group: "", found: [] },
  ).found;

/** The group's block as [first line, line after its last]. */
const blockOf = (lines: readonly string[], group: string): [number, number] | undefined => {
  const start = lines.findIndex((line) => GROUP_LINE.exec(line)?.[1] === group);
  if (start === -1) return undefined;
  const next = lines.findIndex((line, index) => index > start && !IN_BLOCK.test(line));
  return [start, next === -1 ? lines.length : next];
};

const addToGroup = (lines: readonly string[], group: string, rules: readonly string[]): string[] => {
  const block = blockOf(lines, group);
  if (block === undefined) throw new Error(`genres.yaml has no group ${group}`);
  const [start, end] = block;
  const hasRules = lines.slice(start, end).includes(RULES_LINE);
  const added = rules.map((rule) => `${RULE_INDENT}${rule}: off  ${MARK}`);
  return [...lines.slice(0, end), ...(hasRules ? [] : [RULES_LINE]), ...added, ...lines.slice(end)];
};

/** A group's "rules:" left with nothing under it, once its measured lines are gone. */
const withoutEmptyRules = (lines: readonly string[]): string[] =>
  lines.filter((line, index) => line !== RULES_LINE || (lines[index + 1] ?? "").startsWith(RULE_INDENT));

/** Whether the group's block already turns the rule off by hand. */
const offByHand = (lines: readonly string[], group: string, rule: string): boolean => {
  const block = blockOf(lines, group);
  return block !== undefined && lines.slice(...block).some((line) => line.startsWith(`${RULE_INDENT}${rule}: off`));
};

/**
 * genres.yaml with exactly these measured offs: the old "# measured" lines are dropped and the new ones appended to
 * their group's rules. A rule the group already turns off by hand keeps that line and gets no second one.
 */
export const withMeasuredOffs = (genresYaml: string, offs: readonly MeasuredOff[]): string => {
  const [groups, genres] = splitAtGenres(genresYaml);
  const kept = withoutEmptyRules(groups.filter((line) => !MEASURED_LINE.test(line)));
  const byGroup = offs
    .filter((off) => !offByHand(kept, off.group, off.rule))
    .reduce((found, off) => found.set(off.group, [...(found.get(off.group) ?? []), off.rule]), new Map<string, string[]>());
  const added = [...byGroup.entries()].reduce(
    (lines, [group, rules]) =>
      addToGroup(
        lines,
        group,
        rules.toSorted((left, right) => left.localeCompare(right, "en")),
      ),
    kept,
  );
  return [...added, ...genres].join("\n");
};
