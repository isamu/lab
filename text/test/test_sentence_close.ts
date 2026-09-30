import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { closesSentence } from "../packages/lang-ja/src/sentence-close.ts";
import { adapter } from "../packages/lang-ja/src/index.ts";

const textsOf = (source: string): string[] => adapter.segment(source).sentences.map((sentence) => sentence.text);

describe("closesSentence: 文が閉じているか", () => {
  it("「。！？!?」で閉じる。閉じ括弧と空白が後ろに続いてよい", () => {
    ["終わる。", "本当か？", "やった！", "Yes!", "Really?", "と言った。」", "（後述。）", "終わる。  ", "終わる。\n", "「やめる。』"].forEach((text) =>
      assert.equal(closesSentence(text), true, text),
    );
  });

  it("仮名・漢字・長音・閉じ括弧の後の「．」で閉じる", () => {
    [
      "低下することがある．",
      "を提案する．",
      "データベース．",
      "サーバー．",
      "手法．",
      "結果を示す（表1）．",
      "と呼ぶ「分割統治」．",
      "である．」",
      "である．）",
      "である．  ",
    ].forEach((text) => assert.equal(closesSentence(text), true, text));
  });

  it("数字の後の「．」は番号か小数点なので閉じない", () => {
    ["１．", "1．", "率は３．", "図２．", "第3．"].forEach((text) => assert.equal(closesSentence(text), false, text));
  });

  it("英字や記号の後の「．」、半角ピリオド、途中の句点では閉じない", () => {
    ["Dr.", "ends with a period.", "NMT．", "約50％．", "No．", "文の途中，", "ある．続く", "ある。続く", "．"].forEach((text) =>
      assert.equal(closesSentence(text), false, text),
    );
  });

  it("空・空白だけ・改行だけでは閉じない", () => {
    ["", " ", "\n", "　"].forEach((text) => assert.equal(closesSentence(text), false, JSON.stringify(text)));
  });
});

describe("日本語の文分割: 「，．」で書いた文", () => {
  it("語の後の「．」で文を分ける", () => {
    assert.deepEqual(textsOf("長い文では品質が低下することがある．この課題に対し，文を短く分けて訳す．結果を表に示す（表1）．"), [
      "長い文では品質が低下することがある．",
      "この課題に対し，文を短く分けて訳す．",
      "結果を表に示す（表1）．",
    ]);
  });

  it("番号と小数点の「．」では分けない", () => {
    assert.deepEqual(textsOf("１．はじめに本稿の目的を述べる．"), ["１．はじめに本稿の目的を述べる．"]);
    assert.deepEqual(textsOf("率は３．５％だった．次に進む．"), ["率は３．５％だった．", "次に進む．"]);
  });

  it("「。」の文と同じ数に分かれる", () => {
    const fullStops = "今日は晴れた．明日は雨が降る（予報）．傘を持つ．";
    assert.equal(textsOf(fullStops).length, textsOf(fullStops.replaceAll("．", "。")).length);
  });

  it("分けてもオフセットが元文字列と一致する", () => {
    const source = "低下することがある．この課題に対し， Dr. 田中は答えなかった．以上．";
    adapter.segment(source).sentences.forEach((sentence) => assert.equal(sentence.text, source.slice(sentence.span.start, sentence.span.end)));
  });
});

describe("closesSentence: 生成した文字列で、「．」を足す前の判定を含む", () => {
  const CLOSED_BEFORE = /[。！？!?][")）」』]*\s*$/u;
  const PIECES = ["あ", "ア", "漢", "ー", "1", "１", "A", "%", "）", "」", "』", ")", '"', "。", "．", ".", "！", "?", "，", " ", "\n", "　"];

  /** 線形合同法。種を変えれば別の並びになる。 */
  const randomStrings = (seed: number, count: number): string[] => {
    const state = { value: seed };
    const next = (): number => {
      state.value = (state.value * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state.value;
    };
    return Array.from({ length: count }, () => Array.from({ length: 1 + (next() % 6) }, () => PIECES[next() % PIECES.length] ?? "").join(""));
  };

  it("前に閉じていた文字列は今も閉じ、新しく閉じるのは「．」で終わるものだけ", () => {
    const SEED = 20_260_930;
    randomStrings(SEED, 20_000).forEach((text) => {
      const before = CLOSED_BEFORE.test(text);
      const now = closesSentence(text);
      if (before) assert.equal(now, true, JSON.stringify(text));
      if (now && !before) assert.match(text, /．[")）」』]*\s*$/u, JSON.stringify(text));
    });
  });
});
