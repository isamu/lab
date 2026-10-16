import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasPredicateIn } from "../packages/chaff/src/detectors/gram-predicate.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { Span, Token } from "../packages/chaff/src/plugin.ts";

// ngram-repetition: a Japanese verb inside a term that coordinates nouns (行為又は怠る事実) is no predicate, so the term's
// repeats are not a repeated phrasing. Self-written text only.

type Word = readonly [surface: string, pos: string, verbType?: string | undefined, nounType?: string];

/** Words written together (Japanese), and their tokens. */
const sentenceOf = (words: readonly Word[]): { text: string; tokens: Token[] } => {
  const state = { at: 0 };
  const tokens = words.map(([surface, pos, verbType, nounType]) => {
    const span = { start: state.at, end: state.at + surface.length };
    state.at = span.end;
    const features = { ...(verbType === undefined ? {} : { VerbType: verbType }), ...(nounType === undefined ? {} : { NounType: nounType }) };
    return Object.keys(features).length === 0 ? { span, surface, pos } : { span, surface, pos, features };
  });
  return { text: words.map(([surface]) => surface).join(""), tokens };
};

const windowOf = (text: string, gram: string): Span => {
  const start = text.indexOf(gram);
  assert.notEqual(start, -1, `${gram} is not in ${text}`);
  return { start, end: start + gram.length };
};

const predicateIn = (words: readonly Word[], gram: string): boolean => {
  const { text, tokens } = sentenceOf(words);
  return hasPredicateIn(tokens, windowOf(text, gram), "char");
};

describe("hasPredicateIn: a verb inside a coordinated noun term (char)", () => {
  it("valid: a verb between 又は after a noun and the noun it modifies is part of the term", () => {
    const words: Word[] = [
      ["会員", "NOUN"],
      ["の", "ADP"],
      ["資格", "NOUN"],
      ["又は", "CCONJ"],
      ["失う", "VERB"],
      ["時期", "NOUN"],
      ["を", "ADP"],
    ];
    assert.equal(predicateIn(words, "の資格又は失う時"), false);
  });

  it("invalid: a verbal noun with a light verb coordinates acts (承認又は拒否する場合): a predicate", () => {
    const words: Word[] = [
      ["申請", "NOUN"],
      ["を", "ADP"],
      ["承認", "NOUN"],
      ["又は", "CCONJ"],
      ["拒否", "NOUN"],
      ["する", "VERB", "Light"],
      ["場合", "NOUN"],
    ];
    assert.equal(predicateIn(words, "承認又は拒否する場"), true);
  });

  it("invalid: a verb that makes its clause a dependent noun is a predicate (承認又は断るとき)", () => {
    const words: Word[] = [
      ["承認", "NOUN"],
      ["又は", "CCONJ"],
      ["断る", "VERB"],
      ["とき", "NOUN", undefined, "Dependent"],
      ["は", "ADP"],
    ];
    assert.equal(predicateIn(words, "承認又は断るときは"), true);
  });

  it("invalid: a verb after 又は that ends a clause is a predicate (資格又は失う。)", () => {
    const words: Word[] = [
      ["資格", "NOUN"],
      ["又は", "CCONJ"],
      ["失う", "VERB"],
      ["。", "PUNCT"],
    ];
    assert.equal(predicateIn(words, "資格又は失う"), true);
  });

  it("invalid: 又は after a clause, not a noun, joins predicates (申し込みをして又は受け取る書類)", () => {
    const words: Word[] = [
      ["申し込み", "NOUN"],
      ["を", "ADP"],
      ["し", "VERB"],
      ["て", "SCONJ"],
      ["又は", "CCONJ"],
      ["受け取る", "VERB"],
      ["書類", "NOUN"],
    ];
    assert.equal(predicateIn(words, "て又は受け取る書類"), true);
  });

  it("invalid: a verb before a noun without a conjunction stays part of a phrasing (〜にある部品)", () => {
    const words: Word[] = [
      ["棚", "NOUN"],
      ["に", "ADP"],
      ["ある", "VERB"],
      ["部品", "NOUN"],
    ];
    assert.equal(predicateIn(words, "棚にある部品"), true);
  });

  it("invalid: in English (word) the conjunction case does not apply; the verb is read as before", () => {
    const words: Word[] = [
      ["rules", "NOUN"],
      ["or", "CCONJ"],
      ["apply", "VERB"],
      ["now", "ADV"],
    ];
    const text = "rules or apply now";
    const tokens = words.map(([surface, pos], index) => {
      const start = text.split(" ").slice(0, index).join(" ").length + (index === 0 ? 0 : 1);
      return { span: { start, end: start + surface.length }, surface, pos };
    });
    assert.equal(hasPredicateIn(tokens, windowOf(text, "rules or apply"), "word"), true);
  });
});

const RULE = "ngram-repetition";

const found = (body: string): string[] =>
  runRules(buildDocument("t.md", `# 案内\n\n${body}\n`, ja), loadRules(ja.id), { [RULE]: "normal" }, false, "docs/manual")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["word"]));

/** Each paragraph: what comes before the repeated words, and what comes after them. Nothing else repeats. */
const PARAGRAPHS = [
  ["受付の窓口は平日の朝九時に開き、昼の休みはありません。初めての方は、", "が要るかを先に確かめます。駐車場は建物の裏にあり、二時間まで無料で使えます。"],
  ["審査は書類が届いた順に進め、結果が出るまで二週間ほどかかります。不足があれば、", "の理由を書面で示します。審査の途中で書類を差し替えることはできません。"],
  ["通知の書面には担当の名前と電話番号を載せています。決まった", "は郵便で届きます。届いた書面は五年間保管しておくと安心です。"],
  ["住所や口座を変えたときは、月末までに届け出てください。", "に必要な書類は二通です。郵送で届け出るときは、封筒の表に赤字で変更届と書きます。"],
  ["更新の時期は誕生月の前の月で、案内のはがきを送ります。前の年に", "を受けた方は記録が残ります。はがきをなくしたときは、窓口で再発行を頼めます。"],
  ["事業をやめるときは、最後の月の帳簿を持ってきてください。それまでの", "について相談できます。帳簿の写しは、原本と照らし合わせてから返します。"],
  ["電話でもメールでも相談を受け付けており、夜は留守番電話が応じます。よくある", "の例を窓口に掲示しています。掲示の内容は毎月一日に新しくなります。"],
] as const;

/** A page long enough to be measured, that repeats the same words once in each paragraph. */
const pageRepeating = (words: string): string => PARAGRAPHS.map(([lead, rest]) => `${lead}${words}${rest}`).join("\n\n");

describe("ngram-repetition (ja): a coordinated noun term", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: a term that coordinates a noun and a verb-modified noun may repeat", () => {
    assert.deepEqual(found(pageRepeating("会員の資格又は失う時期")), []);
  });

  it("invalid: a repeated phrasing with its own predicate is still reported", () => {
    assert.notDeepEqual(found(pageRepeating("お客様の声を大切にしながら、")), []);
  });
});
