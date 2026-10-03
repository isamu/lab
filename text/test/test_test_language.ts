import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAIModule from "openai";
import { runTest, type TestContext } from "../packages/chaff/src/commands/test.ts";
import { EMPTY, type Config } from "../packages/chaff/src/config/load.ts";
import { guessLanguage } from "../packages/chaff/src/detect.ts";
import { credentialHint } from "../packages/chaff/src/judge.ts";
import { toFailure } from "../packages/chaff/src/backends/types.ts";
import type { AnthropicClient } from "../packages/chaff/src/backends/anthropic.ts";
import type { OpenAIClient } from "../packages/chaff/src/backends/openai.ts";
import type { UiLanguage } from "../packages/chaff/src/ui.ts";

const JAPANESE = /[぀-ゟ゠-ヿ一-鿿]/u;
const EN = "# Notes\n\nThis is a short note. The note says one thing.\n";
const JA = "# メモ\n\nこれは短いメモです。メモには一つのことを書きます。\n";
const CHECKS_EN =
  'checks:\n  - name: Notes are useful\n    check: The sentence says something useful.\n    look_at: sentences with "note" or "thing"\n    how_to_fix: Say what the reader should do.\n';
const CHECKS_JA =
  "checks:\n  - name: メモが役に立つ\n    check: 役に立つことを書いている。\n    look_at: 「メモ」「こと」を含む文\n    how_to_fix: 読む人がすることを書く。\n";

type Verdict = { violated: boolean; confidence: number; reason: string };

/** 判定役の差し替え。ネットワークにも API key にも触れない。 */
const anthropicReturning = (verdict: Verdict): AnthropicClient => ({
  messages: { create: () => Promise.resolve({ content: [{ type: "text", text: JSON.stringify(verdict) }] }) },
});
const anthropicThrowing = (error: Error): AnthropicClient => ({ messages: { create: () => Promise.reject(error) } });
const openaiThrowing = (error: Error): OpenAIClient => ({ chat: { completions: { create: () => Promise.reject(error) } } });

const KEY_NAMES = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"];

type Run = { code: number; out: string };

/** 一時ディレクトリで runTest を走らせる。鍵は偽物で、判定役は差し替えてあるので外へは出ない。 */
const run = async (files: Readonly<Record<string, string>>, argv: readonly string[], context: Partial<TestContext>): Promise<Run> => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-test-ui-"));
  Object.entries(files).forEach(([name, body]) => writeFileSync(join(dir, name), body));
  const out: string[] = [];
  const saved = { log: console.log, cwd: process.cwd(), keys: KEY_NAMES.map((name) => [name, process.env[name]] as const) };
  console.log = (...parts: unknown[]) => {
    out.push(parts.join(" "));
  };
  KEY_NAMES.forEach((name) => {
    process.env[name] = "sk-fake-for-tests";
  });
  process.chdir(dir);
  const config: Config = context.config ?? EMPTY;
  try {
    const code = await runTest(
      Object.keys(files).filter((name) => name.endsWith(".md")),
      argv,
      {
        config,
        resolveGenre: () => ({ genre: "blog/tech", from: "default" }),
        inspect: (path) => {
          const language = config.language ?? guessLanguage(readFileSync(path, "utf8")).language;
          return Promise.resolve({ text: `\n${path}\n`, language, outcome: { findings: [] } });
        },
        ui: "en",
        ...context,
      },
    );
    return { code, out: out.join("\n") };
  } finally {
    process.chdir(saved.cwd);
    console.log = saved.log;
    saved.keys.forEach(([name, value]) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  }
};

const FOUND: Verdict = { violated: true, confidence: 0.8, reason: "REASON-FROM-THE-JUDGE" };

describe("chaff test の AI の判定の言語", () => {
  it("英語の文書は、AI の見出し・指摘・締めまで英語（端末が日本語でも）", async () => {
    const result = await run({ "a.md": EN, "checks.yaml": CHECKS_EN }, [], { ui: "ja", clients: { anthropicClient: anthropicReturning(FOUND) } });
    assert.match(result.out, /═══ Judged by AI ═+\n {4}These read the meaning of the text\. The result can change/u);
    assert.match(result.out, / {4}Read \d+ passages? out of \d+ sentences \(the machine ruled out the rest\)/u);
    assert.match(result.out, / {4}Notes are useful: read only the \d+ sentences? containing "note", "thing" \(of \d+\)/u);
    assert.match(result.out, /─── line \d+ ─+/u);
    assert.match(result.out, / {12}confidence 0\.80/u);
    assert.match(result.out, / {5}If you think this finding is wrong:/u);
    assert.match(result.out, /<!-- stet: check:notes-are-useful — reason -->/u);
    assert.match(result.out, /\n {2}0 by machine \/ \d+ by AI\n/u);
    assert.match(result.out, /The text was not changed\. Fixing it is the writer's job\./u);
    assert.doesNotMatch(result.out, JAPANESE);
  });

  it("日本語の文書は、以前と同じ日本語（端末が英語でも）", async () => {
    const result = await run({ "a.md": JA, "checks.yaml": CHECKS_JA }, [], { ui: "en", clients: { anthropicClient: anthropicReturning(FOUND) } });
    assert.match(
      result.out,
      /═══ AI による判定 ═{43}\n {4}文章の意味を読んでいます。実行するたび結果が変わることが\n {4}あります。おかしいと思ったら、そのまま無視して構いません。/u,
    );
    assert.match(result.out, / {4}\d+ 文のうち \d+ 箇所を読みました（残りは機械が対象外と判断）/u);
    assert.match(result.out, / {4}メモが役に立つ: 「メモ」 「こと」 を含む \d+ 文だけを読みました（全 \d+ 文）/u);
    assert.match(result.out, /─── \d+ 行目 ─+/u);
    assert.match(result.out, / {12}確からしさ 0\.80/u);
    assert.match(
      result.out,
      / {5}この指摘が違うと思ったら:\n {7}この箇所だけ黙らせる {4}<!-- stet: check:1 — 理由 -->\n {7}ルールごとゆるめる {6}npx chaffjs relax check:1/u,
    );
    assert.match(result.out, /\n {2}機械 0 件 \/ AI \d+ 件\n {2}文章は書き換えていません。直すのは書いた人です。\n$/u);
  });

  it("絞り込めなかった検査の断りも文書の言語", async () => {
    const english = await run({ "a.md": EN, "checks.yaml": "checks:\n  - name: Whole\n    check: Anything.\n" }, [], {
      clients: { anthropicClient: anthropicReturning({ ...FOUND, violated: false }) },
    });
    assert.match(
      english.out,
      / {4}Whole: could not narrow what to read, so read the whole text\n {6}Put words in quotes in look_at \("like this"\) to read only the sentences that contain them/u,
    );
    const japanese = await run({ "a.md": JA, "checks.yaml": "checks:\n  - name: 全体\n    check: 何でも。\n" }, [], {
      clients: { anthropicClient: anthropicReturning({ ...FOUND, violated: false }) },
    });
    assert.match(japanese.out, / {4}全体: 見るところを絞れず、全文を読みました\n {6}look_at に「」で語を書くと、その語を含む文だけになります/u);
  });

  const failures: readonly (readonly [string, Error, UiLanguage, RegExp])[] = [
    [
      "鍵を受け付けなかった（英語）",
      new Anthropic.AuthenticationError(401, undefined, "unauthorized", new Headers()),
      "en",
      /anthropic did not accept the key \(401\)\.\n {2}Check that the key is right and that it is for that provider\./u,
    ],
    [
      "鍵を受け付けなかった（日本語）",
      new Anthropic.AuthenticationError(401, undefined, "unauthorized", new Headers()),
      "ja",
      /anthropic が鍵を受け付けませんでした（401）。\n {2}鍵が正しいか、その provider のものかを確かめてください。/u,
    ],
    [
      "残高切れ（英語）",
      new Anthropic.RateLimitError(429, undefined, "slow down", new Headers()),
      "en",
      /anthropic has run out of balance or hit a limit \(429\)\./u,
    ],
    ["残高切れ（日本語）", new Anthropic.RateLimitError(429, undefined, "slow down", new Headers()), "ja", /anthropic の残高か上限に達しました（429）。/u],
    ["ほかの失敗（英語）", new Anthropic.InternalServerError(500, undefined, "boom", new Headers()), "en", /anthropic returned 500\./u],
    ["ほかの失敗（日本語）", new Anthropic.InternalServerError(500, undefined, "boom", new Headers()), "ja", /anthropic が 500 を返しました。/u],
  ];
  failures.forEach(([label, error, language, expected]) => {
    it(`API の失敗の断りは文書の言語: ${label}`, async () => {
      const files = language === "en" ? { "a.md": EN, "checks.yaml": CHECKS_EN } : { "a.md": JA, "checks.yaml": CHECKS_JA };
      const result = await run(files, [], { ui: language === "en" ? "ja" : "en", clients: { anthropicClient: anthropicThrowing(error) } });
      assert.match(result.out, expected);
      assert.match(result.out, language === "en" ? /Every machine check ran\./u : /機械による判定はすべて動いています。/u);
      if (language === "en") assert.doesNotMatch(result.out, JAPANESE);
    });
  });

  it("openai の失敗も同じ", async () => {
    const error = new OpenAIModule.AuthenticationError(401, undefined, "unauthorized", new Headers());
    const result = await run({ "a.md": EN, "checks.yaml": CHECKS_EN }, [], {
      config: { ...EMPTY, aiBackend: "openai" },
      clients: { openaiClient: openaiThrowing(error) },
    });
    assert.match(result.out, /openai did not accept the key \(401\)\./u);
    assert.doesNotMatch(result.out, JAPANESE);
  });
});

describe("原因の無い失敗と鍵の案内", () => {
  it("原因が返らなかった失敗は、言葉を足さずに渡す（言語は描く側が決める）", () => {
    assert.equal(toFailure({ status: 500, message: "" }).message, undefined);
    assert.equal(toFailure({ status: 500, message: 42 }).message, undefined);
    assert.equal(toFailure({ status: 500, message: "boom" }).message, "boom");
  });

  it("原因が返らなかった失敗の断り", async () => {
    const error = new Anthropic.InternalServerError(500, undefined, "boom", new Headers());
    Object.defineProperty(error, "message", { value: "" });
    const english = await run({ "a.md": EN, "checks.yaml": CHECKS_EN }, [], { clients: { anthropicClient: anthropicThrowing(error) } });
    assert.match(english.out, /anthropic returned 500\.\n {2}No reason was given\./u);
    const japanese = await run({ "a.md": JA, "checks.yaml": CHECKS_JA }, [], { clients: { anthropicClient: anthropicThrowing(error) } });
    assert.match(japanese.out, /anthropic が 500 を返しました。\n {2}原因は返ってきませんでした/u);
  });

  it("鍵の案内は backend と言語ごと。日本語は以前の文言のまま", () => {
    assert.equal(credentialHint("anthropic", "ja"), "ANTHROPIC_API_KEY を設定するか、ant auth login を実行してください。");
    assert.equal(credentialHint("openai", "ja"), "OPENAI_API_KEY を設定してください。");
    assert.equal(credentialHint("anthropic", "en"), "Set ANTHROPIC_API_KEY, or run ant auth login.");
    assert.equal(credentialHint("openai", "en"), "Set OPENAI_API_KEY.");
  });
});
