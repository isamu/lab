import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LexiconEntry, Token } from "../packages/chaff/src/plugin.ts";
import { exemplifiesMethod, isMethodCue, methodWordsOf } from "../packages/chaff/src/detectors/open-end-method.ts";

// requirement-smell: an act + など that gives one example of how to do the act named right after it (別シートに分離するなど
// データ構造を改める) leaves nothing open. Self-written sentences and tokens only.

const RULE = "requirement-smell";

const found = (body: string): string[] =>
  runRules(buildDocument("t.md", `# T\n\n${body}\n`, ja), loadRules(ja.id), { [RULE]: "normal" }, false, "technical/spec")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${finding.variant ?? ""}:${String(finding.values["matched"])}`);

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("requirement-smell: an example of how to do the act that follows (ja)", () => {
  it("an act + など followed by the act's own object and verb is not reported", () => {
    assert.deepEqual(found("それを許したい場合は、別のシートに分けるなど表を作り直す必要があります。"), []);
    assert.deepEqual(found("表は別シートに分離するなどデータ構造を改める必要があります。"), []);
    assert.deepEqual(found("利用者は、通知を確認するなど状況を把握しなければならない。"), []);
  });

  it("など + する, など + の and a noun list + など are still reported", () => {
    assert.deepEqual(found("受託者は、記録を保存するなどしなければならない。"), ["open-end:など"]);
    assert.deepEqual(found("受託者は、記録を保存するなどして管理しなければならない。"), ["open-end:など"]);
    assert.deepEqual(found("受託者は、記録を保存するなどの措置を講じなければならない。"), ["open-end:など"]);
    assert.deepEqual(found("申込者は、氏名、住所などを記載しなければならない。"), ["open-end:など"]);
  });

  it("an act + など before a phrase that is not an object with its particle is still reported", () => {
    assert.deepEqual(found("受託者は、記録を保存するなど適切な措置を講じなければならない。"), ["open-end:など"]);
  });
});

const token = (surface: string, pos: string): Token => ({ surface, pos, span: { start: 0, end: 0 } });
const at = (surfaces: readonly (readonly [string, string])[]): Token[] => surfaces.map(([surface, pos]) => token(surface, pos));
const entry = (pattern: string, group: string): LexiconEntry => ({ pattern, group, tokens: [token(pattern, "ADP")] });

const words = methodWordsOf([entry("など", ""), entry("を", "method-case"), entry("に", "method-case")]);

describe("exemplifiesMethod", () => {
  it("reads the case particles by group", () => {
    assert.deepEqual(
      words.map((word) => word.pattern),
      ["を", "に"],
    );
    assert.equal(isMethodCue(entry("を", "method-case")), true);
    assert.equal(isMethodCue(entry("など", "")), false);
  });

  it("a verb, the open word, a noun run, a case particle and a verb", () => {
    const tokens = at([
      ["分ける", "VERB"],
      ["など", "ADP"],
      ["データ", "NOUN"],
      ["構造", "NOUN"],
      ["を", "ADP"],
      ["改める", "VERB"],
    ]);
    assert.equal(exemplifiesMethod(tokens, { start: 1, end: 2 }, words), true);
  });

  it("a noun before the open word, a verb or a particle right after it, or no verb after the object", () => {
    const nounList = at([
      ["住所", "NOUN"],
      ["など", "ADP"],
      ["記録", "NOUN"],
      ["を", "ADP"],
      ["残す", "VERB"],
    ]);
    const doing = at([
      ["保存", "NOUN"],
      ["する", "VERB"],
      ["など", "ADP"],
      ["し", "VERB"],
    ]);
    const ofPhrase = at([
      ["する", "VERB"],
      ["など", "ADP"],
      ["の", "ADP"],
      ["措置", "NOUN"],
      ["を", "ADP"],
      ["講じる", "VERB"],
    ]);
    const noVerb = at([
      ["する", "VERB"],
      ["など", "ADP"],
      ["措置", "NOUN"],
      ["を", "ADP"],
      ["。", "PUNCT"],
    ]);
    const otherParticle = at([
      ["する", "VERB"],
      ["など", "ADP"],
      ["措置", "NOUN"],
      ["は", "ADP"],
      ["ある", "VERB"],
    ]);
    [nounList, doing, ofPhrase, noVerb, otherParticle].forEach((tokens) =>
      assert.equal(
        exemplifiesMethod(tokens, { start: tokens.findIndex((t) => t.surface === "など"), end: tokens.findIndex((t) => t.surface === "など") + 1 }, words),
        false,
      ),
    );
  });

  it("the open word at either end of the sentence, an empty sentence, or no case particles", () => {
    const start = at([
      ["など", "ADP"],
      ["構造", "NOUN"],
      ["を", "ADP"],
      ["改める", "VERB"],
    ]);
    const end = at([
      ["する", "VERB"],
      ["など", "ADP"],
    ]);
    const full = at([
      ["する", "VERB"],
      ["など", "ADP"],
      ["構造", "NOUN"],
      ["を", "ADP"],
      ["改める", "VERB"],
    ]);
    assert.equal(exemplifiesMethod(start, { start: 0, end: 1 }, words), false);
    assert.equal(exemplifiesMethod(end, { start: 1, end: 2 }, words), false);
    assert.equal(exemplifiesMethod([], { start: 0, end: 1 }, words), false);
    assert.equal(exemplifiesMethod(full, { start: 1, end: 2 }, []), false);
  });
});
