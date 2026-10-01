import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRulesWith } from "../packages/chaff/src/run.ts";
import { modalLexiconNames } from "../packages/chaff/src/detectors/requirement-modal.ts";
import { loadStyles } from "../packages/chaff/src/style-load.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

// requirement-modal: a provision's verb form the house rule does not use. JIS Z 8301:2019 7.3–7.5 (すべきである,
// a closing できる) and the Federal Plain Language Guidelines ("shall" → "must"). Off until options pick one.

const RULE = "requirement-modal";

/** "matched→preferred" for each finding, with the rule's options as given. */
const found = (body: string, adapter: LanguageAdapter, options: Record<string, string>): string[] =>
  runRulesWith(buildDocument("t.md", `# 規格\n\n${body}\n`, adapter), loadRules(adapter.id), {
    settings: { [RULE]: "normal" },
    experimental: false,
    genre: "technical/spec",
    optionLayers: [{ from: "chaff.yaml", values: { [RULE]: options } }],
  })
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["matched"])}→${String(finding.values["preferred"])}`);

const JIS = { standard: "jis-z8301-2019" };

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("requirement-modal — JIS Z 8301:2019 (ja)", () => {
  it("a closing すべきである and すべきでない (7.3)", () => {
    assert.deepEqual(found("試料を乾燥させるべきである。", ja, JIS), ["べきである→することが望ましい"]);
    assert.deepEqual(found("試料を加熱すべきでない。", ja, JIS), ["べきでない→しないほうがよい"]);
  });

  it("a closing できる and できない (7.4, 7.5), including ことができる", () => {
    assert.deepEqual(found("ほとんどの液体に用いることができる。", ja, JIS), ["できる→してもよい（許容）、可能である（可能性）"]);
    assert.deepEqual(found("この方法は固体には用いることができない。", ja, JIS), ["できない→しなくてもよい（許容）、可能性がない（可能性）"]);
  });

  it("the forms JIS uses are not reported", () => {
    const forms = [
      "試料を乾燥させなければならない。",
      "試料を加熱してはならない。",
      "試料を乾燥させることが望ましい。",
      "試料を加熱してもよい。",
      "ほとんどの液体に適用が可能である。",
    ];
    assert.deepEqual(
      forms.flatMap((sentence) => found(sentence, ja, JIS)),
      [],
    );
  });

  it("できる in the middle of a sentence shows an ability and is allowed (7.5)", () => {
    assert.deepEqual(found("直読できるので、測定操作は簡単である。", ja, JIS), []);
  });

  it("a closing form in quotation marks is a mention, not a use", () => {
    assert.deepEqual(found("規定の文末に使わない語は「べきである」。", ja, JIS), []);
    assert.deepEqual(found("この規格は「できる」を許容に使わない。", ja, JIS), []);
    assert.deepEqual(found("「乾燥」と書いた試料は、乾燥させるべきである。", ja, JIS), ["べきである→することが望ましい"]);
  });

  it("べき modifying a noun is a requirement and is allowed (7.3)", () => {
    assert.deepEqual(found("記載すべき事項は、次による。", ja, JIS), []);
  });

  it("nothing without options, or with standard: none", () => {
    assert.deepEqual(found("試料を乾燥させるべきである。", ja, {}), []);
    assert.deepEqual(found("試料を乾燥させるべきである。", ja, { standard: "none" }), []);
  });

  it("shall: must does not touch a Japanese document", () => {
    assert.deepEqual(found("試料を乾燥させるべきである。", ja, { shall: "must" }), []);
  });
});

describe("requirement-modal — shall: must (en)", () => {
  it("reports shall and shall not, once per sentence", () => {
    assert.deepEqual(found("The supplier shall deliver the goods.", en, { shall: "must" }), ["shall→must"]);
    assert.deepEqual(found("The supplier shall not and shall never resell them.", en, { shall: "must" }), ["shall→must"]);
  });

  it("leaves must alone, and reports nothing unless shall: must is set", () => {
    assert.deepEqual(found("The supplier must deliver the goods.", en, { shall: "must" }), []);
    assert.deepEqual(found("The supplier shall deliver the goods.", en, {}), []);
    assert.deepEqual(found("The supplier shall deliver the goods.", en, JIS), []);
  });

  it("a quoted mention is not a use: the RFC 2119 boilerplate", () => {
    const boilerplate = 'The key words "MUST", "SHALL" and "SHALL NOT" in this document are to be interpreted as described in BCP 14.';
    assert.deepEqual(found(boilerplate, en, { shall: "must" }), []);
    assert.deepEqual(found('The word "shall" is ambiguous, so the supplier shall use must.', en, { shall: "must" }), ["shall→must"]);
  });

  it("does not match inside a longer word (shallow)", () => {
    assert.deepEqual(found("The water is shallow.", en, { shall: "must" }), []);
  });
});

describe("modalLexiconNames — pure", () => {
  it("one lexicon per option that is on", () => {
    assert.deepEqual(modalLexiconNames({}), []);
    assert.deepEqual(modalLexiconNames({ standard: "none", shall: "allow" }), []);
    assert.deepEqual(modalLexiconNames({ standard: "jis-z8301-2019" }), ["requirement-modal-jis-z8301-2019"]);
    assert.deepEqual(modalLexiconNames({ shall: "must" }), ["requirement-modal-must"]);
    assert.deepEqual(modalLexiconNames({ standard: "jis-z8301-2019", shall: "must" }), ["requirement-modal-jis-z8301-2019", "requirement-modal-must"]);
  });
});

describe("style: jis-z8301-2019", () => {
  it("turns the rule on with JIS's forms, and decides nothing else", () => {
    const style = loadStyles().find((entry) => entry.id === "jis-z8301-2019");
    assert.ok(style !== undefined);
    assert.deepEqual(style.rules, { [RULE]: "normal" });
    assert.deepEqual(style.options, { [RULE]: { standard: "jis-z8301-2019" } });
  });

  it("the command line reports すべきである under the style, and not without it", async () => {
    const source = "# 試験方法\n\n試験の前に、試料を乾燥させるべきである。\n";
    const styled = await runCli({ "chaff.yaml": "language: ja\nstyle: jis-z8301-2019\n", "a.md": source }, ["a.md", "--compact"]);
    assert.match(styled.out, /「べきである」は使わない形です。「することが望ましい」と書きます/u);
    const plain = await runCli({ "chaff.yaml": "language: ja\n", "a.md": source }, ["a.md", "--compact", "--experimental"]);
    assert.doesNotMatch(plain.out, /requirement-modal/u);
  });
});
