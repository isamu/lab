<!-- chaff-sample
rule: url-run-on
genre: business/email
file: mail.md
-->

# URL のすぐ後ろに字が続いている（`url-run-on`）

**こんな文書に:** 社内のメール、案内、チャットへの書き込み。URL のすぐ後ろに日本語を続けて書くと、リンクがそこまで伸びます。

## 元の文章

```markdown chaff-before
件名：年末調整の書類の出し方

社員のみなさま

お疲れさまです。人事課の吉田です。

今年の年末調整の書類は、紙ではなく、画面から出していただきます。
入力の画面は https://hr.example.jp/nenmatsuから開けます。
締め切りは、11月28日（金）です。

入力のしかたは、https://hr.example.jp/guide/nenmatsu.pdfにまとめました。

よろしくお願いします。
```

## chaff の指摘

```text chaff-output
$ npx chaffjs --no-guide --genre business/email mail.md

mail.md   business/email · 日本語   ジャンルは --genre から

─── 8 行目 ───────────────────────────────────────────────────

    https://hr.example.jp/nenmatsu

  ⚠  URL のすぐ後ろに字が続いている

     URL「https://hr.example.jp/nenmatsu」の直後に「か」が続いています。リンクがそこまで伸びます
     「https://example.jp/をご覧ください」のように、そのまま書いた URL の直後に空白を置かずに日本語や全角の記号（。」）など）が続くと、GitHub などの自動リンクや多くのメールソフトは空白が来るまでを URL と読みます。押すと存在しないページが開きます。ASCII でない字が続くときだけを指摘します。リンクの記法（[資料](https://…) と <https://…>）で書いたものと、コードの中は数えません。

     → URL の後ろに空白を入れるか、<https://…> または [説明](https://…) の形で書いてください。

     このルールをゆるめる:  npx chaffjs relax url-run-on


─── 11 行目 ──────────────────────────────────────────────────

    https://hr.example.jp/guide/nenmatsu.pdf

  ⚠  URL のすぐ後ろに字が続いている

     URL「https://hr.example.jp/guide/nenmatsu.pdf」の直後に「に」が続いています。リンクがそこまで伸びます
     「https://example.jp/をご覧ください」のように、そのまま書いた URL の直後に空白を置かずに日本語や全角の記号（。」）など）が続くと、GitHub などの自動リンクや多くのメールソフトは空白が来るまでを URL と読みます。押すと存在しないページが開きます。ASCII でない字が続くときだけを指摘します。リンクの記法（[資料](https://…) と <https://…>）で書いたものと、コードの中は数えません。

     → URL の後ろに空白を入れるか、<https://…> または [説明](https://…) の形で書いてください。

     このルールをゆるめる:  npx chaffjs relax url-run-on


────────────────────────────────────────────────────────────

  注意 2 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

## 直した文章

```markdown chaff-after
件名：年末調整の書類の出し方

社員のみなさま

お疲れさまです。人事課の吉田です。

今年の年末調整の書類は、紙ではなく、画面から出していただきます。
入力の画面は https://hr.example.jp/nenmatsu から開けます。
締め切りは、11月28日（金）です。

入力のしかたは、https://hr.example.jp/guide/nenmatsu.pdf にまとめました。

よろしくお願いします。
```

## 直し方

「https://hr.example.jp/nenmatsuから開けます」は、URL の直後に「から」が続いています。
多くのメールソフトやチャットの自動リンクは、空白が来るまでを URL と読みます。押すと「nenmatsuから」で終わる、存在しないページが開きます。手引きの PDF の URL も同じです。

直した文章では、二つの URL の後ろに空白を入れました。`<https://…>` や `[説明](https://…)` の形で書いても直ります。

## 設定

指摘の重さだけが変わります。ふだんは「注意」として出し、`strict` にすると「エラー」、`relaxed` にすると「参考」になります。

```yaml chaff-settings
rules:
  url-run-on: strict
```

リンクの記法で書いた URL、コードの中、空白や ASCII の記号が続く URL は指しません。

```text chaff-explain
$ npx chaffjs explain url-run-on --genre business/email

  URL のすぐ後ろに字が続いている   (url-run-on)

  「https://example.jp/をご覧ください」のように、そのまま書いた URL の直後に空白を置かずに日本語や全角の記号（。」）など）が続くと、GitHub などの自動リンクや多くのメールソフトは空白が来るまでを URL と読みます。押すと存在しないページが開きます。ASCII でない字が続くときだけを指摘します。リンクの記法（[資料](https://…) と <https://…>）で書いたものと、コードの中は数えません。

  直しかた: URL の後ろに空白を入れるか、<https://…> または [説明](https://…) の形で書いてください。

  設定できる値（数える上限は無く、指摘の重さが変わります）:
    strict   エラー
  → normal   注意
    relaxed  参考
    off      見ない

  いまは normal です。

  変える:  npx chaffjs relax url-run-on --why "理由"
```

[見本の一覧へ](README.md)
