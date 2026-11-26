import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { priceListSpans } from "../packages/chaff/src/detectors/price-list.ts";

// undefined-acronym and capitals that label a number or name a product: a register's label before a company's number
// (ACN 106 702 416), and the model letters of an item in a price list (PS / CR Femoral Component $550). Examples are self-written.

const doc = (...body: string[]): string => ["# Agreement", "", ...body, "", "The SRE joins the call."].join("\n");
const jaDoc = (...body: string[]): string => ["# 契約", "", ...body, "", "SREが対応する。"].join("\n");

describe("undefined-acronym: a register's label before its number", () => {
  it("valid: the label straight before a number of seven digits or more", () => {
    assert.deepEqual(reportedAcronyms(en, doc("(1) Northwind Pty Ltd (ACN 123 456 789), 7 Harbour Road, Sydney.")), ["SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("Westwind Inc. (EIN 12-3456789) signs below.")), ["SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("Supplier ABN: 12 345 678 901.")), ["SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("Northwind Pty Ltd（ACN 123 456 789）と契約する。")), ["SRE"]);
  });

  it("invalid: the label alone, or before a short number", () => {
    assert.deepEqual(reportedAcronyms(en, doc("Write the ACN on the form.")), ["ACN", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("The EIN 123 office is closed.")), ["EIN", "SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("ACNを書いてください。")), ["ACN", "SRE"]);
  });
});

describe("priceListSpans", () => {
  it("valid: three or more rows of an item and its price, blank lines between them allowed", () => {
    const list = "Prices\nMetal Head $240\n\nPS / CR Femoral Component $550\n\n- Tibia Tray $440\nSigned";
    assert.deepEqual(
      priceListSpans(list).map((span) => list.slice(span.start, span.end)),
      ["Metal Head $240", "PS / CR Femoral Component $550", "- Tibia Tray $440"],
    );
    const yen = "部品A 5,000円\n部品B 1,200円\n部品C 980円";
    assert.equal(priceListSpans(yen).length, 3);
  });

  it("invalid: two rows, a sentence that ends in a price, a row broken by prose, empty text", () => {
    assert.deepEqual(priceListSpans("Metal Head $240\nTibia Tray $440"), []);
    assert.deepEqual(priceListSpans("The fee is due, and is $550\nThe tax is due, and is $50\nThe rest is due, and is $5"), []);
    assert.deepEqual(priceListSpans("Metal Head $240\nTibia Tray $440\nSee the schedule below.\nPatella $70"), []);
    assert.deepEqual(priceListSpans(""), []);
  });
});

describe("undefined-acronym: the model letters in a price list", () => {
  it("valid: capitals in the item names of a price list", () => {
    assert.deepEqual(reportedAcronyms(en, doc("Schedule 4 Prices", "", "Metal Head $240", "", "PS / CR Femoral Component $550", "", "Tibia Tray $440")), [
      "SRE",
    ]);
  });

  it("invalid: the same capitals in one priced line, or in prose", () => {
    assert.deepEqual(reportedAcronyms(en, doc("PS / CR Femoral Component $550")), ["PS", "CR", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("The PS and CR models ship next month.")), ["PS", "CR", "SRE"]);
  });
});
