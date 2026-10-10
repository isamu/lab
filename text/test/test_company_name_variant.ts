import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import {
  companyMentionsIn,
  companyRelation,
  companyVariants,
  kanaHeadOf,
  type CompanyForm,
  type CompanyMention,
  type IsProper,
  type KanaStops,
} from "../packages/chaff/src/company-names.ts";

// 会社の名前の書き分け（name-variant）。例文はすべて自作。

const variants = (source: string, adapter = en): readonly string[] => namedRuleRun("name-variant", source, adapter, "a.md").findings;

const FORMS: readonly CompanyForm[] = [
  { pattern: "株式会社", group: "株式会社" },
  { pattern: "(株)", group: "株式会社" },
  { pattern: "有限会社", group: "有限会社" },
  { pattern: "Inc", group: "inc", position: "after" },
  { pattern: "Incorporated", group: "inc", position: "after" },
  { pattern: "Ltd", group: "ltd", position: "after" },
  { pattern: "Co., Ltd", group: "co-ltd", position: "after" },
  { pattern: "Limited", group: "ltd", position: "after" },
];

const anyProper = (): boolean => true;
const noProper = (): boolean => false;

type LexiconEntry = { readonly pattern: string; readonly group: string };
const isLexicon = (value: unknown): value is { entries: LexiconEntry[] } =>
  typeof value === "object" && value !== null && "entries" in value && Array.isArray(value.entries);
const kanaLexicon: unknown = parse(readFileSync(new URL("../packages/lang-ja/lexicons/company-name-kana.yaml", import.meta.url), "utf8"));
const kanaEntries = isLexicon(kanaLexicon) ? kanaLexicon.entries : [];
const inGroup = (group: string): string[] => kanaEntries.filter((entry) => entry.group === group).map((entry) => entry.pattern);
const STOPS: KanaStops = { particles: inGroup("particle"), openers: inGroup("opener"), ends: inGroup("end") };

const mentionsOf = (source: string, isProper: IsProper = anyProper): string[] =>
  companyMentionsIn(source, FORMS, isProper, STOPS).map((found) => `${found.base}|${found.form}|${found.position}@${String(found.offset)}`);

const company = (surface: string, base: string, form: string, position: "before" | "after", offset = 0): CompanyMention => ({
  surface,
  base,
  form,
  position,
  offset,
});

describe("name-variant: 会社の名前の書き分け", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("形の語を名前の反対側に置いた会社名（株式会社アオバシステム と アオバシステム株式会社）", () => {
    assert.deepEqual(
      variants("# 提案書\n\n株式会社アオバシステム\n\n株式会社アオバシステムがご提案します。\n\nご不明な点は、アオバシステム株式会社 営業部まで。\n", ja),
      ["「アオバシステム株式会社」は、ほかの所では会社の種類を名前の反対側に置いて「株式会社アオバシステム」と書いています"],
    );
  });

  it("中黒の有無だけが違う会社名（株式会社アオバシステム と 株式会社アオバ・システム）", () => {
    assert.deepEqual(variants("# 請求書\n\n株式会社アオバシステム\n\nお問い合わせは株式会社アオバ・システム 経理部まで。\n", ja), [
      "「株式会社アオバ・システム」は、ほかの所では「株式会社アオバシステム」と書いています（字の大小・幅・記号の違い）",
    ]);
  });

  it("a company written with two forms (Inc. and Ltd.)", () => {
    assert.deepEqual(variants("# Proposal\n\nFrom: Aoba Systems Inc.\n\nFor questions, contact the sales team at Aoba Systems Ltd.\n"), [
      '"Aoba Systems Ltd" is written "Aoba Systems Inc", with another company form, elsewhere in the document',
    ]);
  });

  it("a company name with one letter dropped (Aoba Systems Inc. and Aoba System Inc.)", () => {
    assert.deepEqual(variants("# Invoice\n\nFrom: Aoba Systems Inc.\n\nIf you cannot pay, contact the accounts team at Aoba System Inc.\n"), [
      '"Aoba System Inc" is one letter away from the company name "Aoba Systems Inc" written elsewhere in the document',
    ]);
  });

  it("同じ会社を一通りに書いた文書と、別の会社、呼び名を定めた文書は指さない", () => {
    assert.deepEqual(
      variants(
        "# 契約書\n\n株式会社アオバシステム（以下「アオバ」という。）と株式会社ミナト製作所は、次のとおり合意する。アオバは株式会社アオバシステムの名で請求する。\n",
        ja,
      ),
      [],
    );
    assert.deepEqual(variants("# 案内\n\n株式会社アオバホールディングスの子会社である株式会社アオバシステムが担当します。\n", ja), []);
    assert.deepEqual(variants("# 案内\n\n株式会社アオバシステムが作り、アオバシステムが納めます。\n", ja), []);
    assert.deepEqual(variants("# 案内\n\n株式会社アオバシステムが作り、(株)アオバシステムが納めます。\n", ja), []);
  });

  it("one company written one way, two companies, and a defined short name are not reported", () => {
    assert.deepEqual(
      variants('# Agreement\n\nAoba Systems Inc. (the "Company") and Minato Trading Co., Ltd. agree. The Company invoices as Aoba Systems Inc.\n'),
      [],
    );
    assert.deepEqual(variants("# Group\n\nAoba Holdings Inc. owns Aoba Systems Inc. and Aoba Software Inc.\n"), []);
    assert.deepEqual(variants("# Note\n\nAoba Systems Inc. builds it. Aoba Systems Incorporated ships it. Aoba Systems delivers.\n"), []);
    assert.deepEqual(variants("# Note\n\nAlpha Inc. and Alpho Inc. compete.\n"), []);
  });

  it("会社の名前の現れ: 形の語の隣の名前の字の続き", () => {
    assert.deepEqual(mentionsOf("株式会社アオバシステム 営業部"), ["アオバシステム|株式会社|before@0"]);
    assert.deepEqual(mentionsOf("、アオバシステム株式会社まで"), ["アオバシステム|株式会社|after@1"]);
    assert.deepEqual(mentionsOf("(株)アオバ"), ["アオバ|株式会社|before@0"]);
    assert.deepEqual(mentionsOf("株式会社　アオバ"), ["アオバ|株式会社|before@0"]);
    assert.deepEqual(
      mentionsOf("At Aoba Systems Inc. we", (start) => start >= "At ".length),
      ["Aoba Systems|inc|after@3"],
    );
    assert.deepEqual(mentionsOf("Minato Trading Co., Ltd. sells"), ["Minato Trading|co-ltd|after@0"]);
    assert.deepEqual(mentionsOf("Acme, Inc. sells"), ["Acme|inc|after@0"]);
    assert.deepEqual(mentionsOf("Aoba Systems Inc.\nAoba Systems Ltd. The end"), ["Aoba Systems|inc|after@0", "Aoba Systems|ltd|after@18"]);
  });

  it("ひらがなで始まる会社名を、形の語を反対側に置いた所（株式会社こもれび珈琲 と こもれび珈琲株式会社）", () => {
    assert.deepEqual(
      variants(
        "# 求人\n\n株式会社こもれび珈琲\n\n株式会社こもれび珈琲は、駅前の店です。\n\nお店の電話か、こもれび珈琲株式会社の採用ページから応募してください。\n",
        ja,
      ),
      ["「こもれび珈琲株式会社」は、ほかの所では会社の種類を名前の反対側に置いて「株式会社こもれび珈琲」と書いています"],
    );
    assert.deepEqual(variants("# 求人\n\n株式会社みなと精機\n\n株式会社みなと精機は横浜の会社です。当社はみなと精機株式会社の子会社です。\n", ja), [
      "「みなと精機株式会社」は、ほかの所では会社の種類を名前の反対側に置いて「株式会社みなと精機」と書いています",
    ]);
  });

  it("ひらがなの名前の頭は漢字の一字違いを指さない（株式会社みなと精機 と 株式会社みなと精器）", () => {
    assert.deepEqual(variants("# 求人\n\n株式会社みなと精機\n\n株式会社みなと精機は横浜の会社です。書類は株式会社みなと精器 総務部まで。\n", ja), []);
  });

  it("会社の名前の頭のひらがな: 名前と読む所", () => {
    assert.deepEqual(mentionsOf("株式会社こもれび珈琲の採用ページ"), ["こもれび珈琲|株式会社|before@0"]);
    assert.deepEqual(mentionsOf("、こもれび珈琲株式会社の採用ページ"), ["こもれび珈琲|株式会社|after@1"]);
    assert.deepEqual(mentionsOf("こもれび珈琲株式会社"), ["こもれび珈琲|株式会社|after@0"]);
    assert.deepEqual(mentionsOf("当社はみなと精機株式会社の子会社"), ["みなと精機|株式会社|after@3"]);
    assert.deepEqual(mentionsOf("弊社とみなと精機株式会社は"), ["みなと精機|株式会社|after@3"]);
    assert.deepEqual(mentionsOf("株式会社みなと精機は"), ["みなと精機|株式会社|before@0"]);
    assert.deepEqual(mentionsOf("株式会社 みなと精機"), ["みなと精機|株式会社|before@0"]);
  });

  it("会社の名前の頭のひらがな: 助詞や動詞は名前に入れない", () => {
    assert.deepEqual(mentionsOf("弊社と株式会社アオバは"), ["アオバ|株式会社|before@3"]);
    assert.deepEqual(mentionsOf("当社は株式会社アオバの子会社"), ["アオバ|株式会社|before@3"]);
    assert.deepEqual(mentionsOf("また株式会社アオバが"), ["アオバ|株式会社|before@2"]);
    assert.deepEqual(mentionsOf("当社はアオバ株式会社の子会社"), ["アオバ|株式会社|after@3"]);
    assert.deepEqual(mentionsOf("本契約においてアオバ株式会社は"), ["アオバ|株式会社|after@7"]);
    assert.deepEqual(mentionsOf("契約を締結したアオバ株式会社"), ["アオバ|株式会社|after@7"]);
    assert.deepEqual(mentionsOf("取引先にあるアオバ株式会社"), ["アオバ|株式会社|after@6"]);
    assert.deepEqual(mentionsOf("、することでアオバ株式会社"), ["アオバ|株式会社|after@6"]);
    assert.deepEqual(mentionsOf("また、なおアオバ株式会社"), ["アオバ|株式会社|after@5"]);
    assert.deepEqual(mentionsOf("株式会社の代表者"), []);
    assert.deepEqual(mentionsOf("株式会社と契約する"), []);
    assert.deepEqual(mentionsOf("株式会社としての地位"), []);
    assert.deepEqual(mentionsOf("株式会社こもれびは"), []);
    assert.deepEqual(mentionsOf("当該株式会社において清算人は", noProper), []);
    assert.deepEqual(mentionsOf("株式会社ほか1社"), []);
    assert.deepEqual(mentionsOf("（以下「取引等」という。）により当該株式会社の株式", noProper), []);
    assert.deepEqual(mentionsOf("第3条によりアオバ株式会社"), ["アオバ|株式会社|after@6"]);
    assert.deepEqual(mentionsOf("報酬等のうち当該株式会社の", noProper), []);
    assert.deepEqual(mentionsOf("置かなければならない清算株式会社をいう", noProper), []);
    assert.deepEqual(mentionsOf("公開会社でない清算株式会社における", noProper), []);
  });

  it("名前の頭と読むひらがな（kanaHeadOf）", () => {
    assert.equal(kanaHeadOf("こもれび", "boundary", STOPS), "こもれび");
    assert.equal(kanaHeadOf("はなまる", "boundary", STOPS), undefined);
    assert.equal(kanaHeadOf("はこもれび", "word", STOPS), "こもれび");
    assert.equal(kanaHeadOf("にはこもれび", "word", STOPS), "こもれび");
    assert.equal(kanaHeadOf("とみなと", "word", STOPS), "みなと");
    assert.equal(kanaHeadOf("こもれび", "word", STOPS), undefined);
    assert.equal(kanaHeadOf("した", "word", STOPS), undefined);
    assert.equal(kanaHeadOf("において", "word", STOPS), undefined);
    assert.equal(kanaHeadOf("にある", "word", STOPS), undefined);
    assert.equal(kanaHeadOf("みなと", "form", STOPS), "みなと");
    assert.equal(kanaHeadOf("と", "form", STOPS), undefined);
    assert.equal(kanaHeadOf("の", "form", STOPS), undefined);
    assert.equal(kanaHeadOf("また", "boundary", STOPS), undefined);
    assert.equal(kanaHeadOf("いずれも", "boundary", STOPS), undefined);
    assert.equal(kanaHeadOf("み", "boundary", STOPS), undefined);
    assert.equal(kanaHeadOf("", "boundary", STOPS), undefined);
    assert.equal(kanaHeadOf("こもれび", "word", { particles: [], openers: [], ends: [] }), undefined);
    assert.equal(kanaHeadOf("こもれび", "boundary", { particles: [], openers: [], ends: [] }), undefined);
  });

  it("会社の名前と読まないもの: 法令の項目の印、漢字だけのふつうの語、語の一部の形の語", () => {
    assert.deepEqual(mentionsOf("イ　株式会社\nロ　合名会社"), []);
    assert.deepEqual(mentionsOf("清算株式会社は、当該株式会社の", noProper), []);
    assert.deepEqual(mentionsOf("株式会社の設立"), []);
    assert.deepEqual(mentionsOf("Section 63 Limited-time offers"), []);
    assert.deepEqual(mentionsOf("Including Aoba, Incorporation"), []);
    assert.deepEqual(mentionsOf("the Aoba Limited Partnership", anyProper), []);
    assert.deepEqual(mentionsOf("the accounts Inc", noProper), []);
    assert.deepEqual(mentionsOf(""), []);
  });

  it("同じ会社を二通りに書いたものか（companyRelation）", () => {
    const leading = company("株式会社アオバ", "アオバ", "株式会社", "before");
    assert.equal(companyRelation(leading, company("アオバ株式会社", "アオバ", "株式会社", "after")), "position");
    assert.equal(companyRelation(leading, company("有限会社アオバ", "アオバ", "有限会社", "before")), "form");
    assert.equal(companyRelation(leading, company("(株)アオバ", "アオバ", "株式会社", "before")), undefined);
    assert.equal(companyRelation(company("Acme, Inc", "Acme", "inc", "after"), company("Acme Inc", "Acme", "inc", "after")), "spelling");
    assert.equal(companyRelation(leading, company("株式会社ＡＯＢＡ", "ＡＯＢＡ", "株式会社", "before")), undefined);
    assert.equal(
      companyRelation(company("株式会社AOBA", "AOBA", "株式会社", "before"), company("株式会社ＡＯＢＡ", "ＡＯＢＡ", "株式会社", "before")),
      "spelling",
    );
    assert.equal(companyRelation(leading, leading), undefined);
    const systems = company("Aoba Systems Inc", "Aoba Systems", "inc", "after");
    assert.equal(companyRelation(systems, company("Aoba System Inc", "Aoba System", "inc", "after")), "near");
    assert.equal(companyRelation(systems, company("Aoba Sytsems Inc", "Aoba Sytsems", "inc", "after")), "near");
    assert.equal(companyRelation(systems, company("Aoba System Ltd", "Aoba System", "ltd", "after")), undefined);
    assert.equal(companyRelation(systems, company("Aoba Holdings Inc", "Aoba Holdings", "inc", "after")), undefined);
    assert.equal(companyRelation(company("Abcd1 Inc", "Abcd1", "inc", "after"), company("Abcd2 Inc", "Abcd2", "inc", "after")), undefined);
    assert.equal(companyRelation(company("Alpha Inc", "Alpha", "inc", "after"), company("Alpho Inc", "Alpho", "inc", "after")), undefined);
    assert.equal(companyRelation(company("Contoso Inc", "Contoso", "inc", "after"), company("Contosa Inc", "Contosa", "inc", "after")), "near");
    const nec = company("日本電気株式会社", "日本電気", "株式会社", "after");
    assert.equal(companyRelation(nec, company("日本電機株式会社", "日本電機", "株式会社", "after")), undefined);
    assert.equal(
      companyRelation(
        company("ミナト商事研究所株式会社", "ミナト商事研究所", "株式会社", "after"),
        company("ミナト商時研究所株式会社", "ミナト商時研究所", "株式会社", "after"),
      ),
      undefined,
    );
  });

  it("少ないほうを、同じ会社のうち一番多い書き方と比べる。同数なら後に書いたほう", () => {
    const at = (surface: string, base: string, position: "before" | "after", offset: number): CompanyMention =>
      company(surface, base, "株式会社", position, offset);
    const pairs = (mentions: readonly CompanyMention[]): string[] =>
      companyVariants(mentions).map((variant) => `${variant.mention.surface}<${variant.usual}:${variant.kind}`);
    assert.deepEqual(
      pairs([at("アオバ株式会社", "アオバ", "after", 0), at("株式会社アオバ", "アオバ", "before", 10), at("株式会社アオバ", "アオバ", "before", 20)]),
      ["アオバ株式会社<株式会社アオバ:position"],
    );
    assert.deepEqual(pairs([at("株式会社アオバ", "アオバ", "before", 0), at("アオバ株式会社", "アオバ", "after", 10)]), [
      "アオバ株式会社<株式会社アオバ:position",
    ]);
    assert.deepEqual(pairs([at("株式会社アオバ", "アオバ", "before", 0), at("株式会社ミナト", "ミナト", "before", 10)]), []);
    assert.deepEqual(pairs([]), []);
  });
});
