<!-- chaff-sample
rule: code-fence-language-mix
genre: technical/readme
file: README.md
-->

# 言語名の無いコードブロックが混ざっている（`code-fence-language-mix`）

**こんな文書に:** README、導入の手引き、技術記事。あとから手順を一つ足したとき、その手順のコードブロックにだけ言語名を付け忘れることがあります。

## 元の文章

````markdown chaff-before
# 在庫通知ツール

在庫が少なくなった商品を、毎朝チャットに知らせる小さな道具です。

## 入れ方

```bash
git clone https://example.com/stock-notify.git
cd stock-notify
yarn install
```

## 設定

`config.json` に、知らせる先と、少ないと見なす数を書きます。

```json
{ "channel": "#warehouse", "threshold": 10 }
```

## 動かし方

```
yarn start --dry-run
```

`--dry-run` を付けると、知らせずに結果だけを画面に出します。
````

## chaff の指摘

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme README.md

README.md   technical/readme · 日本語   ジャンルは --genre から

─── 23 行目 ──────────────────────────────────────────────────

    ```

  ·  言語名の無いコードブロックが混ざっている

     このコードブロックだけ言語名がありません（言語名のあるブロック 2 個）
     コードブロックに言語名（```bash、```json）を付けると、読み手の画面で色が付き、何の言語かがひと目で分かります。ほとんどのブロックに付けているのに一部だけ無いと、そのブロックだけ色が付かず、付け忘れに見えます。どちらに揃えるかは決めず、少ないほうを指します（markdownlint の MD040 は、すべてのブロックに言語名を求めます）。

     → 「```」の後ろに言語名を書いてください。出力や平文なら「text」と書きます。

     このルールをゆるめる:  npx chaffjs relax code-fence-language-mix


────────────────────────────────────────────────────────────

  参考 1 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

## 直した文章

````markdown chaff-after
# 在庫通知ツール

在庫が少なくなった商品を、毎朝チャットに知らせる小さな道具です。

## 入れ方

```bash
git clone https://example.com/stock-notify.git
cd stock-notify
yarn install
```

## 設定

`config.json` に、知らせる先と、少ないと見なす数を書きます。

```json
{ "channel": "#warehouse", "threshold": 10 }
```

## 動かし方

```bash
yarn start --dry-run
```

`--dry-run` を付けると、知らせずに結果だけを画面に出します。
````

## 直し方

この README のコードブロックには、「bash」「json」と言語名が付いています。「動かし方」のブロックだけ、言語名がありません。
画面で読むと、そこだけ色が付かず、命令なのか画面に出る結果なのかがひと目で分かりません。

打ち込む命令なので、ほかと同じ「bash」を付けました。
画面に出る結果や平文のブロックなら「text」と書きます。
chaff は、言語名を付けるかどうかは決めません。文書の中で少ないほうを指します。

## 設定

言語名の無いブロックが少しだけのとき、付け忘れと読んで指摘します。多いときや、言語名のあるブロックより多いときは、使い分けていると読みます。

```yaml chaff-settings
rules:
  code-fence-language-mix: relaxed
```

`relaxed` にすると、言語名の無いブロックが1個だけのときに指摘します。`strict` にすると、もう少し多くても指摘します。見たくなければ `off` にします。
契約や法令、論文、文芸、講演のジャンルでは、はじめから動きません。Markdown の文書だけを見ます。

```text chaff-explain
$ npx chaffjs explain code-fence-language-mix --genre technical/readme

  言語名の無いコードブロックが混ざっている   (code-fence-language-mix)

  コードブロックに言語名（```bash、```json）を付けると、読み手の画面で色が付き、何の言語かがひと目で分かります。ほとんどのブロックに付けているのに一部だけ無いと、そのブロックだけ色が付かず、付け忘れに見えます。どちらに揃えるかは決めず、少ないほうを指します（markdownlint の MD040 は、すべてのブロックに言語名を求めます）。

  直しかた: 「```」の後ろに言語名を書いてください。出力や平文なら「text」と書きます。

  書き直しの深さ: light（語と文を直す。構成と文体は残す）。chaff fix-plan --depth でこれより浅い深さを選ぶと、計画はこのルールを直さず、名前だけを挙げます。

  設定できる値:
    strict   言語名の無いブロックが 3 個以下で、ある方より少ないとき指摘
  → normal   言語名の無いブロックが 2 個以下で、ある方より少ないとき指摘
    relaxed  言語名の無いブロックが 1 個以下で、ある方より少ないとき指摘
    off      見ない

  いまは normal です。

  変える:  npx chaffjs relax code-fence-language-mix --why "理由"
```

[見本の一覧へ](README.md)
