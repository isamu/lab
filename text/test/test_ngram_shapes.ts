import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { entryOpeners, nounFragments } from "../packages/chaff/src/detectors/gram-openers.ts";
import { fieldLabelSpans, quotedSpans } from "../packages/chaff/src/detectors/gram-furniture.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// ngram-repetition: repeats that are the document's form, not the writer saying the same thing again — a reference
// page's entries, a table's cells, the title's subject, a quoted title, a defined term, items listed in one sentence,
// field labels a converter kept, and an acronym the tagger reads as a verb. Each is checked both ways. Self-written text.

const worst = (adapter: LanguageAdapter, source: string, genre = "business/report"): string | undefined => {
  const finding = runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

const JA_FILLER = Array.from({ length: 70 }, (_, index) => `項目${String(index)}の値${String(index)}。`).join("");
const EN_FILLER = Array.from({ length: 40 }, (_, index) => `Item ${String(index)} holds value ${String(index * 3)} today.`).join(" ");

const KEYS = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
const THINGS = ["画像", "音声", "動画", "文字", "表計算", "図面", "地図", "楽譜"];

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("ngram-repetition: a reference page's entries", () => {
  const entries = (heading: (key: string) => string): string =>
    [
      `# 設定の一覧\n\n${JA_FILLER}`,
      ...KEYS.map(
        (key, index) => `## ${heading(key)}\n\n${THINGS[index] ?? ""}の読み込みを許すことを示します。値は一つです。\n\n既定値は${String(index)}です。`,
      ),
    ].join("\n\n");

  it("does not count the formula each identifier-headed entry opens with", () => {
    assert.equal(
      worst(
        ja,
        entries((key) => `\`${key}\``),
        "technical/spec",
      ),
      undefined,
    );
    assert.equal(
      worst(
        ja,
        entries((key) => `【${key}】`),
        "technical/spec",
      ),
      undefined,
    );
  });

  it("still counts it under a bracketed label that each case repeats (【アドバイス等】)", () => {
    assert.notEqual(worst(ja, entries(() => "【アドバイス等】"), "technical/spec"), undefined);
  });

  it("still counts it under headings written as prose", () => {
    assert.notEqual(
      worst(
        ja,
        entries((key) => `${key}の設定について`),
        "technical/spec",
      ),
      undefined,
    );
  });

  it("does not count the formula of a definition list", () => {
    const list = KEYS.map((key, index) => `- \`${key}\`\n  - : ${THINGS[index] ?? ""}のための有効なソースを指定します。`).join("\n");
    assert.equal(worst(ja, `# 指令\n\n${JA_FILLER}\n\n${list}\n`, "technical/spec"), undefined);
    const prose = KEYS.map((_, index) => `${THINGS[index] ?? ""}のための有効なソースを指定します。`).join("");
    assert.notEqual(worst(ja, `# 指令\n\n${JA_FILLER}\n\n${prose}\n`, "technical/spec"), undefined);
  });

  it("reads the entry's whole first paragraph and nothing after it", () => {
    const source = "## `a`\n\n一つ目。二つ目。\n\n三つ目。\n\n- b\n  - : 定義。続き。\n";
    const doc = buildDocument("t.md", source, ja);
    assert.deepEqual(
      entryOpeners(doc.sections, doc.source).map((sentence) => sentence.text.trim()),
      ["一つ目。", "二つ目。", ": 定義。", "続き。"],
    );
  });
});

describe("ngram-repetition: a table's cells", () => {
  const ROWS = ["仮登録", "本登録", "変更", "削除", "再発行", "停止", "再開", "解約"];

  it("does not count a noun phrase that stands on its own line", () => {
    const cells = ROWS.map((row) => `${row}の画面で入力されたメールアドレス\n\n${row}の案内を送る。`).join("\n\n");
    assert.equal(worst(ja, `# 送信するメール\n\n${JA_FILLER}\n\n${cells}\n`), undefined);
  });

  it("still counts the phrase in sentences", () => {
    const sentences = ROWS.map((row) => `${row}の画面で入力されたメールアドレスに案内を送る。`).join("\n\n");
    assert.notEqual(worst(ja, `# 送信するメール\n\n${JA_FILLER}\n\n${sentences}\n`), undefined);
  });

  it("is a line without a full stop that ends in a noun", () => {
    const doc = buildDocument("t.md", "入力されたメールアドレス\n\n入力されたメールアドレスに送る。\n\n案内を送る\n", ja);
    assert.deepEqual(
      nounFragments(doc.sentences, doc.source).map((sentence) => sentence.text.trim()),
      ["入力されたメールアドレス"],
    );
  });
});

describe("ngram-repetition: names the document gives", () => {
  const LAWS = ["国家公務員法等", "地方公務員法", "雇用保険法等", "所得税法等", "介護保険法", "国民年金法等", "児童福祉法", "労働基準法"];

  const ENACTED = ["施行", "公布", "可決", "成立", "提出", "審議", "改正", "廃止"];

  it("does not count the words of a title the document quotes", () => {
    const quoted = LAWS.map((law, index) => `「${law}の一部を改正する法律」が令和${String(index + 1)}年に${ENACTED[index] ?? ""}。`).join("");
    assert.equal(worst(ja, `# 制度の動き\n\n${JA_FILLER}\n\n${quoted}\n`), undefined);
    const unquoted = LAWS.map((law, index) => `${law}の一部を改正する法律が令和${String(index + 1)}年に${ENACTED[index] ?? ""}。`).join("");
    assert.notEqual(worst(ja, `# 制度の動き\n\n${JA_FILLER}\n\n${unquoted}\n`), undefined);
  });

  it("does not count a term the document defines", () => {
    const uses = Array.from({ length: 7 }, (_, index) => `改正後の届出を出す法律の規定により、手続${String(index)}を進めた。`).join("");
    const defined = `この制度（以下「改正後の届出を出す法律」という。）を定めた。${uses}`;
    assert.equal(worst(ja, `# 手続\n\n${JA_FILLER}\n\n${defined}\n`), undefined);
    assert.notEqual(worst(ja, `# 手続\n\n${JA_FILLER}\n\n${uses}\n`), undefined);
  });

  it("does not count a phrase in the document's title", () => {
    const after = ["際は", "ことで", "前に", "ときは", "場合", "には", "上で"];
    const body = after.map((word, index) => `作品${String(index)}にライセンスを付与する${word}、権利者${String(index)}に確かめる。`).join("");
    assert.equal(worst(ja, `# ライセンスを付与する際の留意事項\n\n${JA_FILLER}\n\n${body}\n`), undefined);
    assert.notEqual(worst(ja, `# 権利の扱い\n\n${JA_FILLER}\n\n${body}\n`), undefined);
  });

  it("reads 「」 and 『』 as quoted", () => {
    assert.deepEqual(quotedSpans("「甲」と『乙』と丙"), [
      { start: 0, end: 3 },
      { start: 4, end: 7 },
    ]);
    assert.deepEqual(quotedSpans("「閉じない"), []);
    assert.deepEqual(quotedSpans(""), []);
  });
});

describe("ngram-repetition: items listed in one sentence", () => {
  const YEARS = Array.from({ length: 8 }, (_, index) => `平成${String(index + 20)}年度に指定が解除された区域${String(index)}`);

  it("counts a phrase once for the sentence that lists it", () => {
    assert.equal(worst(ja, `# 区域\n\n${JA_FILLER}\n\n対象は、${YEARS.join("、")}である。\n`), undefined);
  });

  it("still counts it across sentences", () => {
    const sentences = YEARS.map((year) => `対象は${year}である。`).join("");
    assert.notEqual(worst(ja, `# 区域\n\n${JA_FILLER}\n\n${sentences}\n`), undefined);
  });
});

describe("ngram-repetition: English field labels and acronyms", () => {
  it("does not count a field label a converter kept on each reference", () => {
    const references = Array.from(
      { length: 8 },
      (_, index) => `- Author ${String(index)}. A study of things. External Links: Document Cited by: footnote ${String(index)}.`,
    ).join("\n");
    assert.equal(worst(en, `# Paper\n\n${EN_FILLER}\n\n${references}\n`, "academic/paper"), undefined);
  });

  it("still counts a lead-in of three words or more", () => {
    const sections = KEYS.slice(0, 7)
      .map((key) => `## ${key}\n\nFollow these guidelines: keep the ${key} room quiet and the door shut.`)
      .join("\n\n");
    assert.notEqual(worst(en, `# Meetings\n\n${EN_FILLER}\n\n${sections}\n`), undefined);
  });

  it("reads one or two capitalised words before a colon and a value as a label", () => {
    assert.deepEqual(fieldLabelSpans("External Links: Document Cited by: footnote 2.", "word").length, 2);
    assert.deepEqual(fieldLabelSpans("Follow these guidelines: be quiet.", "word"), []);
    assert.deepEqual(fieldLabelSpans("Note:", "word"), []);
    assert.deepEqual(fieldLabelSpans("備考: 値", "char"), []);
  });

  it("does not read an acronym as the predicate of a term", () => {
    const uses = Array.from(
      { length: 8 },
      (_, index) => `Study ${String(index)} measured trust in extended AI assistant deployment across ${String(index + 2)} sites.`,
    ).join(" ");
    assert.equal(worst(en, `# Trust\n\n${EN_FILLER}\n\n${uses}\n`, "academic/paper"), undefined);
  });

  it("does not let one misread occurrence make a term a phrasing", () => {
    const uses = [
      "Residents described potential adverse health effects they believe began after the move.",
      "Clinics logged potential adverse health effects in a shared form.",
      "The survey asked when potential adverse health effects first appeared.",
      "Doctors compared potential adverse health effects across two regions.",
      "Nurses recorded potential adverse health effects at each visit.",
      "Families reported potential adverse health effects to the county office.",
      "The panel reviewed potential adverse health effects in older adults.",
    ].join(" ");
    assert.equal(worst(en, `# Request\n\n${EN_FILLER}\n\n${uses}\n`, "business/proposal"), undefined);
  });

  it("still counts a phrase with a verb", () => {
    const uses = Array.from({ length: 8 }, (_, index) => `In study ${String(index)} we listen to our customers closely.`).join(" ");
    assert.notEqual(worst(en, `# Trust\n\n${EN_FILLER}\n\n${uses}\n`, "academic/paper"), undefined);
  });
});

describe("ngram-repetition: a record's and a form's fixed closing lines", () => {
  const ITEMS = ["予算の方針", "施設の計画", "人事の方針", "広報の計画", "防災の計画", "交通の方針", "福祉の計画", "教育の方針"];

  it("does not count the result line of each agenda item", () => {
    const minutes = ITEMS.map((item, index) => `## (${String(index + 1)}) ${item}\n\n（資料${String(index + 1)}）\n\n${item}について、報告があった。`).join(
      "\n\n",
    );
    assert.equal(worst(ja, `# 会議録\n\n${JA_FILLER}\n\n${minutes}\n`, "business/meeting-notes"), undefined);
    const decided = ITEMS.map((item, index) => `## (${String(index + 1)}) ${item}\n\n（資料${String(index + 1)}）\n\n原案のとおり決定する。`).join("\n\n");
    assert.equal(worst(ja, `# 会議録\n\n${JA_FILLER}\n\n${decided}\n`, "business/meeting-notes"), undefined);
  });

  it("does not count a manual's step result or a consultation's request", () => {
    const steps = ITEMS.map((item) => `${item}の画面が表示されます。`).join("\n\n");
    assert.equal(worst(ja, `# 操作\n\n${JA_FILLER}\n\n${steps}\n`, "docs/manual"), undefined);
    const asks = ITEMS.map((item) => `${item}の在り方について検討をお願いします。`).join("\n\n");
    assert.equal(worst(ja, `# 諮問\n\n${JA_FILLER}\n\n${asks}\n`, "business/proposal"), undefined);
  });

  it("still counts another repeated ending", () => {
    const pledges = ITEMS.map((item) => `${item}の改善に全力で取り組んでまいります。`).join("\n\n");
    assert.notEqual(worst(ja, `# 方針\n\n${JA_FILLER}\n\n${pledges}\n`, "business/report"), undefined);
  });
});
