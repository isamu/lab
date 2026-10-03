// The edits `yarn rules:measure --apply` makes so the files say what the measurement decided: a rule's status, its
// severity at normal (info), and the groups it is off for (its off_for). Pure text edits of the rule file, so the comments and the
// layout of the YAML stay as written.
import type { MeasuredOff } from "./rule-policy.ts";

const STATUS_LINE = /^status: \w+$/mu;

export const withStatus = (ruleYaml: string, status: "experimental" | "stable"): string => {
  if (!STATUS_LINE.test(ruleYaml)) throw new Error("the rule has no status line");
  return ruleYaml.replace(STATUS_LINE, `status: ${status}`);
};

const LEVELS_LINE = /^levels: \{([^}]*)\}$/mu;
/** Levels written per language (levels:, then ja: and en: under it) are not rewritten here. */
const LEVELS_BLOCK = /^levels:$/mu;
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

/** "severity: info", in place of "severity: warning" or of a severity written per language (severity:, then ja: and en: under it). */
const withInfoSeverity = (ruleYaml: string): string => {
  const lines = ruleYaml.split("\n");
  const start = lines.findIndex((line) => line === "severity:" || /^severity: \w+$/u.test(line));
  if (start === -1) throw new Error("the rule has no severity line");
  const perLanguage = lines.slice(start + 1).findIndex((line) => !line.startsWith("  "));
  const blockLength = perLanguage === -1 ? lines.length - start - 1 : perLanguage;
  const end = start + 1 + (lines[start] === "severity:" ? blockLength : 0);
  return [...lines.slice(0, start), "severity: info", ...lines.slice(end)].join("\n");
};

/**
 * The rule reports at info by default. A rule that counts (its levels are numbers) changes its severity; a rule whose
 * levels are severities moves every level down until normal is info, so strict stays one step above it.
 */
export const withInfoAtNormal = (ruleYaml: string): string => {
  const withSeverity = withInfoSeverity(ruleYaml);
  const levels = LEVELS_LINE.exec(ruleYaml)?.[1];
  const normal = levels === undefined ? undefined : /normal: (info|warning|error)/u.exec(levels)?.[1];
  if (levels === undefined && LEVELS_BLOCK.test(ruleYaml) && /normal: (?:warning|error)\b/u.test(ruleYaml))
    throw new Error("the rule writes its severity levels per language; set them by hand");
  if (levels === undefined || normal === undefined) return withSeverity;
  return withSeverity.replace(LEVELS_LINE, `levels: {${lowered(levels, SEVERITIES.indexOf(normal))}}`);
};

/** The reason `--apply` writes for an off it measured. An off with any other reason was written by hand. */
export const MEASURED = "measured by yarn rules:measure";
const OFF_FOR_LINE = "off_for:";
const ENTRY = /^ {2}([a-z0-9/-]+): (.+)$/u;
const USE_FOR_LINE = /^use_for: /u;

/** The rule file's off_for block as [its "off_for:" line, the line after its last entry], or undefined. */
const offForBlock = (lines: readonly string[]): [number, number] | undefined => {
  const start = lines.indexOf(OFF_FOR_LINE);
  if (start === -1) return undefined;
  const after = lines.findIndex((line, index) => index > start && !line.startsWith("  "));
  return [start, after === -1 ? lines.length : after];
};

const entriesOf = (lines: readonly string[]): { readonly target: string; readonly reason: string }[] => {
  const block = offForBlock(lines);
  if (block === undefined) return [];
  return lines.slice(block[0] + 1, block[1]).flatMap((line) => {
    const entry = ENTRY.exec(line);
    return entry?.[1] === undefined || entry[2] === undefined ? [] : [{ target: entry[1], reason: entry[2] }];
  });
};

/** The offs `--apply` wrote into a rule file's off_for. */
export const measuredOffsOf = (rule: string, ruleYaml: string): MeasuredOff[] =>
  entriesOf(ruleYaml.split("\n"))
    .filter((entry) => entry.reason === MEASURED)
    .map((entry) => ({ group: entry.target, rule }));

/** The lines with the off_for block replaced by these entry lines, or removed when there are none. */
const withBlock = (lines: readonly string[], entries: readonly string[]): string[] => {
  const block = offForBlock(lines);
  const body = entries.length === 0 ? [] : [OFF_FOR_LINE, ...entries];
  if (block !== undefined) return [...lines.slice(0, block[0]), ...body, ...lines.slice(block[1])];
  const useFor = lines.findIndex((line) => USE_FOR_LINE.test(line));
  if (useFor === -1) throw new Error("the rule has no use_for line");
  return [...lines.slice(0, useFor + 1), ...body, ...lines.slice(useFor + 1)];
};

/**
 * The rule file with exactly these measured offs in its off_for: the old measured entries are dropped and the new ones
 * appended. A group the file already turns off by hand keeps that entry and gets no second one.
 */
export const withMeasuredOffs = (ruleYaml: string, groups: readonly string[]): string => {
  const lines = ruleYaml.split("\n");
  const byHand = entriesOf(lines).filter((entry) => entry.reason !== MEASURED);
  const added = groups
    .filter((group) => !byHand.some((entry) => entry.target === group))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .map((group) => `  ${group}: ${MEASURED}`);
  const kept = lines.slice(...(offForBlock(lines) ?? [0, 0])).filter((line) => line !== OFF_FOR_LINE && !line.endsWith(`: ${MEASURED}`));
  return withBlock(lines, [...kept, ...added]).join("\n");
};
