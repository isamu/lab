import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { placeholderSpans } from "../packages/chaff/src/detectors/placeholder-text.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Level } from "../packages/chaff/src/plugin.ts";

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
