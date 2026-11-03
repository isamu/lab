import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { namedByHeading } from "../packages/chaff/src/detectors/gram-heading.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// ngram-repetition: a phrase a heading names, used in the body with a word attached at its edge (to create a ConfigMap
// under "Create a ConfigMap", 旧氏を併記した氏名 under 旧氏を併記した場合), is the document's subject. Self-written text.

const JA_FILLER = Array.from({ length: 70 }, (_, index) => `項目${String(index)}の値${String(index)}。`).join("");
const EN_FILLER = Array.from({ length: 40 }, (_, index) => `Item ${String(index)} holds value ${String(index * 3)} today.`).join(" ");

const worst = (adapter: LanguageAdapter, source: string): string | undefined => {
  const filled = `${source}\n## Notes\n\n${adapter === ja ? JA_FILLER : EN_FILLER}\n`;
  const finding = runRules(buildDocument("t.md", filled, adapter), loadRules(adapter.id), {}, true, "docs/manual").findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

const SOURCES = ["a directory", "two files", "one file", "an env file", "literal values", "a generator", "a URL", "a template"];
const FORMS = ["願書", "届出書", "請求書", "申請書", "補正書", "上申書", "証明書", "委任状"];
const FIELDS = ["発明者の欄", "出願人の欄", "請求人の欄", "代理人の欄", "承継人の欄", "届出人の欄", "提出者の欄", "代表者の欄"];

const OPENINGS = ["Run kubectl", "Pass a flag", "Use the API", "Call apply", "Edit a manifest", "Write YAML", "Try kustomize", "Ask an admin"];
const ENDINGS = ["書きます。", "記入します。", "記載する。", "入れてください。", "直します。", "改めます。", "示します。", "載せます。"];

const enBody = SOURCES.map((source, index) => `${OPENINGS[index] ?? ""} to create a ConfigMap from ${source}.`).join(" ");
const jaBody = FORMS.map((form, index) => `${form}は${FIELDS[index] ?? ""}に旧氏を併記した氏名を${ENDINGS[index] ?? ""}`).join("");

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

describe("ngram-repetition: a heading's phrase with a word attached", () => {
  it("does not count an English phrase that a heading names but for one word, and counts it under other headings", () => {
    assert.equal(worst(en, `# Tasks\n\n## Create a ConfigMap\n\n${enBody}\n`), undefined);
    assert.match(worst(en, `# Tasks\n\n## Setup\n\n${enBody}\n`) ?? "", /create a configmap/iu);
  });

  it("does not count a Japanese phrase that a heading names in most of its characters, and counts it under other headings", () => {
    assert.equal(worst(ja, `# 手続\n\n## 旧氏を併記した場合\n\n${jaBody}\n`), undefined);
    assert.match(worst(ja, `# 手続\n\n## 書類の書き方\n\n${jaBody}\n`) ?? "", /併記/u);
  });
});

describe("namedByHeading", () => {
  it("is true for a key a heading holds whole", () => {
    assert.equal(namedByHeading("create a configmap", "## create a configmap", "word"), true);
    assert.equal(namedByHeading("ことができます", "ことができますか", "char"), true);
  });

  it("is true when a heading holds a run of more than half the key's characters with content in it", () => {
    assert.equal(namedByHeading("to create a configmap", "create a configmap", "word"), true);
    assert.equal(namedByHeading("氏を併記した氏名", "旧氏を併記した場合", "char"), true);
  });

  it("is false when the run a heading holds is half the key or less", () => {
    assert.equal(namedByHeading("you can use it to create", "create a configmap", "word"), false);
    assert.equal(namedByHeading("記載してください", "記載の方法", "char"), false);
  });

  it("is false when the run a heading holds has no content (one English word, short function words, Japanese without kanji or katakana)", () => {
    assert.equal(namedByHeading("using the tool", "## using", "word"), false);
    assert.equal(namedByHeading("applicants will be", "how you will be evaluated", "word"), false);
    assert.equal(namedByHeading("することができま", "ことができますか", "char"), false);
  });

  it("is false for an empty title, and an empty key is only named by itself", () => {
    assert.equal(namedByHeading("to create a configmap", "", "word"), false);
    assert.equal(namedByHeading("旧氏を併記した氏", "", "char"), false);
    assert.equal(namedByHeading("", "", "char"), true);
  });
});
