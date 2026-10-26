import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// orthographic-variant (ja): 決まった言い方の中の語と、名前や題名の中の語を、地の文の語の書き方のゆれと見ない。
// 例文は自作と、法令の題名（愛がん動物用飼料の安全性の確保に関する法律）と漢文の句（天子有道）。

const findingsOf = (source: string, genre = "business/report"): readonly string[] => namedRuleRun("orthographic-variant", source, ja, "a.md", genre).findings;

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("orthographic-variant: 以て（〜でもって）", () => {
  it("後ろに動詞の続かない「でもって」を、物を持つ動詞と比べない", () => {
    assert.deepEqual(
      findingsOf("# 会見\n\n信念を持って訴えます。一貫性を持って説明します。危機感を持って取り組みます。携帯電話で電子でもって申請します。\n"),
      [],
    );
  });

  it("「を」の後の「もって」は、動詞と見分けられないので今までどおり比べる", () => {
    assert.equal(findingsOf("# 演説\n\n鍵を持つ。権限を持っている。資料を持って出かける。この決意をもって私の演説を閉じます。\n").length, 1);
  });

  it("物を持つ動詞どうしは今までどおり比べる", () => {
    assert.equal(findingsOf("# 演説\n\n鍵をもつ。権限を持っている。資料を持って出かける。地図を持つ。\n").length, 1);
    assert.equal(findingsOf("# 演説\n\n勇気をもって語る。信念を持って話す。熱意を持って伝える。根気を持って続ける。\n").length, 1);
  });
});

describe("orthographic-variant: 「と」の後の「いたす」", () => {
  it("「議題といたします」は補助の語で、本来の動詞（思いを致す）と比べない", () => {
    assert.deepEqual(
      findingsOf("# 委員会\n\n本日は開会いたします。調査を議題といたします。反対討論といたします。改めて被災者に思いを致し、力を尽くします。\n"),
      [],
    );
  });

  it("補助の「いたす」どうしは今までどおり比べる", () => {
    assert.equal(findingsOf("# 委員会\n\n調査を議題といたします。報告は後日といたします。採決は明日と致します。\n").length, 1);
  });
});

describe("orthographic-variant: 複合動詞の後ろの動詞", () => {
  it("「貼り付ける」の「付ける」を、それだけの「つける」と比べない", () => {
    assert.deepEqual(findingsOf("# 手順\n\nリンクを貼り付けます。番号をつけます。名前をつけます。印をつけます。\n"), []);
  });

  it("それだけの「つける」どうしは今までどおり比べる", () => {
    assert.equal(findingsOf("# 手順\n\n番号をつけます。名前をつけます。印を付けます。\n").length, 1);
  });
});

describe("orthographic-variant: 一語として比べる語（ただいま、昨日来）", () => {
  it("「ただいま」の「いま」を「今」と、「昨日来」の「昨日」を「きのう」と比べない", () => {
    assert.deepEqual(findingsOf("# 会議\n\nただいまから会議を始めます。今は春です。今も続いています。\n"), []);
    assert.deepEqual(findingsOf("# 用語\n\n昨日来の雨が続く。きのうの夕方に降った。きのうから降っている。\n"), []);
  });

  it("「ただいま」の書き方どうしは比べる", () => {
    assert.equal(findingsOf("# 会議\n\nただいまから始めます。只今から始めます。ただいまより再開します。\n").length, 1);
  });
});

describe("orthographic-variant: 熟語の頭の一字の漢字", () => {
  it("「曇雨天」の「曇」を、「曇り」と比べない", () => {
    assert.deepEqual(
      findingsOf("# 用語\n\n明日は晴れ（曇り）がちの天気です。\n\n雨、曇り時々雨、曇り一時雨などの天気が続きます。\n\n週末は曇雨天が続きます。\n"),
      [],
    );
  });
});

describe("orthographic-variant: カタカナの名前のかけら", () => {
  it("切られたカタカナの名前（ラオカイ）を、同じ読みの漢字と比べない", () => {
    assert.deepEqual(
      findingsOf("# 旅\n\nベトナムのラオカイから国境を越えます。途中の虎跳峡鎮で下車し、有名な虎跳峡へ向かいます。虎跳峡は深い谷です。\n", "blog/essay"),
      [],
    );
  });

  it("それだけで書いたカタカナとかなは今までどおり比べる", () => {
    assert.equal(findingsOf("# 料理\n\nネギを刻む。ねぎを炒める。ねぎを買う。\n").length, 1);
  });
});

describe("orthographic-variant: 引用のすぐ後ろの括弧（書き下し）", () => {
  it("鉤括弧の直後の括弧は引用の読みで、地の文と比べない", () => {
    assert.deepEqual(findingsOf("# 旅\n\n城がある。町がある。川がある。いわゆる「天子有道」（天子に道有らば）です。\n", "blog/essay"), []);
  });

  it("引用に付かない所の書き方は今までどおり比べる", () => {
    assert.equal(findingsOf("# 旅\n\n城がある。町がある。川がある。天子に道有らば守りは固い。\n", "blog/essay").length, 1);
  });
});

describe("orthographic-variant: 番号を付けて引いた法令の題名", () => {
  it("法令の番号の括弧の前の題名（間の略称の括弧も）は、その法令の書き方", () => {
    assert.deepEqual(
      findingsOf(
        "# 白書\n\n愛がん動物用飼料の安全性の確保に関する法律（ペットフード安全法）（平成20年法律第83号）に基づき指導した。愛玩動物を飼う。愛玩動物の数が増えた。\n",
      ),
      [],
    );
  });

  it("番号の付かない所の書き方は今までどおり比べる", () => {
    assert.equal(findingsOf("# 白書\n\n愛がん動物を飼う人に伝えた。愛玩動物を飼う。愛玩動物の数が増えた。\n").length, 1);
  });
});

describe("orthographic-variant: 施設や組織の名前", () => {
  it("名前を閉じる語（園、センター）で終わる名詞の連なりの中の語は、名前の書き方", () => {
    assert.deepEqual(findingsOf("# 議事録\n\nこども動物園は人気がある。子どもが遊ぶ。子どもの声がする。子どもの数が増えた。\n"), []);
  });

  it("名前そのものを二通りに書いた文書（こども家庭庁、子ども家庭庁）は、名前の中の語も比べる", () => {
    assert.equal(findingsOf("# 白書\n\nこども家庭庁が通知した。子ども家庭庁の資料を読んだ。子どもが遊ぶ。子どもの数が増えた。\n").length, 1);
  });

  it("名前の外の書き方は今までどおり比べる", () => {
    assert.equal(findingsOf("# 議事録\n\nこどもが遊ぶ。子どもの声がする。子どもの数が増えた。\n").length, 1);
  });
});
