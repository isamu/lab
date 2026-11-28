import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { readCompoundNounEnding } from "../packages/lang-ja/src/compound-noun-ending.ts";
import type { Morpheme } from "../packages/lang-ja/src/counter-tsu.ts";
import { tokenize } from "../packages/lang-ja/src/pos.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 名詞に動詞の連用形を付けた名詞（豆挽き、窓拭き）で終わる文は、名詞で終わる文。例文はすべて自作。

const morpheme = (surface: string, pos: string, detail1 = "*", extra: Partial<Morpheme> = {}): Morpheme => ({
  surface_form: surface,
  pos,
  pos_detail_1: detail1,
  pos_detail_2: "*",
  basic_form: surface,
  ...extra,
});

const verb = (surface: string, basic: string, form = "連用形"): Morpheme => morpheme(surface, "動詞", "自立", { basic_form: basic, conjugated_form: form });

const STOP = morpheme("。", "記号", "句点");
const COMMA = morpheme("、", "記号", "読点");

const posOf = (morphemes: readonly Morpheme[]): string[] => readCompoundNounEnding(morphemes).map((item) => `${item.surface_form}/${item.pos}`);

const lastPos = (text: string): string | undefined => tokenize(text)?.findLast((token) => token.pos !== "PUNCT")?.pos;

const findingsOf = (rule: string, source: string): readonly string[] => namedRuleRun(rule, source, ja, "a.md", "business", "strict").findings;

describe("readCompoundNounEnding", () => {
  it("reads a continuative verb right after a noun and right before 。 as a noun", () => {
    assert.deepEqual(posOf([morpheme("豆", "名詞", "一般"), verb("挽き", "挽く"), STOP]), ["豆/名詞", "挽き/名詞", "。/記号"]);
  });

  it("leaves a continuative verb that continues the sentence", () => {
    assert.deepEqual(posOf([morpheme("書類", "名詞", "一般"), verb("出し", "出す"), COMMA]), ["書類/名詞", "出し/動詞", "、/記号"]);
  });

  it("leaves a verb after a particle, after an adverbial noun, after a dependent noun, and ある / する", () => {
    const cases = [
      [morpheme("書類", "名詞", "一般"), morpheme("を", "助詞", "格助詞"), verb("出し", "出す"), STOP],
      [morpheme("毎朝", "名詞", "副詞可能"), verb("走り", "走る"), STOP],
      [morpheme("こと", "名詞", "非自立"), verb("あり", "ある"), STOP],
      [morpheme("在庫", "名詞", "サ変接続"), verb("あり", "ある"), STOP],
      [morpheme("到着", "名詞", "サ変接続"), verb("し", "する"), STOP],
      [morpheme("豆", "名詞", "一般"), verb("挽く", "挽く", "基本形"), STOP],
    ];
    cases.forEach((sequence) => assert.deepEqual(readCompoundNounEnding(sequence), sequence));
  });
});

describe("名詞と連用形でできた名詞で終わる文", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("is read as ending on a noun", () => {
    ["仕事の始まりは、毎朝三時の豆挽き。", "日課は窓拭き。"].forEach((text) => assert.equal(lastPos(text), "NOUN", text));
    assert.equal(lastPos("書類を出し、"), "VERB");
  });

  it("no-mixed-desumasu does not read it as plain style", () => {
    const source = ["仕事の始まりは、毎朝三時の豆挽き。", "豆は店で焙煎しています。", "お客様には毎朝お届けします。", "店は七時に開けます。", ""].join("\n");
    assert.deepEqual(findingsOf("no-mixed-desumasu", source), []);
  });

  it("taigen-dome-in-prose counts it", () => {
    const source = ["今年の目標は売上の回復。", "そのための施策は三つ。", "最初の仕事は窓拭き。", ""].join("\n");
    assert.equal(findingsOf("taigen-dome-in-prose", source).length, 1);
  });
});
