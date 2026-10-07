import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { versionMismatches } from "../packages/chaff/src/structure/version-mismatch.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// コードブロックのすぐ上の段落が名指す版と、ブロックの版の食い違い（version-mismatch）。例文は自作。

const RULE = "version-mismatch";
const FENCE = "```";

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("README.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "technical/readme")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.line)} ${String(finding.values["written"])}>${String(finding.values["code"])}`);

const readme = (leadIn: string, ...code: string[]): string => ["# tidyq", "", leadIn, "", `${FENCE}bash`, ...code, FENCE, ""].join("\n");

before(async () => prepare());

describe("version-mismatch", () => {
  it("ja: 説明の版とコードの版が違う", () => {
    assert.deepEqual(found(readme("npm から 2.3.0 を入れます。", "npm install --global tidyq@2.4.0"), ja), ["3 2.3.0>2.4.0"]);
    assert.deepEqual(found(readme("npm から 2.4.0 を入れます。", "npm install --global tidyq@2.4.0"), ja), []);
  });

  it("en: the lead-in's version against the block's, with or without a v", () => {
    assert.deepEqual(found(readme("Install version 2.3.0 from npm:", "npm install --global tidyq@2.4.0"), en), ["3 2.3.0>2.4.0"]);
    assert.deepEqual(found(readme("Install v2.4.0 from npm:", "npm install --global tidyq@2.4.0"), en), []);
    assert.deepEqual(found(readme("Install version 2.3.0:", "pip install tidyq==2.4.0"), en), ["3 2.3.0>2.4.0"]);
  });

  it("does not compare a block with no version or two, a bound, a heading or a list item, or two-part numbers", () => {
    assert.deepEqual(found(readme("Install version 2.3.0 from npm:", "npm install --global tidyq"), en), []);
    assert.deepEqual(found(readme("Upgrade from 2.3.0:", "npm uninstall tidyq@2.3.0", "npm install tidyq@2.4.0"), en), []);
    assert.deepEqual(found(readme("Upgrade from 2.3.0:", "npm install tidyq@2.4.0"), en), []);
    assert.deepEqual(found(readme("Node.js 20.0.0 or later is needed:", "node --version  # v22.3.0"), en), []);
    assert.deepEqual(found(readme("2.3.0 から更新するには:", "npm install tidyq@2.4.0"), ja), []);
    assert.deepEqual(found(["# tidyq", "", "## 2.3.0", "", `${FENCE}bash`, "npm install tidyq@2.4.0", FENCE, ""].join("\n"), en), []);
    assert.deepEqual(found(["# tidyq", "", "- Install 2.3.0", "", `${FENCE}bash`, "npm install tidyq@2.4.0", FENCE, ""].join("\n"), en), []);
    assert.deepEqual(found(readme("Ubuntu 22.04 is supported:", "apt install tidyq=2.4.0"), en), []);
  });

  it("does not compare another program's version, a date, a bare version line", () => {
    assert.deepEqual(found(readme("Requires Node.js 18.17.0:", "npm install pkg@2.4.0"), en), []);
    assert.deepEqual(found(readme("Python 3.11.4 is required:", "pip install pkg==2.4.0"), en), []);
    assert.deepEqual(found(readme("Node.js 18.17.0 が必要です。", "npm install pkg@2.4.0"), ja), []);
    assert.deepEqual(found(readme("Install pkg 2.4.0:", "Released: 2024.01.15"), en), []);
    assert.deepEqual(found(readme("2.3.0", "npm install pkg@2.4.0"), en), []);
    assert.deepEqual(found(readme("Install pkg 2.3.0:", "npm install pkg@2.4.0"), en), ["3 2.3.0>2.4.0"]);
    assert.deepEqual(found(readme("Install 2.3.0:", "npm install pkg@2.4.0"), en), ["3 2.3.0>2.4.0"]);
  });

  it("reads a version of any length written right after the name of a program the block pins", () => {
    const docker = "docker run --name ci-cache -p 6379:6379 -d redis:7.4";
    assert.deepEqual(found(readme("We run Redis 7.2 in a container:", docker), en), ["3 7.2>7.4"]);
    assert.deepEqual(found(readme("Redis 7.2 をコンテナで動かします。", docker), ja), ["3 7.2>7.4"]);
    assert.deepEqual(found(readme("We run Redis 7.2.1 in a container:", docker), en), ["3 7.2.1>7.4"]);
    assert.deepEqual(found(readme("Use Python 3.11:", "FROM python:3.12-slim"), en), ["3 3.11>3.12"]);
    assert.deepEqual(found(readme("Use Redis 7.2:", "docker pull library/redis:7.4-alpine"), en), ["3 7.2>7.4"]);
  });

  it("does not report a named version of the pinned series, a bound, another program, or a name pinned twice", () => {
    const docker = "docker run -d redis:7.4";
    assert.deepEqual(found(readme("We run Redis 7.4 in a container:", docker), en), []);
    assert.deepEqual(found(readme("We run Redis 7 in a container:", docker), en), []);
    assert.deepEqual(found(readme("We run Redis 7.4.1 in a container:", docker), en), []);
    assert.deepEqual(found(readme("Redis 7.2 or later works:", docker), en), []);
    assert.deepEqual(found(readme("Moving from Redis 7.2:", docker), en), []);
    assert.deepEqual(found(readme("We tried Postgres 15 first:", docker), en), []);
    assert.deepEqual(found(readme("Redis 7.2 before, now:", "docker run -d redis:7.2", "docker run -d redis:7.4"), en), []);
    assert.deepEqual(found(readme("Port 6379 is open, Redis 7.4:", docker), en), []);
    assert.deepEqual(found(readme("Install version 2.3.0 of tidyq:", "npm install tidyq@2.4.0"), en), ["3 2.3.0>2.4.0"]);
    assert.deepEqual(found(readme("Install tidyq 2.3.0:", "npm install tidyq@2.4.0"), en), ["3 2.3.0>2.4.0"]);
    assert.deepEqual(found(readme("Set port 1234:", "port=4321"), en), []);
    assert.deepEqual(found(readme("Use Node 20 in CI:", "node=18"), en), []);
  });

  it("compares the parts as written, and reports a named version against its own pin", () => {
    assert.deepEqual(found(readme("Use Ubuntu 22.4:", "FROM ubuntu:22.04"), en), ["3 22.4>22.04"]);
    assert.deepEqual(found(readme("We run Redis 7.2.0 here:", "docker run -d redis:7.4  # tested with 1.0.0"), en), ["3 7.2.0>7.4"]);
  });

  it("reads only the paragraph right above, with CRLF line ends too", () => {
    const source = ["# tidyq", "", "Earlier 9.9.9 was used.", "", "Install version 2.3.0:", "", `${FENCE}bash`, "npm install pkg@2.4.0", FENCE, ""].join(
      "\r\n",
    );
    assert.deepEqual(
      versionMismatches(source, source, [{ start: source.indexOf(FENCE), code: "npm install pkg@2.4.0" }], { ranges: [], versionWords: ["version"] }),
      [{ offset: source.indexOf("2.3.0"), values: { written: "2.3.0", code: "2.4.0" } }],
    );
  });

  it("reads the version in the lead-in's prose, not in its inline code", () => {
    assert.deepEqual(found(readme("Run `tidyq --version`, which prints `2.3.0`, after installing:", "npm install tidyq@2.4.0"), en), []);
  });
});

describe("versionMismatches", () => {
  it("reads nothing without blocks or before the first paragraph", () => {
    assert.deepEqual(versionMismatches("", "", [], { ranges: [], versionWords: [] }), []);
    assert.deepEqual(versionMismatches("x", "x", [{ start: 0, code: "a@1.0.0" }], { ranges: [], versionWords: [] }), []);
  });
});
