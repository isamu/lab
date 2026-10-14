import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { evidenceSpans, hasNumeral, isClaim, isLabelOnly, startsWithin, type AdviceWords } from "../packages/chaff/src/detectors/concrete-evidence.ts";
import { indexLetterOf } from "../packages/chaff/src/detectors/lettered-index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter, StructureNode, Token } from "../packages/chaff/src/plugin.ts";

const RULE = "concrete-evidence-density";

const flaggedIn = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "strict" }, true, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["word"]));

/** 具体物の無い節を 3 つ並べ、最後の節だけ中身を変える。strict は 1 節から指摘する。 */
const ABSTRACT_EN = "We value openness. We believe in trust. We act with care.";
const ABSTRACT_JA = "考えかたを述べます。理念を語ります。姿勢を示します。";

const englishWith = (last: string): string => `# Values\n\n## Openness\n\n${ABSTRACT_EN}\n\n## Trust\n\n${ABSTRACT_EN}\n\n## Last\n\n${last}`;
const japaneseWith = (last: string): string => `# 方針\n\n## 公開\n\n${ABSTRACT_JA}\n\n## 信頼\n\n${ABSTRACT_JA}\n\n## 最後\n\n${last}`;

/** 最後の節だけ具体物を持つとき、指摘に残る節。 */
const OTHERS_EN = ["Openness", "Trust"];
const OTHERS_JA = ["公開", "信頼"];

const token = (surface: string, start: number, pos: string, features?: Readonly<Record<string, string>>): Token => ({
  surface,
  span: { start, end: start + surface.length },
  pos,
  ...(features === undefined ? {} : { features }),
});

const PLURAL = { Number: "Plur" };

describe("hasNumeral", () => {
  it("数と読んだ語（NumType=Card）は数える", () => {
    assert.equal(hasNumeral([token("二", 0, "NOUN", { NumType: "Card" }), token("割", 1, "NOUN")]), true);
  });

  it("数の語のすぐ後ろが複数形の名詞なら数える（five minutes）", () => {
    assert.equal(hasNumeral([token("five", 0, "NUM"), token("minutes", 5, "NOUN", PLURAL)]), true);
  });

  it("数の語でも、後ろが複数形の名詞でなければ数えない（one of, one person）", () => {
    assert.equal(hasNumeral([token("one", 0, "NUM"), token("of", 4, "ADP")]), false);
    assert.equal(hasNumeral([token("one", 0, "NUM"), token("person", 4, "NOUN")]), false);
    assert.equal(hasNumeral([token("one", 0, "NUM")]), false);
  });

  it("複数形の名詞の前でも、数の語でなければ数えない（many minutes）", () => {
    assert.equal(hasNumeral([token("many", 0, "ADJ"), token("minutes", 5, "NOUN", PLURAL)]), false);
  });

  it("ハイフンで前の語に続く数は合成語の部品（one-on-one meetings）", () => {
    const tokens = [
      token("one", 0, "NUM"),
      token("-", 3, "X"),
      token("on", 4, "ADP"),
      token("-", 6, "X"),
      token("one", 7, "NUM"),
      token("meetings", 11, "NOUN", PLURAL),
    ];
    assert.equal(hasNumeral(tokens), false);
  });

  it("ハイフンが前にあっても、離れていれば部品ではない（- two days）", () => {
    assert.equal(hasNumeral([token("-", 0, "X"), token("two", 2, "NUM"), token("days", 6, "NOUN", PLURAL)]), true);
  });

  it("括弧が前に付いても数える（(two days)）", () => {
    assert.equal(hasNumeral([token("(", 0, "X"), token("two", 1, "NUM"), token("days", 5, "NOUN", PLURAL)]), true);
  });

  it("品詞が無ければ何も言わない", () => {
    assert.equal(hasNumeral([]), false);
  });
});

describe("startsWithin", () => {
  const section = { start: 10, end: 20 };

  it("節の中で始まるものがあれば真", () => {
    assert.equal(startsWithin(section, [{ start: 10, end: 12 }]), true);
    assert.equal(startsWithin(section, [{ start: 19, end: 30 }]), true);
  });

  it("節の外、終わりちょうどから始まるものは数えない", () => {
    assert.equal(startsWithin(section, [{ start: 0, end: 12 }]), false);
    assert.equal(startsWithin(section, [{ start: 20, end: 25 }]), false);
    assert.equal(startsWithin(section, []), false);
  });
});

describe("evidenceSpans", () => {
  const node = (kind: StructureNode["kind"], start: number, children: readonly StructureNode[] = []): StructureNode => ({
    kind,
    address: "",
    span: { start, end: start + 1 },
    line: 1,
    attrs: {},
    children,
  });

  it("参照・数量・日付を、深い所からも集める", () => {
    const tree = node("doc", 0, [node("section", 1, [node("reference", 2), node("quantity", 3)]), node("date", 4)]);
    assert.deepEqual(
      evidenceSpans(tree).map((span) => span.start),
      [2, 3, 4],
    );
  });

  it("定義・義務・節そのものは具体物ではない", () => {
    const tree = node("doc", 0, [node("definition", 1), node("obligation", 2), node("section", 3), node("article", 4)]);
    assert.deepEqual(evidenceSpans(tree), []);
  });

  it("木が無ければ空", () => {
    assert.deepEqual(evidenceSpans(undefined), []);
  });
});

describe("concrete-evidence-density: リンク", () => {
  it("valid: 相対パス・ページ内・mailto のリンクは、読み手が辿れる出典", () => {
    [
      "See the [guide](/handbook/meetings/). We act on it. We keep it.",
      "See [results](#results). We act on it. We keep it.",
      "Write to [us](mailto:team@example.org). We answer. We care.",
    ].forEach((last) => assert.deepEqual(flaggedIn(englishWith(last), en), OTHERS_EN, last));
  });

  it("valid: 参照の形のリンク（[text][ref]）も数える", () => {
    const last = "See the [guide][g]. We act on it. We keep it.\n\n[g]: /handbook/meetings/";
    assert.deepEqual(flaggedIn(englishWith(last), en), OTHERS_EN);
  });

  it("valid: 日本語の文書でも同じ", () => {
    assert.deepEqual(flaggedIn(japaneseWith("詳しくは[手引き](./guide.md)を見てください。理念を語ります。姿勢を示します。"), ja), OTHERS_JA);
  });

  it("invalid: 画像はリンクではない", () => {
    assert.ok(flaggedIn(englishWith("![A photo](/images/team.jpg)\n\nWe value openness. We believe in trust. We act with care."), en).includes("Last"));
  });

  it("invalid: 見出しの中のリンクは節の本文ではない", () => {
    const source = `# Values\n\n## Openness\n\n${ABSTRACT_EN}\n\n## Trust\n\n${ABSTRACT_EN}\n\n## [Last](/x/)\n\n${ABSTRACT_EN}`;
    assert.equal(flaggedIn(source, en).length, 3);
  });

  it("invalid: 角括弧で囲んだだけの語はリンクではない", () => {
    assert.ok(flaggedIn(englishWith("We say [draft] often. We believe in trust. We act with care."), en).includes("Last"));
  });
});

describe("concrete-evidence-density: 英語の数の語", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("valid: 綴りで書いた数が複数形の名詞を数えていれば具体的な数", () => {
    ["The break lasted five minutes. We value openness. We act with care.", "It spans more than two days. We value openness. We act with care."].forEach(
      (last) => assert.deepEqual(flaggedIn(englishWith(last), en), OTHERS_EN, last),
    );
  });

  it("invalid: one of・two-way・one-on-one は量ではない", () => {
    [
      "One of the things we value is openness. We believe in trust. We act with care.",
      "We make two-way door decisions. We believe in trust. We act with care.",
      "We hold one-on-one meetings. We believe in trust. We act with care.",
    ].forEach((last) => assert.ok(flaggedIn(englishWith(last), en).includes("Last"), last));
  });

  it("日本語は変わらない。漢数字は今までどおり数える", () => {
    assert.deepEqual(flaggedIn(japaneseWith("期間は三日間です。理念を語ります。姿勢を示します。"), ja), OTHERS_JA);
    assert.ok(flaggedIn(japaneseWith(ABSTRACT_JA), ja).includes("最後"));
  });
});

describe("concrete-evidence-density: 構造の木が読んだ参照", () => {
  it("valid: 数字の無い番地への参照（Section VI）は、確かめに行ける具体物", () => {
    const last = "Reviews are sent to the investigator. See Section VI for the details. We act with care.";
    assert.deepEqual(flaggedIn(englishWith(last), en), OTHERS_EN);
  });

  it("invalid: 参照の無い節は、今までどおり指摘する", () => {
    assert.ok(flaggedIn(englishWith(ABSTRACT_EN), en).includes("Last"));
  });
});

describe("concrete-evidence-density: 文字で区切った索引（用語集）", () => {
  const ACCOUNT_EN = "The right to use a system. It is tied to a user. A user may hold several.";
  const BACKUP_EN = "A copy kept apart from the original. It is used to restore lost data. It is made on a schedule.";
  const ACCOUNT_JA = "システムを使う権利のこと。利用者ごとに与えられます。複数持つこともあります。";
  const BACKUP_JA = "元とは別に保管する写しのこと。失ったデータを戻すのに使います。定期的に作ります。";

  const glossaryEn = (intro = ""): string =>
    `# Glossary\n\n${intro}## A\n\n### Account\n\n${ACCOUNT_EN}\n\n### Access log\n\n${ACCOUNT_EN}\n\n## B\n\n### Backup\n\n${BACKUP_EN}\n\n#### Offsite copies\n\n${BACKUP_EN}\n`;

  const findingIn = (source: string): Finding | undefined =>
    runRules(buildDocument("t.md", source, en), loadRules(en.id), { [RULE]: "strict" }, true, "business/report").findings.find(
      (candidate) => candidate.rule === RULE,
    );

  it("valid: 1 文字の見出しで区切った項目は、定義であって主張ではない", () => {
    assert.deepEqual(flaggedIn(glossaryEn(), en), []);
  });

  it("valid: 日本語の用語集（あ・い）でも同じ", () => {
    const source = `# 用語集\n\n## あ\n\n### アカウント\n\n${ACCOUNT_JA}\n\n### アクセスログ\n\n${ACCOUNT_JA}\n\n## い\n\n### インフラ\n\n${BACKUP_JA}\n`;
    assert.deepEqual(flaggedIn(source, ja), []);
  });

  it("valid: 小文字の区切り（a, b）も文字の順に並べば索引", () => {
    const source = `# Glossary\n\n## a\n\n### Account\n\n${ACCOUNT_EN}\n\n## B\n\n### Backup\n\n${BACKUP_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), []);
  });

  it("invalid: 索引の外の節（前書き・索引の後の節）は、今までどおり指摘する", () => {
    const intro = `## About this glossary\n\n${ABSTRACT_EN}\n\n`;
    assert.deepEqual(flaggedIn(glossaryEn(intro), en), ["About this glossary"]);
    const after = `${glossaryEn()}\n## Suggest a change\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(after, en), ["Suggest a change"]);
  });

  it("invalid: 索引の項目は分母にも数えない", () => {
    assert.equal(findingIn(glossaryEn(`## About this glossary\n\n${ABSTRACT_EN}\n\n`))?.values["total"], 1);
  });

  it("invalid: FAQ の答えに具体物が無ければ指摘する", () => {
    const source = `# FAQ\n\n## How do I apply?\n\n${ABSTRACT_EN}\n\n## Who can apply?\n\n${ABSTRACT_EN}\n\n## What happens next?\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["How do I apply?", "Who can apply?", "What happens next?"]);
  });

  it("invalid: 語だけの見出しが並ぶ語り（Kindness, No ego）は索引ではない", () => {
    const source = `# Values\n\n## Kindness\n\n${ABSTRACT_EN}\n\n## No ego\n\n${ABSTRACT_EN}\n\n## Trust\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["Kindness", "No ego", "Trust"]);
  });

  it("invalid: 1 文字の見出しが 1 つだけなら索引と読まない", () => {
    const source = `# Plans\n\n## A\n\n### Account\n\n${ABSTRACT_EN}\n\n### Access\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["Account", "Access"]);
  });

  it("invalid: 区切りが文字の順に並ばなければ索引と読まない", () => {
    const source = `# Plans\n\n## B\n\n### Backup\n\n${ABSTRACT_EN}\n\n## A\n\n### Account\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["Backup", "Account"]);
  });

  it("invalid: 同じ文字の区切りが繰り返すなら索引と読まない", () => {
    const source = `# Plans\n\n## A\n\n### Account\n\n${ABSTRACT_EN}\n\n## A\n\n### Access\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["Account", "Access"]);
  });

  it("invalid: 本文を持つ 1 文字の見出し（案 A・案 B）は区切りではない", () => {
    const source = `# Plans\n\n## A\n\nWe start small.\n\n### Account\n\n${ABSTRACT_EN}\n\n## B\n\nWe start big.\n\n### Backup\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["Account", "Backup"]);
  });

  it("invalid: 1 文字の見出しで束ねた語り（A の下に Kindness）は、見出し語が文字に従わないので索引ではない", () => {
    const source = `# Values\n\n## A\n\n### Kindness\n\n${ABSTRACT_EN}\n\n## B\n\n### No ego\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["Kindness", "No ego"]);
  });

  it("valid: 見出し語の過半が区切りの文字で始まればよい（漢字の語・the で始まる語が混ざる）", () => {
    const japanese = `# 用語集\n\n## あ\n\n### アカウント\n\n${ACCOUNT_JA}\n\n### 暗号化\n\n${ACCOUNT_JA}\n\n## い\n\n### インフラ\n\n${BACKUP_JA}\n`;
    assert.deepEqual(flaggedIn(japanese, ja), []);
    const english = `# Glossary\n\n## A\n\n### Account\n\n${ACCOUNT_EN}\n\n### the academy\n\n${ACCOUNT_EN}\n\n## B\n\n### Backup\n\n${BACKUP_EN}\n`;
    assert.deepEqual(flaggedIn(english, en), []);
  });

  it("invalid: 語の見出しで束ね、小見出しが同じ文字で始まるだけ（Accounts の下に Account setup）は索引ではない", () => {
    const source = `# Help\n\n## Accounts\n\n### Account setup\n\n${ABSTRACT_EN}\n\n## Billing\n\n### Billing cycle\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["Account setup", "Billing cycle"]);
  });

  it("invalid: 別の親の下にある A と B は 1 つの索引ではない", () => {
    const source = `# Report\n\n## First area\n\n### A\n\n#### Account setup\n\n${ABSTRACT_EN}\n\n## Second area\n\n### B\n\n#### Billing cycle\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["Account setup", "Billing cycle"]);
  });

  it("valid: 索引が 2 つあっても、それぞれ索引と読む", () => {
    const index = `### A\n\n#### Account\n\n${ACCOUNT_EN}\n\n### B\n\n#### Backup\n\n${BACKUP_EN}\n\n`;
    assert.deepEqual(flaggedIn(`# Glossaries\n\n## Accounting\n\n${index}## Storage\n\n${index}`, en), []);
  });

  it("valid: 見出し語の下の小見出しは、区切りの文字で始まらなくてよい", () => {
    const source = `# Glossary\n\n## A\n\n### Account\n\n${ACCOUNT_EN}\n\n#### Kindness\n\n${ACCOUNT_EN}\n\n#### Openness\n\n${ACCOUNT_EN}\n\n## B\n\n### Backup\n\n${BACKUP_EN}\n\n#### Trust\n\n${BACKUP_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), []);
  });

  it("invalid: 見出し語の半分が区切りの文字で始まらなければ索引ではない", () => {
    const source = `# Glossary\n\n## A\n\n### Account\n\n${ABSTRACT_EN}\n\n### Kindness\n\n${ABSTRACT_EN}\n\n## B\n\n### Backup\n\n${ABSTRACT_EN}\n\n### No ego\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["Account", "Kindness", "Backup", "No ego"]);
  });

  it("valid: 濁点を分けて書いた区切り（か + ゛）も 1 文字", () => {
    const source = `# 用語集\n\n## あ\n\n### アカウント\n\n${ACCOUNT_JA}\n\n## \u304b\u3099\n\n### ガード\n\n${BACKUP_JA}\n`;
    assert.deepEqual(flaggedIn(source, ja), []);
  });

  it("invalid: 数字 1 文字の見出し（1）は文字の区切りではない", () => {
    const source = `# Plans\n\n## 1\n\n### 2020\n\n${ABSTRACT_EN}\n\n## A\n\n### Account\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["2020", "Account"]);
  });

  it("invalid: 区切りと同じ深さの見出しで索引は閉じる", () => {
    const source = `${glossaryEn()}\n## Notes\n\n### Openness\n\n${ABSTRACT_EN}\n`;
    assert.deepEqual(flaggedIn(source, en), ["Openness"]);
  });
});

describe("indexLetterOf", () => {
  it("最初の文字を、索引で引く形にする", () => {
    const cases: readonly (readonly [string, string])[] = [
      ["Account", "A"],
      ["account", "A"],
      ["the Earth", "T"],
      ["“bold”", "B"],
      ["24 hour clock", "H"],
      ["École", "E"],
      ["アカウント", "あ"],
      ["ガード", "か"],
      ["\u304b\u3099", "か"],
      ["暗号化", "暗"],
    ];
    cases.forEach(([heading, letter]) => assert.equal(indexLetterOf(heading), letter, heading));
  });

  it("文字が無ければ空", () => {
    assert.equal(indexLetterOf(""), "");
    assert.equal(indexLetterOf("2026"), "");
  });
});

const ADVICE: AdviceWords = { openers: ["please", "never", "do not"], endings: ["ください", "ましょう"] };
const sentence = (text: string, tokens?: readonly Token[]): { text: string; tokens?: readonly Token[] } => ({
  text,
  ...(tokens === undefined ? {} : { tokens }),
});

describe("isClaim", () => {
  it("問いは主張ではない（? と ？、閉じ括弧の内側も）", () => {
    ["Which tasks should require human review?", "What is it?”", "マルウェアはどこから来るの？", "（何を確認しますか？）", "【何を確認しますか？】"].forEach(
      (text) => assert.equal(isClaim(sentence(text), "en", ADVICE), false, text),
    );
  });

  it("語彙表の書き出しや文末で、読み手にすることを伝える文は主張ではない", () => {
    ["Never use a gas stovetop to heat your home.", "Please submit your comments only once.", "Do not use a gas stove."].forEach((text) =>
      assert.equal(isClaim(sentence(text), "en", ADVICE), false, text),
    );
    ["怪しいリンクは開かないでください。", "正しいURLからアクセスしましょう。"].forEach((text) =>
      assert.equal(isClaim(sentence(text), "ja", ADVICE), false, text),
    );
  });

  const verb = (surface: string, start: number, lemma: string, features?: Readonly<Record<string, string>>): Token => ({
    ...token(surface, start, "VERB", features),
    lemma,
  });
  const ALSO_VERB = { AlsoVerb: "Yes" };

  it("原形の動詞で始まる英語の文は指示（名詞と読まれた、動詞にもなる語も）", () => {
    const keep = [verb("Keep", 0, "keep"), token("freezers", 5, "NOUN", PLURAL), verb("closed", 14, "close"), token(".", 20, "PUNCT")];
    assert.equal(isClaim(sentence("Keep freezers closed.", keep), "en", ADVICE), false);
    const use = [token("Use", 0, "NOUN", ALSO_VERB), token("a", 4, "DET"), token("generator", 6, "NOUN"), token(".", 15, "PUNCT")];
    assert.equal(isClaim(sentence("Use a generator.", use), "en", ADVICE), false);
  });

  it("valid: 動詞にもなる名詞でも、主語・複数形・見出し語・-ing 形は指示ではない", () => {
    const cases: readonly (readonly [string, readonly Token[]])[] = [
      ["Power may return.", [token("Power", 0, "NOUN", ALSO_VERB), token("may", 6, "AUX"), verb("return", 10, "return"), token(".", 16, "PUNCT")]],
      [
        "Issues for the board.",
        [token("Issues", 0, "NOUN", { ...ALSO_VERB, ...PLURAL }), token("for", 7, "ADP"), token("the", 11, "DET"), token("board", 15, "NOUN")],
      ],
      ["Release: none.", [token("Release", 0, "NOUN", ALSO_VERB), token(":", 7, "PUNCT"), token("none", 9, "PRON"), token(".", 13, "PUNCT")]],
      [
        "Using an oven can increase the risk.",
        [verb("Using", 0, "use", { VerbForm: "Ger" }), token("an", 6, "DET"), token("oven", 9, "NOUN"), token("can", 14, "AUX")],
      ],
    ];
    cases.forEach(([text, tokens]) => assert.equal(isClaim(sentence(text, tokens), "en", ADVICE), true, text));
  });

  it("valid: 述べる文は主張のまま（問いの語や依頼の語が途中にあっても）", () => {
    [
      "Our help desk got much better.",
      "The team asked why it failed.",
      "Customers never complained.",
      "Pleased customers wrote back.",
      "The question mark? is part of the name here.",
    ].forEach((text) => assert.equal(isClaim(sentence(text), "en", ADVICE), true, text));
    ["お客様からの評判も上々です。", "ご確認くださいという依頼が増えました。"].forEach((text) =>
      assert.equal(isClaim(sentence(text), "ja", ADVICE), true, text),
    );
  });

  it("日本語の文は、品詞が動詞で始まっても指示に読まない", () => {
    const tokens = [token("メール", 0, "NOUN"), token("に", 3, "ADP"), token("注意", 4, "NOUN"), token("する", 6, "VERB")];
    assert.equal(isClaim(sentence("メールに注意する。", tokens), "ja", ADVICE), true);
  });

  it("空の文や品詞の無い文は、主張として数える", () => {
    assert.equal(isClaim(sentence(""), "en", ADVICE), true);
    assert.equal(isClaim(sentence("Revenue grew.", []), "en", ADVICE), true);
    assert.equal(isClaim(sentence("Never mind."), "en", { openers: [], endings: [] }), true);
  });
});

describe("isLabelOnly", () => {
  it("項目の番号だけの文（a. (1) iv. 2)）", () => {
    ["a.", "(1)", "（2）", "iv.", "2)", "12.", "B."].forEach((text) => assert.equal(isLabelOnly({ text }), true, text));
  });

  it("valid: 短い語や文は番号ではない（API. Yes. はい。 Why?）", () => {
    ["API.", "Yes.", "はい。", "Why?", "", "a", "(abc)"].forEach((text) => assert.equal(isLabelOnly({ text }), false, text));
  });
});

describe("concrete-evidence-density: 問いと指示の節", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("valid: 問いを並べた節（情報提供の依頼）は見ない", () => {
    // Federal Register 2026-16371（NIST の RFI、パブリックドメイン）から。
    const last = [
      "Which tasks are most appropriate for AI-enabled automation?",
      "Which tasks should require human review?",
      "What other actions could NIST take to improve vulnerability management processes?",
    ].join(" ");
    assert.deepEqual(flaggedIn(englishWith(last), en), OTHERS_EN);
  });

  it("valid: 指示を並べた節（安全の手引き）は見ない", () => {
    // Ready.gov「Power Outages」（FEMA、パブリックドメイン）から。
    const last = [
      "Take an inventory of the items you need that rely on electricity.",
      "Have flashlights for every household member.",
      "Never use a gas stovetop or oven to heat your home.",
      "Keep freezers and refrigerators closed.",
    ].join(" ");
    assert.deepEqual(flaggedIn(englishWith(last), en), OTHERS_EN);
  });

  it("valid: 日本語でも、〜ましょう・〜ください で終わる節は見ない", () => {
    const last = "正しいアドレスからアクセスしましょう。怪しいメールは開かないでください。パスワードを使い回さないようにしましょう。";
    assert.deepEqual(flaggedIn(japaneseWith(last), ja), OTHERS_JA);
  });

  it("invalid: 主張が 3 つあれば、問いや指示が混ざっていても指摘する", () => {
    assert.ok(flaggedIn(englishWith(`${ABSTRACT_EN} Why does this matter? Keep it in mind.`), en).includes("Last"));
    assert.ok(flaggedIn(japaneseWith(`${ABSTRACT_JA}なぜでしょう？覚えておきましょう。`), ja).includes("最後"));
  });

  it("invalid: 数字の無い報告の節は、今までどおり指摘する", () => {
    const last = "Our help desk got much better. Customers are pleased with it. The team feels less pressure too.";
    assert.ok(flaggedIn(englishWith(last), en).includes("Last"));
  });
});
