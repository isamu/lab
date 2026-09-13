import { parse } from "yaml";
import type { ConfigFile } from "../plugin.ts";

/** What a step actually runs: its shell script, plus the action it calls. */
export const commandsIn = (files: readonly ConfigFile[]): readonly string[] =>
  files.flatMap((file) => {
    try {
      return stepsOf(parse(file.text)).flatMap((step) => {
        const script = typeof step["run"] === "string" ? [step["run"]] : [];
        const action = typeof step["uses"] === "string" ? [step["uses"]] : [];
        return [...script, ...action];
      });
    } catch {
      return [];
    }
  });

/**
 * Which CI steps really swallow their failure (spec §15).
 *
 * `|| true` alone does not mean a failure was ignored. The other use of it is to capture output
 * from a command that exits non-zero and then judge that output — `yarn example > out.txt || true`
 * followed by a `grep` and an `exit 1` is the opposite of swallowing, and this repository's own
 * workflow does exactly that. A scan that cannot tell the two apart reports an `error` against a
 * step that is stricter than most, and now that the ratchet can fail a build on a new error
 * finding, a rule that cries wolf costs a build.
 *
 * So the workflow is parsed rather than grepped, and a step's script is read as a whole.
 */

/** A script that ends the step on its own terms has judged the outcome it captured. */
const ASSERTS = [/\bexit\s+[1-9]/, /::error::/, /\bexit\s+\$/];

const IGNORES = /\|\|\s*true\b/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const stepsOf = (workflow: unknown): readonly Record<string, unknown>[] => {
  const jobs = isRecord(workflow) ? workflow["jobs"] : undefined;
  if (!isRecord(jobs)) return [];
  return Object.values(jobs).flatMap((job) => {
    const steps = isRecord(job) ? job["steps"] : undefined;
    return Array.isArray(steps) ? steps.filter(isRecord) : [];
  });
};

const swallowsInStep = (step: Record<string, unknown>): boolean => {
  if (step["continue-on-error"] === true) return true;
  const script = step["run"];
  if (typeof script !== "string" || !IGNORES.test(script)) return false;
  return !ASSERTS.some((pattern) => pattern.test(script));
};

/** A job-level `continue-on-error` makes every step in it decoration. */
const swallowingJobs = (workflow: unknown): number => {
  const jobs = isRecord(workflow) ? workflow["jobs"] : undefined;
  if (!isRecord(jobs)) return 0;
  return Object.values(jobs).filter((job) => isRecord(job) && job["continue-on-error"] === true).length;
};

const countIn = (file: ConfigFile): number => {
  try {
    const workflow: unknown = parse(file.text);
    return stepsOf(workflow).filter(swallowsInStep).length + swallowingJobs(workflow);
  } catch {
    // Unparseable YAML is not a licence to guess; a workflow GitHub cannot read runs nothing.
    return 0;
  }
};

export interface Swallowed {
  readonly count: number;
  readonly file: string | undefined;
}

export const swallowedFailures = (workflows: readonly ConfigFile[]): Swallowed => {
  const counted = workflows.map((file) => ({ file, count: countIn(file) }));
  const worst = counted.filter((entry) => entry.count > 0);
  return { count: counted.reduce((sum, entry) => sum + entry.count, 0), file: worst[0]?.file.path };
};
