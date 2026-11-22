<!-- chaff-sample
rule: deprecated-option-used
genre: technical/readme
file: README.md
-->

# 非推奨と書いた名前をコード例で使っている（`deprecated-option-used`）

**こんな文書に:** ライブラリの README、SDK の説明書、移行の手引き。オプションを非推奨にしたとき、説明の文だけを直してコード例を直し忘れると、読む人は古い書き方を写して覚えます。

## 元の文章

````markdown chaff-before
# 注文 API の SDK

## つなぎ方

`createClient` に、API の住所と再送の回数を渡します。

`retry` オプションは非推奨です。代わりに `maxRetries` を使ってください。

```js
const client = createClient({ endpoint: "https://api.example.com", retry: 3 });
```
````

## chaff の指摘

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme README.md

README.md   technical/readme · 日本語   ジャンルは --genre から

─── 10 行目 ──────────────────────────────────────────────────

    retry: 3 });

  ⚠  非推奨と書いた名前をコード例で使っている

     非推奨と書いた「retry」を、コード例で使っています
     「`indent` は非推奨です」と書いた同じ文書のコード例が `{ indent: 2 }` を使っていると、読み手は例をそのまま写して、やがて動かなくなる書き方を覚えます。オプションを非推奨にしたときに、説明だけを直して例を直し忘れると起きます。文の中で「非推奨」「deprecated」にいちばん近いコードの名前と、それらの語のある表の行の最初の列の名前を非推奨の名前として読み、コードブロックの中でその名前をキー（indent:）、引数（indent=）、フラグ（--indent）として使っている行を指します。

     → 例を、非推奨の名前の代わりになるものを使う書き方に直してください。古い書き方を見せる例なら、その行に非推奨とコメントしてください。

     このルールをゆるめる:  npx chaffjs relax deprecated-option-used


────────────────────────────────────────────────────────────

  注意 1 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

## 直した文章

````markdown chaff-after
# 注文 API の SDK

## つなぎ方

`createClient` に、API の住所と再送の回数を渡します。

`retry` オプションは非推奨です。代わりに `maxRetries` を使ってください。

```js
const client = createClient({ endpoint: "https://api.example.com", maxRetries: 3 });
```
````

## 直し方

説明の文は「`retry` は非推奨です」と書いているのに、すぐ下のコード例が `retry: 3` を使っています。
`maxRetries` を足したときに、文だけを書き足して、コード例を直し忘れていました。
読む人の多くは、文を読まずにコード例を写します。写したコードは今は動きますが、次の大きな版で `retry` が消えると、再送をしないまま静かに失敗するようになります。

直した文章では、コード例を `maxRetries: 3` に直しました。
chaff は、文の中で「非推奨」「deprecated」にいちばん近いコードの名前を非推奨の名前として読み、コードブロックの中でそれをキー（`retry:`）、引数（`retry=`）、フラグ（`--retry`）として使っている行を指します。
古い書き方を見せるための例なら、その行のコメントに「非推奨」と書いておけば指摘しません。

## 設定

この規則は、指摘の重さだけが変わります。ふだんは「注意」として出し、`strict` にすると「誤り」、`relaxed` にすると「参考」になります。

```yaml chaff-settings
rules:
  deprecated-option-used: strict
```

説明書を公開する前に必ず止めたいなら `strict` にします。
`interface` や `class` で API を宣言するコードブロックと、「非推奨ではない」のように打ち消した文は見ません。技術の文書と説明書のジャンルで動き、契約・論文・文芸・スピーチでは、はじめから動きません。

```text chaff-explain
$ npx chaffjs explain deprecated-option-used --genre technical/readme

  非推奨と書いた名前をコード例で使っている   (deprecated-option-used)

  「`indent` は非推奨です」と書いた同じ文書のコード例が `{ indent: 2 }` を使っていると、読み手は例をそのまま写して、やがて動かなくなる書き方を覚えます。オプションを非推奨にしたときに、説明だけを直して例を直し忘れると起きます。文の中で「非推奨」「deprecated」にいちばん近いコードの名前と、それらの語のある表の行の最初の列の名前を非推奨の名前として読み、コードブロックの中でその名前をキー（indent:）、引数（indent=）、フラグ（--indent）として使っている行を指します。

  直しかた: 例を、非推奨の名前の代わりになるものを使う書き方に直してください。古い書き方を見せる例なら、その行に非推奨とコメントしてください。

  設定できる値（数える上限は無く、指摘の重さが変わります）:
    strict   エラー
  → normal   注意
    relaxed  参考
    off      見ない

  いまは normal です。

  変える:  npx chaffjs relax deprecated-option-used --why "理由"
```

[見本の一覧へ](README.md)
