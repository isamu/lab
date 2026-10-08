import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { COMMANDS } from "../packages/chaff/src/cli.ts";
import { CLI_TEXT } from "../packages/chaff/src/cli-text.ts";
import { asksForHelp, commandHelp, commandUsage } from "../packages/chaff/src/command-help.ts";
import { AI_SCORE_TEXT } from "../packages/chaff/src/ai-score/text.ts";
import { GRADE_TEXT } from "../packages/chaff/src/grade/text.ts";
import { runCli } from "./cli-run.ts";

// chaff <コマンド> --help は、そのコマンドを動かさずに使い方を出す。init --help が chaff.yaml を書いてはいけない。

const USAGE = [
  "chaff — test",
  "",
  "  chaff a <x>        does a",
  "                     more on a",
  "  chaff b|c          does b or c",
  "  chaff a --json     a as JSON",
  "",
  "  --flag   shared",
].join("\n");

describe("commandUsage", () => {
  it("そのコマンドの行と、その下に字下げした行を出す", () => {
    assert.deepEqual(commandUsage(USAGE, "a"), ["  chaff a <x>        does a", "                     more on a", "  chaff a --json     a as JSON"]);
  });

  it("| で並べた名前のどれでも、その行を出す", () => {
    assert.deepEqual(commandUsage(USAGE, "c"), ["  chaff b|c          does b or c"]);
  });

  it("使い方に無いコマンドには何も出さない", () => {
    assert.deepEqual(commandUsage(USAGE, "z"), []);
  });
});

describe("commandHelp", () => {
  it("使い方に無いコマンドには、使い方の全体を出す", () => {
    assert.equal(commandHelp(USAGE, "z", "more"), USAGE);
  });

  it("あるコマンドには、その行と、残りの在りかを出す", () => {
    assert.equal(commandHelp(USAGE, "c", "more"), "  chaff b|c          does b or c\n\nmore");
  });
});

describe("asksForHelp", () => {
  it("コマンドの後の --help と -h を拾う", () => {
    assert.equal(asksForHelp(["init", "--help"]), true);
    assert.equal(asksForHelp(["test", "a.md", "-h"]), true);
  });

  it("コマンドそのものと、ほかの引数は拾わない", () => {
    assert.equal(asksForHelp(["--help"]), false);
    assert.equal(asksForHelp(["init", "--genre", "blog/tech"]), false);
  });
});

/** "<language>: <command> <flag>" for each flag a command's usage lines do not name. */
const flagsMissingFrom = (usage: string, language: string, flags: Readonly<Record<string, readonly string[]>>): string[] =>
  Object.entries(flags).flatMap(([command, names]) => {
    const lines = commandUsage(usage, command).join("\n");
    return names.filter((name) => !lines.includes(name)).map((name) => `${language}: ${command} ${name}`);
  });

/** Each command's own options, as its parser reads them. The options several commands share are in SHARED_FLAGS. */
const COMMAND_FLAGS: Readonly<Record<string, readonly string[]>> = {
  "ai-score": ["--format", "--json", "--compact"],
  cite: ["--format"],
  compare: ["--allow-dropped", "--allow-added", "--distinct", "--json", "--compact"],
  enable: ["--why"],
  eval: ["--rule"],
  facts: ["--json", "--compact"],
  feedback: ["--rule", "--line", "--missed", "--with-config"],
  "fix-plan": ["--depth", "--json"],
  grade: ["--out", "--baseline", "--allow-stamp-mismatch", "--variant-key", "--format", "--json", "--compact"],
  init: ["--genre", "--plugin"],
  outline: ["--json", "--compact"],
  relax: ["--why"],
  rules: ["--json"],
  skill: ["--global", "--force"],
  tree: ["--format"],
};

const SHARED_FLAGS: readonly string[] = [
  "--compact",
  "--no-guide",
  "--experimental",
  "--genre",
  "--show-baseline",
  "--watch",
  "--dry-run",
  "--sarif",
  "--include",
  "--language",
];

/** "<language>: <flag>" for each shared option that has no line of its own in the usage. */
const sharedMissingFrom = (usage: string, language: string): string[] => {
  const lines = usage.split("\n");
  return SHARED_FLAGS.filter((name) => !lines.some((line) => line.startsWith(`  ${name} `))).map((name) => `${language}: ${name}`);
};

/** The short usage a command prints itself when its arguments do not fit, one per command and language. */
type OwnUsage = { readonly command: string; readonly language: string; readonly usage: string };

const OWN_USAGES: readonly OwnUsage[] = [
  { command: "grade", language: "ja", usage: GRADE_TEXT.ja.usage },
  { command: "grade", language: "en", usage: GRADE_TEXT.en.usage },
  { command: "ai-score", language: "ja", usage: AI_SCORE_TEXT.ja.usage },
  { command: "ai-score", language: "en", usage: AI_SCORE_TEXT.en.usage },
];

/** "<language>: <command> <flag>" for each of the command's own options its short usage does not name. */
const ownFlagsMissing = ({ command, language, usage }: OwnUsage): string[] =>
  (COMMAND_FLAGS[command] ?? []).filter((name) => !usage.includes(name)).map((name) => `${language}: ${command} ${name}`);

describe("どのコマンドも --help に応える", () => {
  it("どのコマンドにも、日本語と英語の使い方に行がある", () => {
    const missing = Object.entries(CLI_TEXT).flatMap(([language, text]) =>
      COMMANDS.filter((command) => commandUsage(text.usage, command).length === 0).map((command) => `${language}: ${command}`),
    );
    assert.deepEqual(missing, []);
  });

  it("どのコマンドの使い方も、そのコマンドだけの指定を日本語と英語の両方で挙げる", () => {
    const missing = Object.entries(CLI_TEXT).flatMap(([language, text]) => flagsMissingFrom(text.usage, language, COMMAND_FLAGS));
    assert.deepEqual(missing, []);
  });

  it("共通の指定は、日本語と英語の両方の使い方に行がある", () => {
    const missing = Object.entries(CLI_TEXT).flatMap(([language, text]) => sharedMissingFrom(text.usage, language));
    assert.deepEqual(missing, []);
  });

  it("指定が 1 つ欠ければ、欠けたものを名指しする", () => {
    const usage = CLI_TEXT.en.usage.replaceAll("--allow-stamp-mismatch", "");
    assert.deepEqual(flagsMissingFrom(usage, "en", COMMAND_FLAGS), ["en: grade --allow-stamp-mismatch"]);
    assert.deepEqual(sharedMissingFrom(CLI_TEXT.ja.usage.replace("  --language ", "  "), "ja"), ["ja: --language"]);
  });

  it("grade と ai-score が誤りのときに出す使い方も、そのコマンドの指定を日本語と英語の両方で挙げる", () => {
    const missing = OWN_USAGES.flatMap(ownFlagsMissing);
    assert.deepEqual(missing, []);
  });

  it("init --help は使い方を出し、chaff.yaml を書かない", async () => {
    const run = await runCli({}, ["init", "--help"], "en_US.UTF-8");
    assert.equal(run.code, 0);
    assert.match(run.out, /^ {2}chaff init /u);
    assert.equal(existsSync(join(run.dir, "chaff.yaml")), false);
  });

  it("skill --help は使い方を出し、skill を入れない", async () => {
    const run = await runCli({}, ["skill", "--help"], "ja_JP.UTF-8");
    assert.equal(run.code, 0);
    assert.match(run.out, /^ {2}chaff skill /u);
    assert.match(run.out, /npx chaffjs --help で出ます。$/u);
    assert.equal(existsSync(join(run.dir, ".claude")), false);
  });

  it("lint --help は使い方の全体を出す", async () => {
    const run = await runCli({}, ["lint", "--help"], "en_US.UTF-8");
    assert.equal(run.code, 0);
    assert.equal(run.out, CLI_TEXT.en.usage);
  });
});
