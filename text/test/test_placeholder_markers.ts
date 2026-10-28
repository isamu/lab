import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { placeholderSpans } from "../packages/chaff/src/detectors/placeholder-text.ts";
import { TEMPLATE, namesTemplate, templateSections } from "../packages/chaff/src/detectors/template-sections.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Level } from "../packages/chaff/src/plugin.ts";
import { entriesForGenre } from "../packages/chaff/src/lexicon-genres.ts";

// unfilled-placeholder reads a value left as a note to fill in later (TBD: …, TBD, 未定, （ここに…を書く）) as a blank,
// and a level sets how a blank is marked: one blank is already one too many, so there is no count to set.

const enWords = en.lexicons["placeholder-word"] ?? [];
const jaWords = ja.lexicons["placeholder-word"] ?? [];

const matched = (text: string, words: typeof enWords): string[] => placeholderSpans(text, words).map((span) => text.slice(span.start, span.end));

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("placeholderSpans: a value left as a marker", () => {
  const blanks: readonly (readonly [string, string, string])[] = [
    ["TODO: add expected output pattern", "TODO: add expected output pattern", "a TODO before a colon, to the end of the value"],
    ['"TODO: add expected output pattern"', "TODO: add expected output pattern", "the same in quotes"],
    ["TBD", "TBD", "a marker that is the whole value"],
    ["TBD.", "TBD", "with a closing stop"],
    ["(TBD)", "TBD", "in parentheses"],
    ["[TODO]", "TODO", "in brackets"],
    ["FIXME: owner", "FIXME: owner", "FIXME"],
    ["TBC", "TBC", "TBC"],
    ["todo: rename the file", "todo: rename the file", "a lowercase TODO before a colon"],
    ["Tbd", "Tbd", "a marker in another case"],
  ];
  blanks.forEach(([text, expected, label]) => {
    it(`finds ${label}`, () => {
      assert.deepEqual(matched(text, enWords), [expected]);
    });
  });

  const japanese: readonly (readonly [string, string])[] = [
    ["未定", "未定"],
    ["「未定」", "未定"],
    ["TODO：議題を書く", "TODO：議題を書く"],
    ["要記入", "要記入"],
    ["TBC：日程を書く", "TBC：日程を書く"],
    ["未記入。", "未記入"],
    ["「未定 」", "未定"],
  ];
  japanese.forEach(([text, expected]) => {
    it(`finds 「${text}」`, () => {
      assert.deepEqual(matched(text, jaWords), [expected]);
    });
  });

  const notBlanks: readonly (readonly [string, typeof enWords, string])[] = [
    ["We use a todo app.", enWords, "a lowercase word in a sentence"],
    ["TODOs remain in the code.", enWords, "a longer word that starts with the marker"],
    ["The date is TBD.", enWords, "a marker inside a sentence"],
    ["TODO lists help.", enWords, "a marker that opens a sentence without a colon"],
    ["[ ] TODO: write the tests", enWords, "a checklist task"],
    ["// TODO: not prose", enWords, "a code comment"],
    ["# FIXME: later", enWords, "a hash comment"],
    ["日程は未定です。", jaWords, "「未定」 in a sentence"],
    ["未定の項目を確認します。", jaWords, "「未定」 opening a sentence"],
    ["", enWords, "an empty text"],
  ];
  notBlanks.forEach(([text, words, label]) => {
    it(`does not find ${label}`, () => {
      assert.deepEqual(matched(text, words), []);
    });
  });

  it("finds one blank per line when values run a line apart", () => {
    assert.deepEqual(matched("TODO: add owner\nTBD: add date", enWords), ["TODO: add owner", "TBD: add date"]);
    assert.deepEqual(matched("Owner: Kim\nTBD", enWords), ["TBD"]);
  });

  it("finds nothing without marker words", () => {
    assert.deepEqual(
      matched(
        "TODO: add it",
        enWords.filter((word) => word.group === undefined),
      ),
      [],
    );
  });
});

describe("placeholderSpans: a note to the writer in parentheses", () => {
  it("finds （ここに…を書く）", () => {
    assert.deepEqual(matched("（ここに会社名を書く）の田中です。", jaWords), ["（ここに会社名を書く）"]);
    assert.deepEqual(matched("(ここに日付を入れる)", jaWords), ["(ここに日付を入れる)"]);
  });

  it("does not read other parentheses as blanks, even with a bracket word inside", () => {
    assert.deepEqual(matched("詳しくは（担当者に確認）してください。", jaWords), []);
    assert.deepEqual(matched("Send it to us (your name and date) by Friday.", enWords), []);
  });

  it("keeps the bracket forms as they were", () => {
    assert.deepEqual(matched("Dear [Your Name],", enWords), ["[Your Name]"]);
    assert.deepEqual(matched("【会社名】の田中です。", jaWords), ["【会社名】"]);
    assert.deepEqual(matched("【氏名】山田", jaWords), []);
  });
});

const findings = (source: string, adapter: LanguageAdapter, path = "t.md", level?: Level) =>
  runRules(
    buildDocument(path, source, adapter),
    loadRules(adapter.id),
    level === undefined ? {} : { "unfilled-placeholder": level },
    true,
    "blog/tech",
  ).findings.filter((finding) => finding.rule === "unfilled-placeholder");

describe("unfilled-placeholder on a document", () => {
  it("reports a TODO value in a list and leaves a checklist task and code alone", () => {
    const source = [
      "# Fixture notes",
      "",
      "- TODO: add expected output pattern",
      "- [ ] TODO: write the tests",
      "- The date is TBD.",
      "",
      "```js",
      "// TODO: not prose",
      "```",
      "",
    ].join("\n");
    const found = findings(source, en);
    assert.deepEqual(
      found.map((finding) => [finding.line, finding.column]),
      [[3, 3]],
    );
  });

  it("leaves comments in a plain-text file alone", () => {
    const source = "Release notes.\n\n# TODO: a comment\n\n// FIXME: a comment\n\n<!-- TBD -->\n";
    assert.deepEqual(findings(source, en, "notes.txt"), []);
  });

  it("reports 未定 as a whole value and （ここに…を書く）, not 未定 in a sentence", () => {
    const source = "# 会議の案内\n\n日程は未定です。\n\n- 未定\n- （ここに会社名を書く）の田中です。\n";
    assert.deepEqual(
      findings(source, ja).map((finding) => finding.line),
      [5, 6],
    );
  });

  it("reports a single blank: there is no count to reach", () => {
    assert.equal(findings("# Letter\n\nDear [Your Name],\n", en).length, 1);
  });

  const marks: readonly (readonly [Level, string])[] = [
    ["strict", "error"],
    ["normal", "warning"],
    ["relaxed", "info"],
  ];
  marks.forEach(([level, severity]) => {
    it(`marks a blank ${severity} at ${level}`, () => {
      assert.deepEqual(
        findings("# Notes\n\nTBD\n", en, "t.md", level).map((finding) => finding.severity),
        [severity],
      );
    });
  });

  it("does not run at off", () => {
    assert.deepEqual(findings("# Notes\n\nTBD\n", en, "t.md", "off"), []);
  });
});

describe("namesTemplate: a heading that says the section is a template", () => {
  const enTemplate = enWords.filter((word) => word.group === TEMPLATE);
  const jaTemplate = jaWords.filter((word) => word.group === TEMPLATE);
  const named: readonly (readonly [string, typeof enWords])[] = [
    ["Template", enTemplate],
    ["Download this template", enTemplate],
    ["Letter templates", enTemplate],
    ["Sample letter: notice of a hearing", enTemplate],
    ["退職届の雛形", jaTemplate],
    ["見積書のテンプレート", jaTemplate],
    ["申請書の記入例", jaTemplate],
  ];
  named.forEach(([heading, words]) => {
    it(`reads "${heading}" as a template`, () => {
      assert.equal(namesTemplate(heading, words), true);
    });
  });
  const unnamed: readonly (readonly [string, typeof enWords])[] = [
    ["Templated reports", enTemplate],
    ["Model risk", enTemplate],
    ["Notice of a hearing", enTemplate],
    ["", enTemplate],
    ["Template", []],
    ["見積もりのご案内", jaTemplate],
  ];
  unnamed.forEach(([heading, words]) => {
    it(`does not read "${heading}" as a template`, () => {
      assert.equal(namesTemplate(heading, words), false);
    });
  });
});

describe("templateSections: where a template heading reaches", () => {
  const words = enWords.filter((word) => word.group === TEMPLATE);
  const heading = (depth: number, text: string, start: number) => ({ depth, text, start, end: start + text.length });
  it("runs to the next heading at its depth or above, past deeper ones", () => {
    const headings = [heading(1, "Guide", 0), heading(2, "Template", 10), heading(3, "Body", 30), heading(2, "Reply", 50)];
    assert.deepEqual(templateSections(headings, 80, words), [{ start: 10, end: 50 }]);
  });
  it("covers the whole document under a template title", () => {
    assert.deepEqual(templateSections([heading(1, "Sample letter", 0), heading(2, "Body", 20)], 60, words), [{ start: 0, end: 60 }]);
  });
  it("finds nothing without headings or without template words", () => {
    assert.deepEqual(templateSections([], 60, words), []);
    assert.deepEqual(templateSections([heading(1, "Template", 0)], 60, []), []);
  });
});

describe("unfilled-placeholder in a table", () => {
  const table = ["# Status", "", "| Issue | Owner |", "| --- | --- |", "| Docs are late | [Name] |", "| Tests are slow | Dana |", ""].join("\n");

  it("reports a blank left in a cell", () => {
    assert.deepEqual(
      findings(table, en).map((finding) => finding.line),
      [5],
    );
  });

  it("leaves a cell whose text only looks like a blank alone", () => {
    assert.deepEqual(findings(table.replace("[Name]", "[the docs](https://example.com/docs)"), en), []);
    assert.deepEqual(findings(table.replace("[Name]", "a todo app"), en), []);
  });

  it("leaves a blank in a table under a template heading alone", () => {
    assert.deepEqual(findings(table.replace("# Status", "# Status template"), en), []);
  });
});

describe("unfilled-placeholder in a template", () => {
  it("leaves the blanks under a Template heading alone", () => {
    const source = [
      "# Notice of a meeting",
      "",
      "A letter to invite a worker to a meeting. Copy it into an email.",
      "",
      "## Template",
      "",
      "Dear [name of worker]",
      "",
      "Please come to a meeting on [date] in [location].",
      "",
      "### Signature",
      "",
      "[name of manager]",
      "",
    ].join("\n");
    assert.deepEqual(findings(source, en), []);
  });

  it("still reports a blank outside the template section", () => {
    const source = ["# Guide", "", "## Template", "", "Dear [Your Name],", "", "## Our reply", "", "We will call on [Insert Date].", ""].join("\n");
    assert.deepEqual(
      findings(source, en).map((finding) => finding.line),
      [9],
    );
  });

  it("still reports a blank written before a template title", () => {
    assert.deepEqual(
      findings("Sent by [Your Name].\n\n# Sample letter\n\nDear [name of worker]\n", en).map((finding) => finding.line),
      [1],
    );
  });

  it("still reports a forgotten blank in a letter whose headings name no template", () => {
    const source = "# Templated reports\n\nDear [Your Name],\n\nThe report is attached.\n";
    assert.equal(findings(source, en).length, 1);
  });

  it("leaves the blanks of a document titled 雛形 alone, and reports one in a real letter", () => {
    assert.deepEqual(findings("# 退職届の雛形\n\n【氏名】の退職届です。\n", ja), []);
    assert.equal(findings("# 見積もりのご案内\n\n【会社名】の田中です。\n", ja).length, 1);
  });
});

describe("placeholderSpans: a template's instruction label left in the text", () => {
  it("finds a capitalised OPTIONAL label opening a line before a colon and text", () => {
    assert.deepEqual(matched("OPTIONAL: General conclusions (bullet points or narrative)", enWords), [
      "OPTIONAL: General conclusions (bullet points or narrative)",
    ]);
    assert.deepEqual(matched("Went well.\nOPTIONAL: (Use bullet points) for example: monitoring caught it", enWords), [
      "OPTIONAL: (Use bullet points) for example: monitoring caught it",
    ]);
  });

  it("does not find the word in another case, inside a sentence, without a colon, or with nothing after the colon", () => {
    assert.deepEqual(matched("Optional: bring a jacket for the evening walk", enWords), []);
    assert.deepEqual(matched("The second step is OPTIONAL: skip it if short of time", enWords), []);
    assert.deepEqual(matched("OPTIONAL fields are marked with a star", enWords), []);
    assert.deepEqual(matched("OPTIONAL:", enWords), []);
    assert.deepEqual(matched("OPTIONALLY: add a note", enWords), []);
  });

  it("is reported in a report whose sections are filled", () => {
    const source = [
      "# Outage of 3 May",
      "",
      "## What went well?",
      "",
      "- The alert fired within a minute.",
      "",
      "OPTIONAL: (Use bullet points) for example: automated monitoring detected the incident",
      "",
    ].join("\n");
    assert.deepEqual(
      findings(source, en).map((finding) => finding.line),
      [7],
    );
  });
});

describe("placeholderSpans: blank marks (〇〇) where a letter needs a name, a sum or a date", () => {
  const letterWords = entriesForGenre(jaWords, "business/email");
  const blanks: readonly (readonly [string, readonly string[], string])[] = [
    ["〇〇様", ["〇〇様"], "the addressee line"],
    ["株式会社〇〇", ["〇〇"], "a company name"],
    ["お疲れさまです。総務部の〇〇です。", ["〇〇"], "the sender's name after the department"],
    ["営業部　〇〇", ["〇〇"], "a signature after the department"],
    ["〇〇", ["〇〇"], "a signature line holding only the blank"],
    ["月額〇万円程度を想定しています。", ["〇万円"], "a sum"],
    ["実施期間：2026年〇月〇日〜〇月〇日", ["〇月〇日", "〇月〇日"], "two dates, each one blank"],
    ["回収には〇か月程度かかります。", ["〇か月"], "a period"],
    ["株式会社△△の山田です。", ["△△"], "a triangle blank"],
    ["〇万円程度を想定しています。", ["〇万円"], "a sum at the head of a line"],
    ["〇月〇日に開きます。", ["〇月〇日"], "a date at the head of a line"],
    ["所属：営業部　氏名：〇〇", ["〇〇"], "a field whose value is the blank"],
    ["報告者：〇〇", ["〇〇"], "a field at the head of a line"],
    ["総務部長 〇〇", ["〇〇"], "a name after a title and a space"],
    ["代表取締役 〇〇 〇〇", ["〇〇 〇〇"], "a family and a given name after a title, as one blank"],
    ["新電話番号：03-〇〇〇〇-〇〇〇〇", ["〇〇〇〇-〇〇〇〇"], "the groups of a phone number, as one blank"],
    ["〒〇〇〇-〇〇〇〇　東京都〇〇区", ["〇〇〇-〇〇〇〇", "〇〇区"], "a postcode and a ward, a filled word between them"],
    ["〇丁目〇番〇号 〇〇ビル5階", ["〇丁目〇番〇号 〇〇ビル"], "a street number and a building, as one blank"],
    ["東京都〇〇区〇〇 〇丁目〇番〇号", ["〇〇区〇〇 〇丁目〇番〇号"], "a whole address, as one blank"],
    ["TEL：〇〇-〇〇〇〇-〇〇〇〇", ["〇〇-〇〇〇〇-〇〇〇〇"], "a phone number of blanks only, as one blank"],
    ["株式会社〇〇の〇〇様", ["〇〇", "〇〇様"], "two blanks a filled word separates"],
    ["株式会社〇〇\n〇〇部　〇〇", ["〇〇", "〇〇部　〇〇"], "blanks on two lines stay two"],
    ["〇〇大学 経営学部", ["〇〇大学"], "a university"],
    ["本社のある〇〇市で開く大会です。", ["〇〇市"], "a city"],
  ];
  blanks.forEach(([text, expected, label]) => {
    it(`finds ${label}`, () => {
      assert.deepEqual(matched(text, letterWords), expected);
    });
  });

  const examples: readonly (readonly [string, string])[] = [
    ["新しい部署名は○○の後に決めます。", "marks with no name, sum or date word beside them"],
    ["「○○さんが違う考え方をしていたよ」と声を掛けています。", "an example person"],
    ["○日本に支店等を設けていない場合", "a bullet mark at the line head"],
    ["○月曜日は休業します", "a bullet before a word that starts with a unit"],
    ["二〇二六年一〇月一日に開きます。", "a kanji numeral zero"],
    ["○　注意事項", "a bullet before a heading word"],
    ["○様式は別紙のとおり", "one mark is a bullet, not a name"],
    ["名前は〇〇で、あとで決めます。", "a blank mid-sentence with no field before it"],
    ["〇〇 の後ろに説明を書きます。", "a blank before more text on its line"],
    ["期限：〇〇までに決める", "a field whose value goes on after the blank"],
  ];
  examples.forEach(([text, label]) => {
    it(`does not find ${label}`, () => {
      assert.deepEqual(matched(text, letterWords), []);
    });
  });

  it("counts the positions only where the word list says they hold", () => {
    assert.deepEqual(matched("〇〇様", entriesForGenre(jaWords, "blog/essay")), []);
    assert.deepEqual(matched("月額〇万円", entriesForGenre(jaWords, "legal/contract")), []);
  });
});

describe("unfilled-placeholder: a blank mark in a letter, and the same mark as an example", () => {
  const findingsIn = (source: string, genre: string) =>
    runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, genre).findings.filter((finding) => finding.rule === "unfilled-placeholder");
  const letter = ["株式会社〇〇", "〇〇様", "", "いつもお世話になっております。営業部の〇〇です。", "", "営業部　〇〇", ""].join("\n");

  it("reports the addressee, the sender and the signature of a letter", () => {
    assert.deepEqual(
      findingsIn(letter, "business/email").map((finding) => finding.line),
      [1, 2, 4, 6],
    );
  });

  it("leaves the same marks alone outside business documents, where 〇〇 is an example", () => {
    assert.deepEqual(findingsIn(letter, "blog/tech"), []);
    assert.deepEqual(findingsIn("出典を記載し、○○株式会社作成などと明記してください。\n", "legal/contract"), []);
    assert.deepEqual(findingsIn("申請書には「○○株式会社」のように正式な名前を書きます。\n", "docs/manual"), []);
  });

  it("reports a blank left in a table cell, and leaves a filled table alone", () => {
    const table = ["# 出張報告", "", "| 作業 | 担当 |", "| --- | --- |", "| 見積もりの確認 | 〇〇 |", "| 回答 | 山田 |", ""].join("\n");
    assert.deepEqual(
      findingsIn(table, "business/report").map((finding) => finding.line),
      [5],
    );
    assert.deepEqual(findingsIn(table.replace("〇〇", "佐藤"), "business/report"), []);
    assert.deepEqual(findingsIn(table, "blog/tech"), []);
  });

  it("leaves a business document whose blanks are filled alone", () => {
    const filled = ["株式会社山田商事", "佐藤様", "", "いつもお世話になっております。営業部の田中です。", "", "営業部　田中", ""].join("\n");
    assert.deepEqual(findingsIn(filled, "business/email"), []);
  });
});
