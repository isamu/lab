<!-- chaff-sample
rule: link-text-url-mismatch
genre: business/email
file: mail.md
-->

# リンクの言葉の URL と行き先が違う（`link-text-url-mismatch`）

**こんな文書に:** 社内の案内メール、手引き、お知らせのページ。URL を書き換えたときに、リンクの言葉か行き先の片方だけが古いまま残ります。

## 元の文章

```markdown chaff-before
件名：経費精算のページの移転について

社員のみなさま

お疲れさまです。経理課の大野です。

経費精算のページを、新しい社内ポータルに移しました。
今月からは、[https://portal.example.jp/expense](https://old-intra.example.jp/keihi) から申請してください。
古いページは、12月26日（金）に閉じます。

使い方は、ポータルの「経費精算の手引き」にまとめてあります。

よろしくお願いします。
```

## chaff の指摘

```text chaff-output
$ npx chaffjs --no-guide --genre business/email mail.md

mail.md   business/email · 日本語   ジャンルは --genre から

─── 8 行目 ───────────────────────────────────────────────────

    [https://portal.example.jp/expense](https://old-intra.example.jp/keihi)

  ⚠  リンクの言葉の URL と行き先が違う

     リンクの言葉は「portal.example.jp」ですが、行き先は「old-intra.example.jp」です
     「[https://example.com/guide](https://other.example/page)」のように、リンクの言葉が URL で、その URL と実際の行き先のサイトが違うリンクです。読み手は見えている URL に行くつもりで押し、別のサイトに着きます。URL を書き換えたときに片方だけ直した跡であることが多く、なりすましの手口と同じ形でもあります。サイト（ホスト）が同じでも、見えているパスが行き先のパスの頭でなければ（[github.com/acme/handbook](https://github.com/handbook)）、別のページなので指します。

     → 言葉と行き先のどちらが正しいかを確かめ、もう一方を合わせてください。行き先の名前を言葉にすると、この食い違いは起きません（[導入の手引き](https://…)）。

     このルールをゆるめる:  npx chaffjs relax link-text-url-mismatch


────────────────────────────────────────────────────────────

  注意 1 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

## 直した文章

```markdown chaff-after
件名：経費精算のページの移転について

社員のみなさま

お疲れさまです。経理課の大野です。

経費精算のページを、新しい社内ポータルに移しました。
今月からは、[https://portal.example.jp/expense](https://portal.example.jp/expense) から申請してください。
古いページは、12月26日（金）に閉じます。

使い方は、ポータルの「経費精算の手引き」にまとめてあります。

よろしくお願いします。
```

## 直し方

リンクの言葉は新しい「portal.example.jp」の URL ですが、押すと古い「old-intra.example.jp」のページに行きます。前の案内を写して、見えている URL だけを書き換えた跡です。
読む人は新しいページに行くつもりで押し、12月に閉じる古いページで申請してしまいます。見える URL と行き先が違うリンクは、なりすましのメールと同じ形でもあり、読み手を不安にさせます。

直した文章では、行き先を、言葉と同じ新しい URL に合わせました。
リンクの言葉を「経費精算のページ」のような名前にすれば、この食い違いはそもそも起きません。

## 設定

指摘の重さだけが変わります。ふだんは「注意」として出し、`strict` にすると「エラー」、`relaxed` にすると「参考」になります。

```yaml chaff-settings
rules:
  link-text-url-mismatch: strict
```

同じサイトの URL を短く見せたもの、言葉が URL でないリンク、行き先が相対パスのリンクは指しません。www. の有無と大文字小文字は同じと読みます。

```text chaff-explain
$ npx chaffjs explain link-text-url-mismatch --genre business/email

  リンクの言葉の URL と行き先が違う   (link-text-url-mismatch)

  「[https://example.com/guide](https://other.example/page)」のように、リンクの言葉が URL で、その URL と実際の行き先のサイトが違うリンクです。読み手は見えている URL に行くつもりで押し、別のサイトに着きます。URL を書き換えたときに片方だけ直した跡であることが多く、なりすましの手口と同じ形でもあります。サイト（ホスト）が同じでも、見えているパスが行き先のパスの頭でなければ（[github.com/acme/handbook](https://github.com/handbook)）、別のページなので指します。

  直しかた: 言葉と行き先のどちらが正しいかを確かめ、もう一方を合わせてください。行き先の名前を言葉にすると、この食い違いは起きません（[導入の手引き](https://…)）。

  書き直しの深さ: light（語と文を直す。構成と文体は残す）。chaff fix-plan --depth でこれより浅い深さを選ぶと、計画はこのルールを直さず、名前だけを挙げます。

  設定できる値（数える上限は無く、指摘の重さが変わります）:
    strict   エラー
  → normal   注意
    relaxed  参考
    off      見ない

  いまは normal です。

  変える:  npx chaffjs relax link-text-url-mismatch --why "理由"
```

[見本の一覧へ](README.md)
