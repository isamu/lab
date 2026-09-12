import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as anthropic from "./backends/anthropic.ts";
import * as openai from "./backends/openai.ts";
import type { AnthropicClient } from "./backends/anthropic.ts";
import type { OpenAIClient } from "./backends/openai.ts";
import type { BackendName, Failure, Judge, JsonSchema } from "./backends/types.ts";

export const CACHE_DIR = ".chaff-cache";

/** 判定は必ずこの形で返させる。自由文を後から解釈しない。 */
export type Verdict = { readonly violated: boolean; readonly confidence: number; readonly reason: string };

const SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    violated: { type: "boolean", description: "決まりに反しているなら true" },
    confidence: { type: "number", description: "0 から 1。確からしさ" },
    reason: { type: "string", description: "書いた人に見せる一文。日本語の文書なら日本語で" },
  },
  required: ["violated", "confidence", "reason"],
  additionalProperties: false,
};

const SYSTEM = [
  "あなたは文章の検査係です。与えられた決まりに、文章が反しているかだけを判定します。",
  "",
  "守ること:",
  "- 決まりに書かれていないことを理由にしない。",
  "- 文章を書き換えない。直しかたも述べない。判定と理由だけを返す。",
  "- 迷ったら violated を false にする。誤って指摘するほうが、見逃すより高くつく。",
  "- reason は 1 文。文章の言語に合わせる。",
].join("\n");

export type Ask = {
  readonly rule: string;
  readonly rubric: string;
  /** 判定に渡す範囲。文書全体ではなく、絞り込んだ部分だけ。spec §14。 */
  readonly candidate: string;
  readonly language: string;
};

const keyOf = (ask: Ask, model: string): string =>
  createHash("sha256").update([model, ask.rule, ask.rubric, ask.candidate].join(" ")).digest("hex").slice(0, 32);

const isVerdict = (value: unknown): value is Verdict => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return typeof record["violated"] === "boolean" && typeof record["confidence"] === "number" && typeof record["reason"] === "string";
};

const readCache = (dir: string, key: string): Verdict | undefined => {
  const path = join(dir, `${key}.json`);
  if (!existsSync(path)) return undefined;
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return isVerdict(raw) ? raw : undefined;
};

const writeCache = (dir: string, key: string, verdict: Verdict): void => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${key}.json`), `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
};

const promptOf = (ask: Ask): string =>
  ["# 決まり", "", ask.rubric.trim(), "", "# 判定する文章", "", ask.candidate.trim(), "", "この文章は決まりに反していますか。"].join("\n");

export type JudgeOptions = {
  readonly model: string;
  readonly cacheDir: string;
  readonly backend: BackendName;
  /** テストで差し替える口。provider ごとに型が違うので分けて持つ。 */
  readonly anthropicClient?: AnthropicClient | undefined;
  readonly openaiClient?: OpenAIClient | undefined;
};

const judgeFor = (options: JudgeOptions): Judge =>
  options.backend === "openai" ? openai.judge(options.openaiClient) : anthropic.judge(options.anthropicClient);

export const defaultModel = (backend: BackendName): string => (backend === "openai" ? openai.DEFAULT_MODEL : anthropic.DEFAULT_MODEL);

export const hasCredentials = (backend: BackendName): boolean => (backend === "openai" ? openai.hasCredentials() : anthropic.hasCredentials());

export const isAuthFailure = (backend: BackendName, error: unknown): boolean =>
  backend === "openai" ? openai.isAuthFailure(error) : anthropic.isAuthFailure(error);

export const describeFailure = (backend: BackendName, error: unknown): Failure | undefined =>
  backend === "openai" ? openai.describeFailure(error) : anthropic.describeFailure(error);

export const credentialHint = (backend: BackendName): string => (backend === "openai" ? openai.SETUP_HINT : anthropic.SETUP_HINT);

/**
 * 同じ (model, rule, rubric, candidate) なら 2 度目は問い合わせない。
 * CI でも使えるよう、キャッシュはファイルに置く。spec §14。
 *
 * 返ってきた形の確かめかたは、provider が増えてもここ 1 箇所のまま。
 */
export const ask = async (request: Ask, options: JudgeOptions): Promise<Verdict> => {
  const key = keyOf(request, options.model);
  const cached = readCache(options.cacheDir, key);
  if (cached !== undefined) return cached;
  const body = await judgeFor(options)({ system: SYSTEM, user: promptOf(request), schema: SCHEMA, model: options.model });
  const parsed: unknown = JSON.parse(body);
  if (!isVerdict(parsed)) throw new Error(`${request.rule}: 判定の形が違います`);
  const verdict = { ...parsed, confidence: Math.min(1, Math.max(0, parsed.confidence)) };
  writeCache(options.cacheDir, key, verdict);
  return verdict;
};
