import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { glossedYearReader, type Era, type GlossedYear } from "../packages/lang-ja/src/era-year.ts";
import { loadCalendarEras } from "../packages/lang-ja/src/lexicons.ts";

// 元号の年と西暦の年を括弧で並べた年。純粋な読み方なので、元号は表を渡して試す。

const ERAS: readonly Era[] = [
  { name: "令和", firstYear: 2019 },
  { name: "平成", firstYear: 1989 },
];

const read = glossedYearReader(ERAS);

const yearsOf = (text: string): [number, number, number, number][] =>
  read(text).map((found: GlossedYear) => [found.start, found.end, found.year, found.glossYear]);

describe("括弧で並べた元号の年と西暦の年", () => {
  const cases: readonly (readonly [string, readonly [number, number, number, number][]])[] = [
    ["令和6年（2024年）12月17日", [[0, 11, 2024, 2024]]],
    ["令和6年(2024年)", [[0, 11, 2024, 2024]]],
    ["2024年（令和6年）12月17日", [[0, 11, 2024, 2024]]],
    ["令和6（2024）年12月17日", [[0, 10, 2024, 2024]]],
    ["2024（令和6）年", [[0, 10, 2024, 2024]]],
    ["令和６年（２０２４年）", [[0, 11, 2024, 2024]]],
    ["令和元年（2019年）5月1日", [[0, 11, 2019, 2019]]],
    ["2019年（令和元年）", [[0, 11, 2019, 2019]]],
    ["令和元（2019）年", [[0, 10, 2019, 2019]]],
    ["令和 6 年（2024年）", [[0, 13, 2024, 2024]]],
    ["令和六年（二〇二四年）", [[0, 11, 2024, 2024]]],
    ["平成三十一年（2019年）", [[0, 13, 2019, 2019]]],
    [
      "申請日は令和6年（2024年）4月1日、締切は2025年（令和7年）3月31日。",
      [
        [4, 15, 2024, 2024],
        [23, 34, 2025, 2025],
      ],
    ],
  ];
  cases.forEach(([text, expected]) => {
    it(text, () => assert.deepEqual(yearsOf(text), expected));
  });

  it("括弧の外に書いた年を year に、中の年を glossYear に読む", () => {
    assert.deepEqual(yearsOf("令和6年（2023年）"), [[0, 11, 2024, 2023]]);
    assert.deepEqual(yearsOf("2023年（令和6年）"), [[0, 11, 2023, 2024]]);
  });
});

describe("括弧で並べた年でないもの", () => {
  const cases: readonly string[] = [
    "",
    "令和6年12月17日",
    "2024年12月17日",
    "令和6年（予定）12月17日",
    "3年（令和8年）",
    "令和6年（第2024号）",
    "12024年（令和6年）",
    "令和6年（20245年）",
    "令和6年（2024）",
    "大正5年（1916年）",
    "令和0年（2018年）",
    "令和6年（2024年",
  ];
  cases.forEach((text) => {
    it(JSON.stringify(text), () => assert.deepEqual(yearsOf(text), []));
  });

  it("元号の無い表では何も読まない", () => {
    assert.deepEqual(glossedYearReader([])("令和6年（2024年）"), []);
  });
});

describe("語彙表 calendar-era", () => {
  it("どの元号にも元年の西暦の年がある", () => {
    const eras = loadCalendarEras();
    assert.deepEqual(
      eras.map((era) => [era.name, era.firstYear]),
      [
        ["令和", 2019],
        ["平成", 1989],
        ["昭和", 1926],
        ["大正", 1912],
        ["明治", 1868],
      ],
    );
  });
});
