import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { contractionMinority } from "../packages/chaff/src/detectors/contraction-minority.ts";

const idsFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "blog/tech").findings.map((finding) => finding.rule);

describe("contraction-consistency", () => {
  it("invalid: 短縮形と長い形が混ざる", () => {
    const source =
      "# Report\n\nWe don't ship on Fridays. It's a rule we keep.\nThe team cannot change it. The process is not negotiable. We will not revisit it.";
    assert.ok(idsFor(source).includes("contraction-consistency"));
  });

  describe("少数派が無ければ指摘しない", () => {
    // noaa-press-flood-mapping の形。短縮形は It’s の 1 つだけで、長い形も does not の 1 つだけ。
    it("valid: 短縮形 1 つと長い形 1 つは、どちらも少数派ではない", () => {
      const source = "# Flood maps\n\nIt’s a tool for forecasters and the public. The latest expansion does not yet cover northern Alaska.";
      assert.ok(!idsFor(source).includes("contraction-consistency"));
    });

    it("valid: 種類も回数も同数なら、少数派は無い", () => {
      const source = "# Report\n\nWe don't ship on Fridays. It's a rule we keep.\nThe team cannot change it. The process is not negotiable.";
      assert.ok(!idsFor(source).includes("contraction-consistency"));
    });

    it("invalid: 種類が同数でも、長い形が何度も出るなら、1 度だけの短縮形を指す", () => {
      const source = "# Report\n\nIt’s a tool for forecasters. The map does not cover Alaska. It does not cover Guam. It does not cover Samoa.";
      assert.deepEqual(
        runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "blog/tech")
          .findings.filter((finding) => finding.rule === "contraction-consistency")
          .map((finding) => String(finding.values?.["matched"])),
        ["it's"],
      );
    });
  });

  describe("contractionMinority", () => {
    it("種類の少ないほうが少数派", () => {
      assert.equal(contractionMinority({ kinds: 1, uses: 5 }, { kinds: 3, uses: 3 }), true);
      assert.equal(contractionMinority({ kinds: 3, uses: 3 }, { kinds: 1, uses: 5 }), false);
    });

    it("種類が同数なら回数の少ないほう", () => {
      assert.equal(contractionMinority({ kinds: 1, uses: 1 }, { kinds: 1, uses: 3 }), true);
      assert.equal(contractionMinority({ kinds: 2, uses: 4 }, { kinds: 2, uses: 2 }), false);
    });

    it("種類も回数も同数なら少数派は無い", () => {
      assert.equal(contractionMinority({ kinds: 1, uses: 1 }, { kinds: 1, uses: 1 }), undefined);
      assert.equal(contractionMinority({ kinds: 2, uses: 3 }, { kinds: 2, uses: 3 }), undefined);
    });

    it("片方しか無ければ一貫している", () => {
      assert.equal(contractionMinority({ kinds: 0, uses: 0 }, { kinds: 2, uses: 2 }), undefined);
      assert.equal(contractionMinority({ kinds: 1, uses: 1 }, { kinds: 0, uses: 0 }), undefined);
      assert.equal(contractionMinority({ kinds: 0, uses: 0 }, { kinds: 0, uses: 0 }), undefined);
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
    const matchedFor = (source: string): string[] =>
      runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "blog/tech")
        .findings.filter((finding) => finding.rule === "contraction-consistency")
        .map((finding) => String(finding.values?.["matched"]));

    it("invalid: 曲がった短縮形と長い形が混ざる", () => {
      const source =
        "# Report\n\nWe don’t ship on Fridays. It’s a rule we keep.\nThe team cannot change it. The process is not negotiable. We will not revisit it.";
      assert.ok(idsFor(source).includes("contraction-consistency"));
    });

    it("曲がった短縮形が多数なら、少数派の長い形を指す", () => {
      const source = "# Report\n\nWe don’t ship on Fridays. It’s a rule we keep. It isn’t negotiable.\nThe team cannot change it.";
      assert.deepEqual(matchedFor(source), ["cannot"]);
    });

    it("曲がった短縮形が少数なら、それを指す", () => {
      const source = "# Report\n\nWe don’t ship on Fridays. It is a rule we keep.\nThe team cannot change it. The process is not negotiable.";
      assert.deepEqual(matchedFor(source), ["don't"]);
    });

    it("valid: 形の違う短縮形が混ざっても、短縮形で揃っていれば指摘しない", () => {
      const source = "# Report\n\nWe don’t ship on Fridays. It's a rule we keep.\nWe can’t change it. It isn't negotiable.";
      assert.ok(!idsFor(source).includes("contraction-consistency"));
    });

    it("ʼ（U+02BC）も短縮形の印", () => {
      const source = "# Report\n\nWe donʼt ship on Fridays. Itʼs a rule we keep. It isnʼt negotiable.\nThe team cannot change it.";
      assert.deepEqual(matchedFor(source), ["cannot"]);
    });
  });

  it("日本語では動かさない。表記ゆれは別の話", () => {
    const result = runRules(buildDocument("t.md", "これは文です。", ja), loadRules("ja"), {}, true, "blog/tech");
    assert.ok(result.skipped.some((entry) => entry.rule === "contraction-consistency"));
  });
});
