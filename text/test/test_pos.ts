import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { neededBy, runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { upos as uposJa } from "../packages/lang-ja/src/pos.ts";
import { upos as uposEn } from "../packages/lang-en/src/pos.ts";
import type { LanguageAdapter, ProseDocument, RuleDefinition, Token } from "../packages/chaff/src/plugin.ts";

const RULES = loadRules("ja");

const idsFor = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/report").findings.map((finding) => finding.rule);

const tokensOf = (source: string, adapter: LanguageAdapter): readonly Token[] =>
  buildDocument("t.md", source, adapter).sentences.flatMap((sentence) => sentence.tokens ?? []);

describe("品詞は UPOS に揃える", () => {
  it("IPADIC を UPOS に写す", () => {
    assert.equal(uposJa("名詞", "一般"), "NOUN");
    assert.equal(uposJa("名詞", "代名詞"), "PRON");
    assert.equal(uposJa("助詞", "格助詞"), "ADP");
    assert.equal(uposJa("助詞", "接続助詞"), "SCONJ");
    assert.equal(uposJa("記号", "句点"), "PUNCT");
  });

  it("Penn Treebank を UPOS に写す", () => {
    assert.equal(uposEn("NN"), "NOUN");
    assert.equal(uposEn("NNP"), "PROPN");
    assert.equal(uposEn("VBN"), "VERB");
    assert.equal(uposEn("IN"), "ADP");
    assert.equal(uposEn("."), "PUNCT");
  });

  it("知らない品詞は X。当てずっぽうを返さない", () => {
    assert.equal(uposJa("未知", "未知"), "X");
    assert.equal(uposEn("ZZZ"), "X");
  });
});

describe("解析器を読むまで tokens は無い", () => {
  it("prepare の前は undefined。「品詞が無い文」と混ざらない", () => {
    // prepare を呼ばない経路。段落を 1 つだけ渡す。
    assert.equal(ja.segment("これは文です。").sentences[0]?.tokens, undefined);
  });

  it("要求する rule も使う rule も 1 本も無ければ pos を読まない", () => {
    // 品詞を要求する rule と、使えるなら使う rule を全部止めた状態。
    const off = Object.fromEntries(RULES.filter((rule) => rule.requires.includes("pos") || rule.uses.includes("pos")).map((rule) => [rule.id, "off" as const]));
    assert.equal(neededBy(RULES, off, true, "blog/tech", "ja").pos, false);
  });

  it("使えるなら使う rule（uses: [pos]）だけが動いていても、pos を読む", () => {
    const off = Object.fromEntries(RULES.filter((rule) => rule.requires.includes("pos") || rule.uses.includes("pos")).map((rule) => [rule.id, "off" as const]));
    assert.equal(neededBy(RULES, { ...off, "concrete-evidence-density": "normal" }, false, "business/report", "ja").pos, true);
    assert.deepEqual(
      RULES.filter((rule) => rule.uses.includes("pos"))
        .map((rule) => rule.id)
        .sort((left, right) => left.localeCompare(right)),
      [
        "ai-tell",
        "closing-cliche",
        "concrete-evidence-density",
        "cushion-phrase-density",
        "double-keigo",
        "empty-intensifier",
        "excessive-hedging",
        "hiragana-fukushi",
        "max-kanji-continuous",
        "ngram-repetition",
        "padded-intro",
        "repeated-conjunction",
        "sasete-itadaku",
        "unqualified-superlative",
      ],
    );
  });

  it("stable な rule が要求していれば、既定でも読む", () => {
    // taigen-dome-in-prose は stable なので、--experimental なしでも動く。
    assert.equal(neededBy(RULES, {}, false, "blog/tech", "ja").pos, true);
  });

  it("experimental な rule は、名指しで有効にしたときだけ数に入る", () => {
    // agentless-passive は experimental。止めたほかの pos rule と合わせて確かめる。
    const off = Object.fromEntries(RULES.filter((rule) => rule.requires.includes("pos") || rule.uses.includes("pos")).map((rule) => [rule.id, "off" as const]));
    assert.equal(neededBy(RULES, off, true, "business/report", "ja").pos, false);
    assert.equal(neededBy(RULES, { ...off, "agentless-passive": "normal" }, false, "business/report", "ja").pos, true);
  });
});

describe("満たせない要求は黙って通さない", () => {
  const bare: LanguageAdapter = { ...ja, capabilities: { ...ja.capabilities, pos: false, lemma: false } };

  it("品詞が使えない言語では、理由を付けて skip する", () => {
    const result = runRules(buildDocument("t.md", "方針が決定されました。", bare), RULES, { "agentless-passive": "normal" }, false, "business/report");
    const skipped = result.skipped.find((entry) => entry.rule === "agentless-passive");
    assert.ok(skipped !== undefined, "skip されていない");
    assert.match(skipped.why, /品詞解析/u);
    assert.ok(!result.findings.some((finding) => finding.rule === "agentless-passive"));
  });

  it("知らない要求は満たされていないものとして扱う", () => {
    const doc: ProseDocument = buildDocument("t.md", "方針が決定されました。", bare);
    const rule: RuleDefinition = {
      id: "telepathic",
      layer: "L3",
      status: "stable",
      name: {},
      why: {},
      how_to_fix: {},
      message: {},
      levels: { normal: 1 },
      by_genre: {},
      how_to_find: "sentence-length",
      word_list: undefined,
      extra_word_lists: [],
      what_to_check: undefined,
      where: undefined,
      requires: ["telepathy"],
      uses: [],
      from: [],
      languages: undefined,
      use_for: ["business"],
      severity: "warning",
    };
    const result = runRules(doc, [rule], {}, false, "business/report");
    assert.deepEqual(
      result.skipped.map((entry) => entry.rule),
      ["telepathic"],
    );
    assert.equal(result.findings.length, 0);
  });
});

describe("agentless-passive（日本語）", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("tokens の位置が原文と合う", () => {
    const tokens = tokensOf("この方針は決定されました。", ja);
    tokens.forEach((token) => {
      assert.equal("この方針は決定されました。".slice(token.span.start, token.span.end), token.surface);
    });
  });

  it("受動の「れる/られる」に Voice=Pass が付く", () => {
    const tokens = tokensOf("方針が決定されました。", ja);
    assert.ok(tokens.some((token) => token.features?.["Voice"] === "Pass" && token.pos === "AUX"));
  });

  it("invalid: 動作主のない受動を指摘する", () => {
    assert.ok(idsFor("一定の協力が求められます。", ja).includes("agentless-passive"));
  });

  it("valid: 動作主が書いてあれば指摘しない", () => {
    assert.ok(!idsFor("報告書は委員会によってレビューされました。", ja).includes("agentless-passive"));
  });

  it("valid: 能動なら指摘しない", () => {
    assert.ok(!idsFor("運営チームが方針を決定しました。", ja).includes("agentless-passive"));
  });

  it("valid: 名詞を修飾しているだけの受動は指摘しない", () => {
    // 「開催される BootCamp」は動作主を隠しているのではなく、名前の付けかた。
    assert.ok(!idsFor("定期的に開催されるBootCampに参加してください。", ja).includes("agentless-passive"));
  });
});

describe("agentless-passive（英語）", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("tokens の位置が原文と合う", () => {
    const source = "The decision was made after a long debate.";
    tokensOf(source, en).forEach((token) => assert.equal(source.slice(token.span.start, token.span.end), token.surface));
  });

  it("invalid: 動作主のない受動を指摘する", () => {
    assert.ok(idsFor("The decision was made after a long debate.", en).includes("agentless-passive"));
  });

  it("valid: by 句があれば指摘しない", () => {
    assert.ok(!idsFor("The report was reviewed by the committee.", en).includes("agentless-passive"));
  });

  it("valid: be の無い過去分詞は受動ではない", () => {
    // "a framework used to build ..." は関係節の省略。完了形 "has reviewed" も受動ではない。
    assert.ok(!idsFor("We used a framework to build the interface.", en).includes("agentless-passive"));
    assert.ok(!idsFor("The committee has reviewed the report.", en).includes("agentless-passive"));
  });

  it("副詞を挟んだ受動も拾う", () => {
    assert.ok(idsFor("The release was quickly approved.", en).includes("agentless-passive"));
  });

  describe("名詞を修飾しているだけの受動は指摘しない", () => {
    const passivesIn = (source: string): string[] => tokensOf(source, en).flatMap((token) => (token.features?.["Voice"] === "Pass" ? [token.surface] : []));

    [
      "We read the report that was published last week.",
      "The report, which was written last year, is late.",
      "The people who were elected will serve.",
      "The plan that has been approved will ship.",
      "The plan that has already been approved will ship.",
      "Those who were elected will serve.",
      "The candidates who will be selected are strong.",
      "We deleted the files stored on the server.",
    ].forEach((source) => {
      it(`valid: ${source}`, () => {
        assert.deepEqual(passivesIn(source), []);
        assert.ok(!idsFor(source, en).includes("agentless-passive"));
      });
    });

    it("過去分詞には VerbForm=Part を付ける。受動かどうかにかかわらず", () => {
      const forms = tokensOf("Based on the review, the plan that was approved was shipped.", en).flatMap((token) =>
        token.features === undefined ? [] : [`${token.surface}:${token.features["VerbForm"] ?? ""}:${token.features["Voice"] ?? ""}`],
      );
      assert.deepEqual(forms, ["Based:Part:", "approved:Part:", "shipped:Part:Pass"]);
    });

    it("invalid: 関係節の外にある述語の受動は残す", () => {
      assert.deepEqual(passivesIn("The report that was published last week was deleted."), ["deleted"]);
    });

    it("invalid: 前に名詞が無い that / which は関係代名詞ではない", () => {
      assert.ok(idsFor("That was decided yesterday.", en).includes("agentless-passive"));
      assert.ok(idsFor("Which was chosen?", en).includes("agentless-passive"));
    });

    it("invalid: 名詞の後ろの being は動名詞の主語と見分けられないので残す", () => {
      assert.ok(idsFor("The delay led to the request being closed.", en).includes("agentless-passive"));
    });

    it("invalid: that 節の中でも主語があれば述語の受動", () => {
      assert.ok(idsFor("We know that it was decided.", en).includes("agentless-passive"));
    });
  });
});
