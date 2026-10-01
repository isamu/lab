import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hostLanguage, sharedLanguage, uiLanguageOf } from "../packages/chaff/src/ui.ts";
import { runCli, type CliRun } from "./cli-run.ts";

describe("どの言語で話すか", () => {
  it("日本語だけが日本語、ほかはすべて英語", () => {
    assert.equal(uiLanguageOf("ja"), "ja");
    ["en", "zh", "ko", undefined, ""].forEach((language) => assert.equal(uiLanguageOf(language), "en", String(language)));
  });

  const cases: readonly (readonly [string, string | undefined, Record<string, string | undefined>, "ja" | "en"])[] = [
    ["chaff.yaml の language が最優先", "en", { LANG: "ja_JP.UTF-8" }, "en"],
    ["chaff.yaml が日本語なら日本語", "ja", { LANG: "C" }, "ja"],
    ["無ければ端末のロケール", undefined, { LANG: "ja_JP.UTF-8" }, "ja"],
    ["LC_ALL が LANG より先", undefined, { LC_ALL: "en_US.UTF-8", LANG: "ja_JP.UTF-8" }, "en"],
    ["LC_MESSAGES が LANG より先", undefined, { LC_MESSAGES: "ja_JP", LANG: "en_US" }, "ja"],
    ["空の変数は飛ばす", undefined, { LC_ALL: "", LANG: "ja_JP.UTF-8" }, "ja"],
    ["大文字でも", undefined, { LANG: "JA_JP" }, "ja"],
    ["ロケールが無ければ英語", undefined, {}, "en"],
    ["C ロケールは英語", undefined, { LANG: "C.UTF-8" }, "en"],
  ];
  cases.forEach(([label, configLanguage, env, expected]) => {
    it(label, () => assert.equal(hostLanguage(configLanguage, env), expected));
  });

  it("締めの言語: 文書がそろっていればその言語、混ざっているか無ければ host", () => {
    assert.equal(sharedLanguage(["en", "en"], "ja"), "en");
    assert.equal(sharedLanguage(["ja"], "en"), "ja");
    assert.equal(sharedLanguage(["en", "zh"], "ja"), "en");
    assert.equal(sharedLanguage(["ja", "en"], "ja"), "ja");
    assert.equal(sharedLanguage(["ja", "en"], "en"), "en");
    assert.equal(sharedLanguage([], "ja"), "ja");
  });
});

describe("画面の言語", () => {
  const JA = `# 手順\n\n${"設定の手順は画面の右上にあるボタンを押してから開く一覧の中で目的の項目を選び、".repeat(5)}保存します。\n`;
  const EN = "# Notes\n\nThis is a short note. It says one thing.\n";

  /** runCli sets LANG and clears LC_ALL; LC_MESSAGES also outranks LANG, so it is cleared here too. */
  const runIn = async (files: Readonly<Record<string, string>>, args: readonly string[], lang: string): Promise<CliRun> => {
    const messages = process.env["LC_MESSAGES"];
    delete process.env["LC_MESSAGES"];
    try {
      return await runCli(files, args, lang);
    } finally {
      if (messages !== undefined) process.env["LC_MESSAGES"] = messages;
    }
  };

  it("英語の文書は英語の枠で出す（端末が日本語でも）", async () => {
    const result = await runIn({ "a.md": EN }, ["a.md"], "ja_JP.UTF-8");
    assert.match(result.out, /English {3}genre from the default/u);
    assert.match(result.out, /All judged by machine/u);
    assert.doesNotMatch(result.out, /行目|すべて機械/u);
  });

  it("日本語の文書は日本語の枠で出す（端末が英語でも）", async () => {
    const result = await runIn({ "a.md": JA }, ["a.md"], "en_US.UTF-8");
    assert.match(result.out, /日本語 {3}ジャンルは既定から/u);
    assert.match(result.out, /行目/u);
    assert.match(result.out, /このルールをゆるめる/u);
  });

  it("まとめの行は、ファイルが同じ言語ならその言語、混ざっていれば端末の言語", async () => {
    const english = await runIn({ "a.md": EN, "b.md": EN }, ["."], "ja_JP.UTF-8");
    assert.match(english.out, /2 files checked/u);
    const mixed = await runIn({ "a.md": EN, "b.md": JA }, ["."], "ja_JP.UTF-8");
    assert.match(mixed.out, /2 ファイルを見て/u);
  });

  it("--help は端末の言語", async () => {
    assert.match((await runIn({}, ["--help"], "en_US.UTF-8")).out, /finds what makes writing hard to read/u);
    assert.match((await runIn({}, ["--help"], "ja_JP.UTF-8")).out, /文章の読みにくいところを見つけます/u);
  });

  it("explain は英語なら語で数え、英語の上限を出す", async () => {
    const result = await runIn({}, ["explain", "max-sentence-length"], "en_US.UTF-8");
    assert.match(result.out, /→ normal {3}up to 25 words in a sentence/u);
  });

  it("relax の返事と、新しく作る chaff.yaml も端末の言語", async () => {
    const dir = await runIn({}, ["relax", "max-sentence-length", "--why", "long quotes"], "en_US.UTF-8");
    assert.match(dir.out, /^Set max-sentence-length to relaxed/u);
  });

  it("init は端末の言語で chaff.yaml を書く", async () => {
    const result = await runIn({}, ["init"], "en_US.UTF-8");
    assert.match(result.out, /Created:/u);
    const path =
      result.out
        .split("\n")
        .map((line) => line.trim().split("  ")[0] ?? "")
        .find((word) => word.endsWith("chaff.yaml")) ?? "";
    assert.match(readFileSync(path, "utf8"), /this team's writing rules/u);
  });

  it("baseline で Markdown が無いときの断りは、日本語では以前の文言のまま", async () => {
    assert.match((await runIn({}, ["baseline"], "ja_JP.UTF-8")).err, /^Markdown が 1 つも見つかりませんでした。$/u);
    assert.match((await runIn({}, ["baseline"], "en_US.UTF-8")).err, /^No Markdown files found\.$/u);
  });

  describe("eval", () => {
    const JAPANESE = /[぀-ゟ゠-ヿ一-鿿]/u;

    it("英語の文書の測定結果は英語（端末が日本語でも）", async () => {
      const result = await runIn({ "a.md": EN, "b.md": EN }, ["eval", "."], "ja_JP.UTF-8");
      assert.equal(result.code, 0);
      assert.match(result.out, /Measured \d+ rules? on 2 files as a corpus/u);
      assert.doesNotMatch(result.out, JAPANESE);
    });

    it("測定結果は by_path で決めた文書の言語（chaff.yaml の language と端末が日本語でも）", async () => {
      const config = 'language: ja\nby_path:\n  - files: ["*.md"]\n    language: en\n';
      const result = await runIn({ "chaff.yaml": config, "a.md": EN }, ["eval", "."], "ja_JP.UTF-8");
      assert.equal(result.code, 0);
      assert.match(result.out, /Measured \d+ rules? on 1 file as a corpus/u);
      assert.doesNotMatch(result.out, JAPANESE);
    });

    it("日本語の文書の測定結果は日本語（端末が英語でも）", async () => {
      const result = await runIn({ "a.md": JA }, ["eval", "."], "en_US.UTF-8");
      assert.equal(result.code, 0);
      assert.match(result.out, /1 ファイルを corpus として \d+ 本の rule を測りました。/u);
      assert.match(result.out, /閾値は自動で書き換えていません。/u);
    });

    it("Markdown が無いときの断りは端末の言語、日本語は以前の文言のまま", async () => {
      assert.match((await runIn({}, ["eval", "nothing"], "en_US.UTF-8")).err, /^No Markdown files found: nothing$/u);
      assert.match((await runIn({}, ["eval", "nothing"], "ja_JP.UTF-8")).err, /^Markdown が 1 つも見つかりませんでした: nothing$/u);
    });

    it("言語が混ざっているときの断りは端末の言語", async () => {
      const english = await runIn({ "a.md": EN, "b.md": JA }, ["eval", "."], "en_US.UTF-8");
      assert.equal(english.code, 1);
      assert.match(english.err, /^Languages or genres are mixed: /u);
      assert.doesNotMatch(english.err, JAPANESE);
      const japanese = await runIn({ "a.md": EN, "b.md": JA }, ["eval", "."], "ja_JP.UTF-8");
      assert.match(japanese.err, /^言語かジャンルが混ざっています: .+\n1 つに絞って測ってください（例: npx chaff eval examples\/blog-ja\/）。$/u);
    });

    it("無い rule の断りは端末の言語", async () => {
      assert.match((await runIn({ "a.md": EN }, ["eval", ".", "--rule", "nope"], "en_US.UTF-8")).err, /^There is no rule named nope\.$/u);
      assert.match((await runIn({ "a.md": EN }, ["eval", ".", "--rule", "nope"], "ja_JP.UTF-8")).err, /^nope という rule はありません。$/u);
    });

    it("断りは chaff.yaml の language が端末より先", async () => {
      const result = await runIn({ "chaff.yaml": "language: en\n" }, ["eval", "nothing"], "ja_JP.UTF-8");
      assert.match(result.err, /^No Markdown files found: nothing$/u);
    });
  });

  describe("test", () => {
    const JAPANESE = /[぀-ゟ゠-ヿ一-鿿]/u;
    const CREDENTIALS = [
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_AUTH_TOKEN",
      "ANTHROPIC_IDENTITY_TOKEN",
      "ANTHROPIC_IDENTITY_TOKEN_FILE",
      "OPENAI_API_KEY",
      "ANTHROPIC_CONFIG_DIR",
    ];

    /** 鍵が無い状態で走らせる。ネットワークに出る経路へは入らない。 */
    const withoutKeys = async <T>(run: () => Promise<T>): Promise<T> => {
      const saved = CREDENTIALS.map((name) => [name, process.env[name]] as const);
      CREDENTIALS.forEach((name) => delete process.env[name]);
      // A child of a fresh directory: it cannot exist, so no profile counts as credentials.
      process.env["ANTHROPIC_CONFIG_DIR"] = join(mkdtempSync(join(tmpdir(), "chaff-no-profile-")), "absent");
      try {
        return await run();
      } finally {
        saved.forEach(([name, value]) => {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        });
      }
    };

    it("英語の文書なら、鍵が無いときの断りまで英語（端末が日本語でも）", async () => {
      const result = await withoutKeys(() => runIn({ "a.md": EN }, ["test", "a.md"], "ja_JP.UTF-8"));
      assert.match(result.out, /═══ Judged by machine ═+\n {4}The same text gives the same result every time/u);
      assert.match(result.out, / {2}The checks that read meaning did not run\. There are no credentials for anthropic\./u);
      assert.match(result.out, / {2}Set ANTHROPIC_API_KEY, or run ant auth login\./u);
      assert.match(result.out, / {2}A key written in \.env is read too \(there is no \.env now\)\./u);
      assert.match(result.out, / {2}Every machine check ran\./u);
      assert.doesNotMatch(result.out, JAPANESE);
    });

    it("日本語の文書なら、鍵が無いときの断りは以前の文言のまま（端末が英語でも）", async () => {
      const result = await withoutKeys(() => runIn({ "a.md": JA }, ["test", "a.md"], "en_US.UTF-8"));
      assert.match(result.out, /═══ 機械による判定 ═{42}\n {4}同じ文章なら何度実行しても同じ結果になります/u);
      const notice = [
        "",
        "  意味を読む検査は動かしていません。anthropic の認証情報がありません。",
        "  ANTHROPIC_API_KEY を設定するか、ant auth login を実行してください。",
        "  .env に書いても読みます（いまは .env がありません）。",
        "  機械による判定はすべて動いています。",
        "",
      ].join("\n");
      assert.ok(result.out.endsWith(notice), result.out);
    });

    it("openai の鍵の案内も文書の言語", async () => {
      const config = "ai_backend: openai\n";
      const english = await withoutKeys(() => runIn({ "chaff.yaml": config, "a.md": EN }, ["test", "a.md"], "ja_JP.UTF-8"));
      assert.match(english.out, / {2}Set OPENAI_API_KEY\./u);
      assert.doesNotMatch(english.out, JAPANESE);
      const japanese = await withoutKeys(() => runIn({ "chaff.yaml": config, "a.md": JA }, ["test", "a.md"], "en_US.UTF-8"));
      assert.match(japanese.out, / {2}OPENAI_API_KEY を設定してください。/u);
    });

    it("--dry-run の計画と合計は、英語の文書なら英語", async () => {
      const result = await withoutKeys(() => runIn({ "a.md": EN }, ["test", "a.md", "--dry-run"], "ja_JP.UTF-8"));
      assert.equal(result.code, 0);
      assert.match(result.out, /a\.md {3}sends \d+ passages? out of \d+ sentences? \(the API was not called\)/u);
      assert.match(result.out, / {2}\d+ passages? in all would be sent\. With --dry-run the API was not called\./u);
      assert.match(result.out, / {2}Sent to: anthropic \/ \S+ \(no credentials\)/u);
      assert.doesNotMatch(result.out, JAPANESE);
    });

    it("--dry-run の計画と合計は、日本語の文書なら以前の文言のまま", async () => {
      const result = await withoutKeys(() => runIn({ "a.md": JA }, ["test", "a.md", "--dry-run"], "en_US.UTF-8"));
      assert.match(result.out, /a\.md {3}全 \d+ 文のうち \d+ 箇所を送ります（API は呼んでいません）/u);
      assert.match(result.out, / {2}合計 \d+ 箇所を送ります。--dry-run なので API は呼んでいません。\n {2}送り先: anthropic \/ \S+（認証なし）/u);
    });

    it("言語の混ざった実行の締めは chaff.yaml の language、次に端末の言語。文書ごとの枠は文書の言語", async () => {
      const byPath = 'by_path:\n  - files: ["en.md"]\n    language: en\n  - files: ["ja.md"]\n    language: ja\n';
      const files = { "en.md": EN, "ja.md": JA };
      const english = await withoutKeys(() => runIn({ ...files, "chaff.yaml": byPath }, ["test", "."], "en_US.UTF-8"));
      assert.match(english.out, /═══ Judged by machine/u);
      assert.match(english.out, /═══ 機械による判定/u);
      assert.match(english.out, /Every machine check ran\.\n$/u);
      const japanese = await withoutKeys(() => runIn({ ...files, "chaff.yaml": byPath }, ["test", "."], "ja_JP.UTF-8"));
      assert.match(japanese.out, /機械による判定はすべて動いています。\n$/u);
      const configured = await withoutKeys(() => runIn({ ...files, "chaff.yaml": `language: ja\n${byPath}` }, ["test", ".", "--dry-run"], "en_US.UTF-8"));
      assert.match(configured.out, /合計 \d+ 箇所を送ります。/u);
    });

    it("Markdown が無いときの断りは端末の言語、日本語は以前の文言のまま", async () => {
      assert.match((await runIn({}, ["test", "nothing"], "en_US.UTF-8")).err, /^No Markdown files found: nothing$/u);
      assert.match((await runIn({}, ["test", "nothing"], "ja_JP.UTF-8")).err, /^Markdown が 1 つも見つかりませんでした: nothing$/u);
      assert.match((await runIn({ "chaff.yaml": "language: en\n" }, ["test", "nothing"], "ja_JP.UTF-8")).err, /^No Markdown files found: nothing$/u);
    });
  });

  it("無いジャンルの断りも端末の言語", async () => {
    const result = await runIn({ "a.md": EN }, ["a.md", "--genre", "novel"], "en_US.UTF-8");
    assert.equal(result.code, 1);
    assert.match(result.err, /There is no genre "novel"/u);
  });
});
