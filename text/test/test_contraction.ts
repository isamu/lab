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

  describe("引用符で挙げた短い語句は、使ったのではなく名前か例", () => {
    it('valid: 機能の名前（"Do Not Disturb"）は do not に数えない', () => {
      // gitlab-time-away-philosophy の形。本文は don't で揃い、設定の名前だけが Do Not。
      const source = "# Away\n\nDon't check email. Don't join calls.\n\n- Sets your status and turns on \"Do Not Disturb\" settings.";
      assert.deepEqual(matchedFor(source), []);
    });

    it("valid: 一重引用符で挙げた例（‘we’re going to x’）は we're に数えない", () => {
      // govuk-style-guide-a-to-z の形。言い換えの例として挙げた語句。
      const source =
        "# Words to avoid\n\nWe are clear. We are brief. We are plain.\n\n- commit/pledge, use ‘plan to x’, or ‘we’re going to x’ where ‘x’ is a specific verb";
      assert.deepEqual(matchedFor(source), []);
    });

    it("invalid: 引用符の外で使えば、これまでどおり指す", () => {
      const source = "# Away\n\nDon't check email. Don't join calls.\n\nDo not open \"Settings\" today.";
      assert.deepEqual(matchedFor(source), ["do not"]);
    });

    it("invalid: 話した言葉の引用（句読点を持つ）は文書の言葉として数える", () => {
      const source = '# Notes\n\nWe do not ship on Fridays. We do not ship at night.\n\n"We don\'t know yet," she said.';
      assert.deepEqual(matchedFor(source), ["don't"]);
    });

    it("invalid: 5 語以上の引用は語句ではなく文として数える", () => {
      const source = "# Notes\n\nWe do not ship on Fridays. We do not ship at night.\n\nThe sign read “we don't open on Sundays at all”.";
      assert.deepEqual(matchedFor(source), ["don't"]);
    });

    it("valid: 引用の中の一重引用符の札（‘Tweet doesn’t need a note’）も数えない", () => {
      // arxiv-2610-17068-fact-check-true の形。
      const source =
        "# Notes\n\nThe score does not change. The label does not change.\n\nX removed them after such notes “were often rated as ‘Unhelpful - Tweet doesn’t need a note’ ” by raters.";
      assert.deepEqual(matchedFor(source), []);
    });

    it("invalid: 入れ子でない引用の中の語は、これまでどおり数える", () => {
      const source = "# Notes\n\nThe score does not change. The label does not change.\n\nRaters wrote “the tweet doesn’t need a note at all” often.";
      assert.deepEqual(matchedFor(source), ["doesn't"]);
    });
  });

  describe("一語だけ強調した語は、強勢のために選んだ形", () => {
    it("valid: does **not** の長い形は数えない", () => {
      // ts-handbook-more-on-functions の形。not を強めるために分けて書く。短縮形は強勢を持てない。
      const source =
        "# Functions\n\nThe call doesn't return. The type doesn't change.\n\nA `void` type does **not** force functions to **not** return something.";
      assert.deepEqual(matchedFor(source), []);
    });

    it("invalid: 強調した形も、どちらが多いかを数えるときは数える", () => {
      // openapi-spec-3-1-0 の形。*cannot* も cannot と書く文書の 1 回。
      const source = "# Schemas\n\nThis object cannot be extended. Inline schemas *cannot* be used here.\n\nThe viewer can't access the documentation.";
      assert.deepEqual(matchedFor(source), ["can't"]);
    });

    it("invalid: 何語にもわたる強調（太字の札、斜体の注）は地の文として数える", () => {
      // gc-guide-publishing-open-source-code・tts-vulnerability-disclosure-policy の形。
      const source =
        "# Formulas\n\n*The licence is not a commitment to future versions.*\n\nThe sheet isn't sorted. The formula isn't rounded. **This test is not authorized:**";
      assert.deepEqual(matchedFor(source), []);
      const minority =
        "# Formulas\n\n*The licence is not a commitment to future versions.*\n\nThe sheet isn't sorted. The formula isn't rounded. The list isn't long.";
      assert.deepEqual(matchedFor(minority), ["is not"]);
    });

    it("invalid: 強調の外の長い形は、これまでどおり指す", () => {
      const source = "# Functions\n\nThe call doesn't return. The type doesn't change.\n\nThe **checker** does not run here.";
      assert.deepEqual(matchedFor(source), ["does not"]);
    });

    it("invalid: コードの中の * は強調の印ではない", () => {
      const source = "# Functions\n\nThe call doesn't return. The type doesn't change.\n\nUse `a*b` when it does not fit, and `c*d` otherwise.";
      assert.deepEqual(matchedFor(source), ["does not"]);
    });
  });

  describe("語を比べる文と、語の一覧", () => {
    it("valid: 対の 2 つの形を並べた文は、語を挙げていて使っていない", () => {
      // govuk-style-guide-a-to-z の形。
      const source = "# Style\n\nYou can’t file late. You can’t file twice.\n\nUse cannot, instead of can’t.";
      assert.deepEqual(matchedFor(source), []);
    });

    it("invalid: 両方の形を文の中で使う文は、これまでどおり数えて指す", () => {
      // 18f-handbook-one-on-ones の形。
      const source = "# Meetings\n\nIt's fine to move them. It's rare to skip one.\n\nIt is important -- it's the most important -- so keep it.";
      assert.deepEqual(matchedFor(source), ["it is"]);
    });

    it("valid: 検索語の一覧の短縮形は数えない", () => {
      // arxiv-2609-05432-companion-ai-ethics の形。付録のキーワード一覧。
      const source =
        "# Method\n\nThe app did not respond. The model did not recall it.\n\n(i) Memory (k3=55): forgot, forgotten, forgets, doesn't remember, didn't remember, didnt remember, can't remember, no memory, short memory.";
      assert.deepEqual(matchedFor(source), []);
    });

    it("invalid: 読点で区切った短い句の少ない文は、地の文として数える", () => {
      const source = "# Method\n\nThe app did not respond. The model did not recall it.\n\nWe tried, we waited, and it didn't load.";
      assert.deepEqual(matchedFor(source), ["didn't"]);
    });
  });

  it("日本語では動かさない。表記ゆれは別の話", () => {
    const result = runRules(buildDocument("t.md", "これは文です。", ja), loadRules("ja"), {}, true, "blog/tech");
    assert.ok(result.skipped.some((entry) => entry.rule === "contraction-consistency"));
  });
});
