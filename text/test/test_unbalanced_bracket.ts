import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { bracketProblems, withRunOnRestored } from "../packages/chaff/src/detectors/unbalanced-bracket.ts";
import { isLabelClose, isLabelInAside } from "../packages/chaff/src/detectors/bracket-label.ts";

// 括弧の組（unbalanced-bracket）。例文はすべて自作。

const RULE = "unbalanced-bracket";

const findingsOf = (source: string, adapter = ja, path = "a.md"): readonly string[] => namedRuleRun(RULE, source, adapter, path).findings;

describe("unbalanced-bracket: 括弧が組になっていない", () => {
  it("閉じていない開き", () => {
    assert.deepEqual(findingsOf("資料（別紙を参照してください。\n"), ["「（」が閉じていません"]);
  });

  it("開きの無い閉じ", () => {
    assert.deepEqual(findingsOf("会議の「議題」について」話します。\n"), ["「」」に対応する開きがありません"]);
  });

  it("全角の開きを半角で閉じた", () => {
    assert.deepEqual(findingsOf("国際機関（FAO)が定めました。\n"), ["「（」を「)」で閉じています（全角と半角が違います）"]);
  });

  it("英語の文書は英語で言う", () => {
    assert.deepEqual(findingsOf("The plan (see below is ready.\n\nThe list is final.\n", en), ['"(" is never closed']);
    assert.deepEqual(findingsOf('It was “schema aware” and "fast” too.\n', en), ['"”" closes nothing that was opened']);
  });

  it("入れ子の順が崩れたら、内側の開きを閉じていない", () => {
    assert.deepEqual(
      bracketProblems("「（あ」").map((problem) => `${problem.kind}:${problem.mark}`),
      ["unclosed:（"],
    );
  });

  it("引用の閉じのすぐ前の開きは、括弧の字を引いたもの（読替えの「取締役（」とあるのは）", () => {
    assert.deepEqual(findingsOf("同条第二項中「取締役（」とあるのは「清算人（」と読み替えるものとする。\n"), []);
    assert.deepEqual(findingsOf("同項中「掲げる情報（」とあるのは、「掲げる情報（条例で定めるものを除く。）又は」と読み替える。\n"), []);
  });

  it("引用の中で、閉じの前に字を残した開きは閉じていない", () => {
    assert.deepEqual(findingsOf("同条中「取締役（監査役」とあるのは「清算人」と読み替える。\n"), ["「（」が閉じていません"]);
    assert.deepEqual(findingsOf("資料（」を参照してください。\n"), ["「（」が閉じていません", "「」」に対応する開きがありません"]);
  });

  it("箇条の番号の印（1)、a)、事例）、数の後ろの閉じ）は開きを持たない", () => {
    assert.deepEqual(findingsOf("1) 最初に確認します。\n\n事例）窓口で受け付けます。上記事例2）の場合も同じです。\n"), []);
    assert.deepEqual(findingsOf("Evidence for areas a) to d) is required.\n", en), []);
  });

  it("括弧の中の、行の頭でも使う番号の印（「以下、事例3）まで同じ。）」）は、外の括弧と組にしない", () => {
    assert.deepEqual(findingsOf("- 事例1）書類（申込書を含む。以下、事例3）まで同じ。）を紛失した場合\n"), []);
    assert.deepEqual(findingsOf("事例1）窓口で受け付ける。\n\n事例2）書類（申込書を含む。以下、事例3）まで同じ。）を送る。\n"), []);
    assert.deepEqual(findingsOf("- A1) Mail the form (see the notes; A3) and more) today.\n", en), []);
  });

  it("行の頭で使わない印、句読点の後ろでない印、閉じが足りない印は、その閉じで括弧を閉じる", () => {
    assert.deepEqual(findingsOf("資料（例：1、2、3）を配ります。\n"), []);
    assert.deepEqual(findingsOf("袋に入れる（この際、薬剤※（濃度約1,000 ppm）や水（量 2）を入れる。）\n"), []);
    assert.deepEqual(findingsOf("資料（項目 1）を確認した）場合\n"), ["「）」に対応する開きがありません"]);
    assert.deepEqual(findingsOf("書類（以下、事例3）まで同じ。）を送る。\n"), ["「）」に対応する開きがありません"]);
    assert.deepEqual(findingsOf("Check the actions (e.g. phishing, etc) taken by the actor)?\n", en), ['")" closes nothing that was opened']);
    assert.deepEqual(findingsOf("The result (case 2) is final) now.\n", en), ['")" closes nothing that was opened']);
  });

  it("括弧の中の印があっても、本当に足りない括弧は指す", () => {
    const label = "- 事例1）受け付ける。\n";
    assert.deepEqual(findingsOf(`${label}書類（申込書を含む。以下、事例3）まで同じ。）を紛失した）場合\n`), ["「）」に対応する開きがありません"]);
    assert.deepEqual(findingsOf(`${label}書類申込書を含む。以下、事例3）まで同じ。）を紛失した場合\n`), ["「）」に対応する開きがありません"]);
    assert.deepEqual(findingsOf(`${label}「「書類（以下、事例3）まで同じ。）」を見る。\n`), ["「「」が閉じていません"]);
  });

  it("印として読むのは丸括弧だけ", () => {
    assert.deepEqual(findingsOf("「a」」\n").length, 1);
    assert.deepEqual(findingsOf("See item a] here.\n", en), ['"]" closes nothing that was opened']);
  });

  it("続きとして読むのは引用符だけ。丸括弧は次の段落の頭で開き直しても続きではない", () => {
    assert.deepEqual(findingsOf("(one\n\n(two) here.\n", en), ['"(" is never closed']);
  });

  it("段落をまたいでも、同じ節の中なら組にする（詩の連、長い引用）", () => {
    assert.deepEqual(findingsOf("(Pass, pass, ye brigades,\n\nLo, your army follows.)\n", en), []);
  });

  it("見出しで区切った節を越えては組にしない", () => {
    assert.deepEqual(findingsOf("## A\n\n(open here.\n\n## B\n\nclosed here).\n", en), ['"(" is never closed', '")" closes nothing that was opened']);
  });

  it("次の段落を同じ引用符で始める台詞は、続きとして数えない", () => {
    assert.deepEqual(findingsOf("“I went out,\n\n“and came back.”\n", en), []);
  });

  it("コードの中と、URL に続けて書いた括弧（読み手には見える）", () => {
    assert.deepEqual(findingsOf("`(` と ``「`` はコード。\n\nサイト（https://example.jp/）をご覧ください。\n"), []);
    assert.deepEqual(findingsOf("サイト（https://example.jp/をご覧ください。\n"), ["「（」が閉じていません"]);
  });

  it("コードに書いた URL の直後の閉じ括弧も、読み手には見える", () => {
    assert.deepEqual(findingsOf("- **接続先**：サーバーの住所（`https://example.jp`）。設定に書く\n"), []);
    assert.deepEqual(findingsOf("住所（`https://example.jp`）と（`https://example.com/a`）です。\n"), []);
    assert.deepEqual(findingsOf("住所（`https://example.jp`です。\n"), ["「（」が閉じていません"]);
    assert.deepEqual(findingsOf("住所は `https://example.jp`）です。\n"), ["「）」に対応する開きがありません"]);
  });

  it("テキストの文書でも動く", () => {
    assert.deepEqual(findingsOf("資料（別紙を参照してください。\n", ja, "a.txt").length, 1);
  });
});

describe("withRunOnRestored", () => {
  it("URL の覆いが飲み込んだ ASCII でない字を戻す。字のまま見える範囲の外は戻さない", () => {
    const url = "https://a.jp/";
    const source = `x（${url}）y`;
    // 本文では URL の覆いが、空白が来るまでの「）y」まで覆っている。
    const prose = `x（${" ".repeat(url.length + 2)}`;
    assert.equal(withRunOnRestored(prose, source, [{ start: 0, end: source.length }]), `x（${" ".repeat(url.length)}）y`);
    assert.equal(withRunOnRestored(prose, source, []), prose);
    assert.equal(withRunOnRestored("", "", []), "");
  });

  it("コードの中の URL は、コードが終わった後ろの見える字だけを戻す", () => {
    const code = "`https://a.jp`";
    const source = `x（${code}）y`;
    const prose = `x（${" ".repeat(code.length + 2)}`;
    const texts = [
      { start: 0, end: 2 },
      { start: 2 + code.length, end: source.length },
    ];
    assert.equal(withRunOnRestored(prose, source, texts), `x（${" ".repeat(code.length)}）y`);
    assert.equal(withRunOnRestored(prose, source, texts.slice(0, 1)), prose);
  });
});

describe("isLabelInAside", () => {
  const LABEL_LINE = "- 事例1）受け付ける。\n";
  /** LABEL_LINE の後ろに aside を置いた節と、aside の中で before の後ろの最初の閉じの位置。 */
  const sectionWith = (aside: string, before: string, labelLine = LABEL_LINE): [string, number] => {
    const text = `${labelLine}${aside}`;
    return [text, text.indexOf("）", labelLine.length + aside.indexOf(before))];
  };

  it("句読点の後ろの番号の印で、行の頭でも使い、同じ行の後ろの閉じで開いた括弧がすべて閉じれば印", () => {
    assert.equal(isLabelInAside(...sectionWith("書類（以下、事例3）まで同じ。）", "事例3"), 1), true);
    assert.equal(isLabelInAside(...sectionWith("書類（以下、事例12）まで同じ。）", "事例12"), 1), true);
    assert.equal(isLabelInAside(...sectionWith("（a（以下、事例3）まで同じ。））", "事例3", "  * 事例9）x\n"), 2), true);
  });

  it("どれか一つでも欠ければ印ではない", () => {
    assert.equal(isLabelInAside(...sectionWith("書類（以下、事例3）まで同じ。）", "事例3"), 2), false);
    assert.equal(isLabelInAside(...sectionWith("書類（以下、事例3）まで同じ。）", "事例3", ""), 1), false);
    assert.equal(isLabelInAside(...sectionWith("書類（以下、事例3）まで同じ。）", "事例3", "注1）受け付ける。\n"), 1), false);
    assert.equal(isLabelInAside(...sectionWith("書類（以下 事例3）まで同じ。）", "事例3"), 1), false);
    assert.equal(isLabelInAside(...sectionWith("書類（以下、事例）まで同じ。）", "事例"), 1), false);
    assert.equal(isLabelInAside(...sectionWith("書類（以下、事例3）まで\n同じ。）", "事例3"), 1), false);
    assert.equal(isLabelInAside(...sectionWith("書類（以下、事例3）まで（同じ）", "事例3"), 1), false);
    assert.equal(isLabelInAside(...sectionWith("書類（以下、事例3）まで、4）", "事例3"), 1), false);
    assert.equal(isLabelInAside("", 0, 0), false);
  });
});

describe("isLabelClose", () => {
  it("行の頭か空白・句読点の後ろの三文字までの印と、数の後ろの閉じ", () => {
    assert.equal(isLabelClose("1) 確認", 1), true);
    assert.equal(isLabelClose("上記事例2）", 5), true);
    assert.equal(isLabelClose("資料をみる）", 5), false);
    assert.equal(isLabelClose("", 0), false);
  });
});
