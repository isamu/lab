import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { pairMinority } from "../packages/chaff/src/detectors/contraction-minority.ts";

const idsFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "blog/tech").findings.map((finding) => finding.rule);

const matchedFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "blog/tech")
    .findings.filter((finding) => finding.rule === "contraction-consistency")
    .map((finding) => String(finding.values?.["matched"]));

describe("contraction-consistency", () => {
  it("invalid: 同じ語を短縮形と長い形の両方で書く", () => {
    const source = "# Report\n\nWe don't ship on Fridays. We don't ship at night.\nWe do not change it.";
    assert.deepEqual(matchedFor(source), ["do not"]);
  });

  it("invalid: 長い形が多ければ、1 度だけの短縮形を指す", () => {
    // 18f-handbook-work-schedules の形。do not が 3 回、don’t が 1 回。
    const source = "# Hours\n\nDo not log hours early. Do not log hours late. Do not round up.\nDon’t forget the form.";
    assert.deepEqual(matchedFor(source), ["don't"]);
  });

  it("指摘は、多いほうの書きかたを示す", () => {
    const source = "# Report\n\nWe don't ship on Fridays. We don't ship at night.\nWe do not change it.";
    const finding = runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "blog/tech").findings.find(
      (candidate) => candidate.rule === "contraction-consistency",
    );
    assert.equal(finding?.values?.["majority"], "don't");
  });

  describe("別の語どうしは比べない", () => {
    // govuk-understanding-your-pay の形。you’re は使い、否定は do not / cannot と書く。GOV.UK の文体がそう決めている。
    it("valid: 代名詞＋動詞は短縮し、否定は長い形で書く", () => {
      const source =
        "# Your pay\n\nYou’re paid monthly. You’re told the amount. It’s on your payslip.\nYou do not pay tax on it. Your employer cannot deduct it. The amount is not fixed.";
      assert.deepEqual(matchedFor(source), []);
    });

    // 18f-handbook-purchase-requests の形。don’t と it’s は、その語の唯一の書きかた。
    it("valid: 短縮形がその語の唯一の形なら、ほかの語の長い形と比べない", () => {
      const source = "# Purchases\n\nDon’t buy it yourself. It’s handled by the team.\nThe card will not work abroad. You are responsible for receipts.";
      assert.deepEqual(matchedFor(source), []);
    });

    // rust-rfc-2094-nll の形。「we have」の多くは本動詞で、「we've」には縮められない。
    it("valid: 本動詞の we have と、助動詞の we've は比べない", () => {
      const source =
        "# Notes\n\nWe've already seen the first case. We've only considered local lifetimes.\nWe have a problem. We have to fix it. We have an answer.";
      assert.deepEqual(matchedFor(source), []);
    });

    it("valid: 否定どうしでも、別の語なら比べない", () => {
      const source = "# Report\n\nWe don't ship on Fridays. We don't ship at night.\nThe map does not cover Alaska.";
      assert.deepEqual(matchedFor(source), []);
    });
  });

  describe("少数派が無ければ指摘しない", () => {
    // noaa-press-flood-mapping の形。短縮形は It’s の 1 つだけで、長い形も does not の 1 つだけ。
    it("valid: 短縮形 1 つと長い形 1 つは、どちらも少数派ではない", () => {
      const source = "# Flood maps\n\nIt’s a tool for forecasters and the public. The latest expansion does not yet cover northern Alaska.";
      assert.deepEqual(matchedFor(source), []);
    });

    it("valid: 同じ語の 2 つの形が同じ回数なら、少数派は無い", () => {
      const source = "# Report\n\nWe don't ship on Fridays. We do not ship at night.";
      assert.deepEqual(matchedFor(source), []);
    });

    it("valid: 文の境目をまたいで長い形を数えない", () => {
      // 項目「What we do」と次の項目「not every…」は「do not」ではない。数えると 2 対 1 になり、don't を指してしまう。
      const source = "# Report\n\n- What we do\n- not every task ships\n\nWe do not ship on Fridays. We don't ship at night.";
      assert.deepEqual(matchedFor(source), []);
    });
  });

  describe("折り返した行", () => {
    it("invalid: 行をまたいだ長い形も数え、その文を指す", () => {
      const source = "# Report\n\nWe don't ship on Fridays. We don't ship at night.\nWe do\nnot change it.";
      assert.deepEqual(matchedFor(source), ["do not"]);
    });
  });

  it("少ないほうが上限を超えて出てくるなら、混在ではなく書き分け", () => {
    // blog の上限は normal（2）。do not 3 回は書き分けとして読む。
    const source = "# Report\n\nWe don't ship. We don't test. We don't wait. We don't ask.\nDo not reply. Do not call. Do not write.";
    assert.deepEqual(matchedFor(source), []);
  });

  describe("pairMinority", () => {
    it("少ないほうが少数派", () => {
      assert.equal(pairMinority({ short: 1, long: 3 }), "short");
      assert.equal(pairMinority({ short: 18, long: 1 }), "long");
    });

    it("同数なら少数派は無い", () => {
      assert.equal(pairMinority({ short: 1, long: 1 }), undefined);
      assert.equal(pairMinority({ short: 4, long: 4 }), undefined);
    });

    it("片方しか無ければ揃っている", () => {
      assert.equal(pairMinority({ short: 0, long: 2 }), undefined);
      assert.equal(pairMinority({ short: 18, long: 0 }), undefined);
      assert.equal(pairMinority({ short: 0, long: 0 }), undefined);
    });
  });

  it("valid: 短縮形で揃っていれば指摘しない", () => {
    const source = "# Report\n\nWe don't ship on Fridays. It's a rule we keep.\nWe can't change it. It isn't negotiable.";
    assert.ok(!idsFor(source).includes("contraction-consistency"));
  });

  it("valid: 長い形で揃っていれば指摘しない", () => {
    // どちらが正しいかは決めない。1 つの文書で揃っているかだけを見る。
    const source = "# Report\n\nWe do not ship on Fridays. It is a rule we keep.\nWe cannot change it. It is not negotiable.";
    assert.ok(!idsFor(source).includes("contraction-consistency"));
  });

  it("語の境界で照合する。部分一致だと「it isn't」が「it is」を含む", () => {
    const source = "# Report\n\nWe don't ship. It isn't negotiable. We can't change it. We won't revisit it.";
    assert.ok(!idsFor(source).includes("contraction-consistency"));
  });

  it("語彙表が対を持つ。片方だけでは硬い文体と不統一を区別できない", () => {
    const pairs = en.lexicons["contraction"] ?? [];
    assert.ok(pairs.length > 0);
    assert.ok(pairs.every((entry) => entry.instead_of !== undefined));
  });

  describe("アポストロフィの形（’ と '）は短縮形かどうかを変えない", () => {
    it("曲がった短縮形が多数なら、少数派の長い形を指す", () => {
      const source = "# Report\n\nWe don’t ship on Fridays. We don’t ship at night.\nWe do not change it.";
      assert.deepEqual(matchedFor(source), ["do not"]);
    });

    it("曲がった短縮形が少数なら、それを指す", () => {
      const source = "# Report\n\nWe don’t ship on Fridays.\nWe do not change it. We do not revisit it.";
      assert.deepEqual(matchedFor(source), ["don't"]);
    });

    it("valid: 形の違う短縮形が混ざっても、短縮形で揃っていれば指摘しない", () => {
      const source = "# Report\n\nWe don’t ship on Fridays. We don't ship at night.\nWe can’t change it. It isn't negotiable.";
      assert.deepEqual(matchedFor(source), []);
    });

    it("ʼ（U+02BC）も短縮形の印", () => {
      const source = "# Report\n\nWe donʼt ship on Fridays. We donʼt ship at night.\nWe do not change it.";
      assert.deepEqual(matchedFor(source), ["do not"]);
    });
  });

  it("日本語では動かさない。表記ゆれは別の話", () => {
    const result = runRules(buildDocument("t.md", "これは文です。", ja), loadRules("ja"), {}, true, "blog/tech");
    assert.ok(result.skipped.some((entry) => entry.rule === "contraction-consistency"));
  });
});
