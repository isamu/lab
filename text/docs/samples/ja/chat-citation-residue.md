<!-- chaff-sample
rule: chat-citation-residue
genre: business/report
file: report.md
-->

# チャットの出典の名残（`chat-citation-residue`）

**こんな文書に:** 調べものの報告、社内の資料、ブログ。チャットの答えを下書きに貼ると、リンクの末尾や文の後ろに印が残ります。

## 元の文章

```markdown chaff-before
# 在宅勤務の通信費の調べ

総務課の西村です。来期から在宅勤務の通信費を手当として出すにあたり、決め方を調べました。

通信費のうち業務に使った分は、給与として課税しなくてよいとされています（[国税庁の手引き](https://www.nta.go.jp/publication/pamph/pdf/0020012-080.pdf?utm_source=chatgpt.com)）。
業務に使った分の割合は、在宅で働いた日数から計算します。

月の上限は、3,000円から5,000円の間に置く会社が多いようです。:contentReference[oaicite:2]{index=2}
```

## chaff の指摘

```text chaff-output
$ npx chaffjs --no-guide --genre business/report report.md

report.md   business/report · 日本語   ジャンルは --genre から

─── 5 行目 ───────────────────────────────────────────────────

    utm_source=chatgpt.com

  ⚠  チャットの出典の名残

     「utm_source=chatgpt.com」はチャットの答えの名残です
     「?utm_source=chatgpt.com」の付いたリンクや「:contentReference[oaicite:0]」は、チャットの答えを貼ったときに残る印です。文体の好みではなく、貼った後に確かめていない印です。リンク先が本当にその記述の出典なのかも、確かめられていません。

     → リンクを開いて、その記述の出典になっているか確かめてください。出典なら、末尾の「?utm_source=…」を消してリンクを残します。出典の印（oaicite、contentReference）は消します。

     このルールをゆるめる:  npx chaffjs relax chat-citation-residue


─── 8 行目 ───────────────────────────────────────────────────

    contentReference[

  ⚠  チャットの出典の名残

     「contentReference[」はチャットの答えの名残です
     「?utm_source=chatgpt.com」の付いたリンクや「:contentReference[oaicite:0]」は、チャットの答えを貼ったときに残る印です。文体の好みではなく、貼った後に確かめていない印です。リンク先が本当にその記述の出典なのかも、確かめられていません。

     → リンクを開いて、その記述の出典になっているか確かめてください。出典なら、末尾の「?utm_source=…」を消してリンクを残します。出典の印（oaicite、contentReference）は消します。

     このルールをゆるめる:  npx chaffjs relax chat-citation-residue


─── 8 行目 ───────────────────────────────────────────────────

    oaicite

  ⚠  チャットの出典の名残

     「oaicite」はチャットの答えの名残です
     「?utm_source=chatgpt.com」の付いたリンクや「:contentReference[oaicite:0]」は、チャットの答えを貼ったときに残る印です。文体の好みではなく、貼った後に確かめていない印です。リンク先が本当にその記述の出典なのかも、確かめられていません。

     → リンクを開いて、その記述の出典になっているか確かめてください。出典なら、末尾の「?utm_source=…」を消してリンクを残します。出典の印（oaicite、contentReference）は消します。

     このルールをゆるめる:  npx chaffjs relax chat-citation-residue


────────────────────────────────────────────────────────────

  注意 3 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

## 直した文章

```markdown chaff-after
# 在宅勤務の通信費の調べ

総務課の西村です。来期から在宅勤務の通信費を手当として出すにあたり、決め方を調べました。

通信費のうち業務に使った分は、給与として課税しなくてよいとされています（[国税庁の手引き](https://www.nta.go.jp/publication/pamph/pdf/0020012-080.pdf)）。
業務に使った分の割合は、在宅で働いた日数から計算します。

月の上限は、取引先の3社に聞いたところ、どこも3,000円から5,000円の間でした。
```

## 直し方

「?utm_source=chatgpt.com」はリンクの末尾に、「:contentReference[oaicite:2]{index=2}」は文の後ろに残った、チャットの答えの印です。
読み手には、答えを貼っただけで、出典を開いていないように見えます。報告を受けた人は、上限の金額がどこから来たのかを確かめられません。
chaff の画面では、文の後ろの一つの印が、「contentReference[」と「oaicite」の二つの指摘として出ています。

直した文章では、国税庁の手引きのリンクを開き、その文の出典になっていることを確かめてから、末尾の「?utm_source=chatgpt.com」だけを消しました。
上限の金額の文には出典が無かったので、取引先に聞いて確かめた結果に書き換え、印を消しました。印だけを消して、確かめていない数字を残しても、直したことにはなりません。

## 設定

名残の印が1個あれば指摘します。`relaxed` にすると、2個からです。

```yaml chaff-settings
rules:
  chat-citation-residue: relaxed
```

コードの中（`?utm_source=chatgpt.com` と書いて説明している所）は数えません。utm_source でも、チャット以外の値（qiita、twitter）は数えません。

```text chaff-explain
$ npx chaffjs explain chat-citation-residue --genre business/report

  チャットの出典の名残   (chat-citation-residue)

  「?utm_source=chatgpt.com」の付いたリンクや「:contentReference[oaicite:0]」は、チャットの答えを貼ったときに残る印です。文体の好みではなく、貼った後に確かめていない印です。リンク先が本当にその記述の出典なのかも、確かめられていません。

  直しかた: リンクを開いて、その記述の出典になっているか確かめてください。出典なら、末尾の「?utm_source=…」を消してリンクを残します。出典の印（oaicite、contentReference）は消します。

  書き直しの深さ: light（語と文を直す。構成と文体は残す）。chaff fix-plan --depth でこれより浅い深さを選ぶと、計画はこのルールを直さず、名前だけを挙げます。

  設定できる値:
    strict   名残の印が 1 個あれば指摘
  → normal   名残の印が 1 個あれば指摘
    relaxed  名残の印が 2 個あれば指摘
    off      見ない

  いまは normal です。

  変える:  npx chaffjs relax chat-citation-residue --why "理由"
```

[見本の一覧へ](README.md)
