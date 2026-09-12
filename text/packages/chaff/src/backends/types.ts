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

export const BACKENDS: readonly BackendName[] = ["anthropic", "openai"];

export const isBackend = (value: unknown): value is BackendName => BACKENDS.some((name) => name === value);
