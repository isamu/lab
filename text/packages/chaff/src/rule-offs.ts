import { join } from "node:path";
import { parse } from "yaml";
import { readDir, readText } from "./package-files.ts";

/** One rule a group or genre turns off by default, from the rule file's off_for, with why. */
export type RuleOff = { readonly rule: string; readonly target: string; readonly reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A rule file's off_for block: the "off_for:" line and the indented lines under it. */
const OFF_FOR_BLOCK = /^off_for:\n(?:[ \t]+[^\n]*\n?)*/mu;
/** Any top-level off_for line, of whatever form. Only the block form is read, the form `yarn rules:measure --apply` edits. */
const OFF_FOR_LINE = /^off_for:.*$/gmu;

/** The off_for map of one rule file (the group or genre, then why), checked; empty when the file has none. */
export const ruleOffsOf = (rule: string, raw: unknown): RuleOff[] => {
  if (raw === undefined || raw === null) return [];
  if (!isRecord(raw)) throw new Error(`${rule}: off_for must map a group or genre to why it turns the rule off`);
  return Object.entries(raw).map(([target, reason]) => {
    if (typeof reason !== "string" || reason.trim() === "") throw new Error(`${rule}: off_for.${target} needs a reason`);
    return { rule, target, reason };
  });
};

/** The off_for block of one rule file's text, or undefined; a second block or another form stops here. */
const offForBlock = (rule: string, text: string): string | undefined => {
  const lines = [...text.matchAll(OFF_FOR_LINE)].map((match) => match[0]);
  if (lines.length === 0) return undefined;
  if (lines.length > 1 || lines[0] !== "off_for:")
    throw new Error(`${rule}: write off_for once, as "off_for:" with one indented "<group or genre>: <why>" line under it per off`);
  return OFF_FOR_BLOCK.exec(text)?.[0];
};

/** The offs of one rule file. The rule is named by the file, which is named by the rule's id. */
const offsInFile = (dir: string, file: string): RuleOff[] => {
  const rule = file.replace(/\.yaml$/u, "");
  const block = offForBlock(rule, readText(join(dir, file)).replaceAll("\r\n", "\n"));
  const parsed: unknown = block === undefined ? undefined : parse(block);
  return ruleOffsOf(rule, isRecord(parsed) ? parsed["off_for"] : undefined);
};

/**
 * The offs of every rule file in `dir`. Only each file's off_for block is parsed, not the whole rule: genres are read
 * at startup, before any rule is.
 */
export const loadRuleOffs = (dir: string): RuleOff[] =>
  readDir(dir)
    .filter((file) => file.endsWith(".yaml"))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .flatMap((file) => offsInFile(dir, file));
