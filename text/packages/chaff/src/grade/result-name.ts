import type { GradeResult } from "./result.ts";

/** The same task: an id within its variant. Two variants' outputs for one id are different outputs of one task. */
export const resultKey = (result: Pick<GradeResult, "id" | "variant">): string => `${result.variant ?? ""}\n${result.id}`;

/** An output as a person reads its name: the id, and its variant when it has one. */
export const resultName = (result: Pick<GradeResult, "id" | "variant">): string =>
  result.variant === undefined ? result.id : `${result.id} (${result.variant})`;
