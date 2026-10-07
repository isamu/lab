import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { COMMANDS } from "../packages/chaff/src/cli.ts";
import { CLI_TEXT } from "../packages/chaff/src/cli-text.ts";
import { asksForHelp, commandHelp, commandUsage } from "../packages/chaff/src/command-help.ts";
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

describe("どのコマンドも --help に応える", () => {
  it("どのコマンドにも、日本語と英語の使い方に行がある", () => {
    const missing = Object.entries(CLI_TEXT).flatMap(([language, text]) =>
      COMMANDS.filter((command) => commandUsage(text.usage, command).length === 0).map((command) => `${language}: ${command}`),
    );
    assert.deepEqual(missing, []);
  });

  it("grade と fix-plan の使い方は、そのコマンドだけの指定を日本語と英語の両方で挙げる", () => {
    const flags: Readonly<Record<string, readonly string[]>> = { grade: ["--baseline", "--compact", "--out", "--json"], "fix-plan": ["--depth", "--json"] };
    const missing = Object.entries(CLI_TEXT).flatMap(([language, text]) => flagsMissingFrom(text.usage, language, flags));
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
