import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MUTATIONS,
  breakReference,
  contract,
  defineTwice,
  dropGloss,
  dropItem,
  joinSentences,
  nestNo,
  nextNumber,
  plainInPolite,
  politeInPlain,
  shiftWeekday,
  skipLastNumber,
  spaceLatin,
  swapDatedRows,
} from "../scripts/bench-mutations.ts";
import { isPoliteDocument, type Plant, type PlantContext } from "../scripts/bench-text.ts";

// yarn bench の植える誤り。どの行に何を植えたかを、短い自作の文書で固定する。

const lines = (...rows: string[]): string => rows.join("\n");
const LIMITS = { limits: { "max-sentence-length": 25 } };

/** 植えた行の中身と行番号。 */
const at = (plant: Plant | undefined): readonly [number, string] | undefined =>
  plant === undefined ? undefined : [plant.line, plant.source.split("\n")[plant.line - 1] ?? ""];

describe("shiftWeekday", () => {
  it("年まで書いた日付の曜日を次の曜日にする", () => {
    assert.deepEqual(at(shiftWeekday(lines("# 旅程", "", "- 2026年11月9日（月）出発"))), [3, "- 2026年11月9日（火）出発"]);
    assert.deepEqual(at(shiftWeekday(lines("# Trip", "", "Sunday, 8 November 2026: leave"))), [3, "Monday, 8 November 2026: leave"]);
  });

  it("年の無い日付や、日付の無い曜日には植えない", () => {
    assert.equal(shiftWeekday("11月9日（月）に出発する。"), undefined);
    assert.equal(shiftWeekday("We meet every Monday."), undefined);
  });
});

describe("swapDatedRows", () => {
  const plan = (count: number): string => lines("# Plan", "", ...Array.from({ length: count }, (_, index) => `- 2026-10-0${String(index + 1)} step`));

  it("日付の並ぶ四行の真ん中の二行を入れ替え、後ろに回った早い日付の行を指す", () => {
    const plant = swapDatedRows(plan(4));
    assert.deepEqual(plant?.source.split("\n").slice(2), ["- 2026-10-01 step", "- 2026-10-03 step", "- 2026-10-02 step", "- 2026-10-04 step"]);
    assert.equal(plant?.line, 5);
  });

  it("三行までの並びは向きが決まらないので植えない", () => {
    assert.equal(swapDatedRows(plan(3)), undefined);
  });
});

describe("dropItem", () => {
  it("表の最初の内訳を消し、合計の行を指す", () => {
    const source = lines("| Item | Amount |", "| --- | --- |", "| A | $100 |", "| B | $200 |", "| C | $300 |", "| Total | $600 |");
    assert.deepEqual(at(dropItem(source)), [5, "| Total | $600 |"]);
    assert.equal(dropItem(source)?.source.includes("| A |"), false);
  });

  it("消すと内訳が一つしか残らない合計には植えない", () => {
    assert.equal(dropItem(lines("| A | $100 |", "| B | $200 |", "| Total | $300 |")), undefined);
  });

  it("箇条書きの合計も。日本語の合計の語", () => {
    assert.deepEqual(at(dropItem(lines("- 設計: 100円", "- 実装: 200円", "- 試験: 50円", "- 合計: 350円"))), [3, "- 合計: 350円"]);
  });

  it("合計の無い文書、内訳の無い合計には植えない", () => {
    assert.equal(dropItem(lines("- A: $100", "- B: $200")), undefined);
    assert.equal(dropItem(lines("Intro", "- Total: $300")), undefined);
    assert.equal(dropItem("- Totally: $300"), undefined);
  });
});

describe("nextNumber / breakReference / skipLastNumber", () => {
  it("最後の桁を一つ進める", () => {
    assert.equal(nextNumber("6"), "7");
    assert.equal(nextNumber("3.2"), "3.3");
    assert.equal(nextNumber("1.9"), "1.10");
  });

  const policy = lines("第1条（目的）", "本文", "第2条（管理）", "本文", "第3条（返却）", "第2条の届出をした機器は返却しない。");

  it("本文の最初の参照を、見出しに無い番号にする。見出しの番号は変えない", () => {
    assert.deepEqual(at(breakReference(policy)), [6, "第4条の届出をした機器は返却しない。"]);
    assert.deepEqual(at(breakReference(lines("## 3. Data", "### 3.1 Tables", "See Section 3.1."))), [3, "See Section 3.2."]);
  });

  it("参照の無い文書には植えない", () => {
    assert.equal(breakReference(lines("第1条（目的）", "本文")), undefined);
  });

  it("最後の番号付きの見出しを一つ飛ばす", () => {
    assert.deepEqual(at(skipLastNumber(policy)), [5, "第4条（返却）"]);
    assert.deepEqual(at(skipLastNumber(lines("## 1. A", "## 2. B", "- 3. not a heading"))), [2, "## 3. B"]);
    assert.equal(skipLastNumber(lines("# Title", "text")), undefined);
  });
});

describe("defineTwice", () => {
  it("最初の定義文を、最後の段落としてもう一度書く", () => {
    const plant = defineTwice(lines("第1条（定義）", "この規程において「機器」とは、パソコンをいう。", "第2条（管理）", "本文", ""));
    assert.deepEqual(at(plant), [6, "「機器」とは、パソコンをいう。"]);
    assert.deepEqual(at(defineTwice(lines('- "User" means a person. More.', "End."))), [4, '"User" means a person.']);
    assert.equal(defineTwice("No definitions here."), undefined);
  });
});

describe("joinSentences", () => {
  const eleven = "One two three four five six seven eight nine ten eleven.";
  const fifteen = "The plan covers one two three four five six seven eight nine ten eleven twelve.";

  it("つないだときにいちばん長くなる二文をつなぐ", () => {
    const plant = joinSentences(lines("# T", "", `${eleven} Short one.`, `${eleven} ${fifteen}`), LIMITS);
    assert.deepEqual(at(plant), [4, `${eleven.replace(/\.$/u, ",")} and the plan covers one two three four five six seven eight nine ten eleven twelve.`]);
  });

  it("日本語は句点を読点にしてつなぐ", () => {
    const plant = joinSentences("あいうえおかきくけこ。さしすせそたちつてと。", { limits: { "max-sentence-length": 20 } });
    assert.deepEqual(at(plant), [1, "あいうえおかきくけこ、さしすせそたちつてと。"]);
  });

  it("つないだ長さが上限ちょうどなら植えず、一語でも超えれば植える", () => {
    assert.equal(joinSentences(`${eleven} ${fifteen}`, { limits: { "max-sentence-length": 26 } }), undefined);
    assert.equal(joinSentences(`${eleven} ${fifteen}`, { limits: { "max-sentence-length": 25 } })?.line, 1);
  });

  it("つないでも上限に届かなければ植えない。見出しと表の行はつながない", () => {
    assert.equal(joinSentences(`${eleven} ${eleven}`, LIMITS), undefined);
    assert.equal(joinSentences(`| ${eleven} ${fifteen} |`, LIMITS), undefined);
  });
});

describe("politeInPlain / plainInPolite", () => {
  const plain = lines("# 規程", "", "会社は機器を貸与する。従業員は機器を管理する。");
  const polite = lines("# お知らせ", "", "ありがとうございます。お見積りいたします。来週に訪問します。");

  it("文書の多いほうの調子を読む", () => {
    assert.equal(isPoliteDocument(plain), false);
    assert.equal(isPoliteDocument(polite), true);
    assert.equal(isPoliteDocument("来週に訪問します。資料を共有する。"), false);
  });

  /** chaff の読む調子の数を返す、測る文書。 */
  const reading = (counts: { polite: number; plain: number }): PlantContext => ({ limits: {}, registers: () => counts });
  const clash = reading({ polite: 1, plain: 1 });

  it("である調の文書に、です・ます調の文を一つ混ぜる", () => {
    assert.deepEqual(at(politeInPlain(plain, clash)), [3, "会社は機器を貸与します。従業員は機器を管理する。"]);
    assert.equal(politeInPlain(polite, clash), undefined);
  });

  it("混ぜた後に chaff の読む である調の文が残らなければ、です・ます調より少なければ、調子を測れなければ、植えない", () => {
    assert.equal(politeInPlain(plain, reading({ polite: 1, plain: 0 })), undefined);
    assert.equal(politeInPlain(plain, reading({ polite: 0, plain: 0 })), undefined);
    assert.equal(politeInPlain(plain, reading({ polite: 2, plain: 1 })), undefined);
    assert.deepEqual(at(politeInPlain(plain, reading({ polite: 2, plain: 2 })))?.[0], 3);
    assert.equal(politeInPlain(plain, { limits: {} }), undefined);
  });

  it("調子は混ぜた後の文書の、混ぜた行の文と比べ合う文で測る", () => {
    const planted = (source: string, line: number): { polite: number; plain: number } =>
      source.includes("貸与します") && line === 3 ? { polite: 1, plain: 1 } : { polite: 0, plain: 0 };
    assert.deepEqual(at(politeInPlain(plain, { limits: {}, registers: planted }))?.[0], 3);
  });

  it("です・ます調の文書に、である調の文を一つ混ぜる。「ございます」「いたします」は替えない", () => {
    assert.deepEqual(at(plainInPolite(polite)), [3, "ありがとうございます。お見積りいたします。来週に訪問する。"]);
    assert.equal(plainInPolite(plain), undefined);
  });
});

describe("nestNo", () => {
  it("「AのB」の前に「当社の部門の」を足す", () => {
    assert.deepEqual(at(nestNo(lines("# 報告", "", "会計の試験が終わった。"))), [3, "当社の部門の会計の試験が終わった。"]);
    assert.equal(nestNo("# 見出しの行\n\nひらがなのみ。"), undefined);
  });
});

describe("dropGloss", () => {
  it("略語の説明を消して略語だけを残す", () => {
    assert.deepEqual(at(dropGloss("The service level agreement (SLA) is met, and the SLA is kept.")), [1, "The SLA is met, and the SLA is kept."]);
    assert.deepEqual(at(dropGloss("稼働率はサービス品質保証（SLA）で決め、SLAを守る。")), [1, "稼働率はSLAで決め、SLAを守る。"]);
  });

  it("頭文字の合わない括弧、後で使わない日本語の略語は説明ではない", () => {
    assert.equal(dropGloss("Yamada (IT), Suzuki (Accounting)"), undefined);
    assert.equal(dropGloss("画面はシングルページアプリケーション（SPA）として作る。"), undefined);
  });
});

describe("spaceLatin", () => {
  it("英字を詰める書き方が三つ以上ある文書で、一語だけ前後を空ける", () => {
    assert.deepEqual(at(spaceLatin("処理はAPIで行い、結果はJSONで返し、認証はSAMLで行う。")), [1, "処理は API で行い、結果はJSONで返し、認証はSAMLで行う。"]);
  });

  it("二つまでの文書や、もう空けている文書には植えない", () => {
    assert.equal(spaceLatin("処理はAPIで行い、結果はJSONで返す。"), undefined);
    assert.equal(spaceLatin("処理はAPIで行い、結果はJSONで返し、認証はSAMLで行い、鍵は OAuth で得る。"), undefined);
  });
});

describe("contract", () => {
  it("短縮形を使わない文書で、一か所だけ短縮形にする。文頭の大文字は残す", () => {
    assert.deepEqual(at(contract(lines("Do not wait.", "It is fine."))), [1, "Don't wait."]);
  });

  it("書き分けの対が一種類だけの文書や、もう短縮形のある文書には植えない", () => {
    assert.equal(contract("Do not wait. Do not run."), undefined);
    assert.equal(contract("Do not wait. It is fine. Don't run."), undefined);
  });
});

describe("MUTATIONS", () => {
  it("id は重ならない", () => {
    const ids = MUTATIONS.map((mutation) => mutation.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("同じ文書には、何度植えても同じ誤りを同じ場所に植える", () => {
    const source = lines("# 旅程", "", "- 2026年11月9日（月）出発", "- 合計: 300円");
    MUTATIONS.forEach((mutation) => assert.deepEqual(mutation.plant(source, LIMITS), mutation.plant(source, LIMITS)));
  });
});
