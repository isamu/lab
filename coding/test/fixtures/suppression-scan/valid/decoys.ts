// Correct code that is easy to false-positive on (spec §26.1).
// A single detection here means the probe is broken.

/**
 * This comment discusses @ts-ignore, eslint-disable and as any.
 * It is prose about directives, not a single actual suppression.
 */

export const PATTERNS = {
  tsDirective: /@ts-(ignore|expect-error|nocheck)/,
  eslintDirective: "eslint-disable",
  castLike: "as any",
};

export const describeSuppression = (kind: string): string => {
  const label = kind === "ts" ? "@ts-ignore" : "eslint-disable-next-line";
  return `${label} must never be used without a reason`;
};

// `as const` is a type assertion but bypasses nothing, so it is not a suppression.
export const LEVELS = ["low", "medium", "high"] as const;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
