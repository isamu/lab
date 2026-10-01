# chaff

文章の読みにくいところを見つける道具。**文章は書き換えません。** 直すのは書いた人です。

`lint` が布の繊維くずを名前にしているのと同じで、`chaff` は籾殻。取り除くべきものの名を負っています。

```bash
npx chaffjs article.md
```

インストールも、AI の利用登録も、言語の指定も要りません。

> chaff finds what makes writing hard to read — in Japanese and English — and never rewrites the text. On an
> English document it speaks English. Pick the kind of document (`--genre legal/contract`, `docs/manual`,
> `academic/paper`, …) and it checks it the way that kind is written. Guide, genres and rule reference:
> https://isamu.github.io/lab/en/

## 文書の種類を選ぶ

契約書・法令・マニュアル・論文・小説・発言録は、それぞれの書き方で書かれます。種類（ジャンル）を選ぶと、その書き方に合わせて見ます。設定は要りません。

```bash
npx chaffjs --genre legal/contract 契約書.md    この実行だけ、契約書として見る
npx chaffjs init --genre legal/contract         この場所の chaff.yaml に書く
npx chaffjs genres                              ジャンルの一覧と、それぞれ何向けか
```

| 群 | ジャンル |
| --- | --- |
| 技術文書 | `technical/spec` `technical/readme` |
| ブログ | `blog/tech`（既定） `blog/essay` `blog/owned-media` |
| ビジネス文書 | `business/proposal` `business/report` `business/email` `business/press-release` `business/meeting-notes` |
| 法務 | `legal/contract` `legal/statute` `legal/judgment` `legal/patent` |
| 説明書 | `docs/manual` `docs/faq` `docs/glossary` |
| 学術 | `academic/paper` |
| 文学 | `literature/fiction` `literature/essay` `literature/poetry` `literature/play` |
| 話し言葉 | `speech/address` `speech/transcript` |

ジャンルを決めていない文書が別の種類に見えるときは、画面がそう言います（「契約書・規約のようです。--genre legal/contract を試せます」）。

## 何を見つけるか

誤字脱字ではなく、文章の組み立てを見ます。

```
一文が長すぎて、読んでいるうちに主語を見失う
太字が多すぎて、どこも目立たなくなっている
見出しと同じことを、その直後の文が繰り返している
「近年、〜が注目されています」など、どの記事にも当てはまる書き出し
「いかがでしたか」で終わる、読者に何も残さない結び
```

## 指摘のされかた

1 件につき「引用 / 何が起きているか / なぜ問題か / どう直すか」の 4 つが出ます。

```
─── 41 行目 ──────────────────────────────

    ここで **重要** なのは **TTL** と **整合性** です。

  ⚠  太字の使いすぎ

     このセクションに太字が 6 箇所あります（2 箇所まで）
     太字は読者の目を止める道具です。多用すると、どこも目立たなくなります。

     → 本当に強調したい 1〜2 箇所だけ残して、ほかは普通の文にしてください

     このルールをゆるめる:  npx chaffjs relax bold-density
```

## 指摘されたら、道は 3 つ

| 道 | どんなとき | やること |
| --- | --- | --- |
| 直す | 指摘がもっともなとき | 文章を書き直す |
| この箇所だけ黙らせる | 指摘は正しいが、ここは意図的なとき | `<!-- stet: rule-id — 理由 -->` |
| ルールを変える | 自分たちの方針に合わないとき | `npx chaffjs relax rule-id --why "理由"` |

## 主なコマンド

```bash
npx chaffjs .                     この場所の Markdown を全部
npx chaffjs article.md --watch    保存のたびに、変わったところだけ出す
npx chaffjs init                  chaff.yaml を作る（端末ならジャンルを尋ねる）
npx chaffjs explain bold-density  ルールの意図と根拠を読む
npx chaffjs baseline docs/        既にある指摘を棚上げする
npx chaffjs suppressions docs/    stet で黙らせている指摘を数える
npx chaffjs rules --json          いまの設定を JSON で出す（AI に渡す用）
npx chaffjs tree contract.txt     文書を番地の付いた木にする（条・項・定義・参照）
npx chaffjs cite 原文 引用.json   引用が原文にあるかを確かめる
npx chaffjs compare 前.md 後.md   書き換えで事実（数・日付・URL・名前など）が落ちても足されてもいないかを確かめる
npx chaffjs facts 前.md           compare が照合する事実を一覧にする（書き直す前の控え）
npx chaffjs skill                 Claude Code の skill を入れる（--global でホームに）
```

設定は `strict` / `normal` / `relaxed` / `off` の 4 語から選びます。それで足りないときは上限を数で書けます（`max-sentence-length: 260`）。

## 言語

日本語と英語。言語は本文から自動で判定し、指摘の画面もその言語で出ます。アダプタ（`@chaffjs/lang-ja` / `@chaffjs/lang-en`）は同梱されているので、別に入れる必要はありません。

新しい言語のアダプタは誰でも出せます。公式は `@chaffjs/lang-<言語>`、第三者は `chaff-lang-<言語>` と名乗ってください（`@typescript-eslint/*` と `eslint-plugin-*` の関係と同じです）。chaff は公式、第三者の順に探して読みます。

## ドキュメント

- 手引きとルールの一覧: https://isamu.github.io/lab/ja/ （English: https://isamu.github.io/lab/en/）
- リポジトリ: https://github.com/isamu/lab/tree/main/text

MIT
