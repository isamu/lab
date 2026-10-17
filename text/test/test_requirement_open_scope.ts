import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, LexiconEntry, Token } from "../packages/chaff/src/plugin.ts";
import { isScopeCue, openOnPurpose, scopeWordsOf } from "../packages/chaff/src/detectors/open-end-scope.ts";

// requirement-smell: an open list is a smell only in what the requirement asks the reader to do. A list in a condition, a
// permission or a prohibition is open on purpose, as contracts are drafted. Self-written sentences only.

const RULE = "requirement-smell";

const found = (body: string, adapter: LanguageAdapter, genre = "legal/contract"): string[] =>
  runRules(buildDocument("t.md", `# T\n\n${body}\n`, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${finding.variant ?? ""}:${String(finding.values["matched"])}`);

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("requirement-smell: a list a condition, a permission or a prohibition holds (ja)", () => {
  it("a list in a right the writer grants (できるものとする) is not reported", () => {
    assert.deepEqual(found("運営者は、通知なく写真、動画等を削除し、契約を解除することが出来るものとします。", ja), []);
    assert.deepEqual(found("運営者は、広報等に必要な範囲で写真を使うことができるものとする。", ja), []);
  });

  it("a list in what is forbidden or excluded is not reported", () => {
    assert.deepEqual(found("会員は、写真の複製、転載、販売等をしてはならないものとします。", ja), []);
    assert.deepEqual(found("会員は、写真の複製、転載等をしてはなりません。", ja), []);
    assert.deepEqual(found("天災などにより会員が被った損害について、運営者は責任を負わないものとします。", ja), []);
  });

  it("a list in the condition a duty depends on is not reported", () => {
    assert.deepEqual(found("運営者は、会員の情報の訂正等を行った際に、会員に知らせるものとします。", ja), []);
    assert.deepEqual(found("運営者は、会員の停止などを行った場合、会員に知らせるものとします。", ja), []);
    assert.deepEqual(found("写真の削除などが難しいと判断されるときは、運営者は会員に知らせるものとします。", ja), []);
  });

  it("a list in the duty itself is still reported", () => {
    assert.deepEqual(found("受託者は、写真、動画等を毎月提出しなければならない。", ja), ["open-end:等"]);
    assert.deepEqual(found("受託者は、故障等を委託者に申し出て、指示を受けなければならない。", ja), ["open-end:等"]);
    assert.deepEqual(found("受託者は、写真等を確認しなければなりません。", ja), ["open-end:等"]);
    assert.deepEqual(found("写真等を三十日保存すること。", ja), ["open-end:等"]);
    assert.deepEqual(found("写真、動画などを保存する必要があります。", ja), ["open-end:など"]);
  });

  it("a capability a specification requires (できること) is a duty, not a permission", () => {
    assert.deepEqual(found("利用者が写真等を検索できること。", ja, "technical/spec"), ["open-end:等"]);
  });

  it("a condition after the list's own clause has closed does not hold the list", () => {
    assert.deepEqual(found("写真等を保存し、故障が起きた場合は報告すること。", ja), ["open-end:等"]);
  });

  it("なければ that opens a condition is no duty: the permission after it decides", () => {
    assert.deepEqual(found("会員が写真等を提出しなければ、運営者は会員の登録を消去できるものとする。", ja), []);
  });

  it("a duty word before a prohibition word decides (しなければならないものとする)", () => {
    assert.deepEqual(found("受託者は、写真等を提出しなければならないものとする。", ja), ["open-end:等"]);
  });

  it("the scope cues are no smell words themselves", () => {
    assert.deepEqual(found("受託者は、故障した場合は報告しなければならない。", ja), []);
    assert.deepEqual(found("受託者は、写真を削除してはならない。", ja), []);
  });
});

describe("requirement-smell: the scope cues in English", () => {
  it("English has no scope cues, so etc. in a prohibition is still reported", () => {
    assert.deepEqual(found("The Licensee must not copy, sell, rent, etc. the photos.", en), ["open-end:etc."]);
  });
});

const token = (surface: string, pos: string): Token => ({ surface, pos, span: { start: 0, end: 0 } });

const entry = (pattern: string, group: string, tokens: readonly Token[]): LexiconEntry => ({ pattern, group, tokens: [...tokens] });

describe("openOnPurpose", () => {
  const words = scopeWordsOf([
    entry("等", "", [token("等", "NOUN")]),
    entry("なければ", "scope-duty", [token("なけれ", "AUX"), token("ば", "SCONJ")]),
    entry("できる", "scope-permission", [token("できる", "VERB")]),
    entry("場合", "scope-condition", [token("場合", "NOUN")]),
  ]);
  const at = (surfaces: readonly (readonly [string, string])[]): Token[] => surfaces.map(([surface, pos]) => token(surface, pos));
  const open = { start: 1, end: 2 };

  it("the cues are told apart from the open words by their group", () => {
    assert.equal(isScopeCue(entry("場合", "scope-condition", [])), true);
    assert.equal(isScopeCue(entry("等", "", [])), false);
    assert.equal(isScopeCue(entry("、", "class-link", [])), false);
  });

  it("nothing after the list leaves it to the sentence's own ending", () => {
    assert.equal(
      openOnPurpose(
        at([
          ["写真", "NOUN"],
          ["等", "NOUN"],
          ["を", "ADP"],
        ]),
        open,
        words,
      ),
      false,
    );
    assert.equal(openOnPurpose([], open, words), false);
  });

  it("the first cue decides", () => {
    const permission = at([
      ["写真", "NOUN"],
      ["等", "NOUN"],
      ["できる", "VERB"],
      ["なけれ", "AUX"],
      ["ば", "SCONJ"],
    ]);
    const duty = at([
      ["写真", "NOUN"],
      ["等", "NOUN"],
      ["なけれ", "AUX"],
      ["ば", "SCONJ"],
      ["できる", "VERB"],
    ]);
    assert.equal(openOnPurpose(permission, open, words), true);
    assert.equal(openOnPurpose(duty, open, words), false);
  });

  it("a condition word counts only right after a predicate, and before the list's clause closes", () => {
    const afterVerb = at([
      ["写真", "NOUN"],
      ["等", "NOUN"],
      ["した", "VERB"],
      ["場合", "NOUN"],
    ]);
    const afterNoun = at([
      ["写真", "NOUN"],
      ["等", "NOUN"],
      ["の", "ADP"],
      ["場合", "NOUN"],
    ]);
    const closed = at([
      ["写真", "NOUN"],
      ["等", "NOUN"],
      ["し", "VERB"],
      ["、", "PUNCT"],
      ["した", "VERB"],
      ["場合", "NOUN"],
    ]);
    assert.equal(openOnPurpose(afterVerb, open, words), true);
    assert.equal(openOnPurpose(afterNoun, open, words), false);
    assert.equal(openOnPurpose(closed, open, words), false);
  });

  it("a cue whose tokens run past the end of the sentence does not match", () => {
    assert.equal(
      openOnPurpose(
        at([
          ["写真", "NOUN"],
          ["等", "NOUN"],
          ["なけれ", "AUX"],
        ]),
        open,
        words,
      ),
      false,
    );
  });
});
