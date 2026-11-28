<!-- chaff-sample
rule: heading-command-missing
genre: docs/manual
file: usage.md
-->

# 見出しのコマンドやオプションが、その節のコードに無い（`heading-command-missing`）

**こんな文書に:** コマンドの使い方の説明書、CLI の README、社内ツールの手引き。オプションの名前を変えたときに、見出しかコード例の片方だけを直すと、どちらが今の名前なのか分からなくなります。

## 元の文章

````markdown chaff-before
# kura の使い方

kura は、指定したフォルダの控えを取るコマンドです。

## `--exclude`

控えに入れないファイルを、パターンで指定します。

```bash
kura backup --ignore "*.tmp" ~/Documents
```

## `--keep`

控えを何日分残すかを指定します。

```bash
kura backup --keep 30 ~/Documents
```
````

## chaff の指摘

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual usage.md

usage.md   docs/manual · 日本語   ジャンルは --genre から

─── 5 行目 ───────────────────────────────────────────────────

    ## `--exclude`

  ·  見出しのコマンドやオプションが、その節のコードに無い

     見出しの「--exclude」が、この節のコードにありません
     「## `--dry-run`」の節のコード例が「--dryrun」を使っていると、読み手はどちらが正しいか分かりません。コマンドやオプションの名前を変えたときに、見出しかコード例の片方だけを直すと起きます。見出しのコードの部分（`npm install`、`--force`、`init`）が、その節（次の同じ深さか浅い見出しまで）のコードブロックにもコードの部分にも無いとき指します。節にコードが一つも無ければ見ません。

     → 見出しとコード例のどちらが今の名前かを確かめて、もう一方を直してください。

     このルールをゆるめる:  npx chaffjs relax heading-command-missing


────────────────────────────────────────────────────────────

  参考 1 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

## 直した文章

````markdown chaff-after
# kura の使い方

kura は、指定したフォルダの控えを取るコマンドです。

## `--exclude`

控えに入れないファイルを、パターンで指定します。

```bash
kura backup --exclude "*.tmp" ~/Documents
```

## `--keep`

控えを何日分残すかを指定します。

```bash
kura backup --keep 30 ~/Documents
```
````

## 直し方

「`--exclude`」の節のコード例が、`--ignore` を使っています。
前の版のオプションは `--ignore` でした。版を上げて名前を `--exclude` に変えたとき、見出しだけを直し、コード例を直し忘れていました。
読む人はコード例をそのまま写して動かします。今の版では `--ignore` が無いので、エラーで止まるか、一時ファイルまで控えに入ってしまいます。

直した文章では、コード例を `--exclude` に直しました。
chaff は、見出しのコードの部分（`--exclude`、`init`、`npm install`）が、その節のコードブロックにもコードの部分にも無いとき指します。
節にコードが一つも無ければ見ません。`config.yaml` のようなファイル名を書いた見出しも見ません。`--force` は `--force-with-lease` の中にあっても、あったとは数えません。

## 設定

この規則は、指摘の重さだけが変わります。ふだんは「参考」として出し、`strict` にすると「注意」になります。

```yaml chaff-settings
rules:
  heading-command-missing: strict
```

コマンドの説明書を出す前に見落としたくないなら `strict` にします。技術の文書と説明書のジャンルで動き、契約・論文・文芸・スピーチでは、はじめから動きません。

```text chaff-explain
$ npx chaffjs explain heading-command-missing --genre docs/manual

  見出しのコマンドやオプションが、その節のコードに無い   (heading-command-missing)

  「## `--dry-run`」の節のコード例が「--dryrun」を使っていると、読み手はどちらが正しいか分かりません。コマンドやオプションの名前を変えたときに、見出しかコード例の片方だけを直すと起きます。見出しのコードの部分（`npm install`、`--force`、`init`）が、その節（次の同じ深さか浅い見出しまで）のコードブロックにもコードの部分にも無いとき指します。節にコードが一つも無ければ見ません。

  直しかた: 見出しとコード例のどちらが今の名前かを確かめて、もう一方を直してください。

  書き直しの深さ: light（語と文を直す。構成と文体は残す）。chaff fix-plan --depth でこれより浅い深さを選ぶと、計画はこのルールを直さず、名前だけを挙げます。

  設定できる値（数える上限は無く、指摘の重さが変わります）:
    strict   注意
  → normal   参考
    relaxed  参考
    off      見ない

  いまは normal です。

  変える:  npx chaffjs relax heading-command-missing --why "理由"
```

[見本の一覧へ](README.md)
