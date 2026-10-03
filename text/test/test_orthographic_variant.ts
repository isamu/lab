import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { oddSpellings } from "../packages/chaff/src/spelling-variants.ts";
import { kanjiSkeleton, katakanaKey, lemmaReading } from "../packages/chaff/src/kana-spelling.ts";

// 表記ゆれ（orthographic-variant）。例文はすべて自作。

const RULE = "orthographic-variant";

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

describe("orthographic-variant: 読みで束ねる", () => {
  it("出来る と できる: 少ないほうを指す", () => {
    assert.deepEqual(findingsOf("窓口で申請できます。郵送でもできます。代理の人も申請出来ます。\n"), [
      "「出来る」と書いています（この文書はふつう「できる」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("送り仮名のゆれ（引っ越し と 引越し、行う と 行なう）", () => {
    assert.deepEqual(findingsOf("引っ越しは月末です。引っ越しの日を決めます。引越しの費用は会社が出します。\n"), [
      "「引越し」と書いています（この文書はふつう「引っ越し」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
    assert.equal(findingsOf("点検を行います。報告を行いました。説明を行なった。\n").length, 1);
  });

  it("形式名詞の 事 と こと", () => {
    assert.deepEqual(findingsOf("出すことが決まりました。読むことも大切です。その事は後で話します。\n"), [
      "「事」と書いています（この文書はふつう「こと」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("補助動詞と本来の動詞は別に比べる（資料を下さい と 見てください）", () => {
    assert.deepEqual(findingsOf("資料を下さい。見てください。確かめてください。\n"), []);
  });

  it("漢字の違う同音の語は別の語（書く と 描く）", () => {
    assert.deepEqual(findingsOf("名前を書く。絵を描く。日記を書く。\n"), []);
    assert.deepEqual(findingsOf("機会が増えた。機会を待つ。機械を止める。\n"), []);
  });

  it("漢字の書き方が二つある読みでは、かなの語をどちらにも付けない（橋・箸 と はし）", () => {
    assert.deepEqual(findingsOf("川の橋を渡る。古い橋を直す。箸で食べる。はしを持つ。\n"), []);
  });

  it("意味の違いで書き分ける語は比べない（成る と なる）", () => {
    assert.deepEqual(findingsOf("委員会は五人から成る。来年はよくなる。春になる。\n"), []);
  });

  it("どちらも同じ数なら、どちらの側にも立たない", () => {
    assert.deepEqual(findingsOf("窓口で申請できます。代理の人も申請出来ます。\n"), []);
  });

  it("少ないほうが三分の一を超えれば、使い分けと見る", () => {
    assert.deepEqual(findingsOf("できます。できます。できます。出来ます。出来ます。\n"), []);
  });

  it("鉤括弧の中は引いた元の書き方なので数えない", () => {
    assert.deepEqual(findingsOf("できます。できます。規程は「申請出来る」と書いている。\n"), []);
  });
});

describe("orthographic-variant: カタカナ語と英字", () => {
  it("ウィンドウ と ウインドウ", () => {
    assert.deepEqual(findingsOf("ウィンドウを開きます。ウィンドウを閉じます。ウインドウの大きさを変えます。\n"), [
      "「ウインドウ」と書いています（この文書はふつう「ウィンドウ」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("語末の「ー」だけの違いは katakana-long-vowel に任せる", () => {
    assert.deepEqual(findingsOf("サーバーを止めます。サーバーを再起動します。サーバの設定を見ます。\n"), []);
    assert.deepEqual(findingsOf("コンピューターを使う。コンピューターを買う。コンピュータを直す。\n"), []);
  });

  it("e-mail と email、GitHub と Github", () => {
    assert.deepEqual(findingsOf("Send it by email. Every email is read. Attach it to the e-mail.\n", en), [
      '"e-mail" here, where the document usually writes "email" (1 of 3)',
    ]);
    assert.deepEqual(findingsOf("GitHub に置きます。GitHub で見ます。Github の設定です。\n"), [
      "「Github」と書いています（この文書はふつう「GitHub」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("頭の字の大文字小文字は書き方の違いにしない（Email と email、Windows と windows）", () => {
    assert.deepEqual(findingsOf("Email is fine. We read email daily. Reply by email.\n", en), []);
    assert.deepEqual(findingsOf("Windows runs it. Windows ships it. Close the windows first.\n", en), []);
  });

  it("題の大文字（Long-Term）と、アドレスやファイル名の一部（github.com）は書き方の違いにしない", () => {
    assert.deepEqual(findingsOf("A Long-Term Plan. The long-term view. Our long-term goal.\n", en), []);
    assert.deepEqual(findingsOf("GitHub hosts it. GitHub runs it. Write to help@github.com today.\n", en), []);
  });

  it("ハイフンで別の語になるもの（re-sign と resign）は比べない", () => {
    assert.deepEqual(findingsOf("Staff resign today. Managers resign tomorrow. Please re-sign the offer.\n", en), []);
  });

  it("大文字だけの語（強調や略語）は数えない", () => {
    assert.deepEqual(findingsOf("Read the terms. The terms apply. THE TERMS ARE FINAL.\n", en), []);
  });
});

describe("orthographic-variant: 使い方で分ける", () => {
  it("接尾の「用」と形式名詞の「よう」は別の語", () => {
    assert.deepEqual(findingsOf("このように書きます。次のように直します。業務用の端末です。\n"), []);
  });

  it("「者」（人）と「もの」は書き分け", () => {
    assert.deepEqual(findingsOf("申請するものとする。届け出るものとする。申請した者に通知する。\n"), []);
  });
});

describe("spelling-variants: 束ねた語の少ないほう", () => {
  const words = (spellings: string): { key: string; spelling: string }[] => [...spellings].map((spelling) => ({ key: "k", spelling }));

  it("多いほうと違う書き方だけを返す", () => {
    assert.deepEqual(
      oddSpellings(words("aab"), 34).map((odd) => [odd.word.spelling, odd.usual, odd.count, odd.of]),
      [["b", "a", 1, 3]],
    );
  });

  it("一通りしかない、同数、少ないほうが上限を超える、は何も返さない", () => {
    assert.deepEqual(oddSpellings(words("aaa"), 34), []);
    assert.deepEqual(oddSpellings(words("ab"), 49), []);
    assert.deepEqual(oddSpellings(words("aabb"), 50), []);
    assert.deepEqual(oddSpellings(words("aabb"), 49), []);
    assert.deepEqual(oddSpellings(words("aaabb"), 34), []);
    assert.deepEqual(oddSpellings([], 34), []);
  });

  it("上限ちょうどは指す", () => {
    assert.equal(oddSpellings(words("aaab"), 25).length, 1);
    assert.equal(oddSpellings(words("aaab"), 24).length, 0);
  });

  it("鍵ごとに別々に数える", () => {
    const mixed = [...words("aab"), { key: "j", spelling: "x" }, { key: "j", spelling: "y" }];
    assert.deepEqual(
      oddSpellings(mixed, 34).map((odd) => odd.word.spelling),
      ["b"],
    );
  });
});

describe("kana-spelling: 読みと字の鍵", () => {
  it("辞書の形の読み", () => {
    assert.equal(lemmaReading("下さい", "下さる", "クダサイ"), "クダサル");
    assert.equal(lemmaReading("出来", "出来る", "デキ"), "デキル");
    assert.equal(lemmaReading("でき", "できる", "デキ"), "デキル");
    assert.equal(lemmaReading("行なっ", "行なう", "オコナッ"), "オコナウ");
    assert.equal(lemmaReading("引越し", "引越し", "ヒッコシ"), "ヒッコシ");
    assert.equal(lemmaReading("𠮟っ", "𠮟る", "シカッ"), "シカル");
  });

  it("読みが語尾と合わなければ答えない", () => {
    assert.equal(lemmaReading("見た", "見る", "ミタ"), "ミル");
    assert.equal(lemmaReading("い", "来る", "キ"), undefined);
    assert.equal(lemmaReading("書", "描く", "カ"), undefined);
  });

  it("漢字の骨組み", () => {
    assert.equal(kanjiSkeleton("引っ越し"), "引越");
    assert.equal(kanjiSkeleton("引越し"), "引越");
    assert.equal(kanjiSkeleton("できる"), "");
    assert.equal(kanjiSkeleton("人々"), "人々");
  });

  it("カタカナ語の鍵", () => {
    assert.equal(katakanaKey("ウィンドウ"), katakanaKey("ウインドウ"));
    assert.equal(katakanaKey("インターフェース"), katakanaKey("インタフェイス"));
    assert.equal(katakanaKey("ヴァイオリン"), katakanaKey("バイオリン"));
    assert.notEqual(katakanaKey("ウィンドウ"), katakanaKey("ウインド"));
  });
});
