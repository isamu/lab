import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cleanFindingLines,
  compareToExpected,
  expectationOf,
  formatRecall,
  isCaught,
  misalignedPlants,
  parseExpectation,
  parseManifest,
  pickSets,
  recallByKind,
  setsWithoutManifest,
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

  it("pairedLine は省けて、書いたなら別の行の番号でなければ止まる", () => {
    assert.equal(parseManifest({ documents: [documents[0]] })[0]?.mistakes[0]?.pairedLine, undefined);
    const paired = { ...documents[0], mistakes: [{ ...mistake("order", "due-before-issue", 11), pairedLine: 13 }] };
    assert.equal(parseManifest({ documents: [paired] })[0]?.mistakes[0]?.pairedLine, 13);
    [0, 2.5, "13", null, 11].forEach((pairedLine) => {
      const bad = { ...documents[0], mistakes: [{ ...mistake("order", "due-before-issue", 11), pairedLine }] };
      assert.throws(() => parseManifest({ documents: [bad] }), /ja\/one mistakes\[0\] has a pairedLine that is not another line/u);
    });
  });

  it("style は省けて、書いたなら名前でなければ止まる", () => {
    assert.equal(parseManifest({ documents: [documents[0]] })[0]?.style, undefined);
    assert.equal(parseManifest({ documents: [{ ...documents[0], style: "koyobun" }] })[0]?.style, "koyobun");
    assert.throws(() => parseManifest({ documents: [{ ...documents[0], style: "" }] }), /ja\/one has no style/u);
    assert.throws(() => parseManifest({ documents: [{ ...documents[0], style: 3 }] }), /ja\/one has no style/u);
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

  it("組の相手の行は、どちらの版にもなければ言う", () => {
    const paired: PlantedDocument = {
      ...document,
      mistakes: [{ kind: "total", rule: "total-mismatch", line: 2, pairedLine: 3, clean: "60,000", planted: "50,000" }],
    };
    assert.deepEqual(misalignedPlants(paired, ["x", "保守費60,000円", "y"], ["x", "保守費50,000円", "y"]), []);
    assert.deepEqual(misalignedPlants(paired, ["x", "保守費60,000円", "y"], ["x", "保守費50,000円"]), [
      "ja/two:2 total: paired line 3 is past the end of the document",
    ]);
  });
});

describe("isCaught", () => {
  const paired = { kind: "enrolment-after-graduation", rule: "due-before-issue", line: 11, pairedLine: 13, clean: "a", planted: "b" };
  const unpaired = mistake("enrolment-after-graduation", "due-before-issue", 11);

  it("狙いの rule の指摘が、植えた行か組の相手の行にあれば見つけた", () => {
    assert.equal(isCaught(paired, [{ rule: "due-before-issue", line: 11 }]), true);
    assert.equal(isCaught(paired, [{ rule: "due-before-issue", line: 13 }]), true);
  });

  it("ほかの行の指摘、組の相手の行でもほかの rule の指摘は見逃し", () => {
    assert.equal(isCaught(paired, [{ rule: "due-before-issue", line: 12 }]), false);
    assert.equal(isCaught(paired, [{ rule: "date-range-reversed", line: 13 }]), false);
    assert.equal(isCaught(paired, [{ rule: "date-range-reversed", line: 11 }]), false);
    assert.equal(isCaught(paired, []), false);
  });

  it("組の相手を書かない誤りは、植えた行だけを見る", () => {
    assert.equal(isCaught(unpaired, [{ rule: "due-before-issue", line: 13 }]), false);
    assert.equal(isCaught(unpaired, [{ rule: "due-before-issue", line: 11 }]), true);
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

  it("組の相手の行に書いた指摘も、その誤りを見つけたと数える", () => {
    const paired: PlantedDocument[] = [
      {
        id: "en/one",
        language: "en",
        genre: "legal/contract",
        clean: "c",
        planted: "p",
        mistakes: [{ ...mistake("total", "total-mismatch", 2), pairedLine: 4 }],
      },
    ];
    assert.deepEqual(recallByKind(paired, new Map([["en/one", [{ rule: "total-mismatch", line: 4 }]]]))[0]?.found, 1);
    assert.deepEqual(recallByKind(paired, new Map([["en/one", [{ rule: "total-mismatch", line: 5 }]]]))[0]?.missed, ["en/one:2"]);
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

describe("compareToExpected", () => {
  const recalls = recallByKind(documents, new Map([["ja/one", [{ rule: "total-mismatch", line: 3 }]]]));
  const expected = expectationOf(recalls, ["ja/one.clean.md:4 total-mismatch"]);
  const same = { regressions: [], improvements: [] };
  const withRecall = (language: string, kind: string, score: string) => ({
    ...expected,
    recall: { ...expected.recall, [language]: { ...expected.recall[language], [kind]: score } },
  });

  it("記録した形のまま読み戻せて、同じなら違いは無い", () => {
    assert.deepEqual(expected.recall, { ja: { total: "1/2", dangling: "0/1" }, en: { total: "0/1" } });
    const roundTrip = parseExpectation(JSON.parse(JSON.stringify(expected)));
    assert.deepEqual(compareToExpected(roundTrip, expected), same);
  });

  it("見つけた数が減れば落とす", () => {
    assert.deepEqual(compareToExpected(expected, withRecall("ja", "total", "0/2")), {
      regressions: ["  recall dropped: ja total 1/2 -> 0/2"],
      improvements: [],
    });
  });

  it("きれいな版に記録に無い指摘が増えれば落とす", () => {
    const gained = { ...expected, clean: [...expected.clean, "ja/two.clean.md:1 total-mismatch"] };
    assert.deepEqual(compareToExpected(expected, gained), { regressions: ["  clean document gained: ja/two.clean.md:1 total-mismatch"], improvements: [] });
  });

  it("記録にある種類・言語が無くなれば落とす", () => {
    const withoutEnglish = { ja: expected.recall["ja"] ?? {} };
    assert.deepEqual(compareToExpected(expected, { ...expected, recall: withoutEnglish }), {
      regressions: ["  kind no longer scored: en total 0/1 -> (none)"],
      improvements: [],
    });
    const withoutDangling = { ...expected, recall: { ...expected.recall, ja: { total: "1/2" } } };
    assert.deepEqual(compareToExpected(expected, withoutDangling).regressions, ["  kind no longer scored: ja dangling 0/1 -> (none)"]);
  });

  it("植えた数が変われば、上がっても落とす（manifest の変更は記録して受け入れる）", () => {
    assert.deepEqual(compareToExpected(expected, withRecall("ja", "total", "3/3")), {
      regressions: ["  planted count changed: ja total 1/2 -> 3/3"],
      improvements: [],
    });
    assert.deepEqual(compareToExpected(expected, withRecall("en", "new-kind", "1/1")).regressions, ["  kind not in expected.json: en new-kind (none) -> 1/1"]);
  });

  it("見つけた数が増えたのは通して、良くなったと言う", () => {
    assert.deepEqual(compareToExpected(expected, withRecall("ja", "total", "2/2")), { regressions: [], improvements: ["  recall rose: ja total 1/2 -> 2/2"] });
  });

  it("記録したきれいな版の指摘が消えたのは通して、良くなったと言う", () => {
    assert.deepEqual(compareToExpected(expected, { ...expected, clean: [] }), {
      regressions: [],
      improvements: ["  clean document lost: ja/one.clean.md:4 total-mismatch"],
    });
  });

  it("良くなった所と悪くなった所が混ざれば、両方を分けて言う", () => {
    const mixed = { recall: { ja: { total: "2/2", dangling: "0/1" }, en: { total: "0/1" } }, clean: ["ja/two.clean.md:1 total-mismatch"] };
    assert.deepEqual(compareToExpected(expected, mixed), {
      regressions: ["  clean document gained: ja/two.clean.md:1 total-mismatch"],
      improvements: ["  recall rose: ja total 1/2 -> 2/2", "  clean document lost: ja/one.clean.md:4 total-mismatch"],
    });
  });

  it("読めない数え方は落とす", () => {
    assert.deepEqual(compareToExpected(withRecall("ja", "total", "?"), expected).regressions, ["  unreadable score: ja total ? -> 1/2"]);
  });
});

describe("parseExpectation", () => {
  it("記録を読む", () => {
    assert.deepEqual(parseExpectation({ recall: { ja: { total: "1/2" } }, clean: ["a"] }), { recall: { ja: { total: "1/2" } }, clean: ["a"] });
    assert.deepEqual(parseExpectation({ recall: {}, clean: [] }), { recall: {}, clean: [] });
  });

  it("形の悪い記録は、どこが悪いかを言って止まる", () => {
    assert.throws(() => parseExpectation(null, "x/expected.json"), /x\/expected.json is not an object with recall and clean/u);
    assert.throws(() => parseExpectation([], "x"), /x is not an object/u);
    assert.throws(() => parseExpectation({ clean: [] }), /expected.json has no recall object/u);
    assert.throws(() => parseExpectation({ recall: { ja: "1/2" }, clean: [] }), /recall.ja is not an object of kinds/u);
    assert.throws(() => parseExpectation({ recall: { ja: { total: 3 } }, clean: [] }), /recall.ja.total is 3, not "found\/total"/u);
    assert.throws(() => parseExpectation({ recall: { ja: { total: "3/2" } }, clean: [] }), /recall.ja.total is "3\/2"/u);
    assert.throws(() => parseExpectation({ recall: { ja: { total: "" } }, clean: [] }), /recall.ja.total is ""/u);
    assert.throws(() => parseExpectation({ recall: {} }), /has no clean list/u);
    assert.throws(() => parseExpectation({ recall: {}, clean: ["a", 1] }), /has no clean list/u);
  });
});

describe("setsWithoutManifest", () => {
  it("記録だけ残って manifest の無い組を名前順に", () => {
    assert.deepEqual(setsWithoutManifest(["tech", "email", "contracts"], ["contracts"]), ["email", "tech"]);
    assert.deepEqual(setsWithoutManifest(["contracts"], ["contracts", "tech"]), []);
    assert.deepEqual(setsWithoutManifest([], []), []);
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
