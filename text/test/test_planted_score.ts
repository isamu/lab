import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cleanFindingLines,
  expectationChanges,
  expectationOf,
  formatRecall,
  misalignedPlants,
  parseExpectation,
  parseManifest,
  pickSets,
  recallByKind,
  type PlantedDocument,
} from "../scripts/planted-score.ts";

// yarn planted の数え方。植えた誤りを種類ごとに数え、きれいな版の指摘を数え、記録と比べる。

const mistake = (kind: string, rule: string, line: number) => ({ kind, rule, line, clean: "a", planted: "b" });

const documents: PlantedDocument[] = [
  {
    id: "ja/one",
    language: "ja",
    genre: "legal/contract",
    clean: "ja/one.clean.md",
    planted: "ja/one.planted.md",
    mistakes: [mistake("total", "total-mismatch", 3), mistake("dangling", "dangling-reference", 5)],
  },
  {
    id: "ja/two",
    language: "ja",
    genre: "legal/contract",
    clean: "ja/two.clean.md",
    planted: "ja/two.planted.md",
    mistakes: [mistake("total", "total-mismatch", 7)],
  },
  {
    id: "en/one",
    language: "en",
    genre: "legal/contract",
    clean: "en/one.clean.md",
    planted: "en/one.planted.md",
    mistakes: [mistake("total", "total-mismatch", 2)],
  },
];

describe("parseManifest", () => {
  it("文書と植えた誤りを読む", () => {
    const parsed = parseManifest({ documents });
    assert.deepEqual(parsed, documents);
  });

  it("欠けた項目・形の違う値は、どこが悪いかを言って止まる", () => {
    assert.throws(() => parseManifest({}), /no documents/u);
    assert.throws(() => parseManifest({ documents: [null] }), /documents\[0\] is not an object/u);
    assert.throws(() => parseManifest({ documents: [{ ...documents[0], mistakes: undefined }] }), /ja\/one has no mistakes/u);
    assert.throws(() => parseManifest({ documents: [{ ...documents[0], language: "" }] }), /has no language/u);
    const badLine = { ...documents[0], mistakes: [{ ...mistake("total", "total-mismatch", 3), line: 0 }] };
    assert.throws(() => parseManifest({ documents: [badLine] }), /ja\/one mistakes\[0\] has no line/u);
    const fractional = { ...documents[0], mistakes: [{ ...mistake("total", "total-mismatch", 3), line: 2.5 }] };
    assert.throws(() => parseManifest({ documents: [fractional] }), /has no line/u);
  });
});

describe("misalignedPlants", () => {
  const document: PlantedDocument = {
    id: "ja/two",
    language: "ja",
    genre: "legal/contract",
    clean: "ja/two.clean.md",
    planted: "ja/two.planted.md",
    mistakes: [{ kind: "total", rule: "total-mismatch", line: 2, clean: "60,000", planted: "50,000" }],
  };

  it("きれいな版と植えた版の同じ行に、それぞれの文字列があれば合っている", () => {
    assert.deepEqual(misalignedPlants(document, ["x", "保守費60,000円"], ["x", "保守費50,000円"]), []);
  });

  it("行がずれた・文書が短いときは、どちら側かを言う", () => {
    assert.deepEqual(misalignedPlants(document, ["保守費60,000円", "x"], ["x", "保守費50,000円"]), ['ja/two:2 total: clean line has no "60,000"']);
    assert.deepEqual(misalignedPlants(document, ["x", "保守費60,000円"], ["x"]), ['ja/two:2 total: planted line has no "50,000"']);
  });
});

describe("recallByKind", () => {
  it("狙いの rule が植えた行で言ったものだけを見つけたと数える。言語ごと、最初に出た順", () => {
    const findings = new Map([
      [
        "ja/one",
        [
          { rule: "total-mismatch", line: 3 },
          { rule: "dangling-reference", line: 6 },
        ],
      ],
      ["ja/two", [{ rule: "dangling-reference", line: 7 }]],
    ]);
    assert.deepEqual(recallByKind(documents, findings), [
      { language: "ja", kind: "total", rule: "total-mismatch", found: 1, total: 2, missed: ["ja/two:7"] },
      { language: "ja", kind: "dangling", rule: "dangling-reference", found: 0, total: 1, missed: ["ja/one:5"] },
      { language: "en", kind: "total", rule: "total-mismatch", found: 0, total: 1, missed: ["en/one:2"] },
    ]);
  });

  it("指摘の無い文書は、すべて見逃し", () => {
    assert.deepEqual(
      recallByKind(documents, new Map()).map((entry) => entry.found),
      [0, 0, 0],
    );
  });
});

describe("cleanFindingLines", () => {
  it("きれいな版の指摘のうち、測っている rule のものだけを並べる", () => {
    const findings = new Map([
      [
        "ja/two",
        [
          { rule: "dangling-reference", line: 9 },
          { rule: "max-ten", line: 1 },
        ],
      ],
      ["ja/one", [{ rule: "total-mismatch", line: 4 }]],
    ]);
    assert.deepEqual(cleanFindingLines(documents, findings), ["ja/one.clean.md:4 total-mismatch", "ja/two.clean.md:9 dangling-reference"]);
    assert.deepEqual(cleanFindingLines(documents, new Map()), []);
  });
});

describe("expectationChanges", () => {
  const recalls = recallByKind(documents, new Map([["ja/one", [{ rule: "total-mismatch", line: 3 }]]]));
  const expected = expectationOf(recalls, ["ja/one.clean.md:4 total-mismatch"]);

  it("記録した形のまま読み戻せて、同じなら違いは無い", () => {
    assert.deepEqual(expected.recall, { ja: { total: "1/2", dangling: "0/1" }, en: { total: "0/1" } });
    const roundTrip = parseExpectation(JSON.parse(JSON.stringify(expected)));
    assert.deepEqual(expectationChanges(roundTrip, expected), []);
  });

  it("見つけた数が減れば dropped、増えれば changed、きれいな版の指摘の増減も言う", () => {
    const worse = expectationOf(recallByKind(documents, new Map()), ["ja/one.clean.md:4 total-mismatch", "ja/two.clean.md:1 total-mismatch"]);
    assert.deepEqual(expectationChanges(expected, worse), [
      "  recall dropped: ja total 1/2 -> 0/2",
      "  clean document gained: ja/two.clean.md:1 total-mismatch",
    ]);
    const better = expectationOf(
      recallByKind(
        documents,
        new Map([
          ["ja/one", [{ rule: "total-mismatch", line: 3 }]],
          ["ja/two", [{ rule: "total-mismatch", line: 7 }]],
        ]),
      ),
      [],
    );
    assert.deepEqual(expectationChanges(expected, better), [
      "  recall changed: ja total 1/2 -> 2/2",
      "  clean document lost: ja/one.clean.md:4 total-mismatch",
    ]);
  });

  it("記録に無い種類・無くなった種類も違いとして言う", () => {
    assert.deepEqual(expectationChanges({ recall: {}, clean: [] }, { recall: { en: { total: "0/1" } }, clean: [] }), [
      "  recall changed: en total (none) -> 0/1",
    ]);
    assert.deepEqual(expectationChanges({ recall: { en: { total: "0/1" } }, clean: [] }, { recall: {}, clean: [] }), [
      "  recall changed: en total 0/1 -> (none)",
    ]);
  });

  it("読めない記録は空として扱う", () => {
    assert.deepEqual(parseExpectation(null), { recall: {}, clean: [] });
    assert.deepEqual(parseExpectation({ recall: { ja: { total: 3, dangling: "0/1" } }, clean: ["a", 1] }), {
      recall: { ja: { dangling: "0/1" } },
      clean: ["a"],
    });
  });
});

describe("formatRecall", () => {
  it("種類と rule を揃えて並べ、見逃した所を添える", () => {
    const lines = formatRecall(recallByKind(documents, new Map([["ja/one", [{ rule: "total-mismatch", line: 3 }]]])));
    assert.deepEqual(lines, [
      "ja  total     total-mismatch        1/2  missed ja/two:7",
      "ja  dangling  dangling-reference    0/1  missed ja/one:5",
      "en  total     total-mismatch        0/1  missed en/one:2",
    ]);
    assert.deepEqual(formatRecall([]), []);
  });
});

describe("pickSets", () => {
  const sets = ["tech", "contracts", "email"];
  it("名前が無ければ全部を名前順に", () => assert.deepEqual(pickSets(sets, []), ["contracts", "email", "tech"]));
  it("名前があればその順に、重ねず", () => assert.deepEqual(pickSets(sets, ["tech", "contracts", "tech"]), ["tech", "contracts"]));
  it("無い名前は、ある名前を添えて落とす", () => assert.throws(() => pickSets(sets, ["contract"]), /no set contract \(sets: contracts, email, tech\)/u));
  it("一つも無い所で名前を頼まれても落とす", () => assert.throws(() => pickSets([], ["tech"]), /no set tech/u));
});
