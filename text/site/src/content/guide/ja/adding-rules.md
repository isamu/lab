# ルールを足す：AI やエンジニアに頼むとき

チームの書き方の決まりを、chaff が確かめられる形にする方法をまとめました。
AI やエンジニアに頼むときは、このページをそのまま渡せます。
道は 4 つあり、上から順にやさしく、下ほど細かいことができます。

## 4 つの道

| 道 | 向いているとき | 書く場所 | 使える時期 |
| --- | --- | --- | --- |
| 組み込みルールの設定を変える | 既にあるルールで足りる（上限、表記の組、社内用語、必須の見出し） | `chaff.yaml` | いま |
| 語や正規表現のルール | 決まった語句や文字の並びに、チームの言葉で指摘を付けたい（「弊社」を社外向けに使わない、など） | `chaff.yaml` の `custom_rules` | 次のリリース |
| 形態素解析のルール | 品詞や活用で決まる書き方（名詞のあとの「する」など） | `chaff.yaml` の `custom_rules` | 次のリリース |
| Node の関数のルール | 数える・比べるなど、上の 3 つで書けないもの | `.js` のファイル | その後のリリース |

まず、既にあるルールで足りないかを確かめます。
どんなルールがあるかは、[リファレンス](./reference) に例と一緒に並べてあります。
端末では、次のコマンドで一覧が出ます。

```bash
npx chaffjs rules          ルールの一覧を、グループごとに表で出す
npx chaffjs rules --json   同じ一覧を、AI が読む形（JSON）で出す
```

## 書き方の決まりから chaff.yaml を作る

AI に頼むときの手順です。AI には `npx chaffjs rules --json` の出力を読ませます。
この出力には、ルールごとに、見つけるもの（`summary`）、段階の意味（`level_meaning`）、
例、ジャンルごとの動き（`genres`）が入っています。推測でルールの名前や数を書かせないためです。

| 順番 | AI がすること |
| --- | --- |
| 1 | チームの決まりを、一つずつに分けて読む |
| 2 | 決まりごとに、`summary` と `level_meaning` が合うルールを選ぶ。数の決まりは、段階の数と比べて段階を選ぶか、数をそのまま書く |
| 3 | 文書の種類が分かれば `genre` を決め、`genres` でそのジャンルで動くかを確かめる |
| 4 | 表記の組は `prefer`、社内用語は `jargon`、必須の見出しは `required_sections` に書く |
| 5 | 既定と同じものは書かない。書いたら `explain` と、決まりに沿った短い見本で確かめる |

同じ手順は、`rules --json` の `how_to_write_settings_from_a_style_note` にも入っています。
AI に渡すのは、JSON だけでも足ります。

## 例：「です・ます、1文80字まで」

技術資料の決まりが「です・ます、1文80字まで」だとします。
`rules --json` で `max-sentence-length` を見ると、次のように出ます（一部）。

```json
{
  "id": "max-sentence-length",
  "summary": { "ja": "読み終える前に主語を見失うほど長い一文" },
  "level_meaning": { "ja": "一文 {limit} 字まで" },
  "levels": { "strict": 70, "normal": 100, "relaxed": 140 }
}
```

80 字はどの段階とも違うので、数をそのまま書きます。
「です・ます」は `no-mixed-desumasu` が見ます。
ただし、このルールは どちらの調子が正しいかを決めず、混ざった文だけを指します。
全部を だ・である で書いた文書は指しません。この違いは、チームに伝えておきます。

```yaml
language: ja
genre: technical/spec

rules:
  # 1文80字まで
  max-sentence-length: 80
  # です・ます（だ・である が混ざったら指摘する）
  no-mixed-desumasu: normal
```

決まりに沿わない見本を一つ作って、かけてみます。実際の出力です。

```
$ npx chaffjs sample.md --compact

sample.md   technical/spec · 日本語   ジャンルはchaff.yamlから

  3:1     warning この文は 84 文字あります（80 文字まで）
                  max-sentence-length
  5:31    warning この文だけ他と文末の調子が違います（文書の中で 1 文）
                  no-mixed-desumasu
```

どちらの決まりも指摘されたので、設定が効いています。
指摘が出ないときは、`npx chaffjs rules` の表で、そのルールがいま `off` になっていないかを見ます。

## 組み込みルールの設定を変える

いちばんやさしい道です。書くのは `chaff.yaml` だけで、chaff のコードには触りません。

| 変えたいこと | 書き方 |
| --- | --- |
| ルールの強さ | `rules` に `strict` `normal` `relaxed` `off` のどれかを書く |
| 上限の数 | `rules` に数を書く（`max-sentence-length: 80`） |
| 試験中のルールを動かす | `rules` に段階を書く（`doubled-word: normal`） |
| 表記を揃える | `prefer` に「使わない書き方: 使う書き方」の組を書く |
| 社内用語を指す | `jargon` に語を並べる |
| 必須の見出し | `required_sections` に見出しを並べる |

書き方の細かいところは [設定](./configuration) にあります。
書いたあとは `npx chaffjs rules` の表で、そのルールがいまどの段階で動くかを確かめます。

## chaff 本体にルールを足す

どのチームにも役立つルールは、chaff 本体に足せます。
chaff の決まりで、ルールは機械で決まるものだけです。意味を読まないと決まらないものは、`chaff test` の側に置きます。
足すときに書くものは、次のとおりです。

| 書くもの | 場所 | 中身 |
| --- | --- | --- |
| ルールの定義 | `packages/chaff/rules/<id>.yaml` | 名前・理由・指摘の文・直し方・段階を日本語と英語で。読み手向けの `group` `summary` `example` `not_flagged` `level_meaning` も書く |
| 見つける処理 | `packages/chaff/src/detectors/` | 文書を受け取って指摘を返す関数。`detectors/index.ts` に名前で登録する |
| 語の一覧 | `packages/lang-ja/lexicons/` と `packages/lang-en/lexicons/` | 語の一覧で見つけるルールだけ。言語ごとに書く |
| テスト | `test/test_<id>.ts` | 指摘すべき例と、指摘してはいけない例の両方 |
| 見本への仕込み | `scripts/bench-mutations*.ts` と `test/fixtures/bench/plants.yaml` | きれいな見本に誤りを一つ入れて、見つかるかを測る。仕込めないときは理由を書く |
| ChangeLog | `docs/ChangeLog.md` の `Unreleased` | 何が見つかるようになったか |

ルールの定義に読み手向けの欄が欠けていると、`yarn test` が止まります。
`example` の `before` が指摘されないとき、`after` が指摘されるときも止まります。
リファレンスのページに、動かない例が載らないためです。

最後に、実際の文書で確かめます。

```bash
yarn test     テストをすべて動かす
yarn bench    見本に仕込んだ誤りを、ルールが見つけるかを測る
yarn corpus   集めた実際の文書にかけて、corpus/expected.txt からの増減を見る
```

`yarn corpus` で増えた指摘は、一つずつ読みます。誤った指摘なら、その形を例にしてテストに足し、直します。
増えた指摘が正しいと確かめたら、`yarn corpus --update` で `corpus/expected.txt` を更新します。
見本の結果も同じで、`yarn bench --update` で `test/fixtures/bench/expected.txt` を更新します。
