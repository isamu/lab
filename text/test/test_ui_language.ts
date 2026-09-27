import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hostLanguage, uiLanguageOf } from "../packages/chaff/src/ui.ts";
import { main } from "../packages/chaff/src/cli.ts";

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
});

describe("画面の言語", () => {
  const JA = `# 手順\n\n${"設定の手順は画面の右上にあるボタンを押してから開く一覧の中で目的の項目を選び、".repeat(5)}保存します。\n`;
  const EN = "# Notes\n\nThis is a short note. It says one thing.\n";

  const runIn = async (files: Readonly<Record<string, string>>, args: readonly string[], lang: string): Promise<{ code: number; out: string; err: string }> => {
    const dir = mkdtempSync(join(tmpdir(), "chaff-ui-"));
    Object.entries(files).forEach(([name, body]) => writeFileSync(join(dir, name), body));
    const out: string[] = [];
    const err: string[] = [];
    const saved = {
      log: console.log,
      error: console.error,
      cwd: process.cwd(),
      env: { LANG: process.env["LANG"], LC_ALL: process.env["LC_ALL"], LC_MESSAGES: process.env["LC_MESSAGES"] },
    };
    console.log = (...parts: unknown[]) => {
      out.push(parts.join(" "));
    };
    console.error = (...parts: unknown[]) => {
      err.push(parts.join(" "));
    };
    delete process.env["LC_ALL"];
    delete process.env["LC_MESSAGES"];
    process.env["LANG"] = lang;
    process.chdir(dir);
    try {
      const code = await main(args);
      return { code, out: out.join("\n"), err: err.join("\n") };
    } finally {
      process.chdir(saved.cwd);
      console.log = saved.log;
      console.error = saved.error;
      Object.entries(saved.env).forEach(([name, value]) => {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      });
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
    assert.match(result.out, /Levels \(unit: words\)/u);
    assert.match(result.out, /→ normal {3}25/u);
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

  it("無いジャンルの断りも端末の言語", async () => {
    const result = await runIn({ "a.md": EN }, ["a.md", "--genre", "novel"], "en_US.UTF-8");
    assert.equal(result.code, 1);
    assert.match(result.err, /There is no genre "novel"/u);
  });
});
