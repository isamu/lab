import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Judge, Prompt } from "./types.ts";

export type AnthropicResponse = { readonly content: readonly { readonly type: string; readonly text?: string | undefined }[] };

/** judge が使うのは messages.create だけ。最小の面だけを要求する。テストで差し替えられる。 */
export type AnthropicClient = { readonly messages: { readonly create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<AnthropicResponse> } };

const isTextBlock = (block: unknown): block is { readonly text: string } =>
  typeof block === "object" && block !== null && "text" in block && typeof block.text === "string";

export const DEFAULT_MODEL = "claude-opus-5";

/**
 * 認証情報があるか。
 *
 * env var を見るだけでは足りない。SDK は ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN /
 * `ant auth login` のプロファイル / Workload Identity の順に解決するので、env が
 * 無くても通ることがある。逆に、無いまま呼ぶと SDK は型の無い素の Error を投げる
 * （AnthropicError でも APIError でもない）ので、あとから種類で判別できない。
 * だから先に確かめる。
 */
const ENV_KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_IDENTITY_TOKEN", "ANTHROPIC_IDENTITY_TOKEN_FILE"];

export const configDir = (): string => process.env["ANTHROPIC_CONFIG_DIR"] ?? join(homedir(), ".config", "anthropic");

export const hasCredentials = (profileDir: string = configDir()): boolean =>
  ENV_KEYS.some((name) => (process.env[name] ?? "").length > 0) || existsSync(profileDir);

export const isAuthFailure = (error: unknown): boolean =>
  error instanceof Anthropic.AuthenticationError || (error instanceof Anthropic.APIError && error.status === 401);

export const judge =
  (client?: AnthropicClient): Judge =>
  async (prompt: Prompt): Promise<string> => {
    const anthropic: AnthropicClient = client ?? new Anthropic();
    const response = await anthropic.messages.create({
      model: prompt.model,
      max_tokens: 1024,
      system: prompt.system,
      output_config: { format: { type: "json_schema", schema: prompt.schema } },
      messages: [{ role: "user", content: prompt.user }],
    });
    const body = response.content.map((block) => (isTextBlock(block) ? block.text : undefined)).find((text) => text !== undefined);
    if (body === undefined) throw new Error("判定が返りませんでした");
    return body;
  };

/** 認証が無いときに人へ見せる案内。 */
export const SETUP_HINT = "ANTHROPIC_API_KEY を設定するか、ant auth login を実行してください。";
