/**
 * 判定役の面。ここまでが provider ごとに違い、ここから先は共通。
 *
 * 返すのは JSON の文字列で、Verdict への変換と検証は judge.ts が 1 箇所で行う。
 * provider が増えても「返ってきた形の確かめかた」は増やさない。
 */
export type JsonSchema = Readonly<Record<string, unknown>>;

export type Prompt = { readonly system: string; readonly user: string; readonly schema: JsonSchema; readonly model: string };

export type Judge = (prompt: Prompt) => Promise<string>;

export type BackendName = "anthropic" | "openai";

const BACKENDS: readonly BackendName[] = ["anthropic", "openai"];

export const isBackend = (value: unknown): value is BackendName => BACKENDS.some((name) => name === value);

/** API が返した失敗。生のスタックトレースを人に見せないための、最小の分類。 */
export type Failure = { readonly kind: "auth" | "quota" | "api"; readonly status: number | undefined; readonly message: string };

const statusOf = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

const messageOf = (value: unknown): string => (typeof value === "string" && value.length > 0 ? value : "原因は返ってきませんでした");

const kindOf = (status: number | undefined): Failure["kind"] => {
  if (status === 401 || status === 403) return "auth";
  return status === 429 ? "quota" : "api";
};

/**
 * SDK の APIError から Failure を作る。分類は provider で変えない。
 * status と message は SDK 上 any なので、ここで 1 度だけ形を確かめる。
 */
export const toFailure = (error: { readonly status: unknown; readonly message: unknown }): Failure => {
  const status = statusOf(error.status);
  return { kind: kindOf(status), status, message: messageOf(error.message) };
};
