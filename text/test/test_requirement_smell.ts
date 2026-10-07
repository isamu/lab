import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// requirement-smell: a loophole, an open-ended list or "and/or" in a sentence that states a requirement (Femmer et al.
// 2017; Berry et al. 2003; ISO/IEC/IEEE 29148). Self-written sentences only.

const RULE = "requirement-smell";

/** "variant:matched" for each finding, in a specification. */
const found = (body: string, adapter: LanguageAdapter, genre = "technical/spec"): string[] =>
  runRules(buildDocument("t.md", `# Spec\n\n${body}\n`, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${finding.variant ?? ""}:${String(finding.values["matched"])}`);

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("requirement-smell (ja)", () => {
  it("a loophole in a requirement that ends with こと, ものとする or なければならない", () => {
    assert.deepEqual(found("予約の画面は、可能な限り速く表示されること。", ja), ["loophole:可能な限り"]);
    assert.deepEqual(found("受託者は、必要に応じて報告するものとする。", ja), ["loophole:必要に応じて"]);
    assert.deepEqual(found("利用者は、なるべく早く取り消さなければならない。", ja), ["loophole:なるべく"]);
  });

  it("等 and など in a requirement, and 及び／又は", () => {
    assert.deepEqual(found("ログ等を三十日保存すること。", ja), ["open-end:等"]);
    assert.deepEqual(found("氏名、住所などを記録しなければならない。", ja), ["open-end:など"]);
    assert.deepEqual(found("管理者及び／又は利用者に通知すること。", ja), ["either:及び／又は"]);
  });

  it("one finding per kind of smell in a sentence, not one per word", () => {
    assert.deepEqual(found("可能な限り、ログ等を必要に応じて保存すること。", ja), ["loophole:可能な限り", "open-end:等"]);
  });

  it("a sentence that states no requirement is not read", () => {
    assert.deepEqual(found("画面は可能な限り速く表示されるとよい。", ja), []);
    assert.deepEqual(found("ログ等の保存について説明する。", ja), []);
  });

  it("及び又は and およびまたは without a slash, and a polite ending", () => {
    assert.deepEqual(found("管理者及び又は利用者に通知しなければなりません。", ja), ["either:及び又は"]);
    assert.deepEqual(found("管理者およびまたは利用者に通知するものとします。", ja), ["either:およびまたは"]);
  });

  it("a marker inside a clause does not make a definition a requirement: the predicate closes a Japanese sentence", () => {
    assert.deepEqual(found("「保護手段」とは、回避されてはならないものとされる手段等をいいます。", ja), []);
    assert.deepEqual(found("報告しなければならない事項等を定める。", ja), []);
  });

  it("「〜のこと。」 defines a term and is no requirement; こと in the middle of a sentence is no marker", () => {
    assert.deepEqual(found("サーバやネットワークなどに接続できる権利のこと。", ja), []);
    assert.deepEqual(found("ログ等を保存することがある。", ja), []);
  });

  it("a word that only contains 等 is not 等 (平等, 等しい)", () => {
    assert.deepEqual(found("利用者を平等に扱うこと。", ja), []);
    assert.deepEqual(found("二つの値が等しいこと。", ja), []);
  });

  it("a requirement without a smell, and a measurable one", () => {
    assert.deepEqual(found("予約の画面は、三秒以内に表示されること。", ja), []);
  });

  it("等 that ends a name the document defines closes its own list: in an aside, in quotes, or at the head of an item", () => {
    const aside = "受託者は、委託先等（委託先及び再委託先をいう。以下同じ。）を監督しなければならない。受託者は、委託先等に報告させなければならない。";
    assert.deepEqual(found(aside, ja), []);
    const quoted = "受託者は、委託先及び再委託先（以下この条において「委託先等」という。）を監督しなければならない。受託者は、当該委託先等に報告させなければならない。";
    assert.deepEqual(found(quoted, ja), []);
    assert.deepEqual(found("一　委託先等　委託先及び再委託先をいう。\n\n受託者は、委託先等を監督しなければならない。", ja), []);
  });

  it("a longer noun that ends in a defined name narrows it and leaves nothing open (当該委託先等, 海外委託先等)", () => {
    const defined = "委託先等（委託先及び再委託先をいう。）を定める。";
    assert.deepEqual(found(`${defined}受託者は、当該委託先等を監督しなければならない。`, ja), []);
    assert.deepEqual(found(`${defined}受託者は、海外委託先等を監督しなければならない。`, ja), []);
    assert.deepEqual(found(`${defined}受託者は、委託先の資料等を保存しなければならない。`, ja), ["open-end:等"]);
  });

  it("a longer noun with 等 inside is a name when the document defines it, or a noun that starts it", () => {
    const head = "一　監査等委員会設置会社　監査等委員会を置く会社をいう。\n\n";
    assert.deepEqual(found(`${head}監査等委員会設置会社は、報告を求めなければならない。`, ja), []);
    assert.deepEqual(found(`${head}監査等委員会は、報告を求めなければならない。`, ja), []);
    assert.deepEqual(found("監査等委員（監査等委員会の委員をいう。）を定める。設立時監査等委員は、三人以上でなければならない。", ja), []);
  });

  it("a longer noun with 等 inside that the document never defines leaves the list open (契約書等文書)", () => {
    assert.deepEqual(found("システムは、契約書等文書を保存しなければならない。", ja), ["open-end:等"]);
    assert.deepEqual(found("監査等委員会は、報告を求めなければならない。", ja), ["open-end:等"]);
  });

  it("等 after a name the document does not define still leaves the list open, beside one it does", () => {
    assert.deepEqual(found("委託先等（委託先及び再委託先をいう。）を定める。受託者は、ログ等を保存しなければならない。", ja), ["open-end:等"]);
    assert.deepEqual(found("受託者は、委託先等（委託先及び再委託先をいう。）及びログ等を管理しなければならない。", ja), ["open-end:等"]);
  });

  it("a requirement whose subject ends in 等 is no definition, even with とする in it", () => {
    assert.deepEqual(found("ログ等は、三十日保存するものとする。", ja), ["open-end:等"]);
    assert.deepEqual(found("一　ログ等は、三十日保存するものとする。", ja), ["open-end:等"]);
  });
});

describe("requirement-smell (en)", () => {
  it("a loophole in a requirement with must, shall or is required to", () => {
    assert.deepEqual(found("The page must load as fast as possible.", en), ["loophole:as fast as possible"]);
    assert.deepEqual(found("The supplier shall report if necessary.", en), ["loophole:if necessary"]);
    assert.deepEqual(found("Staff are required to file the form where possible.", en), ["loophole:where possible"]);
  });

  it("etc. and and/or in a requirement", () => {
    assert.deepEqual(found("The system must keep logs, traces, etc. for thirty days.", en), ["open-end:etc."]);
    assert.deepEqual(found("The system shall notify the owner and/or the user.", en), ["either:and/or"]);
  });

  it("a sentence that states no requirement is not read", () => {
    assert.deepEqual(found("The page loads as fast as possible.", en), []);
    assert.deepEqual(found("Users can choose email and/or text messages.", en), []);
  });

  it("points at the phrase, not at the start of the sentence", () => {
    const source = "# Spec\n\nThe page must load if possible.\n";
    const columns = runRules(buildDocument("t.md", source, en), loadRules("en"), { [RULE]: "normal" }, false, "technical/spec")
      .findings.filter((finding) => finding.rule === RULE)
      .map((finding) => `${finding.line}:${finding.column}`);
    // "The page must load " is 19 characters, so "if possible" starts at column 20.
    assert.deepEqual(columns, ["3:20"]);
  });

  it("a word that only contains a marker is not one (mustard, shallow)", () => {
    assert.deepEqual(found("The mustard is shallow, etc.", en), []);
  });
});

describe("requirement-smell — which documents, with --experimental and no level set", () => {
  const LOOSE = "# Spec\n\nThe page must load if possible.\n";
  const firesIn = (genre: string): boolean =>
    runRules(buildDocument("t.md", LOOSE, en), loadRules("en"), {}, true, genre).findings.some((finding) => finding.rule === RULE);

  it("runs on specifications, contracts, manuals and FAQs", () => {
    assert.deepEqual(["technical/spec", "legal/contract", "docs/manual", "docs/faq"].filter(firesIn), [
      "technical/spec",
      "legal/contract",
      "docs/manual",
      "docs/faq",
    ]);
  });

  it("does not run on statutes, judgments, patents, glossaries, papers, fiction, speeches, blogs or reports", () => {
    const others = [
      "legal/statute",
      "legal/judgment",
      "legal/patent",
      "docs/glossary",
      "academic/paper",
      "literature/fiction",
      "speech/address",
      "blog/tech",
      "business/report",
    ];
    assert.deepEqual(others.filter(firesIn), []);
  });
});
