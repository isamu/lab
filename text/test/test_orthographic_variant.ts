import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { oddSpellings } from "../packages/chaff/src/spelling-variants.ts";
import { dropsOkurigana, isKanaForKanji, kanjiKeyAmong, kanjiSkeleton, katakanaKey, lemmaReading } from "../packages/chaff/src/kana-spelling.ts";
import { furiganaSpans } from "../packages/chaff/src/furigana.ts";
import { acronymsIn, isCapitalsNotSpelling } from "../packages/chaff/src/capitals-with-small.ts";

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

  it("ではない・でもない・高くはない の「ない」は打ち消しで、「無い」と別に比べる", () => {
    assert.deepEqual(findingsOf("無い分類は止めます。無い値も止めます。事実ではない。どれでもない。\n"), []);
    assert.deepEqual(findingsOf("無い分類は止めます。無い値も止めます。条の番号は 2 ではなく 3 です。\n"), []);
    assert.deepEqual(findingsOf("無い分類は止めます。無い値も止めます。書類がない。\n"), [
      "「ない」と書いています（この文書はふつう「無い」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
    assert.equal(findingsOf("良い例です。良い結果です。東京ではよい店を探します。\n").length, 1);
  });

  it("名前や空白のすぐ後ろの「でない」は「出ない」ではない", () => {
    assert.deepEqual(findingsOf("結果が出ない。音が出ない。JSON でない行は止めます。\n"), []);
    assert.deepEqual(findingsOf("結果が出ない。音が出ない。結果がでない。\n"), [
      "「でる」と書いています（この文書はふつう「出る」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
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

  it("分割器の切り方が違うカタカナ語は、続けて書いたカタカナ全体で比べる（タイヤレバー と タイヤーレバー）", () => {
    assert.deepEqual(findingsOf("タイヤレバーを差し込む。タイヤレバーで外す。タイヤーレバーを使わずにはめる。\n"), [
      "「タイヤーレバー」と書いています（この文書はふつう「タイヤレバー」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("続けて書いたカタカナでも、中の語の語末の「ー」は katakana-long-vowel に任せ、一つの場所は一度だけ言う", () => {
    assert.deepEqual(findingsOf("サーバーリストを見る。サーバーリストを直す。サーバリストを消す。\n"), []);
    assert.deepEqual(findingsOf("ユーザーインターフェースを直す。ユーザーインターフェースを見る。ユーザーインタフェースを試す。\n"), [
      "「インタフェース」と書いています（この文書はふつう「インターフェース」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("続けて書いたカタカナも、短いもの（タイヤ と タイヤー）は別の語と出会うので比べない", () => {
    assert.deepEqual(findingsOf("タイヤを替える。タイヤを外す。タイヤーを見る。\n"), []);
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

  it("大文字に小文字の語尾が付いた語（略語の字を示す CLImatology、関数名の SENDs）は数えない", () => {
    const acronym = "The CLIPER model (CLImatology and PERsistence) is the baseline. Climatology is slow. We read climatology daily. Old climatology helps.\n";
    assert.deepEqual(findingsOf(acronym, en), []);
    assert.deepEqual(
      findingsOf("A program may issue several SENDs before a CLOSE. The peer sends data. The host sends a reply. Each side sends a FIN.\n", en),
      [],
    );
    assert.deepEqual(findingsOf("A connection is OPENed passively. It opened at noon. We opened it again. They opened a second one.\n", en), []);
  });

  it("ハイフンでつないだ語は、大文字の部分があっても語として比べる（GitHub-SENDs と Github-SENDs）", () => {
    assert.deepEqual(findingsOf("GitHub-SENDs return. GitHub-SENDs retry. Github-SENDs timeout.\n", en), [
      '"Github-SENDs" here, where the document usually writes "GitHub-SENDs" (1 of 3)',
    ]);
  });

  it("名前の大文字（HBase、RSpec）は書き方なので、ゆれは数える", () => {
    assert.deepEqual(findingsOf("HBase stores rows. HBase scales out. Hbase was down today.\n", en), [
      '"Hbase" here, where the document usually writes "HBase" (1 of 3)',
    ]);
  });

  it("大文字の混じる書き方のゆれは、それでも数える（JavaScript と Javascript、IPv6 と ipv6）", () => {
    assert.deepEqual(findingsOf("JavaScript runs here. JavaScript is fast. Javascript is popular.\n", en), [
      '"Javascript" here, where the document usually writes "JavaScript" (1 of 3)',
    ]);
    assert.deepEqual(findingsOf("IPv6 is enabled. IPv6 works here. Turn on ipv6 later.\n", en), [
      '"ipv6" here, where the document usually writes "IPv6" (1 of 3)',
    ]);
  });
});

describe("orthographic-variant: 使い方で分ける", () => {
  it("接尾の「用」と形式名詞の「よう」は別の語", () => {
    assert.deepEqual(findingsOf("このように書きます。次のように直します。業務用の端末です。\n"), []);
  });

  it("「者」（人）と「もの」は書き分け", () => {
    assert.deepEqual(findingsOf("申請するものとする。届け出るものとする。申請した者に通知する。\n"), []);
  });

  it("複合語の頭で送り仮名を省いた語（取扱事業者）は、それだけの語（取扱い）と別に比べる", () => {
    assert.deepEqual(findingsOf("取扱事業者は記録を残す。取扱事業者は報告する。取扱事業者が届け出る。記録の取扱いを定める。\n"), []);
    assert.deepEqual(findingsOf("締切日を守る。締切日を決める。締切日を書く。提出の締切りは明日です。\n"), []);
  });

  it("漢字だけの書き方が無い語（引越し と 引っ越し）は、複合語の頭も分けずに比べる", () => {
    assert.deepEqual(findingsOf("引越し業者に頼む。引越し業者を選ぶ。引越し業者と話す。引っ越しの日を決める。\n"), [
      "「引っ越し」と書いています（この文書はふつう「引越し」と書く語です。4 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("漢字の一部をかなで書いた語（かたくり粉）は、漢字の多い書き方（片栗粉）と同じ語として比べる", () => {
    assert.deepEqual(findingsOf("水で溶いた片栗粉を加える。片栗粉を足す。かたくり粉を少し足す。\n"), [
      "「かたくり粉」と書いています（この文書はふつう「片栗粉」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("読みが同じでも漢字の違う語（機関 と 期間）は、かなの混ざる書き方があっても別の語", () => {
    assert.deepEqual(findingsOf("研究の機関に送る。外部の機関と話す。契約の期間を決める。\n"), []);
    assert.deepEqual(findingsOf("川の橋を渡る。古い橋を直す。箸で食べる。はしを持つ。\n"), []);
  });

  it("それだけの語どうし、複合語の頭どうしのゆれは数える", () => {
    assert.deepEqual(findingsOf("記録の取扱いを定める。書類の取扱いを決める。鍵の取扱いを守る。現金の取扱を記す。\n"), [
      "「取扱」と書いています（この文書はふつう「取扱い」と書く語です。4 箇所のうち 1 箇所が違う）",
    ]);
    assert.deepEqual(findingsOf("取扱事業者は記録を残す。取扱事業者は報告する。取扱事業者が届け出る。取扱い事業者が答える。\n"), [
      "「取扱い」と書いています（この文書はふつう「取扱」と書く語です。4 箇所のうち 1 箇所が違う）",
    ]);
  });
});

describe("orthographic-variant: 語の書き方ではないもの", () => {
  it("ふりがなの括弧の中は語の読みで、書き方ではない", () => {
    const glossary = "- **Bearerトークン（べあらーとーくん）** はヘッダで示すトークンの渡し方です。\n- トークンは通行証です。\n- トークンを送ります。\n";
    assert.deepEqual(findingsOf(glossary), []);
    assert.equal(findingsOf("窓口で申請できます。郵送でもできます。代理の人も（申請出来ます）。\n").length, 1);
  });

  it("名詞に続けて書いたかなの名詞（全員ぶん）は、同じ読みの名詞（文）と比べない", () => {
    assert.deepEqual(findingsOf("一つの文で書きます。次の文も短くします。全員ぶん用意します。\n"), []);
    assert.equal(findingsOf("一つの文で書きます。次の文も短くします。そのぶんは長いです。\n").length, 1);
  });

  it("カタカナの語の途中で切られたもの（ミスっ → ミ・スる）は語ではない", () => {
    assert.deepEqual(findingsOf("設定をミスっていると動きません。準備をする。確認をする。記録をする。\n"), []);
    // カタカナ二字の語幹の動詞は語。名詞に続けて書いても数える。
    assert.equal(findingsOf("ジムサボる。授業をさぼる。会議をさぼる。練習をさぼる。\n").length, 1);
  });

  it("て形の後ろの補助動詞は、分割器がて形を接続詞と読んでも補助動詞（追ってみる）", () => {
    assert.deepEqual(findingsOf("画面を見る。記録を見る。結果を見る。追ってみると分かる。\n"), []);
    assert.equal(findingsOf("画面を見る。記録を見る。結果を見る。表をみる。\n").length, 1);
    // かなの接続詞（そして）は て形ではない。
    assert.equal(findingsOf("画面を見る。記録を見る。結果を見る。そしてみる。\n").length, 1);
  });

  it("慣用句の動詞（気をつける）は、それだけの動詞（名札を付ける）と別に比べる", () => {
    assert.deepEqual(findingsOf("名札を付ける。印を付ける。色を付ける。足元に気をつける。\n"), []);
    assert.equal(findingsOf("名札を付ける。印を付ける。色を付ける。紙につける。\n").length, 1);
    // 慣用句は動詞まで含めて決まる。「目を」の後ろでも、慣用句でない動詞は数える。
    assert.equal(findingsOf("画面を見る。記録を見る。結果を見る。目をみる。\n").length, 1);
  });
});

describe("furiganaSpans: 語の直後のふりがなの括弧", () => {
  it("漢字・カタカナ・英字の直後の、ひらがなだけの括弧", () => {
    assert.deepEqual(furiganaSpans("脆弱性（ぜいじゃくせい）"), [{ start: 3, end: 12 }]);
    assert.deepEqual(furiganaSpans("HTTP(えいち てぃー)"), [{ start: 4, end: 13 }]);
    assert.deepEqual(furiganaSpans("トークン（とーくん）と鍵（かぎ）"), [
      { start: 4, end: 10 },
      { start: 12, end: 16 },
    ]);
  });

  it("ひらがなの後ろ、文の頭、カタカナや漢字の混ざる括弧、ひらがなの無い括弧は読みではない", () => {
    assert.deepEqual(furiganaSpans("これは（たぶん）正しい"), []);
    assert.deepEqual(furiganaSpans("（ふりがな）"), []);
    assert.deepEqual(furiganaSpans("鍵（カギ）"), []);
    assert.deepEqual(furiganaSpans("鍵（かぎ、別名）"), []);
    assert.deepEqual(furiganaSpans("鍵（ー）"), []);
    assert.deepEqual(furiganaSpans("鍵 （かぎ）"), []);
    assert.deepEqual(furiganaSpans(""), []);
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

  it("送り仮名を省いた漢字だけの書き方", () => {
    assert.equal(dropsOkurigana("取扱", ["取扱", "取扱い"]), true);
    assert.equal(dropsOkurigana("締切", ["締切り", "締切"]), true);
    assert.equal(dropsOkurigana("取扱い", ["取扱", "取扱い"]), false);
    assert.equal(dropsOkurigana("取扱", ["取扱"]), false);
    // かなだけの書き方（まち）は送り仮名ではない。漢字の違う書き方（町・街）とも別。
    assert.equal(dropsOkurigana("町", ["町", "まち"]), false);
    assert.equal(dropsOkurigana("町", ["町", "街"]), false);
    assert.equal(dropsOkurigana("", ["", "取扱い"]), false);
  });

  it("漢字の一部をかなで書いた書き方", () => {
    assert.equal(isKanaForKanji("かたくり粉", "片栗粉"), true);
    assert.equal(isKanaForKanji("とり扱い", "取り扱い"), true);
    assert.equal(isKanaForKanji("取りあつかい", "取り扱い"), true);
    // 漢字が同じ（送り仮名だけの違い）、漢字だけ、かなだけ、漢字の位置が合わない、漢字の多い側から見る、は当たらない。
    assert.equal(isKanaForKanji("取扱い", "取り扱い"), false);
    assert.equal(isKanaForKanji("片栗粉", "片栗粉"), false);
    assert.equal(isKanaForKanji("かたくりこ", "片栗粉"), false);
    assert.equal(isKanaForKanji("かたくり粉", "片栗"), false);
    assert.equal(isKanaForKanji("粉かたくり", "片栗粉"), false);
    assert.equal(isKanaForKanji("片栗粉", "かたくり粉"), false);
    assert.equal(isKanaForKanji("", "片栗粉"), false);
  });

  it("かなの混ざる書き方の漢字の鍵は、当てはまる漢字の書き方が一つのときだけ移す", () => {
    assert.equal(kanjiKeyAmong("かたくり粉", ["片栗粉", "かたくり粉"]), "片栗粉");
    assert.equal(kanjiKeyAmong("かたくり粉", ["かたくり粉"]), "粉");
    assert.equal(kanjiKeyAmong("片栗粉", ["片栗粉", "かたくり粉"]), "片栗粉");
    assert.equal(kanjiKeyAmong("かたくりこ", ["片栗粉", "かたくりこ"]), "");
    // 二つの別の漢字の書き方に当てはまるなら、どちらとも決めない。
    assert.equal(kanjiKeyAmong("き関", ["機関", "期関", "き関"]), "関");
  });

  it("カタカナ語の鍵", () => {
    assert.equal(katakanaKey("ウィンドウ"), katakanaKey("ウインドウ"));
    assert.equal(katakanaKey("インターフェース"), katakanaKey("インタフェイス"));
    assert.equal(katakanaKey("ヴァイオリン"), katakanaKey("バイオリン"));
    assert.notEqual(katakanaKey("ウィンドウ"), katakanaKey("ウインド"));
  });
});

describe("capitals-with-small: capitals that are not a spelling of the plain word", () => {
  it("acronymsIn: the words in capitals only", () => {
    assert.deepEqual(acronymsIn("The CLIPER model (CLImatology and PERsistence) and CAMEX-3 use NASA data."), ["CLIPER", "CAMEX", "NASA"]);
    assert.deepEqual(acronymsIn("HBase and a I"), []);
    assert.deepEqual(acronymsIn(""), []);
  });

  it("a name in capitals with an ending, and the letters of an acronym of the sentence", () => {
    assert.deepEqual(
      ["SENDs", "RECEIVEs", "OPENed", "ACKing", "URLs"].map((word) => isCapitalsNotSpelling(word, [])),
      [true, true, true, true, true],
    );
    assert.deepEqual(
      ["CLImatology", "PERsistence", "EXperiment"].map((word) => isCapitalsNotSpelling(word, ["CLIPER", "CAMEX"])),
      [true, true, true],
    );
  });

  it("not a name spelled with capitals, capitals with no acronym to spell, or other words", () => {
    assert.deepEqual(
      ["HBase", "RSpec", "EMail", "CLImatology", "GitHub", "IPv6", "Email", "SEND", "sends", "", "-"].map((word) => isCapitalsNotSpelling(word, ["NASA"])),
      [false, false, false, false, false, false, false, false, false, false, false],
    );
    assert.equal(isCapitalsNotSpelling("CLImatology", []), false);
    assert.equal(isCapitalsNotSpelling("SCIMple", ["SCIM"]), false);
    assert.equal(isCapitalsNotSpelling("GitHub-SENDs", []), false);
    assert.equal(isCapitalsNotSpelling("SCIMple", ["SCIMS"]), true);
  });
});

describe("orthographic-variant: 表の本体の升の語も数える", () => {
  const recipe = (cell: string, header = "材料"): string =>
    `# 煮物\n\n| ${header} | 分量 |\n| --- | --- |\n| ${cell} | 小さじ2 |\n\n水で溶いた片栗粉を加えます。\n\nとろみが弱いときは、かたくり粉を足します。\n`;

  it("升の 片栗粉 が票になり、本文の かたくり粉 が少ないほうになる", () => {
    assert.deepEqual(findingsOf(recipe("片栗粉")), ["「かたくり粉」と書いています（この文書はふつう「片栗粉」と書く語です。3 箇所のうち 1 箇所が違う）"]);
  });

  it("本文だけでは同数で、どちらにも寄らない。見出しの行の語は票にならない", () => {
    assert.deepEqual(findingsOf(recipe("砂糖")), []);
    assert.deepEqual(findingsOf(recipe("砂糖", "片栗粉")), []);
  });

  it("升の中の少ないほうは、升の位置で言う", () => {
    const source = "# 予定\n\n引っ越しは月末です。引っ越しの日を決めます。\n\n| 項目 | 金額 |\n| --- | --- |\n| 引越し費用 | 5万円 |\n";
    const found = runRules(buildDocument("a.md", source, ja), loadRules("ja"), { [RULE]: "normal" }, false, "business/report").findings.filter(
      (finding) => finding.rule === RULE,
    );
    assert.deepEqual(
      found.map((finding) => [finding.line, finding.values["written"]]),
      [[7, "引越し"]],
    );
  });

  it("英字: 語句の升は数え、小文字一語の升（項目名や値）は数えない", () => {
    const table = (cell: string): string =>
      `# API\n\n| Field | Notes |\n| --- | --- |\n| ${cell} | set by the client |\n\nThe Content-Type header is required. Send the Content-Type with every request.\n`;
    assert.deepEqual(findingsOf(table("contentType"), en), []);
    assert.deepEqual(findingsOf(table("the contentType header"), en), ['"contentType" here, where the document usually writes "Content-Type" (1 of 3)']);
    assert.deepEqual(findingsOf(table("ContentType"), en), ['"ContentType" here, where the document usually writes "Content-Type" (1 of 3)']);
  });

  it("英字: 升のリンクの行き先は語に数えない", () => {
    const table = (cell: string): string =>
      `# API\n\n| Field | Notes |\n| --- | --- |\n| ${cell} | set by the client |\n\nThe Content-Type header is required. Send the Content-Type with every request.\n`;
    assert.deepEqual(findingsOf(table("[contentType](#contentType)"), en), []);
    assert.deepEqual(findingsOf(table('See [the header](#contentType "contentType")'), en), []);
    assert.deepEqual(findingsOf(table("See [the header][contentType]"), en), []);
    assert.deepEqual(findingsOf(table("See [the contentType header](#header)"), en), [
      '"contentType" here, where the document usually writes "Content-Type" (1 of 3)',
    ]);
  });
});

describe("orthographic-variant: 辞書が片方だけ切る語は一語で比べる", () => {
  it("お客さま は お客様 と比べ、名前の後の 様 とは比べない", () => {
    assert.deepEqual(findingsOf("お客さま名：山田 太郎 様\n\n山田 太郎 様のご使用量は前年より少なくなっています。\n"), []);
    assert.deepEqual(findingsOf("お客様の声を聞きます。お客様に送ります。お客さまへの案内です。\n"), [
      "「お客さま」と書いています（この文書はふつう「お客様」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("読みの違う切られ方も、組で一語（お父様 は オ + トウサマ、お父さま は オ + チチ + サマ）", () => {
    assert.deepEqual(findingsOf("お父様が来ました。お父様の席です。お父さまに渡します。\n"), [
      "「お父さま」と書いています（この文書はふつう「お父様」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("三つに切られる語も一語（お + 嬢 + さま）", () => {
    assert.deepEqual(findingsOf("お嬢様が来ました。お嬢様の席です。お嬢さまに渡します。\n"), [
      "「お嬢さま」と書いています（この文書はふつう「お嬢様」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("名前の後の 様 と さま のゆれは、これまでどおり言う", () => {
    assert.deepEqual(findingsOf("山田 太郎 様へ送ります。鈴木 一郎 様へ送ります。佐藤 花子 さまへ送ります。お客さまにも送ります。\n"), [
      "「さま」と書いています（この文書はふつう「様」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });
});
