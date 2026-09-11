// この fixture は「probe が誤検知しやすい正常なコード」を集めたもの (spec §26.1)。
// ここから 1 件でも検出されたら probe が壊れている。

/**
 * このコメントは @ts-ignore と eslint-disable と as any について説明している。
 * 散文がディレクティブを話題にしているだけで、どれも実際の抑制ではない。
 */

export const PATTERNS = {
  tsDirective: /@ts-(ignore|expect-error|nocheck)/,
  eslintDirective: "eslint-disable",
  castLike: "as any",
};

export const describeSuppression = (kind: string): string => {
  const label = kind === "ts" ? "@ts-ignore" : "eslint-disable-next-line";
  return `${label} は理由なしでは使わないこと`;
};

// as const は型アサーションではあるが、型を迂回しないので抑制ではない。
export const LEVELS = ["low", "medium", "high"] as const;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
