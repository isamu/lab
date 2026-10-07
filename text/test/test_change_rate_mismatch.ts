import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { changeRateMismatches, gapLength, type ChangeText } from "../packages/chaff/src/structure/change-rate.ts";
import type { LanguageAdapter, Token } from "../packages/chaff/src/plugin.ts";
import { startsOtherSubject } from "../packages/chaff/src/structure/subject-change.ts";

// 一つの文の、もとの値・今の値・増減率の食い違い（change-rate-mismatch）。例文は自作。

const RULE = "change-rate-mismatch";

const found = (text: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", `# 報告\n\n${text}\n`, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["rate"])}:${String(finding.values["computed"])}`);

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

describe("change-rate-mismatch", () => {
  it("ja: もとの値（から・に比べて）と今の値から計算した率と、書いた率が違う", () => {
    assert.deepEqual(found("利用企業は1,200社となり、前年同月の1,000社から25%増えました。", ja), ["25:20"]);
    assert.deepEqual(found("利用企業は1,200社となり、前年同月の1,000社から20%増えました。", ja), []);
    assert.deepEqual(found("会員は800人で、前年の1,000人に比べて20%の減少となった。", ja), []);
    assert.deepEqual(found("会員は800人で、前年の1,000人に比べて15%の減少となった。", ja), ["15:20"]);
    // 向きが逆なら違う。
    assert.deepEqual(found("会員は800人で、前年の1,000人から20%増えた。", ja), ["20:20"]);
  });

  it("en: from / compared with, with a word of direction beside the rate", () => {
    assert.deepEqual(found("1,200 companies used the app, up 25% from 1,000 companies a year earlier.", en), ["25:20"]);
    assert.deepEqual(found("1,200 companies used the app, up 20% from 1,000 companies a year earlier.", en), []);
    assert.deepEqual(found("Revenue was $9.0 million, a decline of 10% from $10.0 million.", en), []);
    assert.deepEqual(found("Revenue was $9.0 million, a decline of 20% from $10.0 million.", en), ["20:10"]);
  });

  it("allows the rounding of values written to a coarse step", () => {
    assert.deepEqual(found("売上高は12億円で、前年同期の10億円に比べて25%の増加となった。", ja), []);
    assert.deepEqual(found("Sales were $12 million, an increase of 25% from $10 million.", en), []);
    assert.deepEqual(found("売上高は12.0億円で、前年同期の10.0億円に比べて25%の増加となった。", ja), ["25:20"]);
  });

  it("does not compare: two rates, no marked base, no single current value, no direction, a rate of something else", () => {
    assert.deepEqual(found("売上は1,200億円で前年の1,000億円から25%増、利益は5%減った。", ja), []);
    assert.deepEqual(found("利用企業は1,200社で、25%増えました。", ja), []);
    assert.deepEqual(found("利用企業は1,200社、1,100社、前年の1,000社から25%増えました。", ja), []);
    assert.deepEqual(found("利用企業は1,200社となり、前年同月の1,000社から満足度は25%だった。", ja), []);
    assert.deepEqual(found("店舗は100店から120店に増え、同じ期間に売上高も前年より15%増えた。", ja), []);
    assert.deepEqual(found("Prices went from $10 to $12; demand rose 15% over the year.", en), []);
    assert.deepEqual(found("Sales rose 20% from $10 million to $900,000 in costs.", en), []);
    // An amount after the rate, not marked as the value reached, is about something else.
    assert.deepEqual(found("Costs rose 20% from $1,000, and revenue was $1,300.", en), []);
    // "up to" is a ceiling; a year is a point in time.
    assert.deepEqual(found("The program covers 1,300 companies, up to 25% from 1,000 companies in 2024.", en), []);
    assert.deepEqual(found("2024 revenue was 1,300, up 25% from 2020 revenue of 1,000.", en), []);
  });

  it("reads the value reached when marked (to, に), and a base whose mark stands beside the rate", () => {
    assert.deepEqual(found("Users rose 25% from 1,000 users to 1,200 users.", en), ["25:20"]);
    assert.deepEqual(found("会員は1,000人から1,200人に25%増えた。", ja), ["25:20"]);
    assert.deepEqual(found("Revenue was $1,300, up 25% compared with $1,000.", en), ["25:30"]);
  });
});

describe("change-rate-mismatch: the two values written together before the rate", () => {
  // Each form with a wrong rate, then the same with the right one.
  const ja_forms: readonly (readonly [string, string])[] = [
    ["売上は昨年の100万円から今年は150万円になり、前年比20%の増加でした。", "売上は昨年の100万円から今年は150万円になり、前年比50%の増加でした。"],
    ["売上は100万円から150万円に増え、前年比20%の増加でした。", "売上は100万円から150万円に増え、前年比50%の増加でした。"],
    ["売上は100万円から150万円へ伸び、前年同期比20%の伸びとなった。", "売上は100万円から150万円へ伸び、前年同期比50%の伸びとなった。"],
    ["売上は100万円から150万円になり、前年比でも20%の増加でした。", "売上は100万円から150万円になり、前年比でも50%の増加でした。"],
    ["売上は100万円から150万円に上がり、20%の増加となった。", "売上は100万円から150万円に上がり、50%の増加となった。"],
    ["売上は前年の100万円、今年の150万円で、前年比20%の増加でした。", "売上は前年の100万円、今年の150万円で、前年比50%の増加でした。"],
    ["売上は100万円→150万円で、前年比20%増でした。", "売上は100万円→150万円で、前年比50%増でした。"],
    ["売上は2025年度は100万円、2026年度は150万円で、20%の増加でした。", "売上は2025年度は100万円、2026年度は150万円で、50%の増加でした。"],
    ["売上は200万円から150万円に下がり、前年比20%の減少となった。", "売上は200万円から150万円に下がり、前年比25%の減少となった。"],
  ];
  const en_forms: readonly (readonly [string, string])[] = [
    ["Revenue rose from $1.0 million to $1.5 million, an increase of 20%.", "Revenue rose from $1.0 million to $1.5 million, an increase of 50%."],
    ["Revenue rose from $1.0 million to $1.5 million, with an increase of 20%.", "Revenue rose from $1.0 million to $1.5 million, with an increase of 50%."],
    ["Revenue rose from $1.0 million last year to $1.5 million, up 20%.", "Revenue rose from $1.0 million last year to $1.5 million, up 50%."],
    ["Revenue was $1.0 million in 2025 and $1.5 million in 2026, up 20%.", "Revenue was $1.0 million in 2025 and $1.5 million in 2026, up 50%."],
    ["Revenue was $1.5 million in 2026 and $1.0 million in 2025, grew 20%.", "Revenue was $1.5 million in 2026 and $1.0 million in 2025, grew 50%."],
    ["Users grew from 1,000 users to 1,500 users, an increase of 20%.", "Users grew from 1,000 users to 1,500 users, an increase of 50%."],
    ["Revenue fell from $2.0 million to $1.5 million, down 20%.", "Revenue fell from $2.0 million to $1.5 million, down 25%."],
  ];

  it("ja: reports a wrong rate in each form, and not the right one", () => {
    ja_forms.forEach(([wrong, right]) => {
      assert.equal(found(wrong, ja).length, 1, wrong);
      assert.deepEqual(found(right, ja), [], right);
    });
  });

  it("en: reports a wrong rate in each form, and not the right one", () => {
    en_forms.forEach(([wrong, right]) => {
      assert.equal(found(wrong, en).length, 1, wrong);
      assert.deepEqual(found(right, en), [], right);
    });
  });

  it("en: an and that starts a clause about another subject does not join the two values", () => {
    assert.deepEqual(found("Revenue was $2,000 in 2025 and costs were $2,500 in 2026, up 20%.", en), []);
    assert.deepEqual(found("Revenue was $1.0 million in 2025 and costs $1.5 million in 2026, up 20%.", en), []);
    assert.deepEqual(found("Revenue was $2,000 in 2025 and revenue was $2,500 in 2026, up 20%.", en), ["20:25"]);
    assert.deepEqual(found("Revenue was $2,000 in 2025 and revenue $2,500 in 2026, up 20%.", en), ["20:25"]);
    assert.deepEqual(found("In 2025, revenue was $2,000 and costs were $2,500 in 2026, up 20%.", en), []);
    assert.deepEqual(found("ACME's revenue was $2,000 in 2025 and revenue was $2,500 in 2026, up 20%.", en), ["20:25"]);
  });

  it("allows the rounding of the two values", () => {
    assert.deepEqual(found("売上は昨年の3.0億円から今年は3.6億円になり、前年比22%の増加だった。", ja), []);
    assert.deepEqual(found("売上は昨年の3.0億円から今年は3.6億円になり、前年比25%の増加だった。", ja), ["25:20"]);
  });

  it("does not take an unrelated percentage as the rate", () => {
    assert.deepEqual(found("売上は昨年の100万円から今年は150万円になり、前年比20%の増加、利益率は10%でした。", ja), ["20:50"]);
    assert.deepEqual(found("売上は昨年の100万円から今年は150万円になり、前年比50%の増加、利益率は10%でした。", ja), []);
    assert.deepEqual(found("シェアは20%で、売上は100万円から150万円に増加した。", ja), []);
    assert.deepEqual(found("売上は100万円から150万円になり、構成比は20%に上昇した。", ja), []);
    assert.deepEqual(found("Revenue rose from $1.0 million to $1.5 million, and its share of sales was 20%.", en), []);
  });

  it("does not compare a rate of another subject, after another value, or among three values", () => {
    ["は", "も", "が"].forEach((particle) => assert.deepEqual(found(`売上は100万円から150万円に増え、利益${particle}20%増えた。`, ja), []));
    assert.deepEqual(found("売上は100万円から150万円に増え、客数1,000人で20%増えた。", ja), []);
    ["and costs rose 20%", "while margins grew 20%", "with margins up 20%"].forEach((tail) =>
      assert.deepEqual(found(`Revenue rose from $1.0 million to $1.5 million, ${tail}.`, en), []),
    );
    assert.deepEqual(found("Revenue rose from $1.0 million to $1.5 million; costs rose 20%.", en), []);
    // The two values of two subjects.
    assert.deepEqual(found("2025年の売上は100万円、2026年の費用は150万円で20%増でした。", ja), []);
    assert.deepEqual(found("売上は100万円から、費用は150万円で前年比20%増でした。", ja), []);
    assert.deepEqual(found("Revenue was $1.0 million in 2025, $1.2 million in 2026 and $1.5 million in 2027, up 20%.", en), []);
    assert.deepEqual(found("Revenue was $1.0 million in 2025 and $1.5 million in 2025, up 20%.", en), []);
  });
});

describe("changeRateMismatches", () => {
  const sentence = { start: 0, end: 100 };
  const base: ChangeText = {
    sentences: [sentence],
    figures: [
      { start: 0, end: 5, value: 1200, unit: "社", step: 1 },
      { start: 20, end: 26, value: 1000, unit: "社", step: 1 },
    ],
    rates: [{ start: 28, end: 31, value: 25, decimals: 0 }],
    directions: [{ start: 31, end: 32, sign: 1 }],
    marks: [{ start: 26, end: 28, position: "after" }],
    targets: [],
    periods: [],
    breaks: [],
    source: "・".repeat(100),
  };

  it("reports the rate and the computed one", () => {
    assert.deepEqual(changeRateMismatches(base), [{ offset: 28, values: { rate: "25", computed: "20" } }]);
  });

  it("reads nothing without each part, or with a base of zero", () => {
    assert.deepEqual(changeRateMismatches({ ...base, sentences: [] }), []);
    assert.deepEqual(changeRateMismatches({ ...base, rates: [] }), []);
    assert.deepEqual(changeRateMismatches({ ...base, directions: [] }), []);
    assert.deepEqual(changeRateMismatches({ ...base, marks: [] }), []);
    assert.deepEqual(changeRateMismatches({ ...base, directions: [...base.directions, { start: 32, end: 33, sign: -1 }] }), []);
    const zero = {
      ...base,
      figures: [base.figures[0], { start: 20, end: 26, value: 0, unit: "社", step: 1 }].flatMap((figure) => (figure === undefined ? [] : [figure])),
    };
    assert.deepEqual(changeRateMismatches(zero), []);
  });

  // 「A（0-5）から（5-7）B（7-12）になり（12-20）20%（20-23）増（23-24）」
  const pair: ChangeText = {
    ...base,
    figures: [
      { start: 0, end: 5, value: 100, unit: "円", step: 1 },
      { start: 7, end: 12, value: 150, unit: "円", step: 1 },
    ],
    rates: [{ start: 20, end: 23, value: 20, decimals: 0 }],
    directions: [{ start: 23, end: 24, sign: 1 }],
    marks: [{ start: 5, end: 7, position: "after" }],
  };

  it("reads two values written together before the rate", () => {
    assert.deepEqual(changeRateMismatches(pair), [{ offset: 20, values: { rate: "20", computed: "50" } }]);
    assert.deepEqual(changeRateMismatches({ ...pair, rates: [{ start: 20, end: 23, value: 50, decimals: 0 }] }), []);
    assert.deepEqual(changeRateMismatches({ ...pair, breaks: [{ start: 14, end: 15, beforeRateOnly: false }] }), []);
    assert.deepEqual(changeRateMismatches({ ...pair, breaks: [{ start: 14, end: 15, beforeRateOnly: true }] }), []);
    // A word that joins the two values ("… in 2025 and …") parts them only when it is not read before the rate alone.
    assert.deepEqual(changeRateMismatches({ ...pair, breaks: [{ start: 5, end: 6, beforeRateOnly: true }] }), [
      { offset: 20, values: { rate: "20", computed: "50" } },
    ]);
    assert.deepEqual(changeRateMismatches({ ...pair, breaks: [{ start: 5, end: 6, beforeRateOnly: false }] }), []);
    assert.deepEqual(
      changeRateMismatches({ ...pair, rates: [{ start: 40, end: 43, value: 20, decimals: 0 }], directions: [{ start: 43, end: 44, sign: 1 }] }),
      [],
    );
    assert.deepEqual(changeRateMismatches({ ...pair, marks: [] }), []);
  });

  it("takes the value of the earlier year as the earlier one", () => {
    // Each year right after its value: A, its year, B, its year.
    const years = (first: number, second: number): ChangeText => ({
      ...pair,
      marks: [],
      periods: [
        { start: 5, end: 7, year: first },
        { start: 12, end: 14, year: second },
      ],
    });
    assert.deepEqual(changeRateMismatches(years(2025, 2026)), [{ offset: 20, values: { rate: "20", computed: "50" } }]);
    assert.deepEqual(changeRateMismatches(years(2026, 2025)), [{ offset: 20, values: { rate: "20", computed: "33" } }]);
    assert.deepEqual(changeRateMismatches(years(2025, 2025)), []);
    assert.deepEqual(changeRateMismatches({ ...years(2025, 2026), periods: [{ start: 5, end: 7, year: 2025 }] }), []);
  });

  it("measures a gap with a Latin word as one character", () => {
    assert.equal(gapLength(" million, an increase of ", { start: 0, end: 25 }), 10);
    assert.equal(gapLength("になり、前年比", { start: 0, end: 7 }), 7);
    assert.equal(gapLength("", { start: 0, end: 0 }), 0);
  });

  it("allows half the rate's last digit", () => {
    assert.deepEqual(changeRateMismatches({ ...base, rates: [{ start: 28, end: 33, value: 20.04, decimals: 2 }] }), []);
    assert.deepEqual(changeRateMismatches({ ...base, rates: [{ start: 28, end: 32, value: 20.4, decimals: 1 }] }), [
      { offset: 28, values: { rate: "20.4", computed: "20.0" } },
    ]);
  });
});

describe("startsOtherSubject: a joining word followed by another subject", () => {
  const sentence = (...parts: readonly (readonly [string, string, string?])[]): Token[] =>
    parts.map(([surface, pos, lemma], index) => ({
      surface,
      pos,
      span: { start: index * 10, end: index * 10 + surface.length },
      ...(lemma === undefined ? {} : { lemma }),
    }));
  const AND = ["and", "CCONJ"] as const;

  it("a noun other than the subject after the joining word", () => {
    const tokens = sentence(
      ["Revenue", "NOUN"],
      ["was", "AUX"],
      ["$", "SYM"],
      ["2,000", "NUM"],
      AND,
      ["the", "DET"],
      ["operating", "NOUN"],
      ["costs", "NOUN", "cost"],
      ["were", "AUX"],
    );
    assert.equal(startsOtherSubject(tokens, 4), true);
    const name = sentence(["Revenue", "NOUN"], ["was", "AUX"], ["2,000", "NUM"], AND, ["Acme", "PROPN"], ["reported", "VERB"]);
    assert.equal(startsOtherSubject(name, 3), true);
  });

  it("the head of each noun run is compared, past a determiner, a possessive or an adjective", () => {
    const tokens = sentence(
      ["Operating", "NOUN", "operating"],
      ["revenue", "NOUN"],
      ["was", "AUX"],
      ["2,000", "NUM"],
      AND,
      ["our", "PRON"],
      ["new", "ADJ"],
      ["operating", "NOUN"],
      ["costs", "NOUN", "cost"],
    );
    assert.equal(startsOtherSubject(tokens, 4), true);
  });

  it("the same subject again, a value, or a word that is not a noun", () => {
    const same = sentence(["Revenues", "NOUN", "revenue"], ["was", "AUX"], ["2,000", "NUM"], AND, ["revenue", "NOUN"], ["was", "AUX"]);
    assert.equal(startsOtherSubject(same, 3), false);
    const value = sentence(["Revenue", "NOUN"], ["was", "AUX"], ["2,000", "NUM"], AND, ["$", "SYM"], ["2,500", "NUM"]);
    assert.equal(startsOtherSubject(value, 3), false);
    const adverb = sentence(["Revenue", "NOUN"], ["was", "AUX"], ["2,000", "NUM"], AND, ["then", "ADV"], ["costs", "NOUN"]);
    assert.equal(startsOtherSubject(adverb, 3), false);
  });

  it("no subject before the joining word, or nothing after it", () => {
    const noSubject = sentence(["In", "ADP"], ["2025", "NUM"], AND, ["costs", "NOUN"]);
    assert.equal(startsOtherSubject(noSubject, 2), false);
    const owner = sentence(["ACME", "PROPN"], ["revenue", "NOUN"], ["was", "AUX"], ["2,000", "NUM"], AND, ["revenue", "NOUN"]);
    assert.equal(startsOtherSubject(owner, 4), false);
    const last = sentence(["Revenue", "NOUN"], AND);
    assert.equal(startsOtherSubject(last, 1), false);
    assert.equal(startsOtherSubject([], 0), false);
  });
});
