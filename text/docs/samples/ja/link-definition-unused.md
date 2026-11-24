<!-- chaff-sample
rule: link-definition-unused
genre: docs/manual
file: onboarding.md
-->

# 使われないリンクの定義（`link-definition-unused`）

**こんな文書に:** 社内の手引き、README、入社の案内。行き先を「[名前]: URL」の行にまとめて末尾に置く Markdown の文書。

## 元の文章

```markdown chaff-before
# 入社の週にすること

初日に[社員の手引き][handbook]を読み、パソコンの設定を済ませてください。
初めての出張の前に、経費の精算システムのアカウントを情報システム部に頼んでください。

[handbook]: https://example.com/handbook
[expenses]: https://example.com/expenses
```

## chaff の指摘

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual onboarding.md

onboarding.md   docs/manual · 日本語   ジャンルは --genre から

─── 7 行目 ───────────────────────────────────────────────────

    [expenses]: https://example.com/expenses

  ⚠  使われないリンクの定義

     リンクの定義「expenses」を使うリンクがありません
     Markdown の参照の形のリンク（[資料][1]）は、文書のどこかの「[1]: URL」の行から行き先を取ります。どのリンクも呼ばない定義は、表示されず何もしません。リンクの文字を書き換えた、リンクを消した、名前を打ち間違えたときに残り、書いたはずのリンクが本文から消えていることを示します。同じ名前をもう一度、別の行き先で定義した行も、Markdown は最初の定義を使って黙って捨てます（markdownlint の MD053、remark-lint の no-unused-definitions・no-duplicate-definitions）。

     → 本文でそのリンクを使うつもりだったなら、リンクの名前を定義と同じにしてください（[資料][expenses]）。要らなくなった定義なら消してください。二度目の定義は、どちらの行き先が正しいかを決めて一つにします。

     このルールをゆるめる:  npx chaffjs relax link-definition-unused


────────────────────────────────────────────────────────────

  注意 1 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

## 直した文章

```markdown chaff-after
# 入社の週にすること

初日に[社員の手引き][handbook]を読み、パソコンの設定を済ませてください。
初めての出張の前に、[経費の精算システム][expenses]のアカウントを情報システム部に頼んでください。

[handbook]: https://example.com/handbook
[expenses]: https://example.com/expenses
```

## 直し方

文書の末尾に「expenses」の行き先を定義していますが、本文のどのリンクもそれを使っていません。
書いた人は「経費の精算システム」をリンクにするつもりで、リンクにし忘れました。読む人はシステムの場所を知る手立てがありません。
定義は画面に出ないので、リンクが抜けていることに書いた人も気づきません。

直した文章では、「経費の精算システム」を定義を使うリンクにしました。
わざと消したリンクの定義が残っていただけなら、定義のほうを消します。

## 設定

この規則は、指摘の重さだけが変わります。ふだんは「注意」として出し、`strict` で「エラー」、`relaxed` で「参考」になります。

```yaml chaff-settings
rules:
  link-definition-unused: relaxed
```

同じ行き先での二度目の定義、注の形（「[^1]: …」）、コメントとして書いた定義（「[//]: # (メモ)」）、定義だけの文書、引用の中の定義は指しません。
どのジャンルでも動きます。

```text chaff-explain
$ npx chaffjs explain link-definition-unused --genre docs/manual

  使われないリンクの定義   (link-definition-unused)

  Markdown の参照の形のリンク（[資料][1]）は、文書のどこかの「[1]: URL」の行から行き先を取ります。どのリンクも呼ばない定義は、表示されず何もしません。リンクの文字を書き換えた、リンクを消した、名前を打ち間違えたときに残り、書いたはずのリンクが本文から消えていることを示します。同じ名前をもう一度、別の行き先で定義した行も、Markdown は最初の定義を使って黙って捨てます（markdownlint の MD053、remark-lint の no-unused-definitions・no-duplicate-definitions）。

  直しかた: 本文でそのリンクを使うつもりだったなら、リンクの名前を定義と同じにしてください（[資料][名前]）。要らなくなった定義なら消してください。二度目の定義は、どちらの行き先が正しいかを決めて一つにします。

  書き直しの深さ: light（語と文を直す。構成と文体は残す）。chaff fix-plan --depth でこれより浅い深さを選ぶと、計画はこのルールを直さず、名前だけを挙げます。

  設定できる値（数える上限は無く、指摘の重さが変わります）:
    strict   エラー
  → normal   注意
    relaxed  参考
    off      見ない

  いまは normal です。

  変える:  npx chaffjs relax link-definition-unused --why "理由"
```

[見本の一覧へ](README.md)
