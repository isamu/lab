import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { screenLabelSpans } from "../packages/chaff/src/detectors/gram-furniture.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// ngram-repetition: a screen manual names a different button in each step and writes the step the same way
// ([許可]をクリックすると …). The words from the bracketed name on are not the writer's phrasing. Self-written text.

const JA_FILLER = Array.from({ length: 70 }, (_, index) => `項目${String(index)}の値${String(index)}。`).join("");

const worst = (source: string): string | undefined => {
  const finding = runRules(buildDocument("t.md", `${source}\n## 補足\n\n${JA_FILLER}\n`, ja), loadRules(ja.id), {}, true, "docs/manual").findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

const LABELS = ["許可", "保存", "次へ", "戻る", "申請書を開く", "添付", "送信", "閉じる"];
const KINDS = ["", "ボタン", "リンク", "", "ボタン", "", "リンク", ""];
const RESULTS = ["ログイン画面", "確認の窓", "入力欄", "一覧", "申請書", "選択の窓", "受付番号", "最初の画面"];

/** A manual of eight steps, each label written between open and close (or followed by close alone). */
const manual = (open: string, close: string): string => {
  const steps = LABELS.map((label, index) => `${open}${label}${close}${KINDS[index] ?? ""}をクリックすると${RESULTS[index] ?? ""}が出ます。`);
  return `# 申請する\n\n${steps.join("\n\n")}\n`;
};

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("ngram-repetition: the step wording after a bracketed screen label", () => {
  it("does not count the words right after a bracketed label, and counts them after unbracketed words", () => {
    assert.equal(worst(manual("[", "]")), undefined);
    assert.equal(worst(manual("［", "］")), undefined);
    assert.match(worst(manual("", "の所")) ?? "", /クリック/u);
  });
});

describe("screenLabelSpans", () => {
  it("covers a bracketed label, a katakana word after it and one particle", () => {
    assert.deepEqual(screenLabelSpans("[許可]をクリック", "char"), [{ start: 0, end: 5 }]);
    assert.deepEqual(screenLabelSpans("まず［内容を確認］リンクを押す", "char"), [{ start: 2, end: 13 }]);
    assert.deepEqual(screenLabelSpans("【氏名】に書く", "char"), [{ start: 0, end: 5 }]);
  });

  it("covers nothing without a particle right after, for a link, an empty bracket or English", () => {
    assert.deepEqual(screenLabelSpans("[許可]。", "char"), []);
    assert.deepEqual(screenLabelSpans("[許可](https://example.com)を見る", "char"), []);
    assert.deepEqual(screenLabelSpans("[]を押す", "char"), []);
    assert.deepEqual(screenLabelSpans("", "char"), []);
    assert.deepEqual(screenLabelSpans("[Save]を押す", "word"), []);
  });
});
