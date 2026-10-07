import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { isVersionHistory, leadingVersion, versionOrderBreaks } from "../packages/chaff/src/structure/version-order.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 変更履歴の版の並び（version-order）と、版の見出しを番号の並びとして読まない numbering-gap。例文は自作。

const found = (source: string, adapter: LanguageAdapter, rule = "version-order"): string[] =>
  runRules(buildDocument("CHANGELOG.md", source, adapter), loadRules(adapter.id), { [rule]: "normal" }, false, "technical/readme")
    .findings.filter((finding) => finding.rule === rule)
    .map((finding) => `${String(finding.line)} ${String(finding.values["version"] ?? finding.values["label"])}`);

const changelog = (title: string, ...versions: string[]): string =>
  [`# ${title}`, "", ...versions.flatMap((version) => [`## ${version}`, "", "- A change.", ""])].join("\n");

const labels = (...versions: string[]): { offset: number; label: string }[] => versions.map((label, offset) => ({ offset, label }));

before(async () => prepare());

describe("version-order", () => {
  it("ja and en: one heading out of a newest-first changelog", () => {
    const versions = ["3.2.0 - 2026-09-14", "3.1.1 - 2026-07-08", "3.3.0 - 2026-06-02", "3.0.0 - 2026-03-20", "2.4.2 - 2026-01-11"];
    assert.deepEqual(found(changelog("変更履歴", ...versions), ja), ["11 3.3.0"]);
    assert.deepEqual(found(changelog("Changelog", ...versions), en), ["11 3.3.0"]);
    assert.deepEqual(found(changelog("Changelog", "3.2.0", "3.1.1", "3.1.0", "3.0.0", "2.4.2"), en), []);
  });

  it("an oldest-first changelog, brackets and a v", () => {
    assert.deepEqual(found(changelog("Changelog", "[1.0.0]", "[1.1.0]", "[0.9.0]", "[1.2.0]", "[2.0.0]"), en), ["11 [0.9.0]"]);
    assert.deepEqual(found(changelog("Changelog", "v1.0.0", "v1.1.0", "v1.2.0", "v2.0.0"), en), []);
  });

  it("a list of releases and a table of releases", () => {
    const items = ["3.2.0 (2026-09-14)", "3.1.0 (2026-06-02)", "3.3.0 (2026-04-01)", "3.0.0 (2026-03-20)", "2.4.2 (2026-01-11)"];
    assert.deepEqual(found(["# Releases", "", ...items.map((item) => `- ${item}: a change`)].join("\n"), en), ["5 3.3.0"]);
    const rows = ["| Version | Date |", "| --- | --- |", ...items.map((item) => `| ${item.replace(" (", " | ").replace(")", "")} |`)];
    assert.deepEqual(found(["# Releases", "", ...rows].join("\n"), ja), ["7 3.3.0"]);
  });

  it("a prerelease comes before its release, with dots or hyphens in its name", () => {
    assert.deepEqual(found(changelog("Changelog", "3.0.0", "3.0.0-rc.1", "3.0.0-beta.2", "2.4.0"), en), []);
    const prereleases = ["2.0.0", "1.0.0", "1.0.0-rc-1", "1.0.0-beta-2", "1.0.0-rc-3", "1.0.0-beta-1", "0.9.0"];
    assert.deepEqual(found(changelog("Changelog", ...prereleases), en), ["19 1.0.0-rc-3"]);
  });

  it("headings with no body between them are quoted from the version", () => {
    const source = ["# Changelog", "", "## 3.2.0", "## 3.1.1", "## 3.3.0", "## 3.0.0", "## 2.4.2", ""].join("\n");
    const quotes = runRules(buildDocument("CHANGELOG.md", source, en), loadRules("en"), { "version-order": "normal" }, false, "technical/readme")
      .findings.filter((finding) => finding.rule === "version-order")
      .map((finding) => `${String(finding.line)} ${finding.quote}`);
    assert.deepEqual(quotes, ["5 3.3.0"]);
  });

  it("an example changelog in a code fence is not the document's", () => {
    const fenced = ["# README", "", "```md", "- 3.0.0", "- 2.0.0", "- 4.0.0", "- 1.0.0", "```", ""].join("\n");
    assert.deepEqual(found(fenced, en), []);
  });

  it("does not read a sequence of fewer than three, with no direction, or headings under different parents", () => {
    assert.deepEqual(found(changelog("Changelog", "3.2.0", "3.3.0"), en), []);
    assert.deepEqual(found(changelog("Changelog", "1.0.0", "2.0.0", "1.5.0"), en), []);
    const twoParents = ["# Changelog", "", "## 3.x", "", "### 3.1.0", "", "### 3.0.0", "", "## 2.x", "", "### 2.4.0", "", "### 2.3.0", ""].join("\n");
    assert.deepEqual(found(twoParents, en), []);
  });

  it("versions in running text and two-part numbers are not a sequence", () => {
    assert.deepEqual(found("# Notes\n\nWe moved from 3.2.0 to 3.1.0 and then to 3.3.0 after 3.0.0.\n", en), []);
    assert.deepEqual(found(changelog("Changelog", "3.2", "3.1", "3.3", "3.0"), en), []);
  });
});

describe("version-order: the pure parts", () => {
  it("reads a leading version, and nothing else", () => {
    assert.equal(leadingVersion("3.2.0 - 2026-09-14"), "3.2.0");
    assert.equal(leadingVersion("[3.2.0] - 2026-09-14"), "[3.2.0]");
    assert.equal(leadingVersion("v1.0.0-beta.1"), "v1.0.0-beta.1");
    ["", "Version 3.2.0", "3.2", "2026-09-14", "1.2.3a"].forEach((text) => assert.equal(leadingVersion(text), undefined, text));
  });

  it("points at the version in no longest run, and says nothing on empty or sorted input", () => {
    assert.deepEqual(versionOrderBreaks([]), []);
    assert.deepEqual(versionOrderBreaks(labels("3.0.0", "2.0.0", "1.0.0")), []);
    assert.deepEqual(versionOrderBreaks(labels("3.0.0", "2.0.0", "2.0.0", "1.0.0")), []);
    assert.deepEqual(
      versionOrderBreaks(labels("4.0.0", "3.0.0", "5.0.0", "2.0.0", "1.0.0")).map((issue) => issue.values["version"]),
      ["5.0.0"],
    );
    assert.deepEqual(versionOrderBreaks(labels("a", "b", "c")), []);
  });

  it("does not choose between two versions that could each be the one out of place", () => {
    assert.deepEqual(versionOrderBreaks(labels("4.0.0", "3.0.0", "1.0.0", "2.0.0")), []);
  });

  it("a sequence mostly out of order is sorted by something else", () => {
    assert.deepEqual(versionOrderBreaks(labels("2.0.0", "5.0.0", "1.0.0", "4.0.0", "3.0.0", "6.0.0")), []);
  });

  it("tells a version history from section numbers", () => {
    assert.equal(isVersionHistory(["3.2.0", "3.1.1", "3.1.0"]), true);
    assert.equal(isVersionHistory(["1.0.0", "1.0.1", "1.1.0"]), true);
    assert.equal(isVersionHistory(["[1.1.0]", "v1.0.1", "1.0.0-beta-1"]), true);
    assert.equal(isVersionHistory(["2.3.4", "2.3.2", "2.3.1"]), true);
    assert.equal(isVersionHistory(["1.2.1", "1.2.2", "1.2.4"]), false);
    assert.equal(isVersionHistory(["1.2", "1.3", "1.0"]), false);
    assert.equal(isVersionHistory(["1.0.1", "1.0.3", "1.0.4"]), false);
    assert.equal(isVersionHistory(["3.2.0"]), false);
    assert.equal(isVersionHistory([]), false);
    assert.equal(isVersionHistory(["第1条", "第2条"]), false);
  });
});

describe("numbering-gap leaves a changelog's version headings to version-order", () => {
  it("a newest-first changelog has no gap; dotted section numbers still do", () => {
    const dated = ["3.2.0 - 2026-09-14", "3.1.1 - 2026-07-08", "3.1.0 - 2026-06-02", "3.0.0 - 2026-03-20", "2.4.2 - 2026-01-11"];
    assert.deepEqual(found(changelog("Changelog", ...dated), en, "numbering-gap"), []);
    assert.deepEqual(found(changelog("変更履歴", ...dated), ja, "numbering-gap"), []);
    const sections = ["# Spec", "", "## 1.2.1 Scope", "", "Text.", "", "## 1.2.2 Terms", "", "Text.", "", "## 1.2.4 Rules", "", "Text.", ""].join("\n");
    assert.equal(found(sections, en, "numbering-gap").length, 1);
    const zeroInside = ["# Spec", "", "## 1.0.1 Scope", "", "Text.", "", "## 1.0.3 Terms", "", "Text.", "", "## 1.0.4 Rules", "", "Text.", ""].join("\n");
    assert.equal(found(zeroInside, en, "numbering-gap").length, 1);
  });

  it("section numbers out of order are numbering-gap's, not version-order's", () => {
    const sections = ["1.2.1 Scope", "1.2.2 Auth", "1.2.5 Webhooks", "1.2.3 Errors", "1.2.4 Limits"].flatMap((heading) => [`## ${heading}`, "", "Text.", ""]);
    const source = ["# API", "", ...sections].join("\n");
    assert.deepEqual(found(source, en), []);
    assert.notEqual(found(source, en, "numbering-gap").length, 0);
  });
});
