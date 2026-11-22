<!-- chaff-sample
rule: parameter-table-mismatch
genre: technical/readme
file: README.md
-->

# 引数の表とシグネチャが合わない（`parameter-table-mismatch`）

**こんな文書に:** API のリファレンス、ライブラリの README、社内の共通部品の説明書。引数の名前を変えたときに、シグネチャか引数の表の片方だけを直すと、どちらの名前で渡せばよいのか分からなくなります。

## 元の文章

````markdown chaff-before
# hizuke

日時を、決まった形の文字列にするライブラリです。

## formatDate

```ts
function formatDate(date: Date, pattern: string, timeZone = "Asia/Tokyo"): string
```

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `date` | Date | 書き出す日時 |
| `format` | string | 書き出す形（`yyyy-MM-dd` など） |
| `timeZone` | string | 時刻を合わせる地域 |
````

## chaff の指摘

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme README.md

README.md   technical/readme · 日本語   ジャンルは --genre から

─── 8 行目 ───────────────────────────────────────────────────

    pattern: string, timeZone = "Asia/Tokyo"): string

  ⚠  引数の表とシグネチャが合わない

     「formatDate」の引数の表とシグネチャで、「pattern」が片方にしかありません
     API リファレンスで、関数のシグネチャと、その下の引数の表が違う引数を並べていると、読み手はどちらが正しいか分からず、無い引数を渡したり、必要な引数を知らずに終わったりします。引数を足したり名前を変えたりしたときに、片方だけを直すと起きます。コードブロックがちょうど一つの関数を宣言し（function や def、または戻り値の型が付いたもの）、次の見出しかコードブロックより前に、最初の列の見出しが「引数」や「Parameter」の表があるとき、両者を比べます。表にだけある引数は表の行を、シグネチャにだけある引数はシグネチャを指します。

     → 実際の関数の引数を確かめて、表かシグネチャのどちらかを直してください。

     このルールをゆるめる:  npx chaffjs relax parameter-table-mismatch


─── 14 行目 ──────────────────────────────────────────────────

    format` | string | 書き出す形（`yyyy-MM-dd` など） |

  ⚠  引数の表とシグネチャが合わない

     「formatDate」の引数の表とシグネチャで、「format」が片方にしかありません
     API リファレンスで、関数のシグネチャと、その下の引数の表が違う引数を並べていると、読み手はどちらが正しいか分からず、無い引数を渡したり、必要な引数を知らずに終わったりします。引数を足したり名前を変えたりしたときに、片方だけを直すと起きます。コードブロックがちょうど一つの関数を宣言し（function や def、または戻り値の型が付いたもの）、次の見出しかコードブロックより前に、最初の列の見出しが「引数」や「Parameter」の表があるとき、両者を比べます。表にだけある引数は表の行を、シグネチャにだけある引数はシグネチャを指します。

     → 実際の関数の引数を確かめて、表かシグネチャのどちらかを直してください。

     このルールをゆるめる:  npx chaffjs relax parameter-table-mismatch


────────────────────────────────────────────────────────────

  注意 2 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

## 直した文章

````markdown chaff-after
# hizuke

日時を、決まった形の文字列にするライブラリです。

## formatDate

```ts
function formatDate(date: Date, pattern: string, timeZone = "Asia/Tokyo"): string
```

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `date` | Date | 書き出す日時 |
| `pattern` | string | 書き出す形（`yyyy-MM-dd` など） |
| `timeZone` | string | 時刻を合わせる地域 |
````

## 直し方

シグネチャの二つめの引数は `pattern` なのに、引数の表は `format` と書いています。
前の版では、この引数の名前が `format` でした。名前を `pattern` に変えたときに、シグネチャだけを直し、表を直し忘れていました。
読む人は、表を見て `{ format: "yyyy-MM-dd" }` のような名前で渡そうとしたり、エラーの意味を取り違えたりします。表にある引数とシグネチャにある引数のどちらが本物か、コードを読みに行くことになります。

直した文章では、表の名前を `pattern` に直しました。
chaff は、コードブロックがちょうど一つの関数を宣言し、その下に最初の列の見出しが「引数」の表があるとき、両者を比べます。表にだけある引数は表の行を、シグネチャにだけある引数はシグネチャを指します。
関数の呼び出しの例、二つ以上の関数を宣言したコードブロック、最初の列の見出しが「オプション」や「項目」の表は比べません。

## 設定

この規則は、指摘の重さだけが変わります。ふだんは「注意」として出し、`strict` にすると「誤り」、`relaxed` にすると「参考」になります。

```yaml chaff-settings
rules:
  parameter-table-mismatch: strict
```

リファレンスを公開する前に必ず止めたいなら `strict` にします。
Java の `String format(String text)` のように型を名前の前に書く宣言は読みません。技術の文書と説明書のジャンルで動き、契約・論文・文芸・スピーチでは、はじめから動きません。

```text chaff-explain
$ npx chaffjs explain parameter-table-mismatch --genre technical/readme

  引数の表とシグネチャが合わない   (parameter-table-mismatch)

  API リファレンスで、関数のシグネチャと、その下の引数の表が違う引数を並べていると、読み手はどちらが正しいか分からず、無い引数を渡したり、必要な引数を知らずに終わったりします。引数を足したり名前を変えたりしたときに、片方だけを直すと起きます。コードブロックがちょうど一つの関数を宣言し（function や def、または戻り値の型が付いたもの）、次の見出しかコードブロックより前に、最初の列の見出しが「引数」や「Parameter」の表があるとき、両者を比べます。表にだけある引数は表の行を、シグネチャにだけある引数はシグネチャを指します。

  直しかた: 実際の関数の引数を確かめて、表かシグネチャのどちらかを直してください。

  設定できる値（数える上限は無く、指摘の重さが変わります）:
    strict   エラー
  → normal   注意
    relaxed  参考
    off      見ない

  いまは normal です。

  変える:  npx chaffjs relax parameter-table-mismatch --why "理由"
```

[見本の一覧へ](README.md)
