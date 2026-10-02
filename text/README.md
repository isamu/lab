# chaff

[![npm](https://img.shields.io/npm/v/chaffjs)](https://www.npmjs.com/package/chaffjs)

chaff は、文書の読みにくいところと、機械で確かめられる誤りを見つける道具です。
技術記事も契約書も法令も手順書も、日本語でも英語でも、同じ文章なら何度かけても同じ結果を出します。
文章は書き換えません。直すのは書いた人です。

文書を読んで書くのは人や AI で、chaff はその隣で、判断の要らない側を受け持ちます。
一文の長さや見出しの繰り返し、条文の番号の抜け、書き直しで消えた数字や URL、引用が原文のその番地に本当にあるかどうかは、
別の AI の意見を聞かなくても機械で決まります。意味を読まないと決まらないことだけを、`chaff test` が候補を絞ってから AI に渡します。

この README は入口です。使い方の手引きとルールの一覧は [日本語のサイト](https://isamu.github.io/lab/ja/) と
[英語のサイト](https://isamu.github.io/lab/en/) にあります。

## かけてみる

Node.js 24 以上があれば、インストールせずにかけられます。設定ファイルも API key も言語の指定も要りません。

```bash
npx chaffjs article.md
```

```
article.md   blog/tech · 日本語   ジャンルは既定から

─── 5 行目 ───────────────────────────────────────────────────

    キャッシュの仕組みについて説明します。

  ⚠  見出しの繰り返し

     見出し「キャッシュの仕組み」を直後の文がほぼそのまま繰り返しています
     見出しで言ったことを次の文が繰り返すと、読者はそこで何も受け取れません。

     → 見出しが約束したことの中身から書き始めてください。

     このルールをゆるめる:  npx chaff relax heading-echo


────────────────────────────────────────────────────────────

  注意 1 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

指摘は、引いた文、何が起きているか、なぜ読みにくいか、どう直すかの順に出ます。
画面は文書の言語で出るので、英語の文書には英語で返ってきます。
このあとに、動かなかったルールが理由と一緒に並びます。指摘が 0 件でも、見ていないルールがあればそれが分かるようにするためです。

```bash
npx chaffjs .                          この場所の Markdown を全部見る
npx chaffjs docs/ README.md            ディレクトリもファイルも glob も混ぜてよい
npx chaffjs article.md --watch         保存のたびに、変わったところだけ出す
npx chaffjs article.md --experimental  試験中のルールも動かす
npx chaffjs init                       chaff.yaml を作る（端末ならジャンルを一覧から選ぶ）
```

`node_modules` `dist` `build` `coverage` は見ません。見る文書が一つも見つからなければ失敗にします。
CI が何も見ないまま通る状態を作らないためです。
コマンドの一覧は手引きの [コマンド](https://isamu.github.io/lab/ja/guide/commands/) にあります。

## 指摘されたら

指摘への応じ方は 3 つあります。3 つ目があることが大事で、これが無いと「うるさいから使わない」で終わってしまいます。

| 応じ方 | どんなとき | やること |
| --- | --- | --- |
| 直す | 指摘がもっともなとき | 文章を書き直す |
| この箇所だけ黙らせる | 指摘は正しいが、ここは意図してそう書いたとき | `<!-- stet: rule-id — 理由 -->` |
| ルールを変える | 自分たちの方針に合わないとき | `npx chaffjs relax rule-id --why "理由"` |

黙らせる範囲は、直後の箇所（`stet`）、次の見出しまで（`stet-section`）、ファイル全体（`stet-file`）から選べます。
同じルールを何度も黙らせているなら、ルールのほうを変える頃合いです。`npx chaffjs suppressions docs/` がそれを数えます。

## 文書の種類を選ぶ

契約書の一文はブログより長く、小説は同じ言葉を繰り返し、発言録は話したとおりに残します。どれもその種類の正しい書き方です。
そこで chaff は、文書の種類（ジャンル）ごとに、動かすルールと閾値を変えます。種類を選べば、設定を書かずにその書き方に合わせて見ます。

```bash
npx chaffjs --genre legal/contract 契約書.md    この実行だけ、契約書として見る
npx chaffjs init --genre legal/contract         この場所の chaff.yaml に書く
npx chaffjs genres                              ジャンルの一覧と、それぞれ何向けか
```

| 群 | ジャンル |
| --- | --- |
| 技術文書 | `technical/spec` `technical/readme` |
| ブログ | `blog/tech` `blog/essay` `blog/owned-media` |
| ビジネス文書 | `business/proposal` `business/report` `business/email` `business/press-release` `business/meeting-notes` |
| 法務 | `legal/contract` `legal/statute` `legal/judgment` `legal/patent` |
| 説明書 | `docs/manual` `docs/faq` `docs/glossary` |
| 学術 | `academic/paper` |
| 文学 | `literature/fiction` `literature/essay` `literature/poetry` `literature/play` |
| 話し言葉 | `speech/address` `speech/transcript` |

ジャンルを決めていない文書は、パスと内容から決めます。`README.md`、`*-spec.md`、`docs/` は技術文書として、どれでもなければ技術記事（`blog/tech`）として見ます。
別の種類に見えるときは、1 行目の下に「契約書・規約のようです。--genre legal/contract を試せます」のように出しますが、勝手には切り替えません。
ジャンルごとに何が変わるかは [ジャンルのページ](https://isamu.github.io/lab/ja/genres/) に、種類ごとの使い方は
[文書の種類ごとにできること](https://isamu.github.io/lab/ja/guide/documents/) にあります。

## AI が書いた文章、AI が直した文章

生成された文章には、よく出る形があります。太字の多さ、「X ではありません。Y です」の対比、「さらに、」で始まる文の続き、
「お役に立てれば幸いです」のようなチャットの名残などです。`--experimental` を付けると、chaff はこうした形を数えます。
どれも人が書く形なので、一つ見つけただけで「AI が書いた」とは言いません。重なったときに、読み返す場所の目印として出します。

直すときは、まず `fix-plan` で直す計画を出します。指摘をルールごとにまとめ、直す方向、変えてはいけないもの、直す前と後の例、
勧める直し方（指摘の所だけ、節ごと、全面書き直し）、直したあとにかけるコマンドを並べたものです。
人が直すときも AI に頼むときも、この計画を読んで書き直します。

```bash
npx chaffjs fix-plan article.md --experimental    直す計画を出す（--json で AI に渡す形）
npx chaffjs facts article.md                      書き直す前に、数・日付・URL・名前などの事実を控える
npx chaffjs outline article.md after.md           見出しの数、節の長さ、箇条書きの割合、太字を前と後で並べる
npx chaffjs compare article.md after.md           書き直しで事実が落ちていないか、足されていないかを確かめる
```

AI に大きく書き直させると、文は滑らかになっても、数字が一つ消えたり、元に無い数字が入ったりします。
`compare` はそれを機械で拾い、落ちた事実か足された事実があれば 1 で終わります。

```
✗ 落ちた事実 2 件（before.md にあって after.md に無い）
  数: 1,200円  (before.md:3)
  URL: https://example.com/price  (before.md:3)

✗ 足された事実 1 件（after.md にだけある）
  数: 1,300円  (after.md:3)

i 書き方だけ変わった事実 3 件
  見出し: 料金改定のお知らせ → 料金が変わります  (1 行目 → 1 行目)
  日付: 2026年4月1日 → 2026/4/1  (3 行目 → 3 行目)
  数: 1,000円 → 1000円  (3 行目 → 3 行目)
```

この README も、この手順で全面的に書き直しました。手順と例は手引きの [AIっぽさを直す](https://isamu.github.io/lab/ja/guide/ai-sounding/) にあります。

## 条文と引用を確かめる

契約書や規程、仕様書のように番号の付いた文書は、番地の付いた木として読めます。第3条第2項は `3.2`、Section 4.2(a) は `4.2.a` になります。
`.txt` の契約書も読みます。

```
$ npx chaffjs tree kitei.txt
(doc :language "ja" :path "kitei.txt" :profile "statute" :line 1
  (article "1" :label "第一条" :line 1)
  (article "2" :label "第二条" :line 2
    (reference :label "第五条" :target "5" :unitWord "条" :line 2)
    (item "2.2" :label "２" :line 3))
  (article "3" :label "第三条" :line 4
    (obligation :marker "することができる" :type "may" :line 4)))
```

木を読むルールが、無い条への参照、番号の抜け、同じ語の二重の定義を見ます。`legal/contract` と `legal/statute` では、これが既定で動きます。
上の規程なら「「第五条」（番地 5）はこの文書にありません」と出ます。

`cite` は、要約や回答が引いた文が、原文のその番地に本当にあるかを確かめます。一つでも無ければ 1 で終わるので、
AI の回答を単体試験のように検査できます。

```bash
npx chaffjs cite contract.txt quotes.json    quotes.json は [{ "address": "4.2", "quote": "…" }]
```

詳しくは手引きの [構造と引用](https://isamu.github.io/lab/ja/guide/structure/) にあります。

## 意味を読む検査

提案書にリスクが書かれているか、効果を言う数字に根拠があるかは、意味を読まないと決まりません。
`chaff test` はそういう検査を AI に頼みますが、文書の全体は送りません。機械で候補を絞ってから、その箇所だけを読ませます。
API key が要り、無ければ機械の判定だけを動かしてそう言います。

```bash
npx chaffjs test docs/              意味を読む検査も動かす
npx chaffjs test docs/ --dry-run    何を送るかだけを見る（API は呼ばない）
```

判定役は Anthropic と OpenAI から選べます。チームの検査は `checks.yaml` に自然文で書けます。
鍵の置き方、絞り込みの仕方、送る前の確かめ方は手引きの [コマンド](https://isamu.github.io/lab/ja/guide/commands/) にあります。

## チームに合わせる

ルールの強さは `strict` `normal` `relaxed` `off` の 4 つから選びます。`chaff.yaml` を開かずにコマンドでも変えられ、理由はコメントとして残ります。

```bash
npx chaffjs relax bold-density --why "図の説明で太字を多用するため"
```

```yaml
rules:
  # 太字の使いすぎ
  # 太字は読者の目を止める道具です。多用すると、どこも目立たなくなります。
  bold-density: relaxed # 2026-09-11 図の説明で太字を多用するため / isamu
```

4 つで足りなければ上限を数で書けます（`max-sentence-length: 260`）。
社内用語、必須の見出し、チームの表記、固有名詞は chaff が中身を持たず、`chaff.yaml` に書いたものだけを見ます。
学会や JIS、公用文の表記の決まりは `style:` で名前を選ぶだけで使え、チームだけのルールは語・正規表現・品詞の並び・Node の関数で足せます。
AI に設定を書かせるときは、`npx chaffjs rules --json` の出力を渡します。いまの値、使える値、なぜいま `off` なのかが一つに入っています。

それぞれの書き方は手引きの [設定](https://isamu.github.io/lab/ja/guide/configuration/)、
[チームの表記ルールを決める](https://isamu.github.io/lab/ja/guide/house-style/)、
[プラグインを作る](https://isamu.github.io/lab/ja/guide/writing-plugins/) にあります。

## CI に入れる

記事が 200 本あるリポジトリに入れると、最初は指摘が数千件出ます。全部直してから始めることは誰にもできないので、
`baseline` でいまある指摘を棚上げし、新しく増えたものだけを出します。棚上げは行番号ではなく中身で覚えるので、前後に段落を足しても剥がれません。

```bash
npx chaffjs baseline docs/                  いまある指摘を棚上げする
npx chaffjs . --sarif report/chaff.sarif    指摘を SARIF で書き出す
```

SARIF を GitHub の code scanning に上げると、指摘が PR の変更行に直接出ます。
ログの中の指摘は読みに行かないと見えませんが、行の上の指摘は書いた本人の目の前にあり、開けば直し方まで読めます。
手順は手引きの [CI](https://isamu.github.io/lab/ja/guide/ci/) にあります。

## Claude Code から使う

```bash
npx chaffjs skill             このフォルダの .claude/skills/chaff/ に skill を入れる
npx chaffjs skill --global    ~/.claude/skills/chaff/ に入れる
```

skill を入れると、Claude Code が chaff のかけ方、指摘の読み方、直すか黙らせるかルールを変えるかの選び方、
`fix-plan` での書き直しを知った状態になります。
chaff が誤った指摘をしたとき、言うべきことを言わなかったときは、`npx chaffjs feedback a.md --rule <rule> --line 42` が報告の下書きを作ります。
chaff は何も送りません。届いた報告は、そのまま試験と修正になります。

## 手引き

- [はじめかた](https://isamu.github.io/lab/ja/guide/getting-started/)
- [文書の種類ごとにできること](https://isamu.github.io/lab/ja/guide/documents/)
- [コマンド](https://isamu.github.io/lab/ja/guide/commands/)
- [設定](https://isamu.github.io/lab/ja/guide/configuration/)
- [言語](https://isamu.github.io/lab/ja/guide/languages/)
- [AIっぽさを直す](https://isamu.github.io/lab/ja/guide/ai-sounding/)
- [構造と引用](https://isamu.github.io/lab/ja/guide/structure/)
- [CI](https://isamu.github.io/lab/ja/guide/ci/)
- [リファレンス](https://isamu.github.io/lab/ja/guide/reference/) と [ルールの一覧](https://isamu.github.io/lab/ja/rules/)

## 開発

このディレクトリ（`text/`）は yarn workspaces のルートです。隣の `coding/` にある scoria がコードの品質を測るのに対して、chaff は文章の品質を測ります。

```bash
yarn install
yarn format        # prettier。*.md と samples/ は手で整形しているので対象外
yarn lint          # eslint
yarn typecheck     # tsc --noEmit
yarn build         # 各 package の dist
yarn test          # node:test
yarn knip          # 未使用の export（落とさない）
yarn duplication   # コピペ検出（落とさない）
yarn corpus        # corpus にかけて corpus/expected/ と比べる（--verbose で指摘も出す、--update で書き換える）
yarn corpus:health # URL の文書をすべて取り直す。取れない・コミットした写しと上流が違う・結果が変わった、を報告する（週次の CI と同じ）
yarn bench         # 誤りを植えた見本で見逃しを数える（--verbose、--update は corpus と同じ）
yarn bench:ai      # AI っぽさのルールを、同じ中身を人・生成文・書き直しの 3 通りに書いた見本（test/fixtures/ai-samples/paired/）と corpus にかけ、当たりと誤報を数える
yarn example       # examples/ の実文書にかける（1 行形式。yarn example:friendly で既定の出力）
```

[examples/](./examples/) には、実際に公開した記事と社内文書を置いています（`blog-ja/` 日本語の技術記事、`blog-en/` 英語の技術記事、`business-ja/` 会の文書）。
CI でも毎回ここにかけます。指摘の数では落としませんが、実文書で chaff が最後まで動かなければ落ちます。
CI は `.github/workflows/chaff-ci.yml` で、`text/**` を触る PR でだけ、ubuntu・macOS・Windows の 3 つで回ります。

```
text/                      yarn workspaces のルート
  packages/chaff           core。npm 名 chaffjs
    rules/*.yaml           rule 定義。分岐も式も書かない。サイトのルールのページもここから作る
    genres.yaml            ジャンルごとに動かす rule。サイトのジャンルのページもここから作る
    profiles/*.yaml        文書の種類（法令など）の知識。コードは種類を知らず、ここを読む
    src/plugin.ts          contract（型のみ。実装を持たない）
    src/document.ts        Markdown → ProseDocument
    src/mask.ts            非 prose を同じ長さの空白で覆う
    src/levels.ts          4 語 → 数値
    src/detectors/         rule 定義の how_to_find が引く
    src/config/            chaff.yaml の読み書き
    src/render/            出力（既定 / --compact / --json）
    src/cli.ts
    skills/chaff/SKILL.md  npx chaffjs skill が入れる Claude Code の skill
  examples/                実文書。CI でもここにかける
  packages/lang-ja         @chaffjs/lang-ja。文分割と語彙表
    lexicons/*.yaml        L2 の語彙。ここだけが言語別
  packages/lang-en         @chaffjs/lang-en。同上
  site/                    ドキュメントサイト（Astro）。https://isamu.github.io/lab/
  test/                    node:test
```

パッケージのあいだの import は型だけにしています。言語のアダプタは chaff の値に依存せず、単体で動きます。
実装の仕様は [chaff-spec.md](./chaff-spec.md) で、冒頭に非エンジニア向けの概要があります。
導入から規範の更新までの利用者側の仕様は [chaff-workflow-spec.md](./chaff-workflow-spec.md)、
概念の仕様は [natural-language-validation-harness-spec.md](./natural-language-validation-harness-spec.md) です。
設定ファイルの実物は [samples/](./samples/) にあります。

## In English

chaff finds what makes a document hard to read, and the mistakes a machine can check, in Japanese and English. The same
text gives the same result every time, and chaff never rewrites it. Run `npx chaffjs article.md`; on an English
document the screen is in English. Pick the kind of document with `--genre` (`legal/contract`, `docs/manual`,
`academic/paper`, `literature/fiction`, and so on) and chaff checks it the way that kind is written. The guide, the
genres and the reference of every rule are at https://isamu.github.io/lab/en/
