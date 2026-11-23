import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { quotedLabelSpans } from "../packages/chaff/src/detectors/quoted-label.ts";
import { eventTitleSpans } from "../packages/chaff/src/detectors/event-title-item.ts";

// undefined-acronym and words the page cannot change: a label quoted from a form (the “VOID” box), and the titles in a list of
// past talks and events. They still count towards the limit. The excerpts are self-written.

const covered = (text: string, spans: readonly { readonly start: number; readonly end: number }[]): string[] =>
  spans.map((span) => text.slice(span.start, span.end));

const EN_NOUNS = (en.lexicons["control-noun"] ?? []).map((entry) => entry.pattern);
const JA_NOUNS = (ja.lexicons["control-noun"] ?? []).map((entry) => entry.pattern);
const JA_KINDS = (ja.lexicons["talk-kind"] ?? []).map((entry) => entry.pattern);

describe("quotedLabelSpans", () => {
  it("valid: capitals quoted right before a control noun", () => {
    assert.deepEqual(covered("the “VOID” box checked", quotedLabelSpans("the “VOID” box checked", EN_NOUNS)), ["VOID"]);
    assert.deepEqual(covered('press the "SUBMIT" button', quotedLabelSpans('press the "SUBMIT" button', EN_NOUNS)), ["SUBMIT"]);
    assert.deepEqual(covered("「OK」ボタンを押す", quotedLabelSpans("「OK」ボタンを押す", JA_NOUNS)), ["OK"]);
    assert.deepEqual(covered("「VOID」欄に印", quotedLabelSpans("「VOID」欄に印", JA_NOUNS)), ["VOID"]);
  });

  it("invalid: no quotes, another noun, a longer word after the noun, lower case inside the quotes", () => {
    assert.deepEqual(quotedLabelSpans("the VOID box checked", EN_NOUNS), []);
    assert.deepEqual(quotedLabelSpans("the “VOID” rule applies", EN_NOUNS), []);
    assert.deepEqual(quotedLabelSpans("the “SIG” boxer", EN_NOUNS), []);
    assert.deepEqual(quotedLabelSpans("the “Void” box", EN_NOUNS), []);
  });

  it("abnormal input: empty text, no nouns", () => {
    assert.deepEqual(quotedLabelSpans("", EN_NOUNS), []);
    assert.deepEqual(quotedLabelSpans("the “VOID” box", []), []);
  });
});

describe("eventTitleSpans", () => {
  const list = [
    "### 2014",
    "",
    "- 「世帯消費の指数（CTIミクロ）の改善」",
    "- 研究集会「データの二次利用」（2014/2/21）（PDF）",
    "- データを使いこなす！～KUMAの利用手続き～（2014/1/9）",
    "- 講演（EBPM研修の取り組み）",
  ].join("\n");

  it("valid: an item that is one quoted title, the items a list dates, and a kind of talk's bracketed title", () => {
    assert.deepEqual(covered(list, eventTitleSpans(list, JA_KINDS)), [
      "「世帯消費の指数（CTIミクロ）の改善」",
      "研究集会「データの二次利用」（2014/2/21）（PDF）",
      "データを使いこなす！～KUMAの利用手続き～（2014/1/9）",
      "EBPM研修の取り組み",
    ]);
  });

  it("valid: a talk's title that runs onto the next line", () => {
    const wrapped = ["- 研究集会（2017/11/17）", "- 見学会（2017/11/11）", "- 講演（データによる人材育成", "– 総務省EBPM研修への取り組み -）", "- 見学"].join(
      "\n",
    );
    assert.deepEqual(covered(wrapped, eventTitleSpans(wrapped, JA_KINDS)), [
      "研究集会（2017/11/17）",
      "見学会（2017/11/11）",
      "データによる人材育成\n– 総務省EBPM研修への取り組み -",
    ]);
  });

  it("invalid: a kind of talk in a list that dates nothing, another head, a full stop, a bracket closed before the item ends", () => {
    assert.deepEqual(eventTitleSpans("- 講演（EBPM研修の取り組み）\n- 次回の議題", JA_KINDS), []);
    const dates = "- 研究集会（2017/11/17）\n- 見学会（2017/11/11）\n";
    const titles = (item: string): string[] => covered(dates + item, eventTitleSpans(dates + item, JA_KINDS)).slice(2);
    assert.deepEqual(titles("- 議題（KPI の見直し）"), []);
    assert.deepEqual(titles("- 講演（KPI を見直した。次に進む）"), []);
    assert.deepEqual(titles("- 講演（EBPM）で KPI を説明"), []);
    assert.deepEqual(titles("- 講演（データによる人材育成\n\nKPI を見直す）"), []);
    assert.deepEqual(titles("- 講演（データによる人材育成\n- KPI の見直し）"), []);
  });

  it("invalid: one dated item alone, a quote inside the writer's sentence, a line that is not an item", () => {
    const one = ["- KPI の見直し（2024/1/9）", "- 次回の議題"].join("\n");
    assert.deepEqual(eventTitleSpans(one, JA_KINDS), []);
    assert.deepEqual(eventTitleSpans("- 「KPI」を決めて共有する", JA_KINDS), []);
    assert.deepEqual(eventTitleSpans("- 「公園で転落し、頭部を骨折。ICU入室。」(4歳)", JA_KINDS), []);
    assert.deepEqual(eventTitleSpans("「世帯消費の指数（CTI）の改善」", JA_KINDS), []);
  });

  it("abnormal input: empty text, an empty item, no kinds of talk", () => {
    assert.deepEqual(eventTitleSpans("", JA_KINDS), []);
    assert.deepEqual(eventTitleSpans("- \n-", JA_KINDS), []);
    const dated = "- 研究集会（2017/11/17）\n- 見学会（2017/11/11）\n- 講演（EBPM研修）";
    assert.deepEqual(covered(dated, eventTitleSpans(dated, [])), ["研究集会（2017/11/17）", "見学会（2017/11/11）"]);
  });
});

describe("undefined-acronym: labels and event titles are counted but not reported", () => {
  it("en: the “VOID” box is not reported, the SRE is", () => {
    const text = "# Notes\n\nIf the “VOID” box is checked, the form was issued in error. The SRE joins.\n";
    assert.deepEqual(reportedAcronyms(en, text), ["SRE"]);
  });

  it("en: a bare VOID before box is still an acronym to the rule", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nIf the VOID box is checked, call us.\n"), ["VOID"]);
  });

  it("ja: the titles in a list of past events are not reported, the writer's own acronym is", () => {
    const text = [
      "# 過去の催し",
      "",
      "- 「世帯消費の指数（CTIミクロ）の改善」",
      "- データを使いこなす！～KUMAの利用手続き～（2014/1/9）",
      "- 研究集会「データの二次利用」（2014/2/21）（PDF）",
      "- 講演（総務省EBPM研修への取り組み）",
      "",
      "申し込みは SRE が受け付けます。",
      "",
    ].join("\n");
    assert.deepEqual(reportedAcronyms(ja, text, "business/press-release"), ["SRE"]);
  });
});
