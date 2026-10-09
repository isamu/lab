import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { placeMentionsIn, placeRelation, placeVariants, type PlaceMention, type PlaceReader, type PlaceWord } from "../packages/chaff/src/place-names.ts";

// 場所の名前の書き分け（name-variant の場所の名前）。例文はすべて自作。

const variants = (source: string, adapter = en): readonly string[] => namedRuleRun("name-variant", source, adapter, "a.md").findings;

const WORDS: readonly PlaceWord[] = [
  { pattern: "口", group: "口" },
  { pattern: "駅", group: "駅" },
  { pattern: "センター", group: "センター" },
  { pattern: "Street", group: "street" },
  { pattern: "St.", group: "street" },
  { pattern: "station", group: "station" },
  { pattern: "Hall", group: "hall" },
];

const plainReader: PlaceReader = { properWords: () => [], joiners: new Set(["of"]), isFunctionWord: () => false, readingOf: () => undefined };

const surfaces = (source: string, reader: PlaceReader = plainReader): string[] => placeMentionsIn(source, WORDS, reader).map((mention) => mention.surface);

const place = (base: string, word: string, extra: Partial<PlaceMention> = {}): PlaceMention => ({
  surface: `${base}${word}`,
  offset: 0,
  base,
  place: word.trim(),
  properAt: [],
  ...extra,
});

const once = (mention: PlaceMention): { mention: PlaceMention; count: number } => ({ mention, count: 1 });
const twice = (mention: PlaceMention): { mention: PlaceMention; count: number } => ({ mention, count: 2 });

describe("name-variant: 場所の名前の書き分け", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("中黒の有る無し（コンベンションセンター と コンベンション・センター）", () => {
    assert.deepEqual(
      variants("会場は札幌コンベンションセンターです。札幌コンベンションセンターで発表し、翌日も札幌コンベンション・センターで聴講します。\n", ja),
      ["「札幌コンベンション・センター」は、ほかの所では「札幌コンベンションセンター」と書いています（字の大小・幅・記号の違い）"],
    );
  });

  it("固有名詞の字の一字違い（八重洲中央口 と 八重州中央口）", () => {
    assert.deepEqual(variants("集合は東京駅 八重洲中央口です。八重洲中央口の改札前に集まり、帰りは八重州中央口で解散します。\n", ja), [
      "「八重州中央口」は、ほかの所で何度も書いた「八重洲中央口」と一字違いです",
    ]);
  });

  it("かなで書いた名前（筑紫口 と ちくし口）", () => {
    assert.deepEqual(variants("博多駅 筑紫口で合流します。ホテルは博多駅 筑紫口から近く、最終日も博多駅 ちくし口で会います。\n", ja), [
      "「ちくし口」は、ほかの所では同じ読みの「筑紫口」と書いています",
    ]);
  });

  it("方角の違う出口や、一度ずつの書き方は言わない", () => {
    assert.deepEqual(variants("東京駅の北口で集合します。北口から歩き、帰りは南口で解散します。\n", ja), []);
    assert.deepEqual(variants("東京駅北口で集合します。東京駅北口から歩き、帰りは東京駅南口で解散します。\n", ja), []);
    assert.deepEqual(variants("入口から入ります。入口で受付をし、出口から出ます。\n", ja), []);
    assert.deepEqual(variants("集合は八重洲中央口、解散は八重州中央口です。\n", ja), []);
  });

  it("a place word written short (11th Street and 11th St.)", () => {
    assert.deepEqual(variants("Meet at Metro Center, 11th Street exit. The hotel is near the 11th Street exit. On Friday, meet at the 11th St. exit.\n"), [
      '"11th St." is written "11th Street", with the place word in another form, elsewhere in the document',
    ]);
  });

  it("a place written with and without an apostrophe (King's Cross and Kings Cross)", () => {
    assert.deepEqual(variants("Meet at King's Cross station. The coach leaves from King's Cross station. We return to Kings Cross station.\n"), [
      '"Kings Cross station" is written "King\'s Cross station" elsewhere in the document (case, width or punctuation)',
    ]);
  });

  it("other numbers, other names and a name at the start of a sentence are different places or the same one", () => {
    assert.deepEqual(variants("Walk along 1st Street. Turn at 1st Street, then cross 2nd Street.\n"), []);
    assert.deepEqual(variants("Lunch is in North Hall. North Hall seats forty. Dinner is in South Hall.\n"), []);
    assert.deepEqual(variants("The Union station is busy. Meet at the Union station at nine.\n"), []);
  });

  it("表の升の中の場所の名前も読む（八重洲中央口 と、日程表の 八重州中央口）", () => {
    const table = (last: string): string =>
      `集合場所：東京駅 八重洲中央口 改札前\n\n| 時刻 | 内容 |\n| --- | --- |\n| 06:40 | 東京駅 八重洲中央口 改札前に集合 |\n| 18:15 | 東京駅 ${last}にて解散 |\n`;
    assert.deepEqual(variants(table("八重州中央口"), ja), ["「八重州中央口」は、ほかの所で何度も書いた「八重洲中央口」と一字違いです"]);
    assert.deepEqual(variants(table("八重洲中央口"), ja), []);
    assert.deepEqual(variants(table("東京駅 南口"), ja), []);
  });

  it("a place name in a table cell is read too (King's Cross and Kings Cross)", () => {
    const table = (last: string): string =>
      `Meeting point: King's Cross station\n\n| Time | Plan |\n| --- | --- |\n| 06:40 | Meet at King's Cross station |\n| 17:35 | Group disbands at ${last} station |\n`;
    assert.deepEqual(variants(table("Kings Cross")), [
      '"Kings Cross station" is written "King\'s Cross station" elsewhere in the document (case, width or punctuation)',
    ]);
    assert.deepEqual(variants(table("King's Cross")), []);
    assert.deepEqual(variants(table("Euston")), []);
    assert.deepEqual(variants("Meet at King's Cross station.\n\n| Kings Cross station | Plan |\n| --- | --- |\n| 06:40 | Meet |\n"), []);
  });
});

describe("the reading behind place names", () => {
  it("a place name is the name right before a place word, which ends the word", () => {
    assert.deepEqual(surfaces("博多駅 筑紫口で会い、口座を開き、東京駅の北口へ。"), ["博多駅", "筑紫口", "東京駅", "北口"]);
    assert.deepEqual(surfaces("博多駅 ちくし口で、この口と"), ["博多駅", "ちくし口"]);
    assert.deepEqual(surfaces("at Metro Center, 11th Street exit and King's Cross station; the street and Streetcar"), ["11th Street", "King's Cross station"]);
  });

  it("a small word from the lexicon joins an English name; a leading abbreviation leaves the start unknown", () => {
    assert.deepEqual(surfaces("near University of Tokyo station"), ["University of Tokyo station"]);
    assert.deepEqual(surfaces("the corner of Main Street"), ["Main Street"]);
    assert.deepEqual(surfaces("at St. George Street"), []);
  });

  it("function words before an English name are not part of it", () => {
    const reader: PlaceReader = { ...plainReader, isFunctionWord: (start) => start === 0 };
    assert.deepEqual(surfaces("The Union station", reader), ["Union station"]);
    assert.deepEqual(surfaces("The station", reader), []);
  });

  it("a name only of kana stands after a space or a mark, not after a word", () => {
    assert.deepEqual(surfaces("（ちくし口）"), ["ちくし口"]);
    assert.deepEqual(surfaces("駅のちくし口"), []);
  });

  it("the reading and the proper-noun letters come from the reader", () => {
    const reader: PlaceReader = { ...plainReader, properWords: () => [{ start: 0, end: 3 }], readingOf: () => "ヤエス" };
    const [mention] = placeMentionsIn("八重洲口", WORDS, reader);
    assert.deepEqual(mention, { surface: "八重洲口", offset: 0, base: "八重洲", place: "口", reading: "ヤエス", properAt: [0, 1, 2] });
    const exit: PlaceReader = {
      ...plainReader,
      properWords: () => [
        { start: 0, end: 2 },
        { start: 3, end: 5 },
      ],
    };
    assert.deepEqual(placeMentionsIn("東京駅北口", WORDS, exit)[0]?.properAt, [0, 1]);
  });

  it("placeRelation: spelling and place word need no count; reading and near need the usual twice and the slip once", () => {
    assert.equal(placeRelation(once(place("King's Cross", " station")), once(place("Kings Cross", " station"))), "spelling");
    assert.equal(placeRelation(once(place("11th", " St.", { place: "street" })), once(place("11th", " Street", { place: "street" }))), "place-word");
    const yaesu = place("八重洲中央", "口", { properAt: [0, 1, 2] });
    const slip = place("八重州中央", "口");
    assert.equal(placeRelation(once(slip), twice(yaesu)), "near");
    assert.equal(placeRelation(once(slip), once(yaesu)), undefined);
    assert.equal(placeRelation(twice(slip), twice(yaesu)), undefined);
    const tsukushi = place("筑紫", "口", { reading: "ツクシ" });
    assert.equal(placeRelation(once(place("ちくし", "口")), twice(tsukushi)), "reading");
    assert.equal(placeRelation(once(place("ちかし", "口")), twice(place("筑紫", "口", { reading: "ツクシ" }))), undefined);
  });

  it("placeRelation: other place words, other directions, other numbers and other names are different places", () => {
    assert.equal(placeRelation(once(place("Union", " Hall", { place: "hall" })), twice(place("Union", " Street", { place: "street" }))), undefined);
    assert.equal(placeRelation(once(place("南", "口")), twice(place("北", "口"))), undefined);
    assert.equal(placeRelation(once(place("第2会議", "口", { properAt: [1] })), twice(place("第1会議", "口", { properAt: [1] }))), undefined);
    assert.equal(placeRelation(once(place("2nd", " Street")), twice(place("1st", " Street"))), undefined);
    assert.equal(placeRelation(once(place("Unoin", " Street")), twice(place("Union", " Street"))), "near");
    assert.equal(placeRelation(once(place("South", " Hall")), twice(place("North", " Hall"))), undefined);
  });

  it("placeVariants reports the less used form once, against the most used related form", () => {
    const usual = place("King's Cross", " station");
    const reported = placeVariants([usual, { ...usual, offset: 10 }, { ...place("Kings Cross", " station"), offset: 20 }]);
    assert.deepEqual(
      reported.map(({ mention, usual: form, kind }) => [mention.surface, form, kind]),
      [["Kings Cross station", "King's Cross station", "spelling"]],
    );
    assert.deepEqual(placeVariants([usual]), []);
    assert.deepEqual(placeVariants([]), []);
  });
});
