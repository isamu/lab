import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { ask, hasCredentials, isAuthFailure, type Ask, type JudgeClient } from "../packages/chaff/src/judge.ts";

type Call = Anthropic.MessageCreateParamsNonStreaming;

/** judge は messages.create だけを要求する。ネットワークに出ずに、送る形と扱いを検証する。 */
const stub = (body: unknown): { client: JudgeClient; calls: Call[] } => {
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
    await ask(request, { model: "claude-opus-5", cacheDir: cacheDir(), client });
    const sent = calls[0];
    assert.equal(sent?.model, "claude-opus-5");
    // 自由文を後から解釈しない。形を固定して返させる。
    assert.equal(formatType(sent), "json_schema");
  });

  it("絞り込んだ候補だけを渡し、文書全体を渡さない", async () => {
    const { client, calls } = stub({ violated: false, confidence: 0.9, reason: "問題ありません" });
    await ask(request, { model: "claude-opus-5", cacheDir: cacheDir(), client });
    const body = JSON.stringify(calls[0]?.messages);
    assert.match(body, /施策の話です。/u);
    assert.match(body, /リスクが書かれていること。/u);
  });

  it("同じ問いは 2 度目に問い合わせない", async () => {
    // キャッシュが効かないと、CI のたびに全文書分だけ課金される。
    const dir = cacheDir();
    const { client, calls } = stub({ violated: true, confidence: 0.8, reason: "リスクがありません" });
    await ask(request, { model: "claude-opus-5", cacheDir: dir, client });
    const second = await ask(request, { model: "claude-opus-5", cacheDir: dir, client });
    assert.equal(calls.length, 1);
    assert.equal(second.reason, "リスクがありません");
  });

  it("モデルが違えばキャッシュは当たらない", async () => {
    const dir = cacheDir();
    const { client, calls } = stub({ violated: true, confidence: 0.8, reason: "x" });
    await ask(request, { model: "claude-opus-5", cacheDir: dir, client });
    await ask(request, { model: "claude-sonnet-5", cacheDir: dir, client });
    assert.equal(calls.length, 2);
  });

  it("確からしさを 0..1 に収める", async () => {
    const { client } = stub({ violated: true, confidence: 3.5, reason: "x" });
    assert.equal((await ask(request, { model: "claude-opus-5", cacheDir: cacheDir(), client })).confidence, 1);
  });

  it("形が違う返答は受け取らない", async () => {
    const { client } = stub({ violated: "はい", reason: "x" });
    await assert.rejects(() => ask(request, { model: "claude-opus-5", cacheDir: cacheDir(), client }), /判定の形が違います/u);
  });
});

describe("認証情報があるかの判定", () => {
  const noProfile = join(mkdtempSync(join(tmpdir(), "chaff-")), "nowhere");

  it("env が無く、プロファイルも無ければ false", () => {
    // ここが false を返せないと、呼んでから型の無い例外で落ちてスタックが出る。
    const saved = ENV_NAMES.map((name) => [name, process.env[name]] as const);
    ENV_NAMES.forEach((name) => delete process.env[name]);
    try {
      assert.equal(hasCredentials(noProfile), false);
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
      assert.equal(hasCredentials(noProfile), true);
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
      assert.equal(hasCredentials(mkdtempSync(join(tmpdir(), "chaff-profile-"))), true);
    } finally {
      saved.forEach(([name, value]) => {
        if (value !== undefined) process.env[name] = value;
      });
    }
  });
});

describe("認証の失敗判定", () => {
  it("401 を認証の失敗とみなす", () => {
    assert.equal(isAuthFailure(new Anthropic.AuthenticationError(401, undefined, "unauthorized", new Headers())), true);
  });

  it("ほかの失敗は認証の失敗としない", () => {
    // ここを広く取ると、ネットワーク断や 500 まで「key がありません」と誤報する。
    assert.equal(isAuthFailure(new Error("boom")), false);
    assert.equal(isAuthFailure(new Anthropic.RateLimitError(429, undefined, "slow down", new Headers())), false);
  });
});
