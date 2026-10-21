import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { precisionHoldsOf } from "../scripts/precision-holds.ts";
import { genreDataOf, precisionHolds, precisionOffs, readGenresText, readPrecision } from "../scripts/rules-measure-files.ts";
import { lowPrecisionGroups } from "../scripts/rule-policy.ts";

// A rule file's precision_hold keeps the rule on in a group its judged precision is low in, while a fix is due.

const GROUPS = ["business", "docs", "legal"];

describe("precision_hold in a rule file", () => {
  it("names each group it keeps the rule on in", () => {
    assert.deepEqual(precisionHoldsOf("x", { business: "A fix is due.", docs: "Names." }, GROUPS), ["business", "docs"]);
    assert.deepEqual(precisionHoldsOf("x", undefined, GROUPS), []);
    assert.deepEqual(precisionHoldsOf("x", null, GROUPS), []);
    assert.deepEqual(precisionHoldsOf("x", {}, GROUPS), []);
  });

  it("refuses a hold without a reason, a group chaff does not know, a genre, and a list", () => {
    assert.throws(() => precisionHoldsOf("x", { business: "" }, GROUPS), /precision_hold\.business needs a reason/u);
    assert.throws(() => precisionHoldsOf("x", { business: " " }, GROUPS), /needs a reason/u);
    assert.throws(() => precisionHoldsOf("x", { business: 3 }, GROUPS), /needs a reason/u);
    assert.throws(() => precisionHoldsOf("x", { poetry: "why" }, GROUPS), /names poetry, which is no group/u);
    assert.throws(() => precisionHoldsOf("x", { "business/report": "why" }, GROUPS), /which is no group/u);
    assert.throws(() => precisionHoldsOf("x", ["business"], GROUPS), /must map a group/u);
    assert.throws(() => precisionHoldsOf("x", "business", GROUPS), /must map a group/u);
  });
});

describe("the committed precision_hold", () => {
  const data = genreDataOf(readGenresText());
  const precision = readPrecision();

  it("keeps max-kanji-continuous on where its judged precision alone would turn it off", () => {
    const holds = precisionHolds(data, "max-kanji-continuous");
    assert.deepEqual(
      holds.toSorted((left, right) => left.localeCompare(right, "en")),
      ["business", "docs", "speech"],
    );
    const low = lowPrecisionGroups(precision.rules["max-kanji-continuous"]);
    assert.ok(
      holds.some((group) => low.includes(group)),
      "the hold has nothing to hold: remove it",
    );
    assert.deepEqual(
      precisionOffs(data, "max-kanji-continuous", precision).filter((group) => holds.includes(group)),
      [],
    );
  });

  it("is absent from a rule without one", () => {
    assert.deepEqual(precisionHolds(data, "clause-chain"), []);
  });
});
