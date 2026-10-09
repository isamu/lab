import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { partyListings, reversedListings, type ListingWords, type PartyListing } from "../packages/chaff/src/structure/party-order.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// party-order: parties listed in the reverse of the document's usual order (乙及び甲 where it otherwise writes 甲及び乙). Self-written text.

const WORDS: ListingWords = {
  labels: ["甲", "乙", "丙", "丁", "委託者", "受託者"],
  bareLabels: ["甲", "乙", "丙", "丁"],
  joiners: ["及び", "および", "並びに", "又は", "または", "若しくは", "と", "・"],
  seriesMarks: ["、", "，"],
};

const listed = (text: string, words: ListingWords = WORDS): string[] =>
  partyListings([{ start: 0, text }], words).map((listing) => text.slice(listing.start, listing.end));

const listing = (start: number, ...labels: string[]): PartyListing => ({ start, end: start + labels.length, labels });

describe("partyListings", () => {
  it("reads names joined by a listing word, written side by side, or in a series", () => {
    assert.deepEqual(listed("甲及び乙は、協議する。"), ["甲及び乙"]);
    assert.deepEqual(listed("甲又は乙が違反したとき"), ["甲又は乙"]);
    assert.deepEqual(listed("甲・乙・丙は"), ["甲・乙・丙"]);
    assert.deepEqual(listed("甲乙記名押印の上"), ["甲乙"]);
    assert.deepEqual(listed("甲乙丙の三者は"), ["甲乙丙"]);
    assert.deepEqual(listed("甲と乙との間で"), ["甲と乙"]);
    assert.deepEqual(listed("甲、乙及び丙は"), ["甲、乙及び丙"]);
    assert.deepEqual(listed("甲，乙及び丙は"), ["甲，乙及び丙"]);
    assert.deepEqual(listed("委託者及び受託者は"), ["委託者及び受託者"]);
  });

  it("does not read a direction, a single name, or a name inside a longer word", () => {
    assert.deepEqual(listed("乙から甲への通知は、書面で行う。"), []);
    assert.deepEqual(listed("甲に対し乙は、報告する。"), []);
    assert.deepEqual(listed("甲が乙に委託する業務"), []);
    assert.deepEqual(listed("甲は、乙と協議する。"), []);
    assert.deepEqual(listed("甲は、本業務を行う。"), []);
    assert.deepEqual(listed("第一種及び乙種の免許"), []);
    assert.deepEqual(listed("株式会社甲乙商事は"), []);
    assert.deepEqual(listed("株式会社甲乙商事及び乙は"), []);
    assert.deepEqual(listed("乙及び甲種株式を取得する。"), []);
    assert.deepEqual(listed("甲種及び乙種の株式"), []);
    assert.deepEqual(listed("甲乙間の協議、甲乙双方の合意"), ["甲乙", "甲乙"]);
  });

  it("ends a series at a comma no listing word follows, and does not join defined names side by side", () => {
    assert.deepEqual(listed("甲、乙は協議する。"), []);
    assert.deepEqual(listed("甲及び乙、丙は"), ["甲及び乙"]);
    assert.deepEqual(listed("委託者受託者は"), []);
    assert.deepEqual(listed("委託者乙は"), []);
    assert.deepEqual(listed("甲及び甲の子会社"), []);
  });

  it("reads nothing with no names or no listing words", () => {
    assert.deepEqual(listed(""), []);
    assert.deepEqual(listed("甲及び乙", { ...WORDS, labels: [], bareLabels: [] }), []);
    assert.deepEqual(listed("甲及び乙", { ...WORDS, joiners: [], seriesMarks: [] }), []);
    assert.deepEqual(listed("甲乙", { ...WORDS, bareLabels: [] }), []);
  });
});

describe("reversedListings", () => {
  const forward = listing(0, "甲", "乙");
  const again = listing(10, "甲", "乙");
  const reverse = listing(20, "乙", "甲");

  it("reports the reverse order when the usual one is written at least twice as often", () => {
    assert.deepEqual(reversedListings([forward, again, reverse], 2), [{ listing: reverse, usual: forward, usualCount: 2, reverseCount: 1 }]);
    assert.deepEqual(
      reversedListings([forward, again, listing(30, "乙", "丙"), listing(40, "乙", "甲", "丙")], 2).map((slip) => slip.listing.start),
      [40],
    );
    const third = [listing(30, "甲", "丙"), listing(40, "甲", "丙")];
    assert.deepEqual(
      reversedListings([forward, again, ...third, listing(50, "丙", "乙", "甲")], 2).map((slip) => slip.listing.start),
      [50],
    );
  });

  it("stays silent on a tie, a near-tie, a lone listing and an empty document", () => {
    assert.deepEqual(reversedListings([forward, reverse], 2), []);
    assert.deepEqual(reversedListings([forward, again, listing(30, "甲", "乙"), reverse, listing(40, "乙", "甲")], 2), []);
    assert.deepEqual(reversedListings([reverse], 2), []);
    assert.deepEqual(reversedListings([], 2), []);
  });

  it("compares each pair of names on its own", () => {
    assert.deepEqual(reversedListings([forward, again, listing(30, "丙", "丁")], 2), []);
  });
});

const ordersIn = (adapter: LanguageAdapter, source: string, genre = "legal/contract"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === "party-order")
    .map((finding) => `${String(finding.values["written"])} (${String(finding.values["usual"])})`);

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const HEAD = ["# 業務委託契約書", "", "株式会社みなと商会（以下「甲」という。）と株式会社しおさい技研（以下「乙」という。）は、次のとおり契約を結ぶ。", ""];
const contract = (...lines: string[]): string => [...HEAD, ...lines.flatMap((line) => [line, ""])].join("\n");
const TWO_FORWARD = ["第1条　甲又は乙は、本契約を解除することができる。", "第3条　本書2通を作成し、甲乙記名押印の上、各1通を保有する。"];

describe("party-order", () => {
  it("reports a reversed pair in a contract that otherwise writes 甲 first", () => {
    assert.deepEqual(ordersIn(ja, contract(TWO_FORWARD[0] ?? "", "第2条　乙及び甲が協議して定める。", TWO_FORWARD[1] ?? "")), ["乙及び甲 (甲又は乙)"]);
    assert.deepEqual(ordersIn(ja, contract(TWO_FORWARD[0] ?? "", "第2条　甲及び乙が協議して定める。", TWO_FORWARD[1] ?? "")), []);
  });

  it("stays silent on a tie and on a direction", () => {
    assert.deepEqual(ordersIn(ja, contract("第1条　甲又は乙は、本契約を解除することができる。", "第2条　乙及び甲が協議して定める。")), []);
    assert.deepEqual(ordersIn(ja, contract(...TWO_FORWARD, "第2条　乙から甲への通知は、書面で行う。", "第4条　甲が乙に委託する。")), []);
  });

  it("reads the names the contract defines for its parties", () => {
    const named = [
      "# 業務委託契約書",
      "",
      "株式会社みなと商会（以下「委託者」という。）と株式会社しおさい技研（以下「受託者」という。）は、次のとおり契約を結ぶ。",
      "",
      "第1条　委託者又は受託者は、本契約を解除することができる。",
      "",
      "第2条　委託者及び受託者は、誠実に協議する。",
      "",
      "第3条　受託者及び委託者が協議して定める。",
      "",
    ].join("\n");
    assert.deepEqual(ordersIn(ja, named), ["受託者及び委託者 (委託者又は受託者)"]);
  });

  it("does not run outside contracts or on English", () => {
    const reversed = contract(TWO_FORWARD[0] ?? "", "第2条　乙及び甲が協議して定める。", TWO_FORWARD[1] ?? "");
    assert.deepEqual(ordersIn(ja, reversed, "legal/statute"), []);
    assert.deepEqual(ordersIn(ja, reversed, "business/report"), []);
    const english = [
      "# Agreement",
      "",
      "The Supplier and the Customer agree. The Supplier or the Customer may end it. The Customer and the Supplier sign.",
      "",
    ];
    assert.deepEqual(ordersIn(en, english.join("\n")), []);
  });
});
