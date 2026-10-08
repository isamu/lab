import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { speakerWords, unnamedSpeakerQuotes } from "../packages/chaff/src/unnamed-speaker.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 名前の無い話し手の言葉を引いている（quote-unnamed-speaker）。例文はすべて自作。

const RULE = "quote-unnamed-speaker";
const PRESS = "business/press-release";
const PLANTED = join(import.meta.dirname, "fixtures", "planted", "reports");

const findingsOf = (source: string, adapter: LanguageAdapter = ja, genre = PRESS): readonly string[] =>
  namedRuleRun(RULE, source, adapter, "a.md", genre).findings;

const reported = (sentence: string, adapter: LanguageAdapter = ja): boolean => findingsOf(`${sentence}\n`, adapter).length > 0;

const linesOf = (file: string, adapter: LanguageAdapter): number[] =>
  runRules(buildDocument(file, readFileSync(join(PLANTED, file), "utf8"), adapter), loadRules(adapter.id), {}, false, PRESS)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => finding.line);

describe("quote-unnamed-speaker: 名前の無い話し手の言葉", () => {
  it("ja: 話し手が役の語だけの引用を指す", () => {
    assert.deepEqual(findingsOf("業界のアナリストは「在庫を一画面で見られる製品は、中小企業ではまだ少ない」と述べています。\n"), [
      "「在庫を一画面で見られる製品は、中小企業ではまだ少ない」の話し手が「業界のアナリスト」とだけ書かれていて、名前がありません",
    ]);
    [
      "ある専門家は「価格の改定は来年の春までに終わるだろう」と話す。",
      "業界関係者によれば「新しい規格への移行は思ったより早く進む」という。",
      "有識者からは「地方の倉庫ほど在庫の見える化が遅れている」との声があった。",
      "「地方の倉庫ほど在庫の見える化が遅れている」と、業界関係者は話す。",
      "同社の担当者は「来月から申し込みの受け付けを始める予定です」と述べた。",
      "業界関係者によると、「新しい規格への移行は思ったより早く進む」という。",
      "氏名不詳の関係者は「新しい規格への移行は思ったより早く進む」と述べた。",
    ].forEach((sentence) => assert.ok(reported(sentence), sentence));
    assert.deepEqual(findingsOf("「地方の倉庫ほど在庫の見える化が遅れている」と、業界関係者は話す。\n"), [
      "「地方の倉庫ほど在庫の見える化が遅れている」の話し手が「業界関係者」とだけ書かれていて、名前がありません",
    ]);
  });

  it("ja: 名前のある話し手、一人に決まる役、指し直し、題名の文書は見ない", () => {
    [
      "ミナトリサーチが2026年9月に公表した調査報告で、同社のアナリストの森花子氏は「在庫を一画面で見られる製品は、中小企業ではまだ少ない」と述べています。",
      "代表取締役の高橋一郎は、「2006年の創業から20年、お客様の声を聞いて改良を重ねてきました」と述べています。",
      "代表取締役社長は「2006年の創業から20年、改良を重ねてきました」と述べています。",
      "同アナリストは「中小企業向けの製品はこれから増えていくだろう」と述べた。",
      "専門家会議の報告書は「在庫の見える化は中小企業ほど遅れている」と指摘する。",
      "アナリストの報告書『在庫の今』によれば「在庫の見える化は中小企業ほど遅れている」という。",
      "業界のアナリストは「割安」と見る。",
      "業界のアナリストが注目する機能として、「倉庫ごとの在庫を一画面で見る」機能を加えた。",
    ].forEach((sentence) => assert.ok(!reported(sentence), sentence));
  });

  it("en: reports a quotation given to a role with no name", () => {
    assert.deepEqual(findingsOf('"Few products for small businesses show all their stock on one screen," said an analyst.\n', en), [
      '"Few products for small businesses show all their stock on one screen" is given to "an analyst", who is not named',
    ]);
    [
      '"Few products for small businesses show all their stock on one screen," an analyst at Minato Research said.',
      'An industry analyst said, "Few products for small businesses show all their stock on one screen."',
      'According to a source familiar with the plan, "the release will slip to the spring."',
      '"The release will slip to the spring," officials said.',
      'Industry insiders said, "the release will slip to the spring."',
      '"We expect the price to rise next year," said an Acme spokesperson.',
      'An analyst once said, "Few products for small businesses show all their stock on one screen."',
      'In Minato Research\'s report, "Few products for small businesses show all their stock on one screen," said an analyst.',
      '"The release will slip to the spring," noted an analyst.',
    ].forEach((sentence) => assert.ok(reported(sentence, en), sentence));
  });

  it("en: a named speaker, a role that is one person, a role pointing back and a role that is not the speaker are not reported", () => {
    [
      '"Few products for small businesses show all their stock on one screen," said Hanako Mori, an analyst at Minato Research, in a report the firm published in September 2026.',
      '"In the 20 years since our founding in 2006, we have kept improving the app on what our customers tell us," said Ichiro Takahashi, the president of Minato Trading.',
      '"We expect the price to rise next year," said the CEO of Acme.',
      '"We expect the price to rise next year," said industry analyst Hanako Mori.',
      '"We expect the price to rise next year," said Ms Mori, an analyst.',
      'Hanako Mori, an analyst at Minato Research, said, "few products show all their stock on one screen."',
      '"We expect the price to rise next year," the analyst said.',
      'An analyst at Minato Research, Hanako Mori, said, "few products show all their stock on one screen."',
      '"Few products for small businesses show all their stock on one screen," said Mori, an analyst at Minato Research.',
      'Mori, an analyst at Minato Research, said, "few products show all their stock on one screen."',
      '"We expect the price to rise next year," our spokesperson said.',
      'An official statement said, "the release will slip to the spring."',
      'The analysts\' report "Inventory Today" says the release will slip.',
    ].forEach((sentence) => assert.ok(!reported(sentence, en), sentence));
  });

  it("プレスリリースと報告書だけで動く", () => {
    const quote = "業界のアナリストは「在庫を一画面で見られる製品は、中小企業ではまだ少ない」と述べています。\n";
    [PRESS, "business/report"].forEach((genre) => assert.ok(firedRules(ja, quote, genre).includes(RULE), genre));
    ["blog/tech", "business/email", "academic/paper", "legal/contract", "literature/fiction"].forEach((genre) =>
      assert.ok(!firedRules(ja, quote, genre).includes(RULE), genre),
    );
  });

  it("planted reports: press:32 の名前の無いアナリストだけを指し、press:30 の社長の言葉と clean の名前のあるアナリストは見ない", () => {
    assert.deepEqual(linesOf("ja/press.planted.md", ja), [32]);
    assert.deepEqual(linesOf("en/press.planted.md", en), [32]);
    assert.deepEqual(linesOf("ja/press.clean.md", ja), []);
    assert.deepEqual(linesOf("en/press.clean.md", en), []);
  });
});

describe("unnamedSpeakerQuotes", () => {
  const words = speakerWords(
    [
      { pattern: "analyst", group: "role" },
      { pattern: "at", group: "after-role" },
      { pattern: "the", group: "anaphor" },
    ],
    [{ pattern: "said" }],
  );

  it("位置は文書の中の位置で、引用の中身と話し手を返す", () => {
    const text = '"We expect the price to rise," said an analyst.';
    assert.deepEqual(unnamedSpeakerQuotes({ start: 40, text }, words), [{ offset: 41, quote: "We expect the price to rise", speaker: "an analyst" }]);
  });

  it("役の語が無い語彙表、空の文、閉じない引用、誰にも帰していない引用は何も返さない", () => {
    assert.deepEqual(unnamedSpeakerQuotes({ start: 0, text: '"We expect the price to rise," said an analyst.' }, speakerWords([], [{ pattern: "said" }])), []);
    assert.deepEqual(unnamedSpeakerQuotes({ start: 0, text: "" }, words), []);
    assert.deepEqual(unnamedSpeakerQuotes({ start: 0, text: '"We expect the price to rise, said an analyst.' }, words), []);
    assert.deepEqual(unnamedSpeakerQuotes({ start: 0, text: 'An analyst wrote "We expect the price to rise" on the board.' }, words), []);
    assert.deepEqual(unnamedSpeakerQuotes({ start: 0, text: '"We expect the price to rise," said the analyst.' }, words), []);
  });

  it("空の語は語彙表から外す", () => {
    const blank = speakerWords([{ pattern: "", group: "role" }], [{ pattern: "" }]);
    assert.deepEqual(blank.roles, []);
    assert.deepEqual(blank.cues, []);
  });
});
