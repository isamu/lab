import OpenAI from "openai";
import type { Judge, Prompt } from "./types.ts";

export type OpenAIResponse = { readonly choices: readonly { readonly message: { readonly content: string | null } }[] };

/** judge が使うのは chat.completions.create だけ。最小の面だけを要求する。 */
export type OpenAIClient = {
  readonly chat: { readonly completions: { readonly create: (params: OpenAI.ChatCompletionCreateParamsNonStreaming) => Promise<OpenAIResponse> } };
};

export const DEFAULT_MODEL = "gpt-5";

export const hasCredentials = (): boolean => (process.env["OPENAI_API_KEY"] ?? "").length > 0;

export const isAuthFailure = (error: unknown): boolean => error instanceof OpenAI.APIError && error.status === 401;

/**
 * 同じ JSON schema をそのまま使う。包みかたが違うだけで、返させる形は provider で変えない。
 * 変えると、provider を替えたときに判定の意味まで変わる。
 */
export const judge =
  (client?: OpenAIClient): Judge =>
  async (prompt: Prompt): Promise<string> => {
    const openai: OpenAIClient = client ?? new OpenAI();
    const response = await openai.chat.completions.create({
      model: prompt.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "verdict", schema: prompt.schema, strict: true } },
    });
    const body = response.choices[0]?.message.content;
    if (body === null || body === undefined) throw new Error("判定が返りませんでした");
    return body;
  };

export const SETUP_HINT = "OPENAI_API_KEY を設定してください。";
