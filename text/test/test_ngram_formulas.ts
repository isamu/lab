import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// ngram-repetition: fixed formulas a document carries per item, not the writer saying it again. A label line repeated
// verbatim before each box (The following rule has the force of law:), a plain-text definition list (qu:  The "qu" parameter
// value conveys …), a cross-reference closing right after a link ([…](…)を参照してください。), a phrase a heading names, and a
// report line filled in with different numbers. Each is checked both ways. Self-written text.

const JA_FILLER = Array.from({ length: 70 }, (_, index) => `項目${String(index)}の値${String(index)}。`).join("");
const EN_FILLER = Array.from({ length: 40 }, (_, index) => `Item ${String(index)} holds value ${String(index * 3)} today.`).join(" ");

/** The phrase ngram-repetition reports in a source, with filler after it so that the document is long enough to measure. */
const worst = (adapter: LanguageAdapter, source: string, genre = "business/report"): string | undefined => {
  const filled = `${source}\n## Notes\n\n${adapter === ja ? JA_FILLER : EN_FILLER}\n`;
  const finding = runRules(buildDocument("t.md", filled, adapter), loadRules(adapter.id), {}, true, genre).findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

const SUBJECTS = ["paper records", "invoices", "receipts", "credit notes", "ledgers", "spreadsheets", "bank statements", "order forms"];
const ACTIONS = ["keep", "store", "file", "sort", "copy", "check", "scan", "label"];
const NAMES = ["qu", "w", "pk", "r", "t", "q", "id", "ts"];
const MEANINGS = ["quota units", "a time window", "a partition key", "remaining units", "a reset time", "a quota", "a request id", "a timestamp"];
const PAGES = ["ノンス", "ハッシュ", "インラインスクリプト", "評価の制限", "報告の送り先", "既定のソース", "投機ルール", "埋め込みの制限"];
const TOPICS = ["鍵の管理", "署名の検証", "暗号の選び方", "証明書の更新", "権限の付与", "ログの保存", "通知の設定", "端末の登録"];
const TAILS = [
  "may lose income",
  "raises credit risk",
  "needs a cosigner",
  "can still apply",
  "pays a higher rate",
  "faces more checks",
  "is rarely approved",
  "should be told why",
];
const PROJECTS = ["Alder", "Birch", "Cedar", "Dogwood", "Elm", "Fir", "Ginkgo", "Hazel"];

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

describe("ngram-repetition: a fixed formula an item carries", () => {
  it("does not count a label line repeated verbatim before each box, and counts one that varies", () => {
    const boxes = SUBJECTS.map(
      (subject, index) =>
        `## Box ${String(index + 1)}\n\nThe following rule has the force of law:\n\nYou must ${ACTIONS[index] ?? ""} ${subject} for six years.\n`,
    );
    assert.equal(worst(en, `# Records\n\n${boxes.join("\n")}`), undefined);
    const varied = SUBJECTS.map(
      (subject, index) =>
        `## Box ${String(index + 1)}\n\nFor ${subject}, the following rule has the force of law:\n\nYou must ${ACTIONS[index] ?? ""} them for six years.\n`,
    );
    assert.equal(worst(en, `# Records\n\n${varied.join("\n")}`), "following rule has");
  });

  it("does not count the opening of each entry in a plain-text definition list, and counts the same words in prose", () => {
    const entries = NAMES.map((name, index) => `   ${name}:  The OPTIONAL "${name}" parameter value conveys ${MEANINGS[index] ?? ""}.\n`);
    assert.equal(worst(en, `# Fields\n\nThe header has these parameters.\n\n${entries.join("\n")}`), undefined);
    const prose = NAMES.map((name, index) => `In this header the "${name}" parameter value conveys ${MEANINGS[index] ?? ""}.`);
    assert.equal(worst(en, `# Fields\n\n${prose.join(" ")}\n`), "parameter value conveys");
  });

  it("does not count a closing right after a link when the document closes its links that way, and counts it after plain words", () => {
    const linked = PAGES.map((page, index) => `${TOPICS[index] ?? ""}は[${page}](/guide#${String(index)})を参照してください。`);
    assert.equal(worst(ja, `# 設定\n\n${linked.join("\n\n")}\n`), undefined);
    const plain = PAGES.map((page, index) => `${TOPICS[index] ?? ""}は${page}の節を参照してください。`);
    assert.match(worst(ja, `# 設定\n\n${plain.join("\n\n")}\n`) ?? "", /参照/u);
  });

  it("does not count a phrase a heading names, and counts one no heading names", () => {
    const body = SUBJECTS.map((subject, index) => `For ${subject}, a borrower not legally authorized to work ${TAILS[index] ?? ""}.`).join(" ");
    assert.equal(worst(en, `## Letters\n\n### Lending to a borrower not legally authorized to work\n\n${body}\n`), undefined);
    assert.match(worst(en, `## Letters\n\n### Guidance on lending\n\n${body}\n`) ?? "", /not legally authorized/u);
  });

  it("does not count a report line filled in with different numbers, and counts the same line copied verbatim", () => {
    const filled = PROJECTS.map(
      (project, index) => `## ${project}\n\nThere are currently ${String(index + 3)} committers and ${String(index + 2)} members in this project.\n`,
    );
    assert.equal(worst(en, `# Minutes\n\n${filled.join("\n")}`), undefined);
    const copied = PROJECTS.map((project) => `## ${project}\n\nThere are currently 5 committers and 4 members in this project.\n`);
    assert.notEqual(worst(en, `# Minutes\n\n${copied.join("\n")}`), undefined);
  });
});
