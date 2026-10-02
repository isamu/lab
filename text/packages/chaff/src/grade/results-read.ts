import type { GradeResult } from "./result.ts";

// An earlier run's results (`--out`), read back for `--baseline`. Pure. Only lines chaff grade wrote are accepted: a
// baseline that half-reads would compare against outputs that were never graded.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isArrayOf = (value: unknown, each: (entry: unknown) => boolean): boolean => Array.isArray(value) && value.every(each);

const isFinding = (value: unknown): boolean =>
  isRecord(value) && isString(value["rule"]) && isString(value["level"]) && isNumber(value["line"]) && isNumber(value["column"]) && isString(value["message"]);

const isFact = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value["kind"]) &&
  isString(value["key"]) &&
  isString(value["text"]) &&
  isNumber(value["line"]) &&
  typeof value["allowed"] === "boolean";

const isFailedCitation = (value: unknown): boolean =>
  isRecord(value) && isString(value["source"]) && isString(value["address"]) && isString(value["quote"]) && isString(value["status"]);

const isFacts = (value: unknown): boolean => value === null || (isRecord(value) && isArrayOf(value["dropped"], isFact) && isArrayOf(value["added"], isFact));

const isCitations = (value: unknown): boolean =>
  value === null || (isRecord(value) && isNumber(value["checked"]) && isArrayOf(value["failed"], isFailedCitation));

const isStamp = (value: unknown): boolean => isRecord(value) && isString(value["chaff"]) && isString(value["rules"]) && isString(value["settings"]);

const isSize = (value: unknown): boolean => isRecord(value) && (value["unit"] === "char" || value["unit"] === "word") && isNumber(value["value"]);

const isScoreItem = (value: unknown): boolean => isRecord(value) && isNumber(value["points"]) && isString(value["rule"]) && isNumber(value["line"]);

const isScore = (value: unknown): boolean => value === undefined || (isRecord(value) && isNumber(value["penalty"]) && isArrayOf(value["items"], isScoreItem));

const isNotRun = (value: unknown): boolean => isRecord(value) && isString(value["rule"]) && isString(value["reason"]);

const isRates = (value: unknown): boolean => isRecord(value) && Object.values(value).every(isNumber);

/** A line `--out` writes, every field checked: a line that only looks like one would be compared as if it had been graded. */
export const isGradeResult = (value: unknown): value is GradeResult =>
  isRecord(value) &&
  isString(value["id"]) &&
  isString(value["language"]) &&
  isString(value["genre"]) &&
  isSize(value["size"]) &&
  isArrayOf(value["findings"], isFinding) &&
  isRates(value["rates"]) &&
  isArrayOf(value["notRun"], isNotRun) &&
  isFacts(value["facts"]) &&
  isCitations(value["citations"]) &&
  isScore(value["score"]) &&
  typeof value["pass"] === "boolean" &&
  isArrayOf(value["failedBecause"], isString) &&
  isStamp(value["stamp"]);

const parsedLine = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

/** The lines whose id an earlier line already has: one run never grades two outputs under one id. */
const repeatedIds = (read: readonly { readonly line: number; readonly value: unknown }[]): number[] => {
  const seen = new Set<string>();
  return read.flatMap(({ line, value }) => {
    if (!isGradeResult(value)) return [];
    const repeated = seen.has(value.id);
    seen.add(value.id);
    return repeated ? [line] : [];
  });
};

/** Every result line, or the line numbers that are not one (or repeat an id). No result at all is not a baseline. */
export const parseResults = (text: string): { readonly results: readonly GradeResult[] } | { readonly badLines: readonly number[] } => {
  const lines = text
    .split(/\r?\n/u)
    .map((body, index) => ({ body, line: index + 1 }))
    .filter(({ body }) => body.trim() !== "");
  const read = lines.map(({ body, line }) => ({ line, value: parsedLine(body) }));
  const badLines = [...read.filter((entry) => !isGradeResult(entry.value)).map((entry) => entry.line), ...repeatedIds(read)].toSorted(
    (left, right) => left - right,
  );
  if (badLines.length > 0 || read.length === 0) return { badLines: read.length === 0 ? [0] : badLines };
  return { results: read.map((entry) => entry.value).filter(isGradeResult) };
};
