# 構造と引用

契約書や仕様書のように番号の付いた文書を、chaff は番地の付いた木として読みます。
木にすると、存在しない条を指している、番号が飛んでいる、といった崩れを機械で確かめられます。
AI の回答が引いた箇所が本当に原文にあるかも、同じ木で確かめます。

## 文書を木にして見る

`tree` は、文書を番地の付いた木にして出します。Markdown のほか、`.txt` も読みます。
契約書は見出しの無いテキストで来ることが多いためです。

| コマンド | 何が起きるか |
| --- | --- |
| `npx chaffjs tree <file>` | 木を S 式で出します。人と AI が読む形です |
| `npx chaffjs tree <file> --format json` | 同じ木を JSON で出します。プログラムが読む形です |

契約書をかけると、次のように出ます。

```
$ npx chaffjs tree contract.txt
(doc :language "ja" :path "contract.txt" :line 1
  (definition :term "甲" :line 3)
  (definition :term "乙" :line 3)
  (article "1" :heading "目的" :label "第1条" :line 5
    (reference :label "第3条" :target "3" :line 6))
  (article "2" :heading "定義" :label "第2条" :line 8
    (definition :term "成果物" :line 9))
  (article "3" :heading "業務" :label "第3条" :line 11
    (obligation :marker "なければならない" :type "must" :line 12)
    (item "3.1" :label "一" :line 13)
    (item "3.2" :label "二" :line 14)
    (item "3.3" :label "三" :line 15))
  (article "4" :heading "委託料" :label "第4条" :line 17
    (quantity :unit "円" :value 500000 :line 18)
    (item "4.2" :label "２" :line 19
      (quantity :unit "日" :value 30 :line 19)
      (obligation :marker "なければならない" :type "must" :line 19))
    (item "4.3" :label "３" :line 20
      (quantity :unit "%" :value 3 :line 20)
      (obligation :marker "ものとする" :type "must" :line 20)))
  (article "5" :heading "再委託" :label "第5条" :line 22
    (obligation :marker "してはならない" :type "must-not" :line 23))
  (article "6" :heading "契約期間" :label "第6条" :line 25
    (date :value "2024-04-01" :line 26)
    (date :value "2025-03-31" :line 26)
    (item "6.2" :label "２" :line 27
      (quantity :unit "か月" :value 3 :line 27)
      (quantity :unit "年間" :value 1 :line 27)
      (obligation :marker "することができる" :type "may" :line 27)))
  (article "7" :heading "解除" :label "第7条" :line 29
    (reference :label "第4条第2項" :target "4.2" :line 30)
    (reference :label "第5条" :target "5" :line 30)
    (obligation :marker "することができる" :type "may" :line 30)))
```

`article` は条、`item` は項や号です。その中に、定義（`definition`）、参照（`reference`）、
義務（`obligation`）、数量（`quantity`）、日付（`date`）が入ります。
`:line` は、原文の何行目かを表します。

## 番地の読み方

番地は、番号を点でつないだものです。書かれたままの番号は `:label` に残ります。

| 原文の書き方 | 番地 |
| --- | --- |
| 第3条第2項 | `3.2` |
| Section 4.2(a) | `4.2.a` |
| 番号の無い見出し（「インストール」など） | 見出しを上から数えた番号を並べ、`h1.2.1` のように振ります |

参照も、同じ形の番地を持ちます。上の例の「第4条第2項」は `:target "4.2"` です。
そのため、参照がどの条を指しているかを木の中で探せます。

## 構造の崩れを見つける

木を読むルールは、次の表のとおりです。

| ルール | 見つけるもの |
| --- | --- |
| `dangling-reference` | 文書に無い条や節を指している参照 |
| `numbering-gap` | 番号の抜けや重なり（第3条の次が第5条、第2項が二つ） |
| `duplicate-definition` | 同じ語を二度定義している所 |

どれも試験中なので、`--experimental` を付けるか、`chaff.yaml` で動かします。
次の例は、条をいくつか消したあとの短い契約書 `contract.txt` にかけたものです。

```
業務委託契約書

第1条（目的）
本契約は、第3条に定める業務の委託について定める。

第4条（委託料）
甲は、乙に対し、委託料として金500,000円を支払う。
２　甲は、成果物の検収後３０日以内に、前項の委託料を支払わなければならない。

第7条（解除）
甲は、乙が第9条に違反したときは、本契約を解除することができる。
```

```
$ npx chaffjs contract.txt --experimental --compact

contract.txt   blog/tech · 日本語   ジャンルは既定から

  4:6     error   「第3条」（番地 3）はこの文書にありません
                  dangling-reference
  6:1     error   「第1条」の次が「第4条」です（2 番目のはず）
                  numbering-gap
  10:1    error   「第4条」の次が「第7条」です（5 番目のはず）
                  numbering-gap
  11:6    error   「第9条」（番地 9）はこの文書にありません
                  dangling-reference

4 findings, 7 rules not run
```

「民法第709条」のように他の文書を指す参照は、探しません。
番号を比べるのは、同じ親の中で並ぶもの同士だけです。
`duplicate-definition` は、二つの定義が食い違っているかまでは決めません。

## 回答の引用を確かめる

AI に文書を読ませて答えさせると、「第4条第2項にこう書いてある」と引用が付きます。
`cite` は、その引用が本当に原文のその番地にあるかを確かめます。

```bash
npx chaffjs cite contract.txt claims.json
```

引用は、番地（`address`）と引用文（`quote`）の組を JSON の配列で渡します。

```json
[{ "address": "4.2", "quote": "検収後30日以内に" }]
```

上の契約書の第4条第2項が「検収後３０日以内に」と全角で書かれていても、一致と判定します。
空白と改行は無視し、文字は NFKC で揃えて比べるためです（３０ = 30）。

```
$ npx chaffjs cite contract.txt claims.json
✓ 4.2「検収後30日以内に」: 一致
```

数字を変えた引用や、別の場所から引いた引用は、失敗になります。
別の場所にあるときは、本当の番地を教えます。

```
$ npx chaffjs cite contract.txt claims.json
✗ 4.2「検収後60日以内に」: 引用文が原文のどこにもありません
✗ 7「委託料として金500,000円を支払う」: 引用文は 7 ではなく 4（7 行目）にあります
```

失敗した引用が混ざっていると、終了コード `1` で終わります。
回答の引用を、単体テストと同じように確かめられます。

## chaff がすることと、しないこと

chaff がするのは、壊れていないかの判定だけです。文書を書き換えることはありません。
文書を読んで答えるのは AI の側で、chaff はその前後で確かめる役です。
