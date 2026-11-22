<!-- chaff-sample
rule: contact-variant
genre: business/press-release
file: notice.md
-->

# 連絡先の書き違い（`contact-variant`）

**こんな文書に:** 募集やお知らせ、問合せ先を何度も書く規約。申込先と問合せ先で同じメールアドレスを書くのに、片方だけハイフンが抜ける、という形がよくあります。

## 元の文章

```markdown chaff-before
# 子ども食堂のお手伝いを募集します

みなみ町の子ども食堂では、毎月第三土曜日の昼に、地域の子どもたちへ温かい昼ごはんを出しています。
料理を作る方、配膳をする方、片付けをする方を募集しています。一回だけのお手伝いでもかまいません。

## 申し込み

お名前と、手伝える月を書いて、12月10日までにメールでお送りください。

メールアドレス：otetsudai@minami-shokudo.example

## お問い合わせ

当日の流れや持ち物についてのご質問も、otetsudai@minamishokudo.example へどうぞ。
```

## chaff の指摘

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release notice.md

notice.md   business/press-release · 日本語   ジャンルは --genre から

─── 14 行目 ──────────────────────────────────────────────────

    otetsudai@minamishokudo.example へどうぞ。

  ⚠  連絡先の書き違い

     メールアドレス「otetsudai@minamishokudo.example」は、「otetsudai@minami-shokudo.example」の書き違いかもしれません
     問合せ先のメールアドレスや会社の住所は、本文の上と下、問合せ先と管轄の条のように何度も書かれます。一か所だけ「privacy@hibari-lab.example」が「privacy@hibarilab.example」に、「丸の内二丁目4番1号」が「丸の内二丁目1番4号」になっていると、読み手はどちらが正しいか分からず、届かない宛先に送ることもあります。メールアドレスは、ハイフンや点が一つ抜けたもの、どこか一語だけが一、二文字違うものを指します。住所は、住所を言う語（住所、本店所在地）の後ろに書いた、同じ町の住所どうしを比べ、番地の数字が入れ替わったもの、一つだけ違うもの、郵便番号だけが違うものを指します。

     → 正しい宛先を確かめて、もう一方を直してください。

     このルールをゆるめる:  npx chaffjs relax contact-variant


────────────────────────────────────────────────────────────

  注意 1 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

## 直した文章

```markdown chaff-after
# 子ども食堂のお手伝いを募集します

みなみ町の子ども食堂では、毎月第三土曜日の昼に、地域の子どもたちへ温かい昼ごはんを出しています。
料理を作る方、配膳をする方、片付けをする方を募集しています。一回だけのお手伝いでもかまいません。

## 申し込み

お名前と、手伝える月を書いて、12月10日までにメールでお送りください。

メールアドレス：otetsudai@minami-shokudo.example

## お問い合わせ

当日の流れや持ち物についてのご質問も、otetsudai@minami-shokudo.example へどうぞ。
```

## 直し方

申し込みのアドレスは「minami-shokudo」とハイフンでつないでいるのに、問い合わせのアドレスは「minamishokudo」です。片方だけ、ハイフンが抜けています。
抜けたほうへ送ったメールは届かないか、知らない誰かに届きます。送った人は返事を待ち続け、手伝いの申し出がそのまま失われます。

直した文章では、問い合わせのアドレスも「otetsudai@minami-shokudo.example」にしました。正しい宛先は、実際に受け取れるアドレスで確かめます。

## 設定

ふだんは「注意」として出します。`strict` にすると「エラー」になり、`off` にすると見なくなります。

```yaml chaff-settings
rules:
  contact-variant: strict
```

メールアドレスは、ハイフンや点が一つ抜けたもの、どこか一語だけが一、二文字違うものを指摘します。住所は、「住所」「本店所在地」のような語の後ろに書いた同じ町の住所どうしを比べ、番地の数字が入れ替わったもの、一つだけ違うもの、郵便番号だけが違うものを指摘します。
文学と、話した言葉を書き起こした記録のジャンルでは止めています。電話番号の入れ違いは、`phone-number-variant` が見ます。

```text chaff-explain
$ npx chaffjs explain contact-variant --genre business/press-release

  連絡先の書き違い   (contact-variant)

  問合せ先のメールアドレスや会社の住所は、本文の上と下、問合せ先と管轄の条のように何度も書かれます。一か所だけ「privacy@hibari-lab.example」が「privacy@hibarilab.example」に、「丸の内二丁目4番1号」が「丸の内二丁目1番4号」になっていると、読み手はどちらが正しいか分からず、届かない宛先に送ることもあります。メールアドレスは、ハイフンや点が一つ抜けたもの、どこか一語だけが一、二文字違うものを指します。住所は、住所を言う語（住所、本店所在地）の後ろに書いた、同じ町の住所どうしを比べ、番地の数字が入れ替わったもの、一つだけ違うもの、郵便番号だけが違うものを指します。

  直しかた: 正しい宛先を確かめて、もう一方を直してください。

  設定できる値（数える上限は無く、指摘の重さが変わります）:
    strict   エラー
  → normal   注意
    relaxed  注意
    off      見ない

  いまは normal です。

  変える:  npx chaffjs relax contact-variant --why "理由"
```

[見本の一覧へ](README.md)
