import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { renderCompact } from "../packages/chaff/src/render/compact.ts";
import type { TeamRules } from "../packages/chaff/src/document.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { isDictionaryVerb } from "../packages/chaff/src/detectors/conjugated-entry.ts";

const RULES = loadRules("ja");

const NONE: TeamRules = { jargon: [], requiredSections: [] };

const idsFor = (source: string, team: TeamRules = NONE, genre = "business/proposal"): string[] =>
  runRules(buildDocument("t.md", source, ja, team), RULES, {}, true, genre).findings.map((finding) => finding.rule);

const PROPOSAL = "# 提案\n\n## 背景\n\n他部署にも横展開したいと考えています。先方と握った内容を共有します。\n\n## 提案\n\n運用は当面こちらで巻き取ります。";

describe("チームが決める rule", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  describe("internal-jargon", () => {
    it("invalid: chaff.yaml に並べた語を見つける", () => {
      assert.ok(idsFor(PROPOSAL, { jargon: ["横展開", "握る"], requiredSections: [] }).includes("internal-jargon"));
    });

    it("活用していても原形で当たる", () => {
      // 利用者は辞書形で書く（握る）が、本文は活用している（握った）。
      const found = runRules(buildDocument("t.md", PROPOSAL, ja, { jargon: ["握る"], requiredSections: [] }), RULES, {}, true, "business/proposal").findings;
      assert.ok(found.some((finding) => finding.rule === "internal-jargon" && finding.values["matched"] === "握る"));
    });

    it("複合動詞は語幹で書けば当たる", () => {
      // 「巻き取ります」は 巻き[巻く] + 取り[取る] に割れるので、原形の「巻き取る」は現れない。
      assert.ok(idsFor(PROPOSAL, { jargon: ["巻き取"], requiredSections: [] }).includes("internal-jargon"));
    });

    it("何も並べていなければ何も言わない。用語の登録を押しつけない", () => {
      assert.ok(!idsFor(PROPOSAL).includes("internal-jargon"));
    });
  });

  describe("required-sections", () => {
    it("invalid: 決めた見出しが無い", () => {
      assert.ok(idsFor(PROPOSAL, { jargon: [], requiredSections: ["リスク", "費用"] }).includes("required-sections"));
    });

    it("valid: 揃っていれば指摘しない", () => {
      const source = `${PROPOSAL}\n\n## リスク\n\n影響は限定的です。\n\n## 費用\n\n30 万円です。`;
      assert.ok(!idsFor(source, { jargon: [], requiredSections: ["リスク", "費用"] }).includes("required-sections"));
    });

    it("見出しに含まれていれば足りる", () => {
      // 「リスクと対策」でも「リスク」の節があると見る。見出しの文言までは縛らない。
      const source = `${PROPOSAL}\n\n## リスクと対策\n\n影響は限定的です。`;
      assert.ok(!idsFor(source, { jargon: [], requiredSections: ["リスク"] }).includes("required-sections"));
    });

    it("何も決めていなければ何も言わない", () => {
      assert.ok(!idsFor(PROPOSAL).includes("required-sections"));
    });
  });

  describe("proper-noun-density", () => {
    const BULK = "本日の連絡です。今日も順調に進めます。".repeat(10);

    it("invalid: 固有名詞が続く", () => {
      const names = "MulmoCast と GraphAI と Receptron と Anthropic の話です。".repeat(8);
      assert.ok(idsFor(`# 紹介\n\n${names}${BULK}`, NONE, "blog/tech").includes("proper-noun-density"));
    });

    it("valid: 普通の文章なら指摘しない", () => {
      assert.ok(!idsFor(`# 紹介\n\n${BULK}`, NONE, "blog/tech").includes("proper-noun-density"));
    });
  });
});

describe("English screens of the team rules", () => {
  const RULES_EN = loadRules("en");

  const findingsFor = (source: string, team: TeamRules): ReturnType<typeof runRules>["findings"] =>
    runRules(buildDocument("t.md", source, en, team), RULES_EN, {}, true, "business/proposal").findings;

  it("missing headings are joined with a comma, not 「、」", () => {
    const found = findingsFor("# Proposal\n\n## Plan\n\nWe start in May.", { jargon: [], requiredSections: ["Risks", "Costs"] });
    assert.equal(found.find((finding) => finding.rule === "required-sections")?.values["word"], "Risks, Costs");
  });

  it("a Japanese document keeps 「、」", () => {
    const found = runRules(
      buildDocument("t.md", "# 提案\n\n## 背景\n\n本文。", ja, { jargon: [], requiredSections: ["リスク", "費用"] }),
      RULES,
      {},
      true,
      "business/proposal",
    ).findings;
    assert.equal(found.find((finding) => finding.rule === "required-sections")?.values["word"], "リスク、費用");
  });

  it("a jargon phrase is found at the start of a sentence too", () => {
    const found = findingsFor("# Note\n\nCircle back after lunch.", { jargon: ["circle back"], requiredSections: [] });
    assert.ok(found.some((finding) => finding.rule === "internal-jargon"));
  });

  it("a jargon entry written with capitals is found in lower case too", () => {
    const found = findingsFor("# Note\n\nWe circle back after lunch.", { jargon: ["Circle back"], requiredSections: [] });
    assert.ok(found.some((finding) => finding.rule === "internal-jargon"));
  });

  it("ai-tell lists its words with a comma in English", () => {
    const source = "# Note\n\nWe delve into the tapestry of ideas. It plays a crucial role and is a testament to our work.";
    const found = runRules(buildDocument("t.md", source, en), RULES_EN, { "ai-tell": "strict" }, true, "blog/tech").findings;
    const words = String(found.find((finding) => finding.rule === "ai-tell")?.values["word"] ?? "");
    assert.ok(words.includes(", ") && !words.includes("、"), words);
  });

  it("the compact tally says 1 finding, not 1 findings", () => {
    const source = "# Note\n\nCircle back after lunch.";
    const document = buildDocument("t.md", source, en, { jargon: ["circle back"], requiredSections: [] });
    const result = runRules(
      document,
      RULES_EN.filter((rule) => rule.id === "internal-jargon"),
      {},
      true,
      "business/proposal",
    );
    assert.match(renderCompact("t.md", result, RULES_EN, "en"), /^1 finding$/mu);
  });
});

describe("internal-jargon: a verb listed in its dictionary form matches its conjugations", () => {
  const RULES_JA = loadRules("ja");
  const RULES_EN = loadRules("en");
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  const quotesFor = (adapter: typeof ja, source: string, jargon: readonly string[]): string[] =>
    runRules(buildDocument("t.md", source, adapter, { jargon, requiredSections: [] }), adapter === ja ? RULES_JA : RULES_EN, {}, true, "business/proposal")
      .findings.filter((finding) => finding.rule === "internal-jargon")
      .map((finding) => finding.quote);

  it("a compound verb (巻き取る) matches 巻き取ります, 巻き取った and 巻き取れば", () => {
    const source = "# 手順\n\n在庫を巻き取ります。\n\n昨日は在庫を巻き取った。\n\n早めに巻き取れば安心です。\n";
    assert.deepEqual(quotesFor(ja, source, ["巻き取る"]), ["在庫を巻き取ります。", "昨日は在庫を巻き取った。", "早めに巻き取れば安心です。"]);
  });

  it("a verb entry does not match its noun form, which the team did not list", () => {
    assert.deepEqual(quotesFor(ja, "# 手順\n\n巻き取りは明日です。\n", ["巻き取る"]), []);
  });

  it("the noun form still matches when the team lists it", () => {
    assert.deepEqual(quotesFor(ja, "# 手順\n\n巻き取りは明日です。\n", ["巻き取り"]), ["巻き取りは明日です。"]);
  });

  it("a verb entry does not match the same pieces split by other words", () => {
    assert.deepEqual(quotesFor(ja, "# 手順\n\n糸を巻きながら取ります。\n", ["巻き取る"]), []);
  });

  it("a conjugated entry (握った) matches only as written", () => {
    assert.deepEqual(quotesFor(ja, "# 手順\n\n先方と握ったら共有します。\n", ["握った"]), ["先方と握ったら共有します。"]);
    assert.deepEqual(quotesFor(ja, "# 手順\n\n先方と握ります。\n", ["握った"]), []);
  });

  it("an English verb the tagger knows matches its past form", () => {
    assert.deepEqual(quotesFor(en, "# Note\n\nI pinged the vendor.\n", ["ping"]), ["I pinged the vendor."]);
  });

  it("an English noun entry is matched as written, not as a verb", () => {
    assert.deepEqual(quotesFor(en, "# Note\n\nWe met the vendor.\n", ["meeting"]), []);
  });
});

describe("isDictionaryVerb", () => {
  const token = (surface: string, pos: string, lemma?: string): Token => ({
    span: { start: 0, end: surface.length },
    surface,
    pos,
    ...(lemma === undefined ? {} : { lemma }),
  });

  it("is true when the last word is a verb in its dictionary form", () => {
    assert.equal(isDictionaryVerb({ pattern: "巻き取る", tokens: [token("巻き", "VERB", "巻く"), token("取る", "VERB", "取る")] }), true);
    assert.equal(isDictionaryVerb({ pattern: "Ping", tokens: [token("Ping", "VERB", "ping")] }), true);
  });

  it("is false for a noun, a conjugated form, a word with no lemma, and an entry with no words", () => {
    assert.equal(isDictionaryVerb({ pattern: "巻き取り", tokens: [token("巻き", "VERB", "巻く"), token("取り", "NOUN", "取り")] }), false);
    assert.equal(isDictionaryVerb({ pattern: "握った", tokens: [token("握っ", "VERB", "握る"), token("た", "AUX", "た")] }), false);
    assert.equal(isDictionaryVerb({ pattern: "握る", tokens: [token("握る", "VERB")] }), false);
    assert.equal(isDictionaryVerb({ pattern: "握る", tokens: [] }), false);
    assert.equal(isDictionaryVerb({ pattern: "握る" }), false);
  });
});
