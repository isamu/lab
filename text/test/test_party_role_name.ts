import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { partiesOf, roleUses } from "../packages/chaff/src/structure/party-role.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// party-role-name: a party called by a role word (受託者, the Vendor) after the contract gave it a short name. Self-written text.

const rolesIn = (adapter: LanguageAdapter, source: string, genre = "legal/contract"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === "party-role-name")
    .map((finding) => `${String(finding.values["role"])} (${String(finding.values["names"])})`);

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const JA_HEAD = ["# 業務委託契約書", "", "株式会社みなと商会（以下「甲」という。）と株式会社しおさい技研（以下「乙」という。）は、次のとおり契約を結ぶ。", ""];
const EN_HEAD = ["# Services Agreement", "", 'This agreement is between Harbour Works Ltd (the "Supplier") and Northwind Retail Inc. (the "Customer").', ""];
const ja_ = (...lines: string[]): string => [...JA_HEAD, ...lines, ""].join("\n");
const en_ = (...lines: string[]): string => [...EN_HEAD, ...lines, ""].join("\n");

describe("party-role-name", () => {
  it("reports a Japanese role word after 甲 and 乙 were defined", () => {
    assert.deepEqual(rolesIn(ja, ja_("第1条　受託者は、甲の会議室の予約を行う。")), ["受託者 (甲、乙)"]);
    assert.deepEqual(rolesIn(ja, ja_("第1条　乙は、甲の会議室の予約を行う。")), []);
  });

  it("reports an English role word after the article, not the defined names nor a lower-case noun", () => {
    assert.deepEqual(rolesIn(en, en_("1. The Vendor shall invoice the Customer monthly.")), ["Vendor (Supplier, Customer)"]);
    assert.deepEqual(rolesIn(en, en_("1. The Supplier shall invoice the Customer monthly.")), []);
    assert.deepEqual(rolesIn(en, en_("1. The Supplier may use a vendor of its choice.")), []);
    assert.deepEqual(rolesIn(en, en_("Vendor shall invoice the Customer monthly.")), ["Vendor (Supplier, Customer)"]);
    assert.deepEqual(rolesIn(en, en_("1. The Vendors shall invoice the Customer monthly.")), ["Vendor (Supplier, Customer)"]);
    assert.deepEqual(rolesIn(en, en_("1. The Customer pays the Vendor's invoices.")), ["Vendor (Supplier, Customer)"]);
    assert.deepEqual(rolesIn(en, en_("1. The Supplier sells Vendorware licences.")), []);
  });

  it("does not read a bare plural at a sentence's head as a role word, but does read the singular and the plural after an article", () => {
    const warranty = ["# Limited Warranty", "", 'Kestrel Devices Ltd. ("we") warrants the product for one year.', ""];
    const in_ = (line: string): string[] => rolesIn(en, [...warranty, line, ""].join("\n"));
    assert.deepEqual(in_("Customers who register the product receive an offer."), []);
    assert.deepEqual(in_("1. Buyers may return the product within 30 days."), []);
    assert.deepEqual(in_("Customer must register the product."), ["Customer (we)"]);
    assert.deepEqual(in_("The Customers must register the product."), ["Customer (we)"]);
    assert.deepEqual(in_("Vendors' terms do not apply."), ["Vendor (we)"]);
  });

  it("does not report a role word before or in the sentence that names the parties", () => {
    const sale = [
      "# 売買契約書",
      "",
      "売主 有限会社たちばな木工（以下「甲」という。）と買主 株式会社ひだまり家具店（以下「乙」という。）は、次のとおり契約する。",
      "",
      "第1条　甲は、乙に家具を売り渡す。",
      "",
    ].join("\n");
    assert.deepEqual(rolesIn(ja, sale), []);
    assert.deepEqual(rolesIn(ja, sale.replace("第1条　甲は", "第1条　売主は")), ["売主 (甲、乙)"]);
  });

  it("does not report a role word the document defines, one inside a defined term, or one inside a longer word", () => {
    const defined = [
      "# 秘密保持契約書",
      "",
      "北浜精機株式会社（以下「開示者」という。）と株式会社あおば設計（以下「受領者」という。）は、次のとおり契約する。",
      "",
      "第1条　受領者は、開示者の情報を守る。",
      "",
    ].join("\n");
    assert.deepEqual(rolesIn(ja, defined), []);
    assert.deepEqual(rolesIn(ja, ja_("第1条　乙は、甲の承諾を得て再受託者に委託できる。")), []);
    const receiving = [
      "# NDA",
      "",
      'Bluefield LLC (the "Receiving Party") and Cedar Inc. (the "Owner") agree as follows.',
      "",
      "1. The Receiving Party keeps the Owner's information secret.",
      "",
    ].join("\n");
    assert.deepEqual(rolesIn(en, receiving), []);
  });

  it("reads from the sentence naming the first party, so a party named later does not hide the role words before it", () => {
    const later = en_(
      "1. The Vendor shall invoice the Customer monthly.",
      "",
      '2. A subcontractor that receives Confidential Information (the "Recipient") must protect it.',
    );
    assert.deepEqual(rolesIn(en, later), ["Vendor (Supplier, Customer, Recipient)"]);
  });

  it("needs a party: a document whose definitions name no party is not read", () => {
    const statuteLike = [
      "# 規程",
      "",
      "第1条　この規程で、業務を委託する者（以下「委託元」という。）について定める。",
      "",
      "第2条　受託者は、委託元に報告する。",
      "",
    ].join("\n");
    assert.deepEqual(rolesIn(ja, statuteLike), []);
    assert.deepEqual(rolesIn(en, ["# Note", "", "The Vendor ships the goods.", ""].join("\n")), []);
  });

  it("runs in the contract genre only", () => {
    assert.deepEqual(rolesIn(ja, ja_("第1条　受託者は、甲の会議室の予約を行う。"), "legal/statute"), []);
  });
});

describe("partiesOf and roleUses", () => {
  const words = { roles: ["受託者", "Vendor"], shortNames: ["甲", "we"], companyForms: ["株式会社", "Inc"] };
  const term = (text: string, start: number) => ({ term: text, span: { start, end: start + text.length }, line: 1, inline: true });

  it("reads a party from a short name, a role word, or a company form right before the bracket", () => {
    assert.deepEqual(partiesOf("甲", [term("甲", 0)], words), [{ term: "甲", end: 1 }]);
    assert.deepEqual(partiesOf("Acme Inc. (Acme)", [term("Acme", 11)], words), [{ term: "Acme", end: 15 }]);
    assert.deepEqual(partiesOf("Including all (Data)", [term("Data", 15)], words), []);
    assert.deepEqual(partiesOf("x", [{ ...term("甲", 0), inline: false }], words), []);
    assert.deepEqual(partiesOf("", [], words), []);
  });

  it("finds role words after the parties, skipping defined ones and empty patterns", () => {
    const source = "受託者は、甲に、再受託者と受託者側に";
    const texts = [{ start: 0, text: source }];
    assert.deepEqual(roleUses(source, texts, ["受託者", ""], [], -1), [{ offset: 0, role: "受託者" }]);
    assert.deepEqual(roleUses(source, texts, ["受託者"], [], 0), []);
    assert.deepEqual(roleUses(source, texts, ["受託者"], ["受託者"], -1), []);
    assert.deepEqual(roleUses(source, [], ["受託者"], [], -1), []);
  });
});
