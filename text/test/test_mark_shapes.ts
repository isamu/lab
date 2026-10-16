import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { enumeratorBracketOffsets, formsOf, isShouting, lowerCaseWords, partialForms } from "../packages/chaff/src/detectors/mark-shape.ts";
import { captionsOf, isCaptionAt } from "../packages/chaff/src/detectors/caps-caption.ts";

// Marks and shapes: quote-style-consistency, bracket-width-consistency, exclamation-width-consistency,
// sentence-spacing-consistency, hyphen-as-dash, latin-abbreviation-form, all-caps-shouting. Every example is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (rule: string, source: string, adapter: LanguageAdapter = en): readonly string[] => namedRuleRun(rule, source, adapter).findings;

describe("formsOf: the two ways of each mark, from the lexicon", () => {
  it("a straight mark shared by two curly ones has both as its other way", () => {
    const forms = formsOf([
      { pattern: "“", instead_of: '"', group: "double" },
      { pattern: "”", instead_of: '"', group: "double" },
    ]);
    assert.deepEqual(forms.get('"'), { kind: "double", side: false, other: "“”" });
    assert.deepEqual(forms.get("“"), { kind: "double", side: true, other: '"' });
  });
});

describe("quote-style-consistency", () => {
  const RULE = "quote-style-consistency";

  it("the less common form is reported, each kind on its own", () => {
    const source = 'The "draft" is ready. The "final" is due. The “review” is next.\n';
    assert.deepEqual(findingsOf(RULE, source), [
      'The quote mark “ here, where the document usually writes " (2 of 6)',
      'The quote mark ” here, where the document usually writes " (2 of 6)',
    ]);
  });

  it("a document written both ways gets one finding with both counts", () => {
    const source = `${'The "a" one. '.repeat(6)}${"The “b” one. ".repeat(3)}\n`;
    assert.deepEqual(findingsOf(RULE, source), ["Quote marks are written two ways in this document (6 curly, 12 straight)"]);
  });

  it("a closing quote after a period is counted", () => {
    assert.deepEqual(findingsOf(RULE, 'The “draft.” is ready. The “final.” is due. The “review." is next.\n'), [
      'The quote mark " here, where the document usually writes “” (1 of 6)',
    ]);
  });

  it("one form throughout, or apostrophes apart from double quotes, is not reported", () => {
    assert.deepEqual(findingsOf(RULE, "The “draft” is ready. The “final” is due. The team’s plan holds.\n"), []);
    assert.deepEqual(findingsOf(RULE, 'The "draft" is ready. The "final" is due. The team’s plan holds.\n'), []);
  });
});

describe("bracket-width-consistency", () => {
  const RULE = "bracket-width-consistency";

  it("日本語の字に接する半角の括弧が少なければ、それを言う", () => {
    const source = "会議（定例）は月曜です。報告（月次）は金曜です。資料(最新版)を配ります。\n";
    assert.deepEqual(findingsOf(RULE, source, ja), [
      "括弧を「(」と書いています（この文書はふつう「（」。6 箇所のうち 2 箇所が違う）",
      "括弧を「)」と書いています（この文書はふつう「）」。6 箇所のうち 2 箇所が違う）",
    ]);
  });

  it("文頭の番号の括弧（(1）、(2）も、前の文の字に接していれば数える", () => {
    const source = "会議（定例）は月曜です。報告（月次）は金曜です。(1）案を出す。(2）表を出す。\n";
    assert.deepEqual(findingsOf(RULE, source, ja), [
      "括弧を「(」と書いています（この文書はふつう「（」。8 箇所のうち 2 箇所が違う）",
      "括弧を「(」と書いています（この文書はふつう「（」。8 箇所のうち 2 箇所が違う）",
    ]);
  });

  it("英字に挟まれた括弧と、鉤括弧の中は数えない", () => {
    assert.deepEqual(findingsOf(RULE, "会議（定例）は月曜です。関数 f(x) を使います。報告（月次）は金曜です。\n", ja), []);
    assert.deepEqual(findingsOf(RULE, "会議（定例）は月曜です。題は「資料(最新版)」です。\n", ja), []);
  });

  it("式の括弧（× (1 - 時間 ÷ 月平均)）は数えず、文の中の半角の括弧は数える", () => {
    const formula =
      "会議（定例）は月曜です。報告（月次）は金曜です。\n\n- 支給額 × (1 - 欠勤時間 ÷ 所定時間)　+ 手当\n- 支給額 × (勤務時間 ÷ 所定時間)　+ 手当\n";
    assert.deepEqual(findingsOf(RULE, formula, ja), []);
    assert.deepEqual(findingsOf(RULE, `${formula}\n資料(最新版)を配ります。\n`, ja), [
      "括弧を「(」と書いています（この文書はふつう「（」。6 箇所のうち 2 箇所が違う）",
      "括弧を「)」と書いています（この文書はふつう「）」。6 箇所のうち 2 箇所が違う）",
    ]);
  });

  const PROSE = "会議（定例）は月曜です。報告（月次）は金曜です。資料（案）を配ります。\n\n";

  it("行の頭の番号の括弧（(1)開催趣旨）は、文の中の括弧と別に比べる", () => {
    const minutes = `${PROSE}(1)開催趣旨の確認\n事務局から説明があった。\n\n(2) 設置要綱の承認\n事務局から提案があった。\n\n- (3) 座長の選出\n`;
    assert.deepEqual(findingsOf(RULE, minutes, ja), []);
  });

  it("番号の括弧どうしの幅の違いと、文の中の半角の括弧は、番号があっても言う", () => {
    const numbers = `${PROSE}(1)開催趣旨の確認\n(2)設置要綱の承認\n(3)座長の選出\n(4)委員の紹介\n(5)今後の予定\n（6）その他\n`;
    assert.deepEqual(findingsOf(RULE, numbers, ja), ["括弧を「）」と書いています（この文書はふつう「)」。6 箇所のうち 1 箇所が違う）"]);
    assert.deepEqual(findingsOf(RULE, `${PROSE}資料(最新版)を配ります。\n\n(1)開催趣旨の確認\n`, ja), [
      "括弧を「(」と書いています（この文書はふつう「（」。8 箇所のうち 2 箇所が違う）",
      "括弧を「)」と書いています（この文書はふつう「）」。8 箇所のうち 2 箇所が違う）",
    ]);
    // 文の中で番号を指す (1) は、文の括弧として数える。
    assert.deepEqual(findingsOf(RULE, `${PROSE}(1)履歴書\n(2)職務経歴書\n\n次の(1)と(2)を送ってください。\n`, ja).length, 4);
  });

  it("行の途中の (2)、幅の揃わない番号（(1）、番号でない語の括弧（(背景)、(注)）は、番号として分けない", () => {
    assert.deepEqual([...enumeratorBracketOffsets("(1)開催\n  - （ア）説明\n(1）案\n説明 (2)案\n(背景)案\n(注)案\n(iv)案\n(iiii)案")], [0, 2, 10, 12, 40, 43]);
    assert.deepEqual([...enumeratorBracketOffsets("")], []);
  });
});

describe("exclamation-width-consistency", () => {
  const RULE = "exclamation-width-consistency";

  it("疑問符の少ないほうを言う", () => {
    assert.deepEqual(findingsOf(RULE, "本当ですか？ 来週ですか？ 今日ですか?\n", ja), [
      "「?」と書いています（この文書はふつう「？」。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("感嘆符と疑問符は別に数える", () => {
    assert.deepEqual(findingsOf(RULE, "本当ですか？ 来週ですか？ 完成しました!\n", ja), []);
  });
});

describe("sentence-spacing-consistency", () => {
  const RULE = "sentence-spacing-consistency";

  it("the less common gap between sentences on a line is reported", () => {
    assert.deepEqual(findingsOf(RULE, "We met. We talked. We agreed.  We left.\n"), [
      "2 spaces after this sentence, where the document usually leaves 1 (1 of 3)",
    ]);
  });

  it("one way throughout, and the break between lines, are not reported", () => {
    assert.deepEqual(findingsOf(RULE, "We met.  We talked.  We agreed.\nWe left. We slept.  We woke.\n"), [
      "1 space after this sentence, where the document usually leaves 2 (1 of 4)",
    ]);
    assert.deepEqual(findingsOf(RULE, "We met. We talked.\nWe agreed. We left.\n"), []);
  });

  it("a split after a number or an abbreviation, or before a citation, is not a gap between sentences", () => {
    assert.deepEqual(findingsOf(RULE, "We met.  We talked.  See Req. 1.  We agreed.  Refs. [ISO99] apply.  We left.\n"), []);
    assert.deepEqual(findingsOf(RULE, "We met.  We talked.  We sat. (Briefly.)  We agreed.\n"), []);
  });
});

describe("hyphen-as-dash", () => {
  const RULE = "hyphen-as-dash";

  it("a spaced or doubled hyphen between words is reported", () => {
    assert.deepEqual(findingsOf(RULE, "The release is late - very late.\n"), ['"-" stands in for a dash']);
    assert.deepEqual(findingsOf(RULE, "Two teams—sales and support—will attend. Pick a date--any date--soon.\n"), [
      '"--" stands in for a dash',
      '"--" stands in for a dash',
    ]);
  });

  it("a double hyphen in a document that sets no dash as a character is its typed dash", () => {
    assert.deepEqual(findingsOf(RULE, "Two teams--sales and support--will attend. It is late -- very late.\n"), []);
    assert.deepEqual(findingsOf(RULE, "Two teams--sales and support--will attend. It is late - very late.\n"), ['"-" stands in for a dash']);
    assert.deepEqual(findingsOf(RULE, "Pages 10–12 hold it. Two teams--sales and support--will attend.\n"), [
      '"--" stands in for a dash',
      '"--" stands in for a dash',
    ]);
  });

  it("a list marker, a number range and a hyphenated word are not", () => {
    assert.deepEqual(findingsOf(RULE, "- First item\n- Second item\n\nPages 1 - 2 hold a well-known chart.\n"), []);
  });

  it("a Japanese sentence quoted in an English document is not read", () => {
    assert.deepEqual(findingsOf(RULE, "The route is listed below. 東京--大阪の便です。\n"), []);
  });
});

describe("partialForms: an abbreviation with some periods dropped", () => {
  it("every form with some but not all of the periods", () => {
    assert.deepEqual(
      partialForms("e.g.").toSorted((left, right) => left.localeCompare(right)),
      ["e.g", "eg."],
    );
    assert.deepEqual(partialForms("etc."), []);
  });
});

describe("latin-abbreviation-form", () => {
  const RULE = "latin-abbreviation-form";

  it("a partial form is reported, in either case", () => {
    assert.deepEqual(findingsOf(RULE, "Bring a document, e.g a passport.\n"), ['"e.g" has some of its periods but not all']);
    assert.deepEqual(findingsOf(RULE, "Ie. the short one. Use the card.\n"), ['"Ie." has some of its periods but not all']);
  });

  it("the full form, the form with no periods, and words that hold the letters are not", () => {
    assert.deepEqual(findingsOf(RULE, "Bring a document, e.g. a passport, or eg a card, i.e. proof. The egg is ripe.\n"), []);
  });
});

describe("isShouting: ordinary words in capitals, not acronyms", () => {
  const NONE: ReadonlySet<string> = new Set();

  it("more than half of the words written in lower case elsewhere", () => {
    assert.equal(isShouting("DO NOT DELETE THIS", lowerCaseWords("Do not delete it. DO NOT DELETE THIS"), NONE), true);
    assert.equal(isShouting("AWS IAM SSO", lowerCaseWords("Use the console. AWS IAM SSO"), NONE), false);
    assert.equal(isShouting("EU CRA PLD DSA", lowerCaseWords("the eu and cra"), NONE), false);
  });

  it("words written in capitals by convention count like acronyms", () => {
    assert.equal(isShouting("LO MUST SEND", lowerCaseWords("it must send"), new Set(["MUST"])), false);
  });
});

describe("all-caps-shouting", () => {
  const RULE = "all-caps-shouting";

  it("a run of ordinary words in capitals is reported", () => {
    assert.deepEqual(findingsOf(RULE, "Do not delete the log. DO NOT DELETE THIS FILE before the audit.\n"), [
      '"DO NOT DELETE THIS FILE" is written in capitals',
    ]);
  });

  it("acronyms and two capital words are not", () => {
    assert.deepEqual(findingsOf(RULE, "Set up AWS IAM SSO for the team. Read the FAQ NOW.\n"), []);
  });

  it("a one-letter word may sit in a run, but one-letter labels alone are not shouting", () => {
    assert.deepEqual(findingsOf(RULE, "I am ok now. I AM OK now.\n"), ['"I AM OK" is written in capitals']);
    assert.deepEqual(findingsOf(RULE, "Pick a, b or c. Options A B C are listed.\n"), []);
  });

  it("a caption in capitals, and prose that names it, are not shouting", () => {
    const notice = [
      "BOARD OF PARKS",
      "",
      "WHO MAY APPLY: Anyone who lives in the town may apply.",
      "",
      "# FOR MORE DETAILS:",
      "",
      "Call the office. If you cannot call, write to the person named in the FOR MORE DETAILS section below.",
      "",
    ].join("\n");
    assert.deepEqual(findingsOf(RULE, notice), []);
  });

  it("shouting that is not a caption is still reported: mid-sentence, a sentence of its own, a wrapped line", () => {
    assert.deepEqual(findingsOf(RULE, "Do not delete the log.\n\nDO NOT DELETE THIS FILE.\n"), ['"DO NOT DELETE THIS FILE" is written in capitals']);
    assert.deepEqual(findingsOf(RULE, "Do not delete the log. Keep it\nDO NOT DELETE THIS FILE\nbefore the audit.\n"), [
      '"DO NOT DELETE THIS FILE" is written in capitals',
    ]);
    assert.deepEqual(findingsOf(RULE, "Do not delete the log.\n\nDO NOT DELETE THIS, the file is needed.\n"), ['"DO NOT DELETE THIS" is written in capitals']);
  });

  it("the legal presets turn it off", () => {
    const source = "The software is provided as is. THE SOFTWARE IS PROVIDED AS IS.\n";
    assert.ok(firedRules(en, source, "business/report").includes(RULE));
    assert.ok(!firedRules(en, source, "legal/contract").includes(RULE));
  });
});

describe("captions in capitals", () => {
  const source = "WHO MAY APPLY: anyone.\n\nBOARD OF PARKS\n\nWe met.\nTHE BOARD MET\nagain.\n";
  const at = (run: string): boolean => isCaptionAt(source, source.indexOf(run), source.indexOf(run) + run.length);

  it("a run opening a paragraph and ending in a colon or the paragraph is a caption", () => {
    assert.equal(at("WHO MAY APPLY"), true);
    assert.equal(at("BOARD OF PARKS"), true);
  });

  it("a run inside a paragraph, or cut short of its colon, is not", () => {
    assert.equal(at("THE BOARD MET"), false);
    assert.equal(at("WHO MAY"), false);
  });

  it("the captions of a source, as their words", () => {
    assert.deepEqual([...captionsOf(source)], ["WHO MAY APPLY", "BOARD OF PARKS"]);
    assert.deepEqual([...captionsOf("# FOR MORE DETAILS:\n\n- KEY DATES:\n")], ["FOR MORE DETAILS", "KEY DATES"]);
    assert.deepEqual([...captionsOf("")], []);
    assert.deepEqual([...captionsOf("Intro.\r\n\r\nBOARD OF PARKS\r\n\r\nWe met.\r\n")], ["BOARD OF PARKS"]);
  });
});
