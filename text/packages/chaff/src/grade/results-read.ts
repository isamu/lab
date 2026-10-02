import type { GradeResult } from "./result.ts";

// An earlier run's results (`--out`), read back for `--baseline`. Pure. Only lines chaff grade wrote are accepted: a
// baseline that half-reads would compare against outputs that were never graded.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isArrayOf = (value: unknown, each: (entry: unknown) => boolean): boolean => Array.isArray(value) && value.every(each);

const isFinding = (value: unknown): boolean => isRecord(value) && isString(value["rule"]) && isString(value["level"]) && isNumber(value["line"]);

const isFact = (value: unknown): boolean => isRecord(value) && isString(value["kind"]) && isString(value["key"]) && typeof value["allowed"] === "boolean";

const isFacts = (value: unknown): boolean => value === null || (isRecord(value) && isArrayOf(value["dropped"], isFact) && isArrayOf(value["added"], isFact));

const isCitations = (value: unknown): boolean =>
  value === null || (isRecord(value) && isNumber(value["checked"]) && isArrayOf(value["failed"], (entry) => isRecord(entry) && isString(entry["address"])));

const isStamp = (value: unknown): boolean => isRecord(value) && isString(value["chaff"]) && isString(value["rules"]) && isString(value["settings"]);

const isSize = (value: unknown): boolean => isRecord(value) && (value["unit"] === "char" || value["unit"] === "word") && isNumber(value["value"]);

const isScore = (value: unknown): boolean => value === undefined || (isRecord(value) && isNumber(value["penalty"]));

/** The fields a comparison reads, each checked. */
export const isGradeResult = (value: unknown): value is GradeResult =>
  isRecord(value) &&
  isString(value["id"]) &&
  isString(value["language"]) &&
  isString(value["genre"]) &&
  isSize(value["size"]) &&
  isArrayOf(value["findings"], isFinding) &&
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

/** Every result line, or the line numbers that are not one. No result at all is not a baseline. */
export const parseResults = (text: string): { readonly results: readonly GradeResult[] } | { readonly badLines: readonly number[] } => {
  const lines = text
    .split(/\r?\n/u)
    .map((body, index) => ({ body, line: index + 1 }))
    .filter(({ body }) => body.trim() !== "");
  const read = lines.map(({ body, line }) => ({ line, value: parsedLine(body) }));
  const badLines = read.filter((entry) => !isGradeResult(entry.value)).map((entry) => entry.line);
  if (badLines.length > 0 || read.length === 0) return { badLines: read.length === 0 ? [0] : badLines };
  return { results: read.map((entry) => entry.value).filter(isGradeResult) };
};
