import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// undefined-term: terms defined in another document the contract says it follows, a slip in the name of a document, and
// capitalised words that are not written as terms (a run split by spaces, a web address, a slash pair, every word
// capitalised). Self-written text in the shape of the 特許庁 OI model contracts and of contracts filed with the SEC.

const termsIn = (adapter: LanguageAdapter, path: string, source: string): string[] =>
  runRules(buildDocument(path, source, adapter), loadRules(adapter.id), {}, false, "legal/contract")
    .findings.filter((finding) => finding.rule === "undefined-term")
    .map((finding) => String(finding.values["term"]));

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const INHERITS = "なお、本共同研究開発契約において定義した用語を本契約で使用する場合には同契約内の定義に従う。";
const useContract = (...lines: string[]): string =>
  [
    "# 利用契約書",
    "",
    "甲と乙は、共同研究開発契約（以下「本共同研究開発契約」という。）に基づき、次のとおり契約（以下「本契約」という。）を締結する。",
    "",
    ...lines,
    "",
    "第2条（利用）",
    "乙は、本学習済みモデルを本連携システムで利用できる。甲は、本学習済みモデルを保守する。",
    "",
    "第3条（追加学習）",
    "甲は、本学習モデルに追加学習を行う。",
    "",
  ].join("\n");

describe("undefined-term: a contract that follows another one's definitions", () => {
  it("reports only a slip for another of its terms", () => {
    assert.deepEqual(termsIn(ja, "c.md", useContract("第1条（定義）", INHERITS)), ["本学習モデル"]);
  });

  it("reports every undefined term when the contract says nothing of another one's definitions", () => {
    assert.deepEqual(termsIn(ja, "c.md", useContract("第1条（定義）", "本契約で使用する用語は、次のとおりとする。")), [
      "本学習済みモデル",
      "本連携システム",
      "本学習モデル",
    ]);
  });

  it("reports a slip in the name of a document the contract defines, and leaves its own name and parts", () => {
    const source = useContract("第1条（定義）", INHERITS, "本共同開発契約第6条は、本契約に準用する。本契約第2条も同じとする。");
    assert.deepEqual(termsIn(ja, "c.md", source), ["本共同開発契約", "本学習モデル"]);
  });
});

const agreement = (...sentences: string[]): string =>
  [
    'This Hosting Agreement (the "Agreement") is made between eGain and the customer (the "Customer").',
    "",
    '"Normal Business Hours" shall mean between the hours of 6:00 a.m. and 6:00 p.m. on business days.',
    "",
    ...sentences.flatMap((sentence) => [sentence, ""]),
  ].join("\n");

describe("undefined-term: capitalised words not written as a term", () => {
  it("reads a defined term split by a run of spaces as that term", () => {
    assert.deepEqual(termsIn(en, "a.txt", agreement("Downtime during Normal Business       Hours shall be credited to the Customer.")), []);
  });

  it("does not report a web address, a slash pair or a phrase with every word capitalised", () => {
    assert.deepEqual(termsIn(en, "a.txt", agreement("The work is provided by three assigned Borrowmoney.com, inc. employees.")), []);
    assert.deepEqual(termsIn(en, "a.txt", agreement("The venture provides 1,500 square feet of Leased/rent office space.")), []);
    assert.deepEqual(termsIn(en, "a.txt", agreement("The purpose is internet Maintenance And Deployment of medical service.")), []);
  });

  it("still reports a capitalised term the document never defines, joined by spaces or written plainly", () => {
    assert.deepEqual(termsIn(en, "a.txt", agreement("Downtime during the Maintenance       Window shall not be credited.")), ["Maintenance       Window"]);
    assert.deepEqual(termsIn(en, "a.txt", agreement("The purpose is internet Maintenance and Deployment of medical service.")), ["Maintenance and Deployment"]);
  });
});
