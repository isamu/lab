import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { cellNumber, lineAmountMismatches, quantityOf } from "../packages/chaff/src/structure/line-amount.ts";
import { perUnitPrice, priceHeadingUnit, quantityUnit, unitsAgree } from "../packages/chaff/src/structure/line-amount-unit.ts";

// 数量×単価が金額と合わない（line-amount-mismatch）。例文はすべて自作。

const RULE = "line-amount-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const table = (rows: readonly string[]): string => ["| 品目 | 数量 | 単価 | 金額 |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
const enTable = (rows: readonly string[]): string => ["| Item | Quantity | Unit price | Amount |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";

const NO_UNITS = { units: [], perUnitMarks: [], headerUnits: [], measureUnits: [], orderRoles: [] };
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
