import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GradeFact, GradeFinding, GradeResult } from "../packages/chaff/src/grade/result.ts";
import type { GradeSummary } from "../packages/chaff/src/grade/summary.ts";

// What the chaff grade tests share: input lines, results read back from --out, and small findings and facts.

export const jsonl = (...rows: unknown[]): string => rows.map((row) => (typeof row === "string" ? row : JSON.stringify(row))).join("\n");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** The fields these tests read. The shape itself is the type's; the command line is what is under test. */
const isGradeResult = (value: unknown): value is GradeResult =>
  isRecord(value) && typeof value["id"] === "string" && Array.isArray(value["findings"]) && isRecord(value["stamp"]) && isRecord(value["size"]);

export const isSummary = (value: unknown): value is GradeSummary => isRecord(value) && typeof value["total"] === "number" && Array.isArray(value["failed"]);

/** The result lines `--out <name>` wrote in a run's directory. */
export const resultsIn = (dir: string, name = "out.jsonl"): GradeResult[] =>
  readFileSync(join(dir, name), "utf8")
    .trim()
    .split("\n")
    .map((line): unknown => JSON.parse(line))
    .filter(isGradeResult);

export const finding = (level: GradeFinding["level"], rule = "some-rule", line = 1): GradeFinding => ({ rule, level, line, column: 1, message: "" });

export const fact = (allowed = false): GradeFact => ({ kind: "number", key: "6", text: "6", line: 1, allowed });
