import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "./cli-run.ts";

// examples/chaff-plugin-example run through chaff itself: what its own tests (examples/chaff-plugin-example/test) cannot
// show, that chaff loads it, prefixes its ids, gives its word list to the rule and applies its style.

const EXAMPLE = join(dirname(fileURLToPath(import.meta.url)), "..", "examples", "chaff-plugin-example");

const configWith = (...lines: string[]): string => [`plugins: [${JSON.stringify(EXAMPLE)}]`, ...lines, ""].join("\n");

describe("examples/chaff-plugin-example through chaff", () => {
  it("reports both rules under example/, in English", async () => {
    const run = await runCli(
      { "chaff.yaml": configWith("language: en"), "a.md": "# Plan\n\nThe launch date is TBD. Some say it is late.\n" },
      ["a.md", "--compact"],
      "en_US.UTF-8",
    );
    assert.match(run.out, /warning +A date left undecided: "TBD"/u);
    assert.match(run.out, /info +A claim with nobody behind it: "Some say"/u);
  });

  it("and in Japanese, with the Japanese word list", async () => {
    const run = await runCli({ "chaff.yaml": configWith("language: ja"), "a.md": "# 計画\n\n公開日は未定です。この方式は速いと言われている。\n" }, [
      "a.md",
      "--compact",
    ]);
    assert.match(run.out, /warning +未定のままの日付:「未定」/u);
    assert.match(run.out, /info +誰の言葉か分からない主張:「と言われている」/u);
  });

  it("its style raises both rules a step", async () => {
    const run = await runCli(
      { "chaff.yaml": configWith("language: en", "style: example/careful"), "a.md": "# Plan\n\nThe launch date is TBD. Some say it is late.\n" },
      ["a.md", "--compact"],
      "en_US.UTF-8",
    );
    assert.match(run.out, /error +A date left undecided/u);
    assert.match(run.out, /warning +A claim with nobody behind it/u);
    assert.equal(run.code, 1);
  });

  it("explain and rules --json know it as a plugin's", async () => {
    const explained = await runCli({ "chaff.yaml": configWith("language: en") }, ["explain", "example/weasel-words"], "en_US.UTF-8");
    assert.match(explained.out, /This rule comes from the plugin example\./u);
    const json = await runCli({ "chaff.yaml": configWith("language: en", "style: example/careful") }, ["rules", "--json"], "en_US.UTF-8");
    assert.match(json.out, /"id": "example\/careful"/u);
    assert.match(json.out, /"defined_in": "plugin example"/u);
  });
});
