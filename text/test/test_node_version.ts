import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { requiredMajorOf, tooOldMessage } from "../packages/chaff/src/node-version.ts";

const CHAFF = new URL("../packages/chaff/", import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, CHAFF), "utf8");

describe("requiredMajorOf", () => {
  it("reads the major version of a >= range", () => {
    assert.equal(requiredMajorOf(">=24"), 24);
    assert.equal(requiredMajorOf(">= 24.1.0"), 24);
    assert.equal(requiredMajorOf(">=v26"), 26);
  });

  it("gives up on any other shape, so the check never stops a Node.js it cannot judge", () => {
    assert.equal(requiredMajorOf("^24"), undefined);
    assert.equal(requiredMajorOf("24"), undefined);
    assert.equal(requiredMajorOf(">24"), undefined);
    assert.equal(requiredMajorOf(""), undefined);
    assert.equal(requiredMajorOf(undefined), undefined);
    assert.equal(requiredMajorOf(24), undefined);
  });

  it("reads chaff's own engines range", () => {
    const manifest: unknown = JSON.parse(read("package.json"));
    const engines = typeof manifest === "object" && manifest !== null && "engines" in manifest ? manifest.engines : undefined;
    const node = typeof engines === "object" && engines !== null && "node" in engines ? engines.node : undefined;
    assert.notEqual(requiredMajorOf(node), undefined);
  });
});

describe("tooOldMessage", () => {
  const english = { LANG: "en_US.UTF-8" };

  it("says nothing on the required version or later", () => {
    assert.equal(tooOldMessage("24.0.0", ">=24", english), undefined);
    assert.equal(tooOldMessage("26.3.0", ">=24", english), undefined);
  });

  it("names the required and the running version below it", () => {
    assert.equal(tooOldMessage("18.20.8", ">=24", english), "chaff needs Node.js 24 or later. This is v18.20.8. Install the LTS from https://nodejs.org/en");
    assert.match(tooOldMessage("23.6.0", ">=24", english) ?? "", /This is v23\.6\.0\./u);
  });

  it("speaks Japanese under a Japanese locale, LC_ALL first and empty variables skipped", () => {
    assert.equal(
      tooOldMessage("18.20.8", ">=24", { LANG: "ja_JP.UTF-8" }),
      "chaff は Node.js 24 以上で動きます。いまは v18.20.8 です。https://nodejs.org/ja から LTS を入れてください。",
    );
    assert.match(tooOldMessage("18.20.8", ">=24", { LC_ALL: "en_US.UTF-8", LANG: "ja_JP.UTF-8" }) ?? "", /^chaff needs/u);
    assert.match(tooOldMessage("18.20.8", ">=24", { LC_ALL: "", LC_MESSAGES: "ja_JP.UTF-8" }) ?? "", /^chaff は/u);
    assert.match(tooOldMessage("18.20.8", ">=24", {}) ?? "", /^chaff needs/u);
  });

  it("lets through a version or a range it cannot read", () => {
    assert.equal(tooOldMessage("abc", ">=24", english), undefined);
    assert.equal(tooOldMessage("18.20.8", "^24", english), undefined);
  });
});

describe("the entry point on an old Node.js", () => {
  it("loads nothing but node:fs and the check before the check has run", () => {
    const imports = [...read("bin/chaff.js").matchAll(/^import .* from "([^"]+)";$/gmu)].map((match) => match[1]);
    assert.deepEqual(imports, ["node:fs", "../dist/node-version.js"]);
  });

  it("keeps the check free of imports and of syntax old releases cannot parse", () => {
    const source = read("src/node-version.ts");
    assert.doesNotMatch(source, /^import /mu);
    assert.doesNotMatch(source.replace(/^\/\/.*$/gmu, ""), /\?\?|\?\./u);
  });
});
