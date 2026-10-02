# chaff

chaff は、文書の読みにくいところと、機械で確かめられる誤りを見つける道具です。日本語と英語の文書を読み、同じ文章なら何度かけても同じ結果を出します。
文章は書き換えません。直すのは書いた人です。
`lint` が布の繊維くずを名前にしているのと同じで、`chaff` は籾殻です。取り除くべきものの名を負っています。

インストールも、AI の利用登録も、言語の指定も要りません。

```bash
npx chaffjs article.md
```

```
─── 5 行目 ───────────────────────────────────────────────────

    キャッシュの仕組みについて説明します。

  ⚠  見出しの繰り返し

     見出し「キャッシュの仕組み」を直後の文がほぼそのまま繰り返しています
     見出しで言ったことを次の文が繰り返すと、読者はそこで何も受け取れません。

     → 見出しが約束したことの中身から書き始めてください。

     このルールをゆるめる:  npx chaff relax heading-echo
```

指摘は 1 件につき 4 つ、引いた文、何が起きているか、なぜ読みにくいか、どう直すかの順に出ます。誤字脱字ではなく、文章の組み立てを見ます。たとえば次のようなところです。

- 一文が長すぎて、読んでいるうちに主語を見失う
- 太字が多すぎて、どこも目立たなくなっている
- 見出しと同じことを、その直後の文が繰り返している
- 「近年、〜が注目されています」など、どの記事にも当てはまる書き出し
- 「いかがでしたか」で終わる、読者に何も残さない結び

画面は文書の言語で出るので、英語の文書には英語で返ってきます。

## 文書の種類を選ぶ

契約書、法令、マニュアル、論文、小説、発言録は、それぞれの書き方で書かれます。種類（ジャンル）を選ぶと、設定を書かずにその書き方に合わせて見ます。
決めていない文書が別の種類に見えるときは、「契約書・規約のようです。--genre legal/contract を試せます」と画面が教えます。

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

## 指摘されたら

応じ方は 3 つです。指摘がもっともなら文章を直します。指摘は正しいがそこは意図して書いたのなら、`<!-- stet: rule-id — 理由 -->` でその箇所だけ黙らせます。
自分たちの方針に合わないなら、`npx chaffjs relax rule-id --why "理由"` でルールのほうを変えます。
強さは `strict` `normal` `relaxed` `off` の 4 語から選び、足りなければ上限を数で書けます（`max-sentence-length: 260`）。

## ほかにできること

```bash
npx chaffjs .                     この場所の Markdown を全部
npx chaffjs article.md --watch    保存のたびに、変わったところだけ出す
npx chaffjs explain bold-density  ルールの意図と根拠を読む
npx chaffjs baseline docs/        既にある指摘を棚上げする
npx chaffjs suppressions docs/    stet で黙らせている指摘を数える
npx chaffjs rules --json          いまの設定を JSON で出す（AI に渡す用）
npx chaffjs tree contract.txt     文書を番地の付いた木にする（条・項・定義・参照）
npx chaffjs cite 原文 引用.json   引用が原文にあるかを確かめる
npx chaffjs fix-plan 前.md        指摘をルールごとにまとめ、直す方向と確かめのコマンドを付けた「直す計画」を出す
npx chaffjs facts 前.md           compare が照合する事実を一覧にする（書き直す前の控え）
npx chaffjs outline 前.md 後.md   見出しの構成と形（見出しの数・節の平均・箇条書きの割合・太字）を前と後で並べる
npx chaffjs compare 前.md 後.md   書き換えで事実（数・日付・URL・名前など）が落ちても足されてもいないかを確かめる
npx chaffjs skill                 Claude Code の skill を入れる（--global でホームに）
```

言語のアダプタ（`@chaffjs/lang-ja` と `@chaffjs/lang-en`）は同梱しているので、別に入れる必要はありません。
新しい言語のアダプタは誰でも出せます。公式は `@chaffjs/lang-<言語>`、第三者は `chaff-lang-<言語>` と名乗ります。
`@typescript-eslint/*` と `eslint-plugin-*` の関係と同じで、chaff は公式、第三者の順に探して読みます。

ルールは Node の関数でも書けます。一つのチームのルールは `chaff.yaml` の `custom_rules` に `type: module` で、いくつものチームで使うものはプラグインのパッケージ `chaff-plugin-<名前>` にまとめます。
型と `defineRule` / `definePlugin` は `chaffjs/api` から読み込みます。プラグインのルールは `<名前>/<ルール>` と呼ばれ、chaff のルールと同じに `explain`・`relax`・`stet`・SARIF で扱えます。
読み込むとそのコードが動くので、信頼できるものだけを入れてください。作り方は手引きの「[プラグインを作る](https://isamu.github.io/lab/ja/guide/writing-plugins/)」にあります。

## ドキュメント

手引きとルールの一覧は [日本語のサイト](https://isamu.github.io/lab/ja/) と [英語のサイト](https://isamu.github.io/lab/en/) にあります。
ソースは https://github.com/isamu/lab/tree/main/text です。

## In English

chaff finds what makes writing hard to read, in Japanese and English, and never rewrites the text. On an English
document it speaks English. Pick the kind of document (`--genre legal/contract`, `docs/manual`, `academic/paper`, …)
and it checks it the way that kind is written. The guide, the genres and the reference of every rule are at
https://isamu.github.io/lab/en/

MIT
