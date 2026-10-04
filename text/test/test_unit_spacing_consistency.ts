import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { quantitiesIn } from "../packages/chaff/src/detectors/unit-spacing.ts";

// 数と単位の間の空白の混在（unit-spacing-consistency）。例文はすべて自作。

const RULE = "unit-spacing-consistency";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, `${source}\n`, adapter).findings;

describe("unit-spacing-consistency: 数と単位の間の空白の混在", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("少ないほうの書き方を指す", () => {
    assert.deepEqual(findingsOf("容量は 5 GB、転送量は 10 GB、上限は 20GBです。"), ["「20GB」と書いています（この文書はふつう「5 GB」のように書きます。3 箇所のうち 1 箇所が違う）"]);
    assert.deepEqual(findingsOf("Storage is 5 GB, transfer is 10 GB and the cap is 20GB.", en), [
      '"20GB" here, where the document usually writes units like "5 GB" (1 of 3)',
    ]);
  });

  it("一通りの文書、同じ数の二通り、使い分けている文書は指さない", () => {
    assert.deepEqual(findingsOf("容量は 5 GB、上限は 20 GB です。"), []);
    assert.deepEqual(findingsOf("Storage is 5 GB and the cap is 20GB.", en), []);
    assert.deepEqual(findingsOf("Use 5GB, 10GB or 20 GB, 30 GB.", en), []);
  });

  it("does not read versions, addresses, words or code", () => {
    assert.deepEqual(quantitiesIn("v1.5GB x86ms 5 hours 5 GBit", ["GB", "ms"]), []);
    assert.deepEqual(quantitiesIn("See example.com/5GB now.", ["GB"]), []);
    assert.deepEqual(findingsOf("Storage is 5 GB and transfer is 10 GB. Run `fallocate -l 20GB f` now.", en), []);
  });

  it("reads numbers with grouping and decimals, next to Japanese", () => {
    assert.deepEqual(
      quantitiesIn("容量は1,000MBで、間隔は2.5 msです。", ["MB", "ms"]).map((quantity) => [quantity.written, quantity.form]),
      [
        ["1,000MB", "touching"],
        ["2.5 ms", "spaced"],
      ],
    );
    assert.deepEqual(quantitiesIn("5 GB", []), []);
  });
});
