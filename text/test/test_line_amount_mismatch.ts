import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { cellNumber, lineAmountMismatches, quantityOf } from "../packages/chaff/src/structure/line-amount.ts";
import { perUnitPrice, priceHeadingUnit, quantityUnit, unitsAgree } from "../packages/chaff/src/structure/line-amount-unit.ts";
import { countOf, factorsOf, labelProductOf } from "../packages/chaff/src/structure/line-amount-label.ts";

// 数量×単価が金額と合わない（line-amount-mismatch）。例文はすべて自作。

const RULE = "line-amount-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const table = (rows: readonly string[]): string => ["| 品目 | 数量 | 単価 | 金額 |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
const enTable = (rows: readonly string[]): string => ["| Item | Quantity | Unit price | Amount |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";

const NO_UNITS = {
  units: [],
  perUnitMarks: [],
  headerUnits: [],
  measureUnits: [],
  orderRoles: [],
  packCount: [],
  packPrice: [],
  itemName: [],
  taxIncluded: [],
};
const VOLUME = ["L", "m³", "㎥"];

const cell = (text: string): { start: number; text: string } => ({ start: 0, text });

/** Every string made of one item from each list, in order. */
const combinations = (lists: readonly (readonly string[])[]): string[] =>
  lists.reduce<string[]>((heads, list) => heads.flatMap((head) => list.map((item) => `${head}${item}`)), [""]);

describe("line-amount-mismatch: 数量×単価が金額と合わない", () => {
  it("数量×単価と違う金額を指す", () => {
    assert.deepEqual(findingsOf(table(["| 画面開発 | 4画面 | 160,000円 | 600,000円 |"])), [
      "金額「600,000円」が、数量×単価（4画面 × 160,000円 = 640,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(enTable(["| Screens | 4 | $1,600 | $6,000 |"]), en), ["The amount $6,000 is not quantity × unit price (4 × $1,600 = $6,400)"]);
    assert.deepEqual(findingsOf(enTable(["| Support | 3 days | $19.99 | $59.00 |"]), en), [
      "The amount $59.00 is not quantity × unit price (3 days × $19.99 = $59.97)",
    ]);
  });

  it("合えば言わない。端数の丸めも合っていると読む", () => {
    assert.deepEqual(findingsOf(table(["| 画面開発 | 4画面 | 150,000円 | 600,000円 |", "| 設計 | 1式 | 400,000円 | 400,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 部品 | 3個 | 333.5円 | 1,000円 |", "| 部品 | 3個 | 333.5円 | 1,001円 |"])), []);
    assert.deepEqual(findingsOf(enTable(["| Hours | 2.5 hours | $90.00 | $225.00 |"]), en), []);
  });

  it("単価と金額の書き方が違う行、負の数、数で始まらない数量は比べない", () => {
    assert.deepEqual(findingsOf(table(["| 開発 | 4画面 | 15万円 | 650,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 値引き | 1 | -50,000円 | -60,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 保守 | 一式 | 80,000円 | 90,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 小計 | | | 1,200,000円 |"])), []);
    assert.deepEqual(findingsOf(enTable(["| A | 2 x 3 | $10 | $60 |"]), en), []);
    assert.deepEqual(findingsOf(enTable(["| A | 2 | $10- | $25- |"]), en), []);
  });

  it("ほかの列に数のある行（値引き、税率）と、数量と別の単位あたりの単価は比べない", () => {
    assert.deepEqual(findingsOf("| 品目 | 数量 | 単価 | 値引 | 金額 |\n| --- | --- | --- | --- | --- |\n| 設計 | 10 | 5,000円 | 5,000円 | 45,000円 |\n"), []);
    assert.deepEqual(
      findingsOf("| Item | Qty | Unit price | Discount | Amount |\n| --- | --- | --- | --- | --- |\n| Widget | 10 | $50.00 | 10% | $450.00 |\n", en),
      [],
    );
    assert.deepEqual(findingsOf("| Item | Quantity | Rate | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 days | $100/hour | $1,600 |\n", en), []);
    assert.deepEqual(findingsOf("| 品目 | 数量 | 単価 | 備考 | 金額 |\n| --- | --- | --- | --- | --- |\n| 設計 | 10 | 5,000円 | 急ぎ | 45,000円 |\n"), [
      "金額「45,000円」が、数量×単価（10 × 5,000円 = 50,000円）と合いません",
    ]);
  });

  it("三つの列がそろわない表と、コードの中の表は読まない", () => {
    assert.deepEqual(findingsOf("| 品目 | 数量 | 金額 |\n| --- | --- | --- |\n| 開発 | 4 | 650,000円 |\n"), []);
    assert.deepEqual(findingsOf(`# 例\n\n\`\`\`\n${table(["| 開発 | 4 | 150,000円 | 650,000円 |"])}\`\`\`\n`), []);
  });

  it("升の数を読む", () => {
    assert.deepEqual(cellNumber(cell(" $1,500.00 ")), {
      before: "$",
      value: 1500,
      after: "",
      offset: 1,
      written: "$1,500.00",
      grouped: true,
      decimals: 2,
    });
    assert.equal(cellNumber(cell("15万円"))?.after, "万円");
    assert.equal(cellNumber(cell("１２０円"))?.value, 120);
    assert.equal(cellNumber(cell("1,000円〜2,000円")), undefined);
    assert.equal(cellNumber(cell("▲500円")), undefined);
    assert.equal(cellNumber(cell("")), undefined);
    assert.equal(quantityOf(cell("3人日"), VOLUME), 3);
    assert.equal(quantityOf(cell(" 2.5 hours"), VOLUME), 2.5);
    assert.equal(quantityOf(cell("一式"), VOLUME), undefined);
    assert.equal(quantityOf(cell("2 x 3"), VOLUME), undefined);
  });

  it("立方メートルの数量は、単位を語彙表から読み、³ を数に足さない（指摘の中では NFKC の字で示す）", () => {
    ["16m³", "16m3", "16 m³", "16㎥", "16 ㎥", "１６ｍ³"].forEach((text) => assert.equal(quantityOf(cell(text), VOLUME), 16, text));
    assert.equal(quantityOf(cell("3m"), VOLUME), 3);
    assert.equal(quantityOf(cell("10³"), VOLUME), undefined);
    assert.equal(quantityOf(cell("10³ L"), VOLUME), undefined);
    assert.equal(quantityOf(cell("１０³"), VOLUME), undefined);
    assert.equal(quantityOf(cell("16m3 x 2"), VOLUME), undefined);
    assert.equal(quantityOf(cell("16m3"), []), undefined);
    assert.equal(quantityOf(cell("16m4"), VOLUME), undefined);
    assert.deepEqual(
      findingsOf(table(["| 従量料金 | 16m³ | 180円 | 2,800円 |", "| 従量料金 | 16m3 | 180円 | 2,800円 |", "| 従量料金 | 16 ㎥ | 180円 | 2,800円 |"])),
      [
        "金額「2,800円」が、数量×単価（16m3 × 180円 = 2,880円）と合いません",
        "金額「2,800円」が、数量×単価（16m3 × 180円 = 2,880円）と合いません",
        "金額「2,800円」が、数量×単価（16 m3 × 180円 = 2,880円）と合いません",
      ],
    );
    assert.deepEqual(findingsOf(table(["| 従量料金 | 16m³ | 180円 | 2,880円 |", "| 従量料金 | 16㎥ | 180円 | 2,880円 |"])), []);
    assert.deepEqual(findingsOf(enTable(["| Water | 16 m³ | $1.80 | $28.00 |"]), en), [
      "The amount $28.00 is not quantity × unit price (16 m3 × $1.80 = $28.80)",
    ]);
    assert.deepEqual(findingsOf(enTable(["| Water | 10³ | $1.80 | $18.00 |"]), en), []);
  });

  it("数字の直後の上付き数字（累乗）はどの組み合わせでも数量として読まず、文字の後の上付き（m³）は読む", () => {
    const superscripts = [..."⁰¹²³⁴⁵⁶⁷⁸⁹"];
    const leadingNumbers = ["1", "10", "１", "１０", "16"];
    const after = ["", " ", " L", "m", "人日"];
    const powers = combinations([leadingNumbers, superscripts, after]);
    powers.forEach((power) => assert.equal(quantityOf(cell(power), VOLUME), undefined, power));
    leadingNumbers.forEach((number) => assert.equal(quantityOf(cell(`${number}m³`), VOLUME), Number(number.normalize("NFKC")), `${number}m³`));
  });

  it("語の無い言語と空の入力", () => {
    assert.deepEqual(lineAmountMismatches(table(["| 開発 | 4 | 150,000円 | 650,000円 |"]), { quantity: [], unitPrice: [], amount: [], ...NO_UNITS }), []);
    assert.deepEqual(lineAmountMismatches("", { quantity: ["数量"], unitPrice: ["単価"], amount: ["金額"], ...NO_UNITS }), []);
    assert.deepEqual(findingsOf(""), []);
    const delivered = "| 品名 | 納品数量 | 単価 | 金額 |\n| --- | --- | --- | --- |\n| 封筒 | 6 | 500円 | 3,500円 |\n";
    const words = { quantity: ["数量"], unitPrice: ["単価"], amount: ["金額"], ...NO_UNITS };
    assert.deepEqual(lineAmountMismatches(delivered, words), []);
    assert.equal(lineAmountMismatches(delivered, { ...words, orderRoles: [{ pattern: "納品数", role: "delivered" }] }).length, 1);
  });

  it("単価が何かあたりで、数量が別の単位なら比べない", () => {
    assert.deepEqual(findingsOf(table(["| 保守 | 2日 | 月額300,000円 | 30,000円 |", "| 作業 | 2日 | 10,000円/時 | 160,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 作業 | 3人日 | 10,000円/時 | 240,000円 |"])), []);
    assert.deepEqual(findingsOf(enTable(["| Hosting | 10 days | $300/month | $100 |", "| Engineer | 2 days | $100 per hour | $1,600 |"]), en), []);
    assert.deepEqual(findingsOf("| Item | Quantity | Rate | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 days | $100 | $1,600 |\n", en), []);
    assert.deepEqual(findingsOf("| Item | Hours | Unit price | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 | $800/day | $200 |\n", en), []);
  });

  it("同じ単位なら、単位あたりの単価でも比べる。単位の無い数量と、ただの単価も比べる", () => {
    assert.deepEqual(findingsOf(table(["| 保守 | 1か月 | 月額80,000円 | 90,000円 |", "| 作業 | 3時間 | 10,000円/時 | 35,000円 |"])), [
      "金額「90,000円」が、数量×単価（1か月 × 月額80,000円 = 80,000円）と合いません",
      "金額「35,000円」が、数量×単価（3時間 × 10,000円/時 = 30,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(table(["| 部品 | 3 | ¥1,000 | ¥3,500 |"])), ["金額「¥3,500」が、数量×単価（3 × ¥1,000 = ¥3,000）と合いません"]);
    assert.deepEqual(findingsOf(enTable(["| Engineer | 2 hours | $100/hour | $250 |", "| Engineer | 2 | $100/hour | $250 |"]), en), [
      "The amount $250 is not quantity × unit price (2 hours × $100/hour = $200)",
      "The amount $250 is not quantity × unit price (2 × $100/hour = $200)",
    ]);
    assert.deepEqual(findingsOf("| Item | Quantity | Rate | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 | $100 | $250 |\n", en), [
      "The amount $250 is not quantity × unit price (2 × $100 = $200)",
    ]);
    assert.deepEqual(findingsOf("| Item | Hours | Rate | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 | $100/hr | $250 |\n", en), [
      "The amount $250 is not quantity × unit price (2 × $100/hr = $200)",
    ]);
  });

  it("時間の列の横の、何あたりか言わない Rate は時間あたりと読む。数量の見出しが単位を言わなければ読まない", () => {
    const hourly = (rows: readonly string[]): string => ["| Earning | Hours | Rate | Amount |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
    assert.deepEqual(findingsOf(hourly(["| Regular pay | 88 | $17.00 | $1,496.00 |", "| Overtime pay | 6 | $25.00 | $153.00 |"]), en), [
      "The amount $153.00 is not quantity × unit price (6 × $25.00 = $150.00)",
    ]);
    assert.deepEqual(findingsOf(hourly(["| Overtime pay | 6 hours | $25.00 | $153.00 |"]), en), [
      "The amount $153.00 is not quantity × unit price (6 hours × $25.00 = $150.00)",
    ]);
    assert.deepEqual(findingsOf(hourly(["| Regular pay | 88 | $17.00 | $1,496.00 |", "| Training | 2 days | $100 | $1,600 |"]), en), []);
    assert.deepEqual(findingsOf(hourly(["| Overtime pay | 6 | $25.00/day | $153.00 |"]), en), []);
    assert.deepEqual(findingsOf("| Item | Quantity | Rate | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 days | $100 | $1,600 |\n", en), []);
    assert.deepEqual(findingsOf("| Item | Units | Rate | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 days | $100 | $1,600 |\n", en), []);
  });

  it("時間・時給の列を読む", () => {
    const pay = (price: string, rows: readonly string[]): string =>
      [`| 支給項目 | 時間 | ${price} | 金額 |`, "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
    assert.deepEqual(findingsOf(pay("単価", ["| 基本給 | 88時間 | 1,150円 | 101,200円 |", "| 時間外手当 | 6時間 | 1,483円 | 8,628円 |"])), [
      "金額「8,628円」が、数量×単価（6時間 × 1,483円 = 8,898円）と合いません",
    ]);
    assert.deepEqual(findingsOf(pay("時給", ["| 時間外手当 | 6 | 1,483円 | 8,628円 |"])), [
      "金額「8,628円」が、数量×単価（6 × 1,483円 = 8,898円）と合いません",
    ]);
    assert.deepEqual(findingsOf(pay("時給", ["| 交通費 | 16日 | 400円 | 6,000円 |"])), []);
    assert.deepEqual(findingsOf(pay("単価", ["| 時間外手当 | 6時間 | 1,483円 | 8,898円 |", "| 交通費 | 16日 | 400円 | 6,400円 |"])), []);
  });

  it("走行距離と距離あたりの単価を読む", () => {
    assert.deepEqual(
      findingsOf("| 区間 | 走行距離 | 単価 | 金額 |\n| --- | --- | --- | --- |\n| 本社〜倉庫 | 48km | 15円 | 720円 |\n| 本社〜工場 | 62km | 15円 | 960円 |\n"),
      ["金額「960円」が、数量×単価（62km × 15円 = 930円）と合いません"],
    );
    assert.deepEqual(
      findingsOf(
        "| 区間 | 走行距離 | 単価（円/km） | 金額 |\n| --- | --- | --- | --- |\n| 本社〜工場 | 62km | 15円 | 960円 |\n| 本社〜駅 | 3時間 | 15円 | 60円 |\n",
      ),
      ["金額「960円」が、数量×単価（62km × 15円 = 930円）と合いません"],
    );
    assert.deepEqual(findingsOf(table(["| 走行 | 62km | 15円/km | 960円 |", "| 走行 | 2日 | 15円/km | 50円 |"])), [
      "金額「960円」が、数量×単価（62km × 15円/km = 930円）と合いません",
    ]);
    const miles = (price: string, rows: readonly string[]): string =>
      [`| Trip | Miles | ${price} | Amount |`, "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
    assert.deepEqual(findingsOf(miles("Rate per mile", ["| Office to warehouse | 32 | $0.70 | $22.40 |", "| Office to plant | 46 | $0.70 | $32.90 |"]), en), [
      "The amount $32.90 is not quantity × unit price (46 × $0.70 = $32.20)",
    ]);
    assert.deepEqual(findingsOf(miles("Rate", ["| Office to plant | 46 miles | $0.70 | $32.90 |"]), en), [
      "The amount $32.90 is not quantity × unit price (46 miles × $0.70 = $32.20)",
    ]);
    assert.deepEqual(findingsOf(miles("Rate per mile", ["| Office to plant | 2 days | $0.70 | $3.00 |"]), en), []);
    assert.deepEqual(findingsOf(enTable(["| Mileage | 46 miles | $0.70/mile | $32.90 |", "| Mileage | 2 hours | $0.70 per mile | $3.00 |"]), en), [
      "The amount $32.90 is not quantity × unit price (46 miles × $0.70/mile = $32.20)",
    ]);
  });

  it("診療明細の点数と1点の単価、Units と Rate per unit を読む", () => {
    const bill = (price: string, rows: readonly string[]): string =>
      [`| 項目 | 点数 | ${price} | 金額 |`, "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
    ["1点の単価", "点数単価", "単価（円/点）"].forEach((price) => {
      assert.deepEqual(findingsOf(bill(price, ["| 初診料 | 291点 | 10円 | 2,910円 |", "| 画像診断 | 225点 | 10円 | 2,550円 |"])), [
        "金額「2,550円」が、数量×単価（225点 × 10円 = 2,250円）と合いません",
      ]);
      assert.deepEqual(findingsOf(bill(price, ["| 初診料 | 291点 | 10円 | 2,910円 |", "| 画像診断 | 255点 | 10円 | 2,550円 |"])), []);
    });
    const enBill = (price: string, rows: readonly string[]): string =>
      [`| Item | Units | ${price} | Amount |`, "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
    ["Rate per unit", "Price per unit"].forEach((price) => {
      assert.deepEqual(
        findingsOf(enBill(price, ["| Room and board | 5 days | $1,200.00 | $6,000.00 |", "| Laboratory tests | 6 tests | $85.00 | $570.00 |"]), en),
        ["The amount $570.00 is not quantity × unit price (6 tests × $85.00 = $510.00)"],
      );
      assert.deepEqual(findingsOf(enBill(price, ["| Laboratory tests | 6 tests | $85.00 | $510.00 |"]), en), []);
    });
  });

  it("点数の列でも、単価と金額の列の無い表（試験の成績）は読まない", () => {
    assert.deepEqual(findingsOf("| 科目 | 点数 |\n| --- | --- |\n| 国語 | 78点 |\n| 数学 | 85点 |\n"), []);
    assert.deepEqual(findingsOf("| 科目 | 点数 | 満点 | 順位 |\n| --- | --- | --- | --- |\n| 国語 | 78点 | 100点 | 3 |\n"), []);
  });

  it("発注・納品・残の数量の列がある一つの表（納品書）で、どの数量を掛けても金額にならない行を指す", () => {
    const note = (rows: readonly string[]): string =>
      ["| 品名 | 発注数量 | 納品数量 | 残数 | 単価 | 金額 |", "| --- | --- | --- | --- | --- | --- |", ...rows].join("\n") + "\n";
    assert.deepEqual(findingsOf(note(["| コピー用紙 | 10箱 | 6箱 | 4箱 | 2,500円 | 16,000円 |", "| ボールペン | 20本 | 20本 | 0本 | 120円 | 2,400円 |"])), [
      "金額「16,000円」が、数量×単価（6箱 × 2,500円 = 15,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(note(["| コピー用紙 | 10箱 | 6箱 | 4箱 | 2,500円 | 15,000円 |", "| 封筒 | 10箱 | 6箱 | 4箱 | 500円 | 5,000円 |"])), []);
    assert.deepEqual(findingsOf(note(["| コピー用紙 | 10箱 | | | 2,500円 | 16,000円 |"])), [
      "金額「16,000円」が、数量×単価（10箱 × 2,500円 = 25,000円）と合いません",
    ]);
    const enNote = (rows: readonly string[]): string =>
      ["| Item | Qty ordered | Qty delivered | Qty backordered | Unit price | Amount |", "| --- | --- | --- | --- | --- | --- |", ...rows].join("\n") + "\n";
    assert.deepEqual(findingsOf(enNote(["| Copy paper | 10 | 6 | 4 | $25.00 | $160.00 |", "| Pens | 20 | 20 | 0 | $1.20 | $24.00 |"]), en), [
      "The amount $160.00 is not quantity × unit price (6 × $25.00 = $150.00)",
    ]);
    assert.deepEqual(findingsOf(enNote(["| Copy paper | 10 | 6 | 4 | $25.00 | $250.00 |"]), en), []);
    assert.deepEqual(
      findingsOf(
        "| Item | Ordered | Shipped | Backordered | Unit price | Amount |\n| --- | --- | --- | --- | --- | --- |\n| Pens | 20 | 18 | 2 | $1.20 | $25.00 |\n",
        en,
      ),
      ["The amount $25.00 is not quantity × unit price (18 × $1.20 = $21.60)"],
    );
  });

  it("複合の見出し一つでも数量の列と読む", () => {
    assert.deepEqual(findingsOf("| 品名 | 納品数量 | 単価 | 金額 |\n| --- | --- | --- | --- |\n| 封筒 | 6箱 | 500円 | 3,500円 |\n"), [
      "金額「3,500円」が、数量×単価（6箱 × 500円 = 3,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf("| 品名 | 出荷数量 | 単価 | 金額 |\n| --- | --- | --- | --- |\n| 封筒 | 6箱 | 500円 | 3,000円 |\n"), []);
    assert.deepEqual(findingsOf("| Item | Quantity shipped | Unit price | Amount |\n| --- | --- | --- | --- |\n| Pens | 18 | $1.20 | $25.00 |\n", en), [
      "The amount $25.00 is not quantity × unit price (18 × $1.20 = $21.60)",
    ]);
  });

  it("選べない数量の列が二つある表と、日付かもしれない役割の列一つは読まない", () => {
    assert.deepEqual(
      findingsOf("| 品名 | 前回納品数 | 今回納品数 | 単価 | 金額 |\n| --- | --- | --- | --- | --- |\n| 封筒 | 2箱 | 4箱 | 500円 | 9,000円 |\n"),
      [],
    );
    assert.deepEqual(findingsOf("| 品名 | 数量 | 個数 | 単価 | 金額 |\n| --- | --- | --- | --- | --- |\n| 封筒 | 2 | 4 | 500円 | 9,000円 |\n"), []);
    assert.deepEqual(findingsOf("| Item | Delivered | Unit price | Amount |\n| --- | --- | --- | --- |\n| Pens | 3 Oct | $1.20 | $25.00 |\n", en), []);
    assert.deepEqual(
      findingsOf("| Item | Ordered | Delivered | Unit price | Amount |\n| --- | --- | --- | --- | --- |\n| Service call | 1 | 3 | $10 | $25 |\n", en),
      [],
    );
    assert.deepEqual(findingsOf("| Item | Ordered / Delivered | Unit price | Amount |\n| --- | --- | --- | --- |\n| Pens | 20 | $1.20 | $25.00 |\n", en), []);
    assert.deepEqual(
      findingsOf("| 品名 | 発注数量 | 納品数量 | 単価 | 値引 | 金額 |\n| --- | --- | --- | --- | --- | --- |\n| 封筒 | 10 | 6 | 500円 | 300円 | 2,700円 |\n"),
      [],
    );
    assert.deepEqual(
      findingsOf("| 品名 | 発注数量 | 納品数量 | 単価 | 金額 |\n| --- | --- | --- | --- | --- |\n| 封筒 | 10 | 6 x 2 | 500円 | 9,000円 |\n"),
      [],
    );
  });

  it("賃料の明細の月額 × 月数 = 年額を読む", () => {
    const rent = (heading: string, rows: readonly string[]): string => [heading, "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
    assert.deepEqual(
      findingsOf(rent("| 項目 | 月額 | 月数 | 年額 |", ["| 賃料 | 75,000円 | 12か月 | 890,000円 |", "| 共益費 | 3,000円 | 12か月 | 36,000円 |"])),
      ["金額「890,000円」が、数量×単価（12か月 × 75,000円 = 900,000円）と合いません"],
    );
    assert.deepEqual(findingsOf(rent("| 項目 | 月額賃料 | ヶ月 | 年間 |", ["| 倉庫 | 40,000円 | 6 | 250,000円 |"])), [
      "金額「250,000円」が、数量×単価（6 × 40,000円 = 240,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(rent("| Item | Monthly | Months | Annual |", ["| Rent | £750.00 | 12 months | £8,900.00 |"]), en), [
      "The amount £8,900.00 is not quantity × unit price (12 months × £750.00 = £9,000.00)",
    ]);
    assert.deepEqual(findingsOf(rent("| Item | Monthly rent | Months | Annual total |", ["| Garage | £60.00 | 10 | £550.00 |"]), en), [
      "The amount £550.00 is not quantity × unit price (10 × £60.00 = £600.00)",
    ]);
    assert.deepEqual(findingsOf(rent("| 項目 | 月額 | 月数 | 年額 |", ["| 賃料 | 75,000円 | 12か月 | 900,000円 |", "| 合計 | | | 900,000円 |"])), []);
    assert.deepEqual(findingsOf(rent("| Item | Monthly | Months | Annual |", ["| Rent | £750.00 | 12 months | £9,000.00 |"]), en), []);
  });

  it("月数の無い月額と年額の表、前年の列、単位を言わない数量と年額の表、別の単位の数量は比べない", () => {
    assert.deepEqual(findingsOf("| 項目 | 月額 | 年額 |\n| --- | --- | --- |\n| 賃料 | 75,000円 | 890,000円 |\n"), []);
    assert.deepEqual(findingsOf("| Item | Monthly | Annual |\n| --- | --- | --- |\n| Rent | £750.00 | £8,900.00 |\n", en), []);
    assert.deepEqual(findingsOf("| 項目 | 月額 | 月数 | 前年 |\n| --- | --- | --- | --- |\n| 賃料 | 75,000円 | 12か月 | 880,000円 |\n"), []);
    assert.deepEqual(
      findingsOf("| 項目 | 月額 | 月数 | 前年 | 年額 |\n| --- | --- | --- | --- | --- |\n| 賃料 | 75,000円 | 12か月 | 880,000円 | 900,000円 |\n"),
      [],
    );
    assert.deepEqual(findingsOf("| 品目 | 数量 | 月額 | 年額 |\n| --- | --- | --- | --- |\n| 利用料 | 5 | 1,000円 | 60,000円 |\n"), []);
    assert.deepEqual(findingsOf("| Item | Units | Monthly | Annual |\n| --- | --- | --- | --- |\n| Seats | 5 | £10.00 | £600.00 |\n", en), []);
    assert.deepEqual(findingsOf("| 項目 | 月額 | 月数 | 年額 |\n| --- | --- | --- | --- |\n| 駐車場 | 8,000円 | 52週 | 102,000円 |\n"), []);
    assert.deepEqual(findingsOf("| 項目 | 時間 | 時給 | 年額 |\n| --- | --- | --- | --- |\n| 保守 | 2時間 | 1,000円 | 2,500円 |\n"), []);
    assert.deepEqual(findingsOf("| Item | Hours | Hourly rate | Annual |\n| --- | --- | --- | --- |\n| Support | 2 hours | $100 | $250 |\n", en), []);
    assert.deepEqual(findingsOf("| プラン | 数量 | 月額 | 金額 |\n| --- | --- | --- | --- |\n| 利用料 | 3 | 1,000円 | 3,500円 |\n"), [
      "金額「3,500円」が、数量×単価（3 × 1,000円 = 3,000円）と合いません",
    ]);
  });

  it("給付金の明細の日額 × 日数 = 金額を読む", () => {
    const benefit = (heading: string, rows: readonly string[]): string => [heading, "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
    assert.deepEqual(
      findingsOf(benefit("| 給付金 | 日数 | 日額 | 金額 |", ["| 入院給付金 | 8日 | 10,000円 | 70,000円 |", "| 通院給付金 | 3日 | 2,000円 | 6,000円 |"])),
      ["金額「70,000円」が、数量×単価（8日 × 10,000円 = 80,000円）と合いません"],
    );
    assert.deepEqual(findingsOf(benefit("| 給付金 | 入院日数 | 日額給付金 | 金額 |", ["| 入院 | 5 | 6,000円 | 36,000円 |"])), [
      "金額「36,000円」が、数量×単価（5 × 6,000円 = 30,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(benefit("| 給付金 | 通院日数 | 1日あたり | 金額 |", ["| 通院 | 2日 | 4,000円 | 9,000円 |"])), [
      "金額「9,000円」が、数量×単価（2日 × 4,000円 = 8,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(benefit("| Benefit | Days | Daily benefit | Amount |", ["| Hospital cash | 8 days | $120.00 | $900.00 |"]), en), [
      "The amount $900.00 is not quantity × unit price (8 days × $120.00 = $960.00)",
    ]);
    assert.deepEqual(findingsOf(benefit("| Benefit | Days in hospital | Per day | Amount |", ["| Hospital cash | 3 | $80.00 | $250.00 |"]), en), [
      "The amount $250.00 is not quantity × unit price (3 × $80.00 = $240.00)",
    ]);
    assert.deepEqual(findingsOf(benefit("| Item | Days | Daily rate | Amount |", ["| Van hire | 2 days | $65.00 | $120.00 |"]), en), [
      "The amount $120.00 is not quantity × unit price (2 days × $65.00 = $130.00)",
    ]);
    assert.deepEqual(findingsOf(benefit("| 給付金 | 日数 | 日額 | 金額 |", ["| 入院給付金 | 8日 | 10,000円 | 80,000円 |", "| 合計 | | | 80,000円 |"])), []);
    assert.deepEqual(findingsOf(benefit("| Benefit | Days | Daily benefit | Amount |", ["| Hospital cash | 8 days | $120.00 | $960.00 |"]), en), []);
  });

  it("価格の無い日数の表、日あたりでない単価、日でない数量、数量と日数の両方を持つ表は比べない", () => {
    assert.deepEqual(findingsOf("| 手続き | 日数 | 期限 |\n| --- | --- | --- |\n| 解約の通知 | 30日 | 2026年10月31日 |\n"), []);
    assert.deepEqual(findingsOf("| Step | Days | Fee |\n| --- | --- | --- |\n| Notice | 30 | $100 |\n", en), []);
    assert.deepEqual(findingsOf("| 作業 | 日数 | 時給 | 金額 |\n| --- | --- | --- | --- |\n| 保守 | 2日 | 1,000円 | 5,000円 |\n"), []);
    assert.deepEqual(findingsOf("| 項目 | 日数 | 月額 | 金額 |\n| --- | --- | --- | --- |\n| 駐車場 | 10日 | 8,000円 | 5,000円 |\n"), []);
    assert.deepEqual(findingsOf("| Item | Days | Hourly rate | Amount |\n| --- | --- | --- | --- |\n| Support | 2 | $100 | $500 |\n", en), []);
    assert.deepEqual(findingsOf("| Item | Days | Monthly | Amount |\n| --- | --- | --- | --- |\n| Parking | 10 | $300 | $150 |\n", en), []);
    assert.deepEqual(findingsOf("| 給付金 | 日数 | 日額 | 金額 |\n| --- | --- | --- | --- |\n| 付添 | 6時間 | 5,000円 | 10,000円 |\n"), []);
    assert.deepEqual(findingsOf("| 品目 | 数量 | 日数 | 単価 | 金額 |\n| --- | --- | --- | --- | --- |\n| 足場 | 2 | 5日 | 1,000円 | 10,000円 |\n"), []);
  });

  it("申込とチケットの明細の人数・枚数の列を数量と読む", () => {
    const order = (heading: string, row: string): string => [heading, "| --- | --- | --- | --- |", row].join("\n") + "\n";
    assert.deepEqual(findingsOf(order("| 席種 | 枚数 | 単価 | 金額 |", "| S席 | 2枚 | 8,200円 | 15,600円 |")), [
      "金額「15,600円」が、数量×単価（2枚 × 8,200円 = 16,400円）と合いません",
    ]);
    assert.deepEqual(findingsOf(order("| 区分 | 人数 | 単価 | 金額 |", "| 一般参加 | 2名 | 6,500円 | 12,000円 |")), [
      "金額「12,000円」が、数量×単価（2名 × 6,500円 = 13,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(order("| コース | 参加人数 | 単価 | 金額 |", "| 見学会 | 3名 | 1,500円 | 4,000円 |")), [
      "金額「4,000円」が、数量×単価（3名 × 1,500円 = 4,500円）と合いません",
    ]);
    const enOrder = (quantity: string, row: string): string => order(`| Item | ${quantity} | Unit price | Amount |`, row);
    assert.deepEqual(findingsOf(enOrder("Tickets", "| Stalls | 2 tickets | $72.00 | $136.00 |"), en), [
      "The amount $136.00 is not quantity × unit price (2 tickets × $72.00 = $144.00)",
    ]);
    assert.deepEqual(findingsOf(enOrder("Attendees", "| Admission | 2 people | $125.00 | $240.00 |"), en), [
      "The amount $240.00 is not quantity × unit price (2 people × $125.00 = $250.00)",
    ]);
    assert.deepEqual(findingsOf(enOrder("Seats", "| Licence | 5 | $12.00 | $50.00 |"), en), [
      "The amount $50.00 is not quantity × unit price (5 × $12.00 = $60.00)",
    ]);
    assert.deepEqual(findingsOf(enOrder("Persons", "| Tour | 4 | $30.00 | $100.00 |"), en), [
      "The amount $100.00 is not quantity × unit price (4 × $30.00 = $120.00)",
    ]);
    assert.deepEqual(findingsOf(order("| 席種 | 枚数 | 単価 | 金額 |", "| S席 | 2枚 | 8,200円 | 16,400円 |")), []);
    assert.deepEqual(findingsOf(enOrder("Tickets", "| Stalls | 2 tickets | $72.00 | $144.00 |"), en), []);
  });

  it("人数の列でも、単価と金額の列の無い表、ほかの数の列（泊数）のある行、数量の列と並ぶ表、年額の表は比べない", () => {
    assert.deepEqual(findingsOf("| クラス | 人数 | 予算 |\n| --- | --- | --- |\n| 1組 | 32名 | 50,000円 |\n"), []);
    assert.deepEqual(findingsOf("| クラス | 人数 | 一人あたり | 予算 |\n| --- | --- | --- | --- |\n| 1組 | 32名 | 1,500円 | 50,000円 |\n"), []);
    assert.deepEqual(findingsOf("| 部屋 | 人数 | 泊数 | 単価 | 金額 |\n| --- | --- | --- | --- | --- |\n| 和室 | 2名 | 2泊 | 12,000円 | 48,000円 |\n"), []);
    assert.deepEqual(findingsOf("| 品目 | 数量 | 人数 | 単価 | 金額 |\n| --- | --- | --- | --- | --- |\n| 研修 | 2回 | 10名 | 5,000円 | 100,000円 |\n"), []);
    assert.deepEqual(findingsOf("| Plan | Seats | Monthly | Annual |\n| --- | --- | --- | --- |\n| Team | 5 | £10.00 | £600.00 |\n", en), []);
    assert.deepEqual(findingsOf("| Room | Guests | Rate | Amount |\n| --- | --- | --- | --- |\n| Double | 2 | $150.00 | $450.00 |\n", en), []);
  });

  const rows = (heading: string, body: readonly string[]): string => {
    const width = heading.split("|").length - 2;
    return [heading, `|${" --- |".repeat(width)}`, ...body].join("\n") + "\n";
  };
  const JA_PACK = "| 品番 | 品名 | 入数 | 単価（税抜） | 1箱の価格（税抜） | 1箱の価格（税込・10%） |";
  const EN_PACK = "| Item code | Description | Pack of | Unit price (excl. tax) | Pack price (excl. tax) | Pack price (incl. 8% tax) |";

  it("カタログの入数 × 単価が1箱の価格と合わない行を指す（品名の数と税込の価格の列があっても）", () => {
    assert.deepEqual(findingsOf(rows(JA_PACK, ["| NB-1 | 方眼ノート A5 | 5冊 | 190円 | 900円 | 990円 |"])), [
      "金額「900円」が、数量×単価（5冊 × 190円 = 950円）と合いません",
    ]);
    assert.deepEqual(findingsOf(rows(EN_PACK, ["| NB-1 | Grid notebook, A5 | 5 notebooks | $1.90 | $9.00 | $9.72 |"]), en), [
      "The amount $9.00 is not quantity × unit price (5 notebooks × $1.90 = $9.50)",
    ]);
    assert.deepEqual(findingsOf(rows("| Product | Units per box | Unit price | Box price |", ["| Clip | 20 | $0.35 | $7.50 |"]), en), [
      "The amount $7.50 is not quantity × unit price (20 × $0.35 = $7.00)",
    ]);
    assert.deepEqual(
      findingsOf(rows(JA_PACK, ["| NB-1 | 方眼ノート A5 | 5冊 | 180円 | 900円 | 990円 |", "| CL-2 | クリップ | 20個 | 35円 | 700円 | 770円 |"])),
      [],
    );
    assert.deepEqual(findingsOf(rows(EN_PACK, ["| NB-1 | Grid notebook, A5 | 5 notebooks | $1.80 | $9.00 | $9.72 |"]), en), []);
  });

  it("入数は注文の数量ではない。1箱の価格の列が無ければ読まず、注文の数量と金額の列は1箱の価格を変えない", () => {
    const order = "| 品名 | 入数 | 単価 | 数量 | 金額 |";
    assert.deepEqual(findingsOf(rows(order, ["| ボールペン | 10本 | 120円 | 3箱 | 3,600円 |", "| ボールペン | 10本 | 1,200円 | 3箱 | 3,600円 |"])), []);
    assert.deepEqual(findingsOf(rows("| 品名 | 入数 | 単価 | 金額 |", ["| ボールペン | 10本 | 120円 | 1,000円 |"])), []);
    const both = "| 品名 | 入数 | 単価 | 1箱の価格 | 数量 | 金額 |";
    assert.deepEqual(findingsOf(rows(both, ["| ボールペン | 10本 | 120円 | 1,200円 | 3箱 | 3,600円 |"])), []);
    assert.deepEqual(findingsOf(rows(both, ["| ボールペン | 10本 | 120円 | 1,300円 | 3箱 | 3,900円 |"])), [
      "金額「1,300円」が、数量×単価（10本 × 120円 = 1,200円）と合いません",
    ]);
    const enBoth = "| Item | Pack of | Unit price | Pack price | Qty | Amount |";
    // The order's amount is quantity × pack price, which the unit price does not give: that row is not compared.
    assert.deepEqual(findingsOf(rows(enBoth, ["| Pen | 10 | $1.20 | $12.00 | 3 | $36.00 |", "| Pen | 10 | $1.20 | $12.00 | 3 | $40.00 |"]), en), []);
  });

  it("入数の列の無い価格表（注文数ごとの1箱の価格）は読まない", () => {
    const tier = "| ご注文数 | 1枚の単価（税抜） | 1箱の価格（税抜） | 1箱の価格（税込・10%） |";
    assert.deepEqual(findingsOf(rows(tier, ["| 100箱以上 | 6.4円 | 6,600円 | 7,260円 |"])), []);
    const enTier = "| Order quantity | Price per envelope (excl. tax) | Box price (excl. tax) | Box price (incl. 8% tax) |";
    assert.deepEqual(findingsOf(rows(enTier, ["| 100 boxes or more | $0.064 | $66.00 | $71.28 |"]), en), []);
  });

  it("品名の列と、金額を税込で言い直す列の数では行を外さない。ほかの列の数では外す", () => {
    assert.deepEqual(findingsOf(rows("| 品番 | 品名 | 数量 | 単価 | 金額 |", ["| NB-1 | 方眼ノート A5 | 4冊 | 180円 | 700円 |"])), [
      "金額「700円」が、数量×単価（4冊 × 180円 = 720円）と合いません",
    ]);
    assert.deepEqual(findingsOf(rows("| 品目 | 数量 | 単価 | 金額（税抜） | 金額（税込） |", ["| 設計 | 4 | 1,000円 | 3,500円 | 3,850円 |"])), [
      "金額「3,500円」が、数量×単価（4 × 1,000円 = 4,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(rows("| Item | Qty | Unit price | Amount | Amount (incl. tax) |", ["| Pen | 4 | $1.00 | $3.50 | $3.78 |"]), en), [
      "The amount $3.50 is not quantity × unit price (4 × $1.00 = $4.00)",
    ]);
    assert.deepEqual(findingsOf(rows("| 品番 | 規格 | 数量 | 単価 | 金額 |", ["| NB-1 | A5 | 4冊 | 180円 | 700円 |"])), []);
    assert.deepEqual(findingsOf(rows("| 品目 | 数量 | 単価 | 単価（税込） | 金額 |", ["| 設計 | 4 | 1,000円 | 1,100円 | 3,500円 |"])), []);
    assert.deepEqual(findingsOf(rows("| Item | Qty | Unit price | Tax rate (incl.) | Amount |", ["| Pen | 4 | $1.00 | 8% | $3.50 |"]), en), []);
    assert.deepEqual(findingsOf(rows("| 品目 | 数量 | 単価 | 金額 | 金額のうち値引き |", ["| 設計 | 4 | 1,000円 | 3,500円 | 500円 |"])), []);
    assert.deepEqual(findingsOf(rows("| Item | Pack of | Unit price | Pack price | Amount |", ["| Pen | 10 | $1.20 | $13.00 | $1.00 |"]), en), []);
  });

  it("授業料の明細の単位数と1単位あたりの授業料を読む", () => {
    const credits = (heads: string, rows: readonly string[]): string => [heads, "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
    assert.deepEqual(
      findingsOf(
        credits("| 科目 | 単位数 | 1単位あたりの授業料 | 金額 |", ["| 統計学 | 2単位 | 15,000円 | 30,000円 |", "| 会計学 | 3単位 | 15,000円 | 30,000円 |"]),
      ),
      ["金額「30,000円」が、数量×単価（3単位 × 15,000円 = 45,000円）と合いません"],
    );
    assert.equal(findingsOf(credits("| 科目 | 履修単位数 | 単位あたり | 金額 |", ["| 英語 | 2 | 12,000円 | 36,000円 |"])).length, 1);
    assert.deepEqual(findingsOf(credits("| 科目 | 履修単位数 | 単位あたり | 金額 |", ["| 英語 | 3 | 12,000円 | 36,000円 |"])), []);
    assert.deepEqual(findingsOf(credits("| Course | Credits | Tuition per credit | Amount |", ["| Statistics | 4 credits | $320.00 | $960.00 |"]), en), [
      "The amount $960.00 is not quantity × unit price (4 credits × $320.00 = $1280.00)",
    ]);
    assert.equal(findingsOf(credits("| Course | Credit hours | Fee per credit | Amount |", ["| Writing | 3 credit hours | $300 | $600 |"]), en).length, 1);
    assert.equal(findingsOf(credits("| Course | Credits | Per credit | Amount |", ["| Writing | 1 credit | $300 | $600 |"]), en).length, 1);
    assert.deepEqual(
      findingsOf(credits("| Course | Credits | Per credit | Amount |", ["| Writing | 1 credit | $300 | $300 |", "| Lab | 2 | $300 | $600 |"]), en),
      [],
    );
  });

  it("単位あたりの授業料と時間・時給を掛けず、単位数だけの成績表と「単位」「単位：円」の見出しは読まない", () => {
    const four = (heads: string, row: string): string => [heads, "| --- | --- | --- | --- |", row].join("\n") + "\n";
    assert.deepEqual(findingsOf(four("| 科目 | 時間 | 1単位あたりの授業料 | 金額 |", "| 実習 | 2 | 15,000円 | 45,000円 |")), []);
    assert.deepEqual(findingsOf(four("| 科目 | 単位数 | 1単位あたりの授業料 | 金額 |", "| 実習 | 2時間 | 15,000円 | 45,000円 |")), []);
    assert.deepEqual(findingsOf(four("| 科目 | 単位数 | 時給 | 金額 |", "| 実習 | 2 | 1,500円 | 4,500円 |")), []);
    assert.deepEqual(findingsOf(four("| Course | Hours | Tuition per credit | Amount |", "| Lab | 2 | $300 | $900 |"), en), []);
    assert.deepEqual(findingsOf(four("| Course | Credits | Hourly rate | Amount |", "| Lab | 2 credits | $30 | $90 |"), en), []);
    assert.deepEqual(findingsOf(four("| 科目 | 単位数 | 評価 | GP |", "| 統計学 | 2 | A | 3 |")), []);
    assert.deepEqual(findingsOf(four("| Course | Credits | Grade | Grade points |", "| Statistics | 3 | A | 4 |"), en), []);
    assert.deepEqual(findingsOf(four("| 品目 | 単位 | 単価 | 金額 |", "| 統計学 | 2単位 | 15,000円 | 40,000円 |")), []);
    assert.deepEqual(findingsOf(four("| 品目 | 単位：円 | 単価 | 金額 |", "| ボルト | 10 | 50円 | 600円 |")), []);
  });

  it("単位を読む", () => {
    const marks = [
      { pattern: "/h", unit: "hour" },
      { pattern: "/hour", unit: "hour" },
      { pattern: "月額", unit: "month" },
    ];
    assert.deepEqual(perUnitPrice("$", "/hour", marks), { before: "$", after: "", unit: "hour" });
    assert.deepEqual(perUnitPrice("$", "/H", marks), { before: "$", after: "", unit: "hour" });
    assert.deepEqual(perUnitPrice("月額", "円", marks), { before: "", after: "円", unit: "month" });
    assert.equal(perUnitPrice("$", "", marks), undefined);
    assert.equal(perUnitPrice("", "/hours", marks), undefined);
    assert.equal(perUnitPrice("$", "/hour", []), undefined);
    const units = [{ pattern: "days", unit: "day" }];
    assert.equal(quantityUnit("Days", units), "day");
    assert.equal(quantityUnit("days.", units), "day");
    assert.equal(quantityUnit("", units), "");
    assert.equal(quantityUnit("  ", units), "");
    assert.equal(quantityUnit("人日", units), undefined);
    assert.equal(unitsAgree(undefined, undefined), true);
    assert.equal(unitsAgree("day", undefined), true);
    assert.equal(unitsAgree("", "hour"), true);
    assert.equal(unitsAgree("hour", "hour"), true);
    assert.equal(unitsAgree("day", "hour"), false);
    assert.equal(unitsAgree(undefined, "hour"), false);
    assert.equal(unitsAgree("hour", "unstated"), false);
    const rateUnits = ["hour", "day", "mile"];
    assert.equal(priceHeadingUnit("unstated", "hour", rateUnits), "hour");
    assert.equal(priceHeadingUnit("unstated", "mile", rateUnits), "mile");
    assert.equal(priceHeadingUnit("unstated", undefined, rateUnits), "unstated");
    assert.equal(priceHeadingUnit("unstated", "unstated", rateUnits), "unstated");
    assert.equal(priceHeadingUnit("unstated", "hour", []), "unstated");
    assert.equal(priceHeadingUnit("day", "hour", rateUnits), "day");
    assert.equal(priceHeadingUnit(undefined, "hour", rateUnits), undefined);
    assert.equal(priceHeadingUnit(undefined, undefined, []), undefined);
  });
});

describe("line-amount-mismatch: 不動産の精算書（日割りと土地の面積）", () => {
  const statement = (heading: string, rows: readonly string[]): string => [heading, "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";

  it("固定資産税の日割り（日数 × 日割額）を読む", () => {
    assert.deepEqual(findingsOf(statement("| 項目 | 日数 | 日割額 | 金額 |", ["| 固定資産税（10月1日〜12月31日） | 92日 | 300円 | 29,600円 |"])), [
      "金額「29,600円」が、数量×単価（92日 × 300円 = 27,600円）と合いません",
    ]);
    assert.deepEqual(findingsOf(statement("| 項目 | 日数 | 日割り額 | 金額 |", ["| 都市計画税 | 15日 | 120円 | 1,800円 |"])), []);
    assert.deepEqual(
      findingsOf(statement("| Item | Days | Daily amount | Amount |", ["| County taxes (Oct 1 to Dec 31) | 92 days | $12.00 | $1,140.00 |"]), en),
      ["The amount $1,140.00 is not quantity × unit price (92 days × $12.00 = $1,104.00)"],
    );
    assert.deepEqual(findingsOf(statement("| Item | Days | Per day | Amount |", ["| HOA dues | 15 days | $4.00 | $60.00 |"]), en), []);
  });

  it("土地の面積 × 面積あたりの単価を読む（㎡、坪、sq ft、m²）", () => {
    assert.deepEqual(findingsOf(statement("| 項目 | 面積 | ㎡単価 | 金額 |", ["| 土地（実測） | 120.50㎡ | 200,000円 | 21,400,000円 |"])), [
      "金額「21,400,000円」が、数量×単価（120.50m2 × 200,000円 = 24,100,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(statement("| 項目 | 土地面積 | 坪単価 | 金額 |", ["| 宅地 | 40坪 | 900,000円 | 32,000,000円 |"])), [
      "金額「32,000,000円」が、数量×単価（40坪 × 900,000円 = 36,000,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(statement("| 項目 | 敷地面積 | 平米単価 | 金額 |", ["| 敷地 | 80平米 | 150,000円 | 12,000,000円 |"])), []);
    assert.deepEqual(findingsOf(statement("| Item | Area | Price per sq ft | Amount |", ["| Lot | 5,400 sq ft | $30.00 | $126,000.00 |"]), en), [
      "The amount $126,000.00 is not quantity × unit price (5,400 sq ft × $30.00 = $162,000.00)",
    ]);
    assert.deepEqual(
      findingsOf(statement("| Item | Lot area | Price per square foot | Amount |", ["| Lot | 2,000 square feet | $25.00 | $50,000.00 |"]), en),
      [],
    );
    assert.deepEqual(findingsOf(statement("| Item | Land area | Price per m² | Amount |", ["| Plot | 300 m² | $400.00 | $102,000.00 |"]), en), [
      "The amount $102,000.00 is not quantity × unit price (300 m2 × $400.00 = $120,000.00)",
    ]);
  });

  it("面積を日あたり・時間あたりの単価や別の面積の単位の単価とは掛けない", () => {
    assert.deepEqual(findingsOf(statement("| 項目 | 面積 | 日割額 | 金額 |", ["| 土地 | 100㎡ | 300円 | 1,000円 |"])), []);
    assert.deepEqual(findingsOf(statement("| 項目 | 面積 | 時給 | 金額 |", ["| 清掃 | 100 | 1,200円 | 3,000円 |"])), []);
    assert.deepEqual(findingsOf(statement("| 項目 | 面積 | 坪単価 | 金額 |", ["| 土地 | 100㎡ | 900,000円 | 30,000,000円 |"])), []);
    assert.deepEqual(findingsOf(statement("| 項目 | 面積 | ㎡単価 | 金額 |", ["| 土地 | 30坪 | 300,000円 | 30,000,000円 |"])), []);
    assert.deepEqual(findingsOf(statement("| Item | Area | Per day | Amount |", ["| Storage | 120 sq ft | $2.00 | $60.00 |"]), en), []);
    assert.deepEqual(findingsOf(statement("| Item | Area | Hourly rate | Amount |", ["| Cleaning | 800 | $40.00 | $120.00 |"]), en), []);
    assert.deepEqual(findingsOf(statement("| Item | Area | Price per sq ft | Amount |", ["| Lot | 500 m² | $30.00 | $45,000.00 |"]), en), []);
    assert.deepEqual(findingsOf(statement("| Item | Days | Price per sq ft | Amount |", ["| Rental | 5 days | $30.00 | $100.00 |"]), en), []);
  });

  it("地域名の Area の列は数量と読まない", () => {
    assert.deepEqual(
      findingsOf(statement("| Item | Area | Price | Amount |", ["| Delivery | North | $40.00 | $90.00 |", "| Delivery | Zone 3 | $40.00 | $90.00 |"]), en),
      [],
    );
  });
});

describe("line-amount-mismatch: 項目の升の括弧に書いた 単価×人数", () => {
  const income = (rows: readonly string[]): string => ["| 項目 | 金額 |", "| --- | --- |", ...rows].join("\n") + "\n";
  const enIncome = (rows: readonly string[]): string => ["| Item | Amount |", "| --- | --- |", ...rows].join("\n") + "\n";

  it("単価×人数と違う金額を指す。人数×単価の順でも読む", () => {
    assert.deepEqual(findingsOf(income(["| 会費（3,000円×26名） | 72,000円 |"])), ["金額「72,000円」が、数量×単価（26名 × 3,000円 = 78,000円）と合いません"]);
    assert.deepEqual(findingsOf(income(["| 協賛金(12社×5,000円) | 50,000円 |"])), ["金額「50,000円」が、数量×単価（12社 × 5,000円 = 60,000円）と合いません"]);
    assert.deepEqual(findingsOf(enIncome(["| Membership dues (26 members × $40) | $960.00 |"]), en), [
      "The amount $960.00 is not quantity × unit price (26 members × $40 = $1040.00)",
    ]);
    assert.deepEqual(findingsOf(enIncome(["| Raffle (120 tickets x $2.50) | $250 |"]), en), [
      "The amount $250 is not quantity × unit price (120 tickets × $2.50 = $300)",
    ]);
  });

  it("合えば言わない", () => {
    assert.deepEqual(findingsOf(income(["| 会費（3,000円×24名） | 72,000円 |", "| 協賛金（5,000円×12社） | 60,000円 |"])), []);
    assert.deepEqual(findingsOf(enIncome(["| Membership dues (24 members × $40) | $960.00 |", "| Raffle (120 tickets x $2.50) | $300 |"]), en), []);
  });

  it("掛け算が一つの金額と数える語の数でなければ読まない", () => {
    const skipped = [
      "| 会費（3,000円×24名×2回） | 72,000円 |",
      "| 手数料（72,000円×5%） | 3,000円 |",
      "| 床面積（12m×4m） | 72,000円 |",
      "| 会費（3,000×24名） | 72,000円 |",
      "| 会費（3,000円×24） | 72,000円 |",
      "| 会費（3,000円×24日） | 72,000円 |",
      "| 会費（月額3,000円×24名） | 72,000円 |",
      "| 会費（3,000円×24名）（2,000円×3名） | 72,000円 |",
      "| 会費 3,000円×24名 | 72,000円 |",
    ];
    skipped.forEach((row) => assert.deepEqual(findingsOf(income([row])), [], row));
    assert.deepEqual(
      findingsOf(enIncome(["| Dues (24 membersx$40) | $960.00 |", "| Box (24 boxes × $40) | $960.00 |", "| Dues (24¹ members × $40) | $960.00 |"]), en),
      [],
    );
  });

  it("行にほかの数があるか、金額の書き方が単価と違えば読まない", () => {
    const budget = ["| 項目 | 予算 | 決算 |", "| --- | --- | --- |", "| 会費（3,000円×26名） | 78,000円 | 72,000円 |"].join("\n") + "\n";
    assert.deepEqual(findingsOf(budget), []);
    assert.deepEqual(findingsOf(income(["| 会費（3,000円×26名） | 7.2万円 |", "| 会費（3,000円×26名） | ¥72,000 |", "| 会費（3,000円×26名） | 未定 |"])), []);
    assert.deepEqual(findingsOf(income(["| 会費（3,000円×26名） | ▲72,000円 |"])), []);
  });

  it("読み方の部品", () => {
    const times = ["×", "x"];
    assert.deepEqual(factorsOf("3,000円×24名", times), ["3,000円", "24名"]);
    assert.deepEqual(factorsOf("24 members x $40", times), ["24 members", "$40"]);
    assert.equal(factorsOf("24 membersx$40", times), undefined);
    assert.equal(factorsOf("3,000円×24名×2回", times), undefined);
    assert.equal(factorsOf("72,000円×5%", times), undefined);
    assert.equal(factorsOf("3,000円と24名", times), undefined);
    assert.equal(factorsOf("3,000円×24名", []), undefined);
    assert.equal(factorsOf("", times), undefined);
    assert.equal(countOf("24名", ["名"]), 24);
    assert.equal(countOf("1,200 Members", ["members"]), 1200);
    assert.equal(countOf("24", ["名"]), undefined);
    assert.equal(countOf("24日", ["名"]), undefined);
    assert.equal(countOf("2.5名", ["名"]), undefined);
    assert.equal(countOf("約24名", ["名"]), undefined);
    assert.equal(countOf("", ["名"]), undefined);
    const words = { times, counts: ["名"], isMoney: (text: string): boolean => text.endsWith("円") };
    assert.equal(labelProductOf("会費（3,000円×24名）", words)?.count, 24);
    assert.equal(labelProductOf("会費（3,000円×24名）", words)?.price.value, 3000);
    assert.equal(labelProductOf("会費", words), undefined);
    assert.equal(labelProductOf("会費（3,000円×24¹名）", words), undefined);
    assert.equal(labelProductOf("会費（24名×24名）", words), undefined);
    assert.equal(labelProductOf("会費（3,000円×3,000円）", words), undefined);
  });
});
