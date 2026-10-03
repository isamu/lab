import type { CustomProblem } from "./parse.ts";

/** One field of one rule, read: its value when it can be used, and what is wrong with it otherwise. */
export type Checked<T> = { readonly value: T | undefined; readonly problems: readonly CustomProblem[] };

export const ok = <T>(value: T): Checked<T> => ({ value, problems: [] });

export const failed = <T>(...problems: CustomProblem[]): Checked<T> => ({ value: undefined, problems });
