# はじめかた

chaff は、文章の読みにくいところを見つける道具です。文章は書き換えません。直すのは書いた人です。
まずは手元の文章に一度かけてみます。

```bash
npx chaffjs article.md
```

## 自分の文章にかける

設定ファイルも API key も言語指定も要りません。ファイルを 1 つ渡せば、そのまま見ます。

```bash
npx chaffjs article.md           このファイルを見る
npx chaffjs .                    この場所の Markdown を全部見る
npx chaffjs docs/ README.md      ディレクトリもファイルも glob も混ぜてよい
```

`node_modules` `dist` `build` `coverage` は見ません。
見る対象が 1 つも見つからなければ、失敗にします。
何も調べていないのに通ったように見える状態を作らないためです。

## 画面の読み方

指摘が無いときは、次のように出ます。

```
$ npx chaffjs article.md

article.md   blog/tech · 日本語   ジャンルは既定から

────────────────────────────────────────────────────────────

  指摘はありません   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。

  30 件の rule は動いていません:
      adverb-overuse（ja 向けの rule ではないため）
      ai-generated-composite（まだ試験中のため）
      ai-tell（まだ試験中のため）
      contraction-consistency（ja 向けの rule ではないため）
      dangling-reference（まだ試験中のため）
      duplicate-definition（まだ試験中のため）
      emoji-density（まだ試験中のため）
      empty-conclusion（意味を読む検査のため（npx chaff test で動きます））
      excessive-hedging（まだ試験中のため）
      expletive-construction（ja 向けの rule ではないため）
      hiragana-fukushi（まだ試験中のため）
      internal-jargon（まだ試験中のため）
      latin-spacing（まだ試験中のため）
      max-kanji-continuous（まだ試験中のため）
      no-em-dash（まだ試験中のため）
      no-mixed-desumasu（まだ試験中のため）
      numbering-gap（まだ試験中のため）
      oxford-comma-consistency（ja 向けの rule ではないため）
      paragraph-length-variance（まだ試験中のため）
      preferred-term（まだ試験中のため）
      proper-noun-density（まだ試験中のため）
      repeated-conjunction（まだ試験中のため）
      required-sections（まだ試験中のため）
      rule-of-three（まだ試験中のため）
      sasete-itadaku（まだ試験中のため）
      section-length-uniformity（まだ試験中のため）
      sentence-initial-conjunction-run（ja 向けの rule ではないため）
      sentence-rhythm（まだ試験中のため）
      title-case-consistency（ja 向けの rule ではないため）
      unqualified-superlative（まだ試験中のため）
```

指摘があるときは、1 件ずつ区切って出ます。次は実際の記事にかけた例です。

```
$ npx chaffjs sample.md

sample.md   blog/tech · 日本語   ジャンルは既定から

─── 62 行目 ──────────────────────────────────────────────────

    ベンダーが作る 内側ハーネス （ループ・ツール・サンドボックス・圧縮）と、利用者が自分のリポジトリのために書く 外側ハーネス （AGENTS.md・lint・テスト・CI・evals）は、投資判断が別物です。

  ·  中黒で並べすぎている

     この文に中黒が 7 個あります（5 個まで）
     中黒の並列は 1 組なら読めますが、1 文に何組も入ると、どの項目がどの組に属するのか追えなくなります。実文書では 1 文 4 個までは普通に読めていました。

     → 文を割るか、箇条書きにしてください。組の切れ目がはっきりします。

     このルールをゆるめる:  npx chaff relax no-nakaguro-parallel


─── 83 行目 ──────────────────────────────────────────────────

    この狭義（harness＝実行層、scaffold＝指示層）と、OpenAI・Anthropic・Fowler が使う広義（harness＝モデル以外すべて、scaffold はその一部）は 食い違っています 。

  ⚠  一文が長すぎる

     この文は 102 文字あります（100 文字まで）
     長い文は、読んでいるうちに主語を見失います。

     → 接続助詞のところで 2 文に割ってください。それだけで読めるようになります。

     このルールをゆるめる:  npx chaff relax max-sentence-length
```

上から順に、次のことが書かれています。

| 画面の部分 | 読み方 |
| --- | --- |
| 1 行目 | ファイル名、ジャンル、言語と、そのジャンルに決めた根拠です |
| `─── 62 行目 ───` | ここから 1 件の指摘です。数字は指摘された行を表します |
| 字下げした文 | 指摘された文そのものです |
| `⚠` と `·` | 指摘の重さを表す記号です。その横に、指摘の見出しが続きます |
| 見出しの下の 2 行 | 何が起きているかと、それがなぜ読みにくいかです |
| `→` で始まる行 | 直しかたです |
| このルールをゆるめる | そのルールを自分たちに合わせるコマンドです |
| 最後の件数 | 指摘の数と、どれも機械による判定であることを示します |
| 動いていない rule | 今回見なかったルールと、見なかった理由の一覧です |

同じ文章なら、何度かけても同じ結果が出ます。
動いていないルールも理由つきで並ぶので、何を見て何を見なかったのかが分かります。

画面には `npx chaff relax` と出ますが、自分で打つときは `npx chaffjs relax` と打ちます。
この手引きのコマンドも、自分で打つ形の `npx chaffjs` で書いています。

## 指摘されたら、道は 3 つ

どれを選んでもかまいません。

| 道 | どんなとき | やること |
| --- | --- | --- |
| 直す | 指摘がもっともなとき | 文章を書き直す |
| この箇所だけ黙らせる | 指摘は正しいが、ここは意図的なとき | `<!-- stet: rule-id — 理由 -->` を書く |
| ルールを変える | 自分たちの方針に合わないとき | `npx chaffjs relax rule-id --why "理由"` を打つ |

大事なのは 3 つ目があることです。
ルールを変える道が無いと、「うるさいから使わない」で終わってしまいます。

## 黙らせる範囲を選ぶ

`stet` は、指摘を黙らせる印です。Markdown のコメントとして書くので、読み手の画面には出ません。
黙らせる範囲は 3 つから選びます。

| 書き方 | 黙らせる範囲 |
| --- | --- |
| `<!-- stet: bold-density — 用語集なので意図的 -->` | 直後の箇所だけ |
| `<!-- stet-section: bold-density — 一覧なので -->` | 次の見出しまで |
| `<!-- stet-file: ai-tell, rule-of-three — 引用が多い -->` | ファイル全体 |

`—` の後ろには理由を書きます。後から読んだ人が、なぜ黙らせたのかを追えるようにするためです。
同じルールを何度も黙らせているなら、ルールを変える道を選ぶ時期です。

## 次に読むページ

- ルールの強さやジャンルをチームに合わせるには、[設定](./configuration) を読みます。
- 使えるコマンドとオプションの一覧は、[コマンド](./commands) にまとめてあります。
