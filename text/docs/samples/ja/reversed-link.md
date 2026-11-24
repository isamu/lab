<!-- chaff-sample
rule: reversed-link
genre: docs/manual
file: vpn.md
-->

# 前後が逆のリンク（`reversed-link`）

**こんな文書に:** 操作マニュアル、README、社内の手引き。リンクを手で打ち込む文書。

## 元の文章

```markdown chaff-before
# 自宅からつなぐ

会社を出る前に、VPN のソフトを入れてください。
パソコンごとの設定は(VPN の設定の手引き)[https://example.com/vpn-setup]にあります。
つながらなくなったら、ソフトを起動し直して、もう一度サインインしてください。
```

## chaff の指摘

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual vpn.md

vpn.md   docs/manual · 日本語   ジャンルは --genre から

─── 4 行目 ───────────────────────────────────────────────────

    (VPN の設定の手引き)[https://example.com/vpn-setup]

  ⚠  前後が逆のリンク

     「(VPN の設定の手引き)[https://example.com/vpn-setup]」は括弧が逆で、リンクになりません
     Markdown のリンクは「[字](URL)」と書きます。角括弧と丸括弧を逆にして「(字)[URL]」と書くとリンクにならず、括弧と URL がそのまま字として表示されます。読み手は押せないリンクと、むき出しの URL を見ることになります（markdownlint の MD011）。

     → 「[VPN の設定の手引き](https://example.com/vpn-setup)」と、字を角括弧に、URL を丸括弧に入れてください。

     このルールをゆるめる:  npx chaffjs relax reversed-link


─── 4 行目 ───────────────────────────────────────────────────

    https://example.com/vpn-setup]

  ⚠  URL のすぐ後ろに字が続いている

     URL「https://example.com/vpn-setup]」の直後に「に」が続いています。リンクがそこまで伸びます
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
# 自宅からつなぐ

会社を出る前に、VPN のソフトを入れてください。
パソコンごとの設定は[VPN の設定の手引き](https://example.com/vpn-setup)にあります。
つながらなくなったら、ソフトを起動し直して、もう一度サインインしてください。
```

## 直し方

書いた人は設定の手引きにリンクするつもりで、丸括弧を先に、角括弧を後に打ちました。
「(字)[URL]」は Markdown のリンクにならず、画面には括弧とむき出しの URL がそのまま出て、手引きを押して開けません。

直した文章では括弧を入れ替え、字を角括弧に、URL を丸括弧に入れました。

## 設定

この規則は、指摘の重さだけが変わります。ふだんは「注意」として出し、`strict` で「エラー」、`relaxed` で「参考」になります。

```yaml chaff-settings
rules:
  reversed-link: relaxed
```

角括弧の中が URL やパスでないもの（「(山田 2020)[3]」のような文献の番号）、注の印、コードと引用の中は指しません。
どのジャンルでも動きます。

```text chaff-explain
$ npx chaffjs explain reversed-link --genre docs/manual

  前後が逆のリンク   (reversed-link)

  Markdown のリンクは「[字](URL)」と書きます。角括弧と丸括弧を逆にして「(字)[URL]」と書くとリンクにならず、括弧と URL がそのまま字として表示されます。読み手は押せないリンクと、むき出しの URL を見ることになります（markdownlint の MD011）。

  直しかた: 「[字](URL)」と、字を角括弧に、URL を丸括弧に入れてください。

  書き直しの深さ: light（語と文を直す。構成と文体は残す）。chaff fix-plan --depth でこれより浅い深さを選ぶと、計画はこのルールを直さず、名前だけを挙げます。

  設定できる値（数える上限は無く、指摘の重さが変わります）:
    strict   エラー
  → normal   注意
    relaxed  参考
    off      見ない

  いまは normal です。

  変える:  npx chaffjs relax reversed-link --why "理由"
```

[見本の一覧へ](README.md)
