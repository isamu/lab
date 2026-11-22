<!-- chaff-sample
rule: default-value-mismatch
genre: technical/readme
file: README.md
-->

# 既定値を二通りに書いている（`default-value-mismatch`）

**こんな文書に:** ライブラリの README、API の説明書、設定の手引き。既定値を変えたときに、コードか説明の文の片方だけを直すと、指定しなかったときの動きが二通りに読めます。

## 元の文章

````markdown chaff-before
# listpage

一覧を、決まった件数ずつのページに分けるライブラリです。

## paginate

```ts
paginate(items: Item[], pageSize = 20): Item[][]
```

一覧を、`pageSize` 件ずつのページに分けて返します。
`pageSize` の既定値は 50 件です。
````

## chaff の指摘

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme README.md

README.md   technical/readme · 日本語   ジャンルは --genre から

─── 12 行目 ──────────────────────────────────────────────────

    pageSize` の既定値は 50 件です。

  ⚠  既定値を二通りに書いている

     「pageSize」の既定値を「50」と書いていますが、ほかの所では「20」です
     シグネチャが width = 72 なのに説明が「`width` の既定値は 80」だと、読み手は指定しなかったときの動きを読み違えます。既定値を変えたときに、コードか表か文のどれかだけを直すと起きます。宣言の引数の既定値（width = 72）、見出しが「既定値」の列の値、「`width` の既定値は」の後ろの値を集め、同じ名前の値がコード、表、文の順でいちばん確かなものと違うとき、違うほうを指します。

     → 実際の既定値を確かめて、違うほうを直してください。

     このルールをゆるめる:  npx chaffjs relax default-value-mismatch


────────────────────────────────────────────────────────────

  注意 1 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

## 直した文章

````markdown chaff-after
# listpage

一覧を、決まった件数ずつのページに分けるライブラリです。

## paginate

```ts
paginate(items: Item[], pageSize = 20): Item[][]
```

一覧を、`pageSize` 件ずつのページに分けて返します。
`pageSize` の既定値は 20 件です。
````

## 直し方

シグネチャは `pageSize = 20` なのに、説明の文は「既定値は 50 件」と書いています。
前の版では既定値が50件でした。版を上げたときにコードの既定値だけを20件に変え、説明の文を直し忘れていました。
読む人は、`pageSize` を書かずに呼べば50件ずつ返ると思って画面を作ります。1ページに20件しか出ず、どこが悪いのかを探して時間を使います。

直した文章では、説明の文の既定値を、コードと同じ20件に直しました。
chaff は、シグネチャの引数の既定値、見出しが「既定値」の表の列、「`pageSize` の既定値は」の後ろの値を集めて比べます。コード、表、文の順に確かなものとして、違うほうを指します。
呼び出しの例で渡した値（`paginate(items, 10)`）は既定値として読みません。

## 設定

この規則は、指摘の重さだけが変わります。ふだんは「注意」として出し、`strict` にすると「誤り」、`relaxed` にすると「参考」になります。

```yaml chaff-settings
rules:
  default-value-mismatch: strict
```

説明書を公開する前に必ず止めたいなら `strict` にします。
コードの印で囲んでいない名前や、既定値を言う語から離れた値は読みません。技術の文書と説明書のジャンルで動き、契約・論文・文芸・スピーチでは、はじめから動きません。

```text chaff-explain
$ npx chaffjs explain default-value-mismatch --genre technical/readme

  既定値を二通りに書いている   (default-value-mismatch)

  シグネチャが width = 72 なのに説明が「`width` の既定値は 80」だと、読み手は指定しなかったときの動きを読み違えます。既定値を変えたときに、コードか表か文のどれかだけを直すと起きます。宣言の引数の既定値（width = 72）、見出しが「既定値」の列の値、「`width` の既定値は」の後ろの値を集め、同じ名前の値がコード、表、文の順でいちばん確かなものと違うとき、違うほうを指します。

  直しかた: 実際の既定値を確かめて、違うほうを直してください。

  設定できる値（数える上限は無く、指摘の重さが変わります）:
    strict   エラー
  → normal   注意
    relaxed  参考
    off      見ない

  いまは normal です。

  変える:  npx chaffjs relax default-value-mismatch --why "理由"
```

[見本の一覧へ](README.md)
