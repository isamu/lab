import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { ask, credentialHint, describeFailure, hasCredentials, isAuthFailure, type Ask } from "../packages/chaff/src/judge.ts";
import type { AnthropicClient } from "../packages/chaff/src/backends/anthropic.ts";
import type { OpenAIClient } from "../packages/chaff/src/backends/openai.ts";
import type OpenAI from "openai";
import OpenAIModule from "openai";
import { hasCredentials as hasAnthropicCredentials } from "../packages/chaff/src/backends/anthropic.ts";

type Call = Anthropic.MessageCreateParamsNonStreaming;
type OpenAICall = OpenAI.ChatCompletionCreateParamsNonStreaming;

/** judge は messages.create だけを要求する。ネットワークに出ずに、送る形と扱いを検証する。 */
const stub = (body: unknown): { client: AnthropicClient; calls: Call[] } => {
  const calls: Call[] = [];
  return {
    client: {
      messages: {
        create: (params: Call) => {
          calls.push(params);
          return Promise.resolve({ content: [{ type: "text", text: JSON.stringify(body) }] });
        },
      },
    },
    calls,
  };
};

const formatType = (call: Call | undefined): unknown => {
  const config: unknown = call?.output_config;
  if (typeof config !== "object" || config === null || !("format" in config)) return undefined;
  const format: unknown = config.format;
  return typeof format === "object" && format !== null && "type" in format ? format.type : undefined;
};

const request: Ask = { rule: "risk-disclosure", rubric: "リスクが書かれていること。", candidate: "施策の話です。", language: "ja" };
const cacheDir = (): string => join(mkdtempSync(join(tmpdir(), "chaff-")), "cache");

const ENV_NAMES = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_IDENTITY_TOKEN", "ANTHROPIC_IDENTITY_TOKEN_FILE"];

describe("judge の呼び出し", () => {
  it("構造化出力の形を指定して送る", async () => {
    const { client, calls } = stub({ violated: true, confidence: 0.8, reason: "リスクがありません" });
    await ask(request, { model: "claude-opus-5", cacheDir: cacheDir(), backend: "anthropic", anthropicClient: client });
    const sent = calls[0];
    assert.equal(sent?.model, "claude-opus-5");
    // 自由文を後から解釈しない。形を固定して返させる。
    assert.equal(formatType(sent), "json_schema");
  });

  it("絞り込んだ候補だけを渡し、文書全体を渡さない", async () => {
    const { client, calls } = stub({ violated: false, confidence: 0.9, reason: "問題ありません" });
    await ask(request, { model: "claude-opus-5", cacheDir: cacheDir(), backend: "anthropic", anthropicClient: client });
    const body = JSON.stringify(calls[0]?.messages);
    assert.match(body, /施策の話です。/u);
    assert.match(body, /リスクが書かれていること。/u);
  });

  it("同じ問いは 2 度目に問い合わせない", async () => {
    // キャッシュが効かないと、CI のたびに全文書分だけ課金される。
    const dir = cacheDir();
    const { client, calls } = stub({ violated: true, confidence: 0.8, reason: "リスクがありません" });
    await ask(request, { model: "claude-opus-5", cacheDir: dir, backend: "anthropic", anthropicClient: client });
    const second = await ask(request, { model: "claude-opus-5", cacheDir: dir, backend: "anthropic", anthropicClient: client });
    assert.equal(calls.length, 1);
    assert.equal(second.reason, "リスクがありません");
  });

  it("モデルが違えばキャッシュは当たらない", async () => {
    const dir = cacheDir();
    const { client, calls } = stub({ violated: true, confidence: 0.8, reason: "x" });
    await ask(request, { model: "claude-opus-5", cacheDir: dir, backend: "anthropic", anthropicClient: client });
    await ask(request, { model: "claude-sonnet-5", cacheDir: dir, backend: "anthropic", anthropicClient: client });
    assert.equal(calls.length, 2);
  });

  it("確からしさを 0..1 に収める", async () => {
    const { client } = stub({ violated: true, confidence: 3.5, reason: "x" });
    assert.equal((await ask(request, { model: "claude-opus-5", cacheDir: cacheDir(), backend: "anthropic", anthropicClient: client })).confidence, 1);
  });

  it("形が違う返答は受け取らない", async () => {
    const { client } = stub({ violated: "はい", reason: "x" });
    await assert.rejects(
      () => ask(request, { model: "claude-opus-5", cacheDir: cacheDir(), backend: "anthropic", anthropicClient: client }),
      /判定の形が違います/u,
    );
  });
});

describe("認証情報があるかの判定", () => {
  const noProfile = join(mkdtempSync(join(tmpdir(), "chaff-")), "nowhere");

  it("env が無く、プロファイルも無ければ false", () => {
    // ここが false を返せないと、呼んでから型の無い例外で落ちてスタックが出る。
    const saved = ENV_NAMES.map((name) => [name, process.env[name]] as const);
    ENV_NAMES.forEach((name) => delete process.env[name]);
    try {
      assert.equal(hasAnthropicCredentials(noProfile), false);
    } finally {
      saved.forEach(([name, value]) => {
        if (value !== undefined) process.env[name] = value;
      });
    }
  });

  it("API key があれば true", () => {
    const saved = process.env["ANTHROPIC_API_KEY"];
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-test";
    try {
      assert.equal(hasAnthropicCredentials(noProfile), true);
    } finally {
      if (saved === undefined) delete process.env["ANTHROPIC_API_KEY"];
      else process.env["ANTHROPIC_API_KEY"] = saved;
    }
  });

  it("プロファイルのディレクトリがあれば true", () => {
    // env が無くても ant auth login のプロファイルで通る。env だけ見ると誤報する。
    const saved = ENV_NAMES.map((name) => [name, process.env[name]] as const);
    ENV_NAMES.forEach((name) => delete process.env[name]);
    try {
      assert.equal(hasAnthropicCredentials(mkdtempSync(join(tmpdir(), "chaff-profile-"))), true);
    } finally {
      saved.forEach(([name, value]) => {
        if (value !== undefined) process.env[name] = value;
      });
    }
  });
});

describe("認証の失敗判定", () => {
  it("401 を認証の失敗とみなす", () => {
    assert.equal(isAuthFailure("anthropic", new Anthropic.AuthenticationError(401, undefined, "unauthorized", new Headers())), true);
  });

  it("ほかの失敗は認証の失敗としない", () => {
    // ここを広く取ると、ネットワーク断や 500 まで「key がありません」と誤報する。
    assert.equal(isAuthFailure("anthropic", new Error("boom")), false);
    assert.equal(isAuthFailure("anthropic", new Anthropic.RateLimitError(429, undefined, "slow down", new Headers())), false);
  });
});

describe("判定役の差し替え", () => {
  /** OpenAI は chat.completions.create だけを要求する。返す形は provider で変えない。 */
  const openaiStub = (body: unknown): { client: OpenAIClient; calls: OpenAICall[] } => {
    const calls: OpenAICall[] = [];
    return {
      client: {
        chat: {
          completions: {
            create: (params: OpenAICall) => {
              calls.push(params);
              return Promise.resolve({ choices: [{ message: { content: JSON.stringify(body) } }] });
            },
          },
        },
      },
      calls,
    };
  };

  it("openai でも同じ Verdict が返る", async () => {
    const { client, calls } = openaiStub({ violated: true, confidence: 0.8, reason: "リスクがありません" });
    const verdict = await ask(request, { model: "gpt-5", cacheDir: cacheDir(), backend: "openai", openaiClient: client });
    assert.equal(verdict.violated, true);
    assert.equal(verdict.reason, "リスクがありません");
    assert.equal(calls[0]?.model, "gpt-5");
  });

  it("openai にも同じ JSON schema を渡す", async () => {
    // 返させる形が provider で変わると、判定の意味まで変わる。
    const { client, calls } = openaiStub({ violated: false, confidence: 0.9, reason: "x" });
    await ask(request, { model: "gpt-5", cacheDir: cacheDir(), backend: "openai", openaiClient: client });
    const format = calls[0]?.response_format;
    assert.equal(format?.type, "json_schema");
    assert.deepEqual(format?.type === "json_schema" ? Object.keys(format.json_schema.schema?.["properties"] ?? {}) : [], ["violated", "confidence", "reason"]);
  });

  it("確からしさの丸めも provider によらない", async () => {
    const { client } = openaiStub({ violated: true, confidence: 3.5, reason: "x" });
    assert.equal((await ask(request, { model: "gpt-5", cacheDir: cacheDir(), backend: "openai", openaiClient: client })).confidence, 1);
  });

  it("認証の案内は backend ごとに違う", () => {
    assert.match(credentialHint("anthropic"), /ANTHROPIC_API_KEY/u);
    assert.match(credentialHint("openai"), /OPENAI_API_KEY/u);
  });

  it("OPENAI_API_KEY だけで openai の認証は通り、anthropic は通らない", () => {
    const saved = [...ENV_NAMES, "OPENAI_API_KEY"].map((name) => [name, process.env[name]] as const);
    ENV_NAMES.forEach((name) => delete process.env[name]);
    process.env["OPENAI_API_KEY"] = "sk-test";
    process.env["ANTHROPIC_CONFIG_DIR"] = join(tmpdir(), "chaff-nowhere");
    try {
      assert.equal(hasCredentials("openai"), true);
      assert.equal(hasCredentials("anthropic"), false);
    } finally {
      delete process.env["ANTHROPIC_CONFIG_DIR"];
      saved.forEach(([name, value]) => {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      });
    }
  });
});

describe("API が返した失敗の分類", () => {
  /** 実際に走らせて見つけた。429 は認証の失敗ではないので、素通りしてスタックトレースになっていた。 */
  it("401 は auth、429 は quota、その他は api", () => {
    const headers = new Headers();
    assert.equal(describeFailure("anthropic", new Anthropic.AuthenticationError(401, undefined, "unauthorized", headers))?.kind, "auth");
    assert.equal(describeFailure("anthropic", new Anthropic.RateLimitError(429, undefined, "slow down", headers))?.kind, "quota");
    assert.equal(describeFailure("anthropic", new Anthropic.InternalServerError(500, undefined, "boom", headers))?.kind, "api");
  });

  it("openai でも同じ分類になる", () => {
    const headers = new Headers();
    assert.equal(describeFailure("openai", new OpenAIModule.AuthenticationError(401, undefined, "unauthorized", headers))?.kind, "auth");
    assert.equal(describeFailure("openai", new OpenAIModule.RateLimitError(429, undefined, "no credits", headers))?.kind, "quota");
  });

  it("API の失敗でないものは拾わない。握りつぶすと原因が消える", () => {
    // ネットワーク断やコードの誤りまで「鍵を確かめてください」と言わせない。
    assert.equal(describeFailure("openai", new Error("ECONNREFUSED")), undefined);
    assert.equal(describeFailure("anthropic", new TypeError("x is not a function")), undefined);
  });

  it("provider 自身の文言を残す。残高切れは鍵の問題ではない", () => {
    const failure = describeFailure("openai", new OpenAIModule.RateLimitError(429, undefined, "You have no credits remaining.", new Headers()));
    assert.match(failure?.message ?? "", /no credits/u);
  });
});
