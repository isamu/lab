import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { personMentions, personMinorities, type PersonMention, type PersonWords } from "../packages/chaff/src/person-forms.ts";
import type { Lexicon } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { REASONS } from "../packages/chaff/src/reasons.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { namedRuleRun } from "./rule-run.ts";

// person-consistency: one document naming itself or its reader two ways. All example sentences are self-written.

const RULE = "person-consistency";

const wordsOf = (adapter: typeof ja): PersonWords => {
  const lexicons = adapter.lexicons ?? {};
  const list = (id: string): Lexicon => lexicons[id] ?? [];
  return { words: list("person-word"), forms: list("person-form"), notAfter: list("person-not-after") };
};

const forms = (text: string, adapter: typeof ja): string[] => personMentions(text, wordsOf(adapter)).map((mention) => `${mention.written}>${mention.form}`);

const findings = (source: string, adapter: typeof ja, genre = "business/report"): readonly string[] =>
  namedRuleRun(RULE, source, adapter, "a.md", genre).findings;

describe("personMentions (ja)", () => {
  it("reads the longest word first, and each word as its form", () => {
    assert.deepEqual(forms("私たちは私の考えを、我々の言葉で、われわれに話す。", ja), ["私たち>私たち", "私>私", "我々>我々", "われわれ>我々"]);
    assert.deepEqual(forms("私どもは弊社と当社の窓口です。", ja), ["私ども>私ども", "弊社>弊社", "当社>当社"]);
  });

  it("reads the longest word first, whatever order the list is in", () => {
    const person: PersonWords = {
      words: [{ pattern: "私" }, { pattern: "私たち" }],
      forms: [
        { pattern: "私", instead_of: "i" },
        { pattern: "私たち", instead_of: "we" },
      ],
      notAfter: [],
    };
    assert.deepEqual(
      personMentions("私たちは行く。", person).map((found) => found.written),
      ["私たち"],
    );
  });

  it("leaves out a word joined to kanji or katakana on either side", () => {
    assert.deepEqual(forms("東京本社の当社比で、私立の公僕が私的に話す。", ja), []);
    assert.deepEqual(forms("本社は移ります。", ja), ["本社>本社"]);
  });

  it("leaves out quotations", () => {
    assert.deepEqual(forms("弊社は「私たちの約束」を守ります。", ja), ["弊社>弊社"]);
    assert.deepEqual(forms("弊社は『私の履歴書』を読みました。", ja), ["弊社>弊社"]);
  });
});

describe("personMentions (en)", () => {
  it("reads you and its forms, and one as the subject of a modal verb", () => {
    assert.deepEqual(forms("You keep your copy; one can ask, and one's own counts.", en), ["You>you", "your>you", "one can>one", "one's>one"]);
  });

  it("leaves out one after a determiner or a preposition, and a word inside another", () => {
    assert.deepEqual(forms("No one can say. The one would fit. Devices connected to one can fail. Someone can go.", en), []);
    assert.deepEqual(forms("Yourselves and youth.", en), []);
  });

  it("looks only at the word right before, across spaces only", () => {
    assert.deepEqual(forms("For, one can ask.", en), ["one can>one"]);
  });

  it("leaves out a word a combining mark joins", () => {
    assert.deepEqual(forms("yoú go", en), []);
  });

  it("guards only the form a not-after word names: to you is still the reader", () => {
    assert.deepEqual(forms("This is for you.", en), ["you>you"]);
  });

  it("leaves out capitals and quotations", () => {
    assert.deepEqual(forms('YOU DECIDE. She said "you can go" to me.', en), []);
  });

  it("reads no we or I: in English they name two parties", () => {
    assert.deepEqual(forms("I think we should go.", en), []);
  });
});

const mention = (form: string, at: number, slot = "we"): { readonly mention: PersonMention } => ({ mention: { at, written: form, form, slot } });

const ofForms = (list: readonly string[], slot = "we"): { readonly mention: PersonMention }[] => list.map((form, index) => mention(form, index, slot));

describe("personMinorities", () => {
  it("points at the forms other than the usual one", () => {
    const [found] = personMinorities(ofForms(["弊社", "弊社", "私たち", "弊社", "弊社"]), 20);
    assert.equal(found?.usual, "弊社");
    assert.equal(found?.of, 5);
    assert.deepEqual(
      found?.odd.map((entry) => entry.mention.form),
      ["私たち"],
    );
  });

  it("says nothing when one form is used", () => {
    assert.deepEqual(personMinorities(ofForms(["弊社", "弊社", "弊社"]), 20), []);
  });

  it("says nothing when the other forms pass the share: the document uses both on purpose", () => {
    assert.deepEqual(personMinorities(ofForms(["弊社", "弊社", "弊社", "私たち"]), 20), []);
    assert.equal(personMinorities(ofForms(["弊社", "弊社", "弊社", "私たち"]), 25).length, 1);
  });

  it("says nothing when the usual form has fewer than three places", () => {
    assert.deepEqual(personMinorities(ofForms(["弊社", "弊社", "私たち"]), 50), []);
  });

  it("counts each slot apart", () => {
    const entries = [...ofForms(["弊社", "弊社", "弊社", "弊社", "私たち"]), ...ofForms(["私", "私", "私", "私"], "i")];
    assert.deepEqual(
      personMinorities(entries, 20).map((found) => found.usual),
      ["弊社"],
    );
  });

  it("on a tie, the form the document used first is the usual one", () => {
    const [found] = personMinorities(ofForms(["当社", "弊社", "当社", "弊社", "当社", "弊社"]), 50);
    assert.equal(found?.usual, "当社");
  });

  it("is empty for no entries", () => assert.deepEqual(personMinorities([], 20), []));
});

describe("person-consistency, through the rule", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  const JA_MIXED = "# 窓口\n\n弊社は窓口を開きます。弊社の担当者が受け付けます。私たちは記録を残します。弊社は記録を保管します。弊社の外には出しません。\n";

  it("reports the minority form in Japanese", () => {
    assert.deepEqual(findings(JA_MIXED, ja), ["「私たち」と書いています（この文書はふつう「弊社」。5 箇所のうち 1 箇所が違う）"]);
  });

  it("reports one in an English document that says you", () => {
    const source = "# Desk\n\nYou can book a slot. Your booking shows next. If you miss it, you can book again. One can also call.\n";
    assert.deepEqual(findings(source, en), ['"One can" here, where the document usually says "you" (1 of 5)']);
  });

  it("reads 私 and 私たち as two parties", () => {
    assert.deepEqual(findings("# 考え\n\n私はこう考えます。私は賛成です。私は反対しません。私たちは社会として選びます。\n", ja), []);
  });

  it("does not count a quoted block or code", () => {
    const source =
      "# 窓口\n\n弊社は窓口を開きます。弊社の担当者が受け付けます。弊社は記録を保管します。弊社の外には出しません。\n\n> 私たちは記録を残します。\n\n`私たち`\n";
    assert.deepEqual(findings(source, ja), []);
  });

  it("does not run on fiction or a transcript, where several people speak", () => {
    ["literature/fiction", "speech/transcript"].forEach((genre) => {
      const result = runRules(buildDocument("a.md", JA_MIXED, ja), loadRules("ja"), {}, true, genre);
      assert.equal(result.skipped.find((entry) => entry.rule === RULE)?.why, REASONS.ja.presetOff(genre), genre);
    });
  });
});
