import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { itemTitles } from "../packages/chaff/src/detectors/gram-openers.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// ngram-repetition: numbered item titles in a notice of amendments repeat one frame by design
// (（1）芸術の振興に係る規定に関する改正（第8条関係）, （2）…に係る規定に関する改正). A phrase found only in those titles
// is the titles' template, not the writer repeating. Self-written text.

const FIELDS = ["音楽", "演劇", "舞踊", "美術", "写真", "映画", "工芸", "書道"];
const FRAME = "の振興に係る規定に関する改正";

const worst = (source: string): string | undefined => {
  const finding = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, "business/email").findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

const filler = Array.from({ length: 30 }, (_, index) => `項目${String(index)}の値${String(index)}。`).join("");

const itemOf = (field: string, index: number, body: string): string => `- （${String(index + 1)}）${field}${FRAME}（第${String(index + 8)}条関係）\n\n${body}`;

const notice = (body: (field: string, index: number) => string): string => {
  const items = FIELDS.map((field, index) => itemOf(field, index, body(field, index))).join("\n\n");
  return `# 改正の概要\n\n${filler}\n\n${items}\n`;
};

const BODIES = [
  "公演の記録を残す。",
  "稽古場を貸し出す。",
  "若い踊り手を育てる。",
  "展示室を広げた。",
  "古い写真を直す。",
  "上映会を開く。",
  "職人の技を伝える。",
  "筆と墨を配る。",
];

const TITLES = ["（1）音楽の振興（第8条関係）", "1．目的", "第2 定義", "③ 手続"];

const titlesIn = (source: string): string[] => {
  const doc = buildDocument("t.md", source, ja);
  return itemTitles(doc.sentences, doc.source).map((sentence) => sentence.text.trim());
};

describe("ngram-repetition: numbered item titles", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("does not count a frame that only the numbered titles repeat", () => {
    assert.equal(worst(notice((_, index) => BODIES[index] ?? "")), undefined);
  });

  it("still counts the frame when the body repeats it too", () => {
    assert.notEqual(worst(notice((field) => `${field}${FRAME}を行い、支援を加えた。`)), undefined);
  });

  it("reads a numbered line without a period as a title", () => {
    assert.deepEqual(titlesIn(TITLES.map((title) => `${title}\n\n本文。`).join("\n\n")), TITLES);
  });

  it("reads a title after an ordered list marker", () => {
    assert.deepEqual(titlesIn("1. （1）目的\n\n本文。\n\n2. （2）範囲\n\n本文。\n"), ["（1）目的", "（2）範囲"]);
  });

  it("does not read a decimal, or numbered items one after another, as titles", () => {
    assert.deepEqual(titlesIn("3.14 kg\n\n本文。\n"), []);
    assert.deepEqual(titlesIn("（1）申請書を提出する\n（2）申請書を確認する\n（3）結果を伝える\n\n本文。\n"), ["（3）結果を伝える"]);
  });

  it("does not read a sentence, an unnumbered line or a line that goes on as a title", () => {
    assert.deepEqual(titlesIn("（1）音楽の振興を図る。\n\n音楽の振興\n\n本文。（2）続き\n"), []);
  });
});
