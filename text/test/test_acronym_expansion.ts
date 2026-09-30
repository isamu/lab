import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { expansionAt, type DefinitionWords } from "../packages/chaff/src/detectors/acronym-expansion.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 略語の定義の形（人事部（以下「HR」という。）、(hereinafter "SLA")）。例文はすべて自作。

const wordsOf = (adapter: LanguageAdapter): DefinitionWords => ({
  markers: (adapter.lexicons["definition-marker"] ?? []).map((entry) => entry.pattern),
  verbs: (adapter.lexicons["definition-verb"] ?? []).map((entry) => entry.pattern),
});

/** text の中の最初の acronym が、その場で説明されているか。 */
const explained = (adapter: LanguageAdapter, text: string, acronym: string): boolean => expansionAt(wordsOf(adapter))(text, acronym, text.indexOf(acronym));

/** [何の形か, 例文]。 */
type Form = readonly [string, string];
/** [何の形か, 例文, 見る略語]。 */
type Miss = readonly [string, string, string];

const JA_FORMS: readonly Form[] = [
  ["以下、", "Human Resource(以下、HR)部が担当する。"],
  ["以下「」という。", "人事部（以下「HR」という。）が担当する。"],
  ["以下「」", "Service Level Agreement（以下「SLA」）を結ぶ。"],
  ["以下『』という", "稼働目標（以下『SLO』という）を置く。"],
  ["以下 と空白", "稼働目標（以下 SLO）を置く。"],
  ["「」という。（以下なし）", "稼働目標（「SLO」という。）を置く。"],
  ["と称する", "稼働目標（以下「SLO」と称する。）を置く。"],
  ["と呼ぶ", "稼働目標（以下「SLO」と呼ぶ）を置く。"],
  ["半角括弧と句点", "稼働目標(以下「SLO」という。)を置く。"],
];

const JA_MISSES: readonly Miss[] = [
  ["ふつうの意味の以下（以下の手順）", "（以下のSRE手順）を読む。", "SRE"],
  ["以下のあとに別の語が続く", "（以下 SRE 担当）に聞く。", "SRE"],
  ["括弧の外の以下", "10万円以下 SRE を使う。", "SRE"],
  ["括弧の中に別の略語と並ぶ", "（以下「SRE」「SLO」という。）", "SRE"],
  ["という のあとに語が続く", "（以下「SRE」という部署）に聞く。", "SRE"],
  ["以下が括弧の中で前にある語の後ろ", "（詳細は以下 SRE）", "SRE"],
  ["閉じ括弧が無い", "（以下「SRE」という。", "SRE"],
];

describe("略語の定義の形（日本語）", () => {
  JA_FORMS.forEach(([form, text]) => {
    it(`valid: ${form}`, () => {
      assert.ok(explained(ja, text, /[A-Z]{2,}/u.exec(text)?.[0] ?? ""), text);
    });
  });

  JA_MISSES.forEach(([form, text, acronym]) => {
    it(`invalid: ${form}`, () => {
      assert.equal(explained(ja, text, acronym), false, text);
    });
  });
});

const EN_MISSES: readonly Miss[] = [
  ["the が語の頭でない（there）", "Ask (there SLA) now.", "SLA"],
  ["括弧の中で後ろに語が続く（the SLA team）", "Ask (the SLA team) now.", "SLA"],
  ["定義の語でない語が前にある（see the）", "Ask (see the SLA) now.", "SLA"],
  ["別の略語の後ろ（the UK GDPR）", "It follows (the UK GDPR) rules.", "GDPR"],
  ["語の途中（theSLA）", "Ask (theSLA) now.", "SLA"],
  ["定義の語がくっついて別の語になる（akathe）", "Ask (akathe SLA) now.", "SLA"],
  ["後ろの語の無い言語で、句点だけが続く", "Ask (SLA.) now.", "SLA"],
];

describe("略語の定義の形（英語）", () => {
  [
    'Service Level Agreement (hereinafter "SLA") applies.',
    "Service Level Agreement (hereinafter referred to as “SLA”) applies.",
    'Service Level Agreement (the "SLA") applies.',
    "Service Level Agreement (The “SLA”) applies.",
    'General Data Protection Regulation (aka the "GDPR") applies.',
    'General Data Protection Regulation (a.k.a. "GDPR") applies.',
    "General Data Protection Regulation (also known as GDPR) applies.",
    "Service Level Agreement (“SLA”) applies.",
  ].forEach((text) => {
    it(`valid: ${text}`, () => {
      assert.ok(explained(en, text, /[A-Z]{3,}/u.exec(text)?.[0] ?? ""), text);
    });
  });

  EN_MISSES.forEach(([form, text, acronym]) => {
    it(`invalid: ${form}`, () => {
      assert.equal(explained(en, text, acronym), false, text);
    });
  });
});

describe("略語の定義の形: 語彙表が無い・変な入力", () => {
  const none: DefinitionWords = { markers: [], verbs: [] };

  it("語彙表が空なら、定義の形は認めず、括弧の形だけを認める", () => {
    const at = expansionAt(none);
    assert.equal(at("人事部（以下「HR」という。）", "HR", "人事部（以下「HR」という。）".indexOf("HR")), false);
    assert.ok(at("人事部（HR）", "HR", "人事部（HR）".indexOf("HR")));
  });

  it("定義の語も後ろの語も無い括弧は、これまでどおり隣の 3 文字の中だけを見る", () => {
    const text = "目標（「『 SLO 』」）を置く。";
    assert.equal(expansionAt(wordsOf(ja))(text, "SLO", text.indexOf("SLO")), false);
  });

  it("括弧の中が定義の語と略語だけなら、前の語を問わない。語の無い括弧（(KPT)）と同じ強さ", () => {
    const at = expansionAt(wordsOf(en));
    ["Ask (KPT) now.", "Ask (the KPT) now."].forEach((text) => assert.ok(at(text, "KPT", text.indexOf("KPT")), text));
  });

  it("空の本文・範囲の外の位置でも落ちない", () => {
    const at = expansionAt(wordsOf(ja));
    assert.equal(at("", "HR", 0), false);
    assert.equal(at("HR", "HR", 0), false);
    assert.equal(at("（以下「HR」という。）", "HR", 100), false);
  });

  it("正規表現の記号を含む語（a.k.a.）は文字どおりに読む", () => {
    const at = expansionAt({ markers: ["a.k.a."], verbs: [] });
    assert.equal(at("Rule (aXkXaX GDPR) set.", "GDPR", "Rule (aXkXaX GDPR) set.".indexOf("GDPR")), false);
    assert.ok(at("Rule (a.k.a. GDPR) set.", "GDPR", "Rule (a.k.a. GDPR) set.".indexOf("GDPR")));
  });
});

describe("undefined-acronym: 定義の形で書いた略語は指摘しない", () => {
  it("日本語: 定義した略語は外れ、していない略語は残る", () => {
    const source = "# 手引き\n\nHuman Resource(以下、HR)部と、欧州委員会（以下「EC」という。）の話です。のちに HR と EC と KPT を見ます。\n";
    assert.deepEqual(reportedAcronyms(ja, source), ["KPT"]);
  });

  it("日本語: 括弧の中にあるだけの略語は指摘する", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 手引き\n\n手順は（以下のKPT手順）に書きます。\n"), ["KPT"]);
  });

  it("英語: 定義した略語は外れ、括弧の中にあるだけの略語は残る", () => {
    const source = '# Terms\n\nThe Service Level Agreement (hereinafter "SLA") applies. Ask (the KPT team) about the SLA.\n';
    assert.deepEqual(reportedAcronyms(en, source), ["KPT"]);
  });
});

describe("undefined-acronym: 読む語彙表がどれか 1 つ無い言語", () => {
  const source = '# Terms\n\nThe Service Level Agreement (hereinafter "SLA") applies at 3:30 PM.\n';
  const without = (list: string): LanguageAdapter => ({ ...en, lexicons: Object.fromEntries(Object.entries(en.lexicons).filter(([id]) => id !== list)) });

  loadRules("en")
    .filter((rule) => rule.id === "undefined-acronym")
    .flatMap((rule) => rule.extra_word_lists)
    .forEach((list) => {
      it(`${list} が無ければ rule は動かず、その語彙表の名前を理由に言う`, () => {
        const result = runRules(buildDocument("t.md", source, without(list)), loadRules("en"), { "undefined-acronym": "strict" }, true, "business/report");
        assert.ok(!result.findings.some((finding) => finding.rule === "undefined-acronym"));
        assert.ok(result.skipped.find((entry) => entry.rule === "undefined-acronym")?.why.includes(list));
      });
    });

  it("空の語彙表は「その書き方が無い」で、rule は動く（定義の形も時刻も数えない）", () => {
    const empty: LanguageAdapter = { ...en, lexicons: { ...en.lexicons, "definition-marker": [], meridiem: [] } };
    assert.deepEqual(reportedAcronyms(empty, source), ["SLA", "PM"]);
  });
});
