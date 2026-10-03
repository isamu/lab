# CI

CI で chaff をかけると、指摘が PR の変更行に出ます。
ログの中の指摘は読みに行かないと見えませんが、行の上の指摘は書いた本人の目の前にあります。
このページでは、GitHub の code scanning に指摘を上げる手順と、既にある文書に入れるときの棚上げを説明します。

## 指摘を SARIF で書き出す

`--sarif` を付けると、指摘を SARIF 2.1.0 の形式でファイルに書き出します。
SARIF は、検査の結果を CI に渡すための決まった形式です。

```
$ npx chaffjs . --sarif report/chaff.sarif

  SARIF を書きました: report/chaff.sarif（1 件）
…
```

この下に、いつもの画面の出力も続けて出ます。
画面の読み方は [はじめかた](./getting-started) にあります。

## GitHub の PR の行に出す

書き出した SARIF を、`github/codeql-action/upload-sarif@v4` で GitHub の code scanning に上げます。
workflow の例は次のとおりです。

```yaml
name: chaff

on: pull_request

permissions:
  contents: read
  security-events: write

jobs:
  prose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npx -y chaffjs . --sarif report/chaff.sarif
      - name: Upload SARIF to Code Scanning
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: report/chaff.sarif
          category: chaff-prose
```

code scanning に上げるには `security-events: write` の権限が要るので、`permissions` に書いています。
`category` は、ほかの検査の結果と分けるための名前です。

## 指摘を開くと直しかたまで読める

chaff は、指摘と一緒に「なぜ直すのか」と「どう直すのか」も上げます。
画面に出る理由と「→ 直しかた」が、そのまま PR の指摘に付きます。
たとえば一文が長すぎるときは、次のように上がります。

| 項目 | 中身 |
| --- | --- |
| 見出し | 一文が長すぎる |
| 本文 | この文は 131 文字あります（100 文字まで） |
| なぜ直すのか | 長い文は、読んでいるうちに主語を見失います。 |
| どう直すのか | 接続助詞のところで 2 文に割ってください。それだけで読めるようになります。 |

問題を指すだけで直しかたを言わないと、書いた人はどうしてよいか分からないからです。

## 既にある文書に入れる

文書がたくさんある repo に入れると、最初に大量の指摘が出ます。
全部直してから始めることはできないので、`baseline` でいまある指摘を棚上げします。

```
$ npx chaffjs baseline docs/

  1 ファイルを走査しました。

  1 件の指摘を .chaff-baseline.json に記録しました。
  以後、これらは報告されません。新しく増えたものだけが出ます。

  .chaff-baseline.json を commit してください。
```

以後は、棚上げしたものは報告されず、新しく増えたものだけが出ます。
`.chaff-baseline.json` を commit すれば、チーム全員が同じ地点から始められます。

## 棚上げが剥がれない理由

棚上げは、行番号ではなく内容で見分けます。
そのため、前後に段落を足しても棚上げは剥がれません。

棚上げした分も見たいときは、`--show-baseline` を付けます。
出力の例は [コマンド](./commands) にあります。
