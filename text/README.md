# chaff

[![npm](https://img.shields.io/npm/v/chaffjs)](https://www.npmjs.com/package/chaffjs)

文章の読みにくいところを見つける道具。**文章は書き換えない。** 直すのは書いた人。

`coding/` の scoria がコードの品質を測るのに対して、こちらは文章の品質を測る。

```bash
npx chaffjs article.md
```

## いまどこまで動くか

L1 rule が 5 本。設定ファイルも API key も言語指定も要らない。

```
$ npx chaffjs article.md

article.md   blog/tech · 日本語   ジャンルは既定から

─── 5 行目 ───────────────────────────────────────────────

    キャッシュの仕組みについて説明します。

  ⚠  見出しの繰り返し

     見出し「キャッシュの仕組み」を直後の文がほぼそのまま繰り返しています
     見出しで言ったことを次の文が繰り返すと、読者はそこで何も受け取れません。

     → 見出しが約束したことの中身から書き始めてください。

     このルールをゆるめる:  npx chaffjs relax heading-echo

──────────────────────────────────────────────────────────

  注意 1 件   すべて機械による判定です
              （同じ文章なら何度実行しても同じ結果になります）

  文章は書き換えていません。直すのは書いた人です。
```

| rule | 見るもの |
| --- | --- |
| `bold-density` | 1 節あたりの太字の数 |
| `max-sentence-length` | 一文の長さ（日本語は文字、英語は語） |
| `heading-echo` | 見出しを直後の文が繰り返していないか |
| `repeated-sentence-head` | 同じ書き出しの連続 |
| `sentence-rhythm` | 文の長さの単調さ（experimental。既定では動かない） |
| `empty-intensifier` | 「非常に重要」など、中身を言わない強調 |
| `padded-intro` | 「近年〜が注目されています」型の書き出し（冒頭限定） |
| `closing-cliche` | 「いかがでしたか」型の結び（最後の節限定） |

後ろの 3 本は **L2**。検出器は共通で、語彙表だけが言語別にある。日本語でも英語でも同じ rule が動く。

```
$ npx chaffjs en.md --compact

  3:67   warning "it is important to note that" emphasises without saying anything
                 empty-intensifier
  3:1    warning "in today's fast-paced world" is an opening that fits any article
                 padded-intro
  11:1   warning Closes with "in conclusion"
                 closing-cliche
```

## 使いはじめ

```bash
npx chaffjs .                    この場所の Markdown を全部見る
npx chaffjs docs/ README.md      ディレクトリもファイルも glob も混ぜてよい
npx chaffjs init                 chaff.yaml を作る
npx chaffjs explain bold-density そのルールの意図と根拠を読む
npx chaffjs genres               ジャンルの一覧
npx chaffjs baseline docs/       いまある指摘を棚上げする
npx chaffjs suppressions docs/   stet で黙らせている指摘を数える
npx chaffjs article.md --watch   保存のたびに、変わったところだけ出す
```

## 書いている最中

```
$ npx chaffjs article.md --watch

  1 ファイルを見ています。いまの指摘は 2 件です。
  保存するたびに、変わったところだけ出します。止めるには Ctrl-C。

18:26:43  article.md  ✓ 2 → 1 件   (-1 bold-density)
18:26:45  article.md  ✗ 1 → 2 件   (+1 closing-cliche)
```

全件を出し直されると、何が変わったのか分からなくなる。差分だけを出す。

`node_modules` `dist` `build` `coverage` は見ない。対象が 1 つも見つからなければ**失敗にする**（「CI は通っているが何も検証していない」状態を作らないため）。

## 意味を読む検査

`chaff test` は、機械では判定できないものを AI に読ませます。API key が要ります。無ければ、機械による判定だけを動かして**そう言います**（黙って通しません）。

```bash
npx chaffjs test docs/
```

```
═══ 機械による判定 ═══════════════════════════════
    同じ文章なら何度実行しても同じ結果になります

═══ AI による判定 ════════════════════════════════
    文章の意味を読んでいます。実行するたび結果が変わることが
    あります。おかしいと思ったら、そのまま無視して構いません。

    118 文のうち 4 箇所を読みました（残りは機械が対象外と判断）

  ⚠  数字の根拠がない            確からしさ 0.88

     「40%」がどう計算されたのか、いつと比べたのかが本文にありません。

     → 「(2026年4-6月、対前年同期、n=120)」のように括弧で添えてください

     この指摘が違うと思ったら:
       この箇所だけ黙らせる    <!-- stet: unsourced-number — 理由 -->
       ルールごとゆるめる      npx chaff relax unsourced-number
```

**文書全体を AI に渡しません。** 機械で候補を絞ってから、その箇所だけを読ませます。`risk-disclosure` は見出しに「リスク」があれば問い合わせすらしません。

| rule | 見るもの | 絞り込み |
| --- | --- | --- |
| `risk-disclosure` | 提案にリスクが書かれているか | 見出しにリスクの節があれば見ない |
| `empty-conclusion` | 結びが本文の要約でしかないか | 最後の節に数字・コード・リンクが無いときだけ |
| `unsourced-number` | 効果を主張する数字に根拠があるか | 数字と効果の語が同じ文にあり、根拠が無いときだけ |

同じ問いは 2 度目から `.chaff-cache/` に当たるので、CI で何度回しても課金されません。

## 自分たちで検査を足す

`checks.yaml` に**自然文で**書きます。プログラムは書きません。

```yaml
checks:
  - name: 提案書に決裁者が書かれている
    use_for: business
    check: |
      決裁を求めている文書に、誰が決めるのかが書かれていること。
      役職名でも個人名でもよい。誰も特定できなければ、決まりに反する。
    level: normal
    how_to_fix: 「◯◯部長の承認をお願いします」のように、決める人を書いてください。
```

## 指摘されたら、道は 3 つ

どれを選んでもよい。3 つ目があることが大事で、これが無いと「うるさいから使わない」で終わる。

| 道 | どんなとき | やること |
| --- | --- | --- |
| **直す** | 指摘がもっともなとき | 文章を書き直す |
| **この箇所だけ黙らせる** | 指摘は正しいが、ここは意図的なとき | `<!-- stet: rule-id — 理由 -->` |
| **ルールを変える** | 自分たちの方針に合わないとき | `npx chaffjs relax rule-id --why "理由"` |

抑制の範囲は 3 つ。

```markdown
<!-- stet: bold-density — 用語集なので意図的 -->          直後の箇所だけ
<!-- stet-section: bold-density — 一覧なので -->          次の見出しまで
<!-- stet-file: ai-tell, rule-of-three — 引用が多い -->   ファイル全体
```

同じルールを何度も黙らせているなら、それは 3 つ目を選ぶべきサイン。`chaff suppressions` が数えて教える。

```
$ npx chaffjs suppressions docs/

  抑制されている指摘: 6 件

  bold-density                6 件  ← 設定の見直しを検討してください
      docs/g1.md, docs/g2.md, docs/g3.md ほか 3 ファイル
      理由: 用語集なので太字が多いのは意図的
      ルールごとゆるめる: npx chaffjs relax bold-density --why "..."

  理由が書かれていない抑制: 1 件
      docs/x.md
```

## 既にある文書に入れる

記事が 200 本ある repo に入れると数千件出る。全部直してから始めることは誰にもできない。

```bash
npx chaffjs baseline docs/       いまある指摘を棚上げする
```

以後、棚上げしたものは報告されず、**新しく増えたものだけ**が出る。`.chaff-baseline.json` を commit すれば、チーム全員が同じ地点から始められる。

行番号ではなく内容で同定するので、前後に段落を足しても棚上げは剥がれない。棚上げ分も見たいときは `--show-baseline`。

## 設定は 4 つの言葉だけ

数字は書かない。`chaff.yaml` を開かずにコマンドでも変えられる。

```bash
npx chaffjs relax bold-density --why "図の説明で太字を多用するため"
```

```yaml
rules:
  # 太字の使いすぎ
  # 太字は読者の目を止める道具です。多用すると、どこも目立たなくなります。
  bold-density: relaxed # 2026-09-11 図の説明で太字を多用するため / isamu
```

説明コメントは自動で入り、既存のコメントは壊さない。既に理由があるものを変えるときは `--why` が要る。古い理由が新しい値に残ると履歴が嘘になるため。

AI に設定を書かせるときは `npx chaffjs rules --json` を渡す。今の値・使える値・なぜ今 off なのか・変更コマンドが 1 つに入っている。

## 品詞を見る rule

「誰がしたのか書かれていない」のような、語の並びだけでは決まらない指摘には品詞解析が要ります。
辞書は同梱してあるので、取得も設定も要りません。

```bash
npx chaffjs report.md --experimental
```

```
  この文は「られ」と受け身で書かれていますが、誰がしたのかがありません
  → 主語を立てて能動にしてください。「決定されました」を「運営チームが決定しました」に。
```

日本語と英語で **rule は 1 本**です。「れる/られる」と be + 過去分詞は形が全く違いますが、
どちらも「動作主が書かれていない」という同じ問題を作るので、判断の言語依存はアダプタに閉じてあります。

辞書を読むのは 2 秒ほどかかるので、**品詞を要求する rule が 1 本も動かないときは読みません**。
動かせないときは黙って通さず、理由を出します。

```
no-doubled-joshi   この言語では品詞解析が使えないため
```

品詞を見る rule は今のところ 4 本です。

| rule | 何を見るか |
| --- | --- |
| `agentless-passive` | 受け身で、誰がしたのか書かれていない（ja / en） |
| `no-mixed-desumasu` | ですます調とである調の混在（ja） |
| `no-doubled-joshi` | 「弊社の新製品の販売の計画」のような入れ子（ja） |
| `taigen-dome-in-prose` | 本文の体言止めが続く（ja） |

品詞が要らない日本語の rule も 5 本あります。

| rule | 何を見るか |
| --- | --- |
| `double-keigo` | 二重敬語（おっしゃられました） |
| `sasete-itadaku` | 「させていただく」の重なり |
| `hiragana-fukushi` | 表外漢字の副詞（殆ど・勿論） |
| `max-kanji-continuous` | 漢字の連続（情報処理推進機構認定試験） |
| `no-nakaguro-parallel` | 1 文に中黒の並列が何組も入る |

英語固有の rule も 5 本あります。

| rule | 何を見るか |
| --- | --- |
| `adverb-overuse` | -ly 副詞の密度 |
| `expletive-construction` | There is / It is ... that |
| `sentence-initial-conjunction-run` | And / But / So で始まる文の連続 |
| `title-case-consistency` | 見出しの大文字化が文書内で揃っているか |
| `oxford-comma-consistency` | 並列の読点が文書内で揃っているか |
| `contraction-consistency` | 短縮形の使いかたが文書内で揃っているか |

後ろの 2 本は**どちらが正しいかを決めません**。1 つの文書で揃っているかだけを見て、少数派を指摘します。

## 判定役は Anthropic でも OpenAI でも

意味を読む検査の判定役は差し替えられます。**rule も、返させる形も変わりません。**

```yaml
ai_backend: openai     # 既定は anthropic
ai_model: gpt-5
```

| backend | 認証 | 既定モデル |
| --- | --- | --- |
| `anthropic` | `ANTHROPIC_API_KEY`、または `ant auth login` | `claude-opus-5` |
| `openai` | `OPENAI_API_KEY` | `gpt-5` |

鍵は `.env` に書いても読みます。**シェルの環境変数のほうが勝ちます**（一時的に別の鍵で試せます）。

```
OPENAI_API_KEY=sk-...
```

`.env` は `.gitignore` に入れてください。`chaff init` が作る `.gitignore` には入っています。

**Claude のサブスクリプション（Claude Code の Pro / Max）は使えません。** API は別勘定で、
認証情報の置き場も違います（`~/.claude` と `~/.config/anthropic`）。

## 指摘を PR の行に出す

```bash
npx chaffjs . --sarif report/chaff.sarif
```

SARIF 2.1.0 で書き出します。GitHub の code scanning に上げると、**PR の変更行に直接出ます**。

```yaml
- name: Upload SARIF to Code Scanning
  uses: github/codeql-action/upload-sarif@v4
  with:
    sarif_file: report/chaff.sarif
    category: chaff-prose
```

ログの中の指摘は読みに行かないと見えませんが、行の上の指摘は書いた本人の目の前にあります。
「なぜ直すのか」と「どう直すのか」も一緒に上げるので、指摘を開けば直しかたまで読めます。

## 何が AI に送られるかを、送る前に見る

意味を読む検査（`chaff test`）は文書全体を送りません。決定的な絞り込みを通した分だけを送ります。
**何が送られるかは、API key が無くても確かめられます。**

```bash
npx chaffjs test docs/ --dry-run
```

```
doc.md   全 6 文のうち 5 箇所を送ります（API は呼んでいません）

      1 箇所  リスクが書かれていない  （機械で絞り込み済み）
      2 箇所  依頼には期限と担当がある  （「お願いします」「ご確認ください」を含む文）
      1 箇所  議事録に決定事項がある  （絞り込めず全文）
```

自分で書いた検査（`checks.yaml`）は、`look_at` の「」の中の語で絞り込まれます。
絞り込めなかったものは全文を送るので、そのことも出します。

## 文書の形を見る rule

言語も鍵も要りません。

| rule | 何を見るか |
| --- | --- |
| `max-paragraph-length` | 1 段落に文を詰めすぎていないか |
| `paragraph-length-variance` | 段落の長さが揃いすぎていないか |
| `section-length-uniformity` | 節の長さが揃いすぎていないか |
| `rule-of-three` | 箇条書きが 3 項目ばかりになっていないか |
| `preamble-length` | 本題に入るまでが長くないか |
| `ngram-repetition` | 同じ言い回しの繰り返し |
| `emoji-density` | 絵文字の密度 |
| `undefined-acronym` | 略語が説明なしで出てこないか |
| `concrete-evidence-density` | 数値もコードもリンクも無い節 |

## 言い回しを見る rule

語彙表だけが言語別で、rule は共通です。新しい言語は語彙表を書けば動きます。

| rule | 何を見るか |
| --- | --- |
| `excessive-hedging` | 逃げの表現の密度 |
| `cushion-phrase-density` | クッション言葉の密度 |
| `unqualified-superlative` | 比べる相手のない最上級 |
| `repeated-conjunction` | 段落が接続詞で始まり続けていないか |
| `ai-tell` | 生成文にありがちな言い回し（重み付き） |

`ai-tell` は**単独で「AI が書いた」とは言いません**。どれも 1 つでは普通の日本語なので、
重みを足し合わせた点だけを出します。

## チームが決める rule

3 つの rule は **chaff が中身を持ちません**。`chaff.yaml` に書いたものだけを見ます。

```yaml
jargon:            # 社内でしか通じない語
  - 横展開
  - 握る

required_sections: # この種類の文書に無いと困る見出し
  - リスク
  - 費用
```

```
1:1   error   「リスク、費用」の見出しがありません
5:1   warning 「横展開」は社内でしか通じないかもしれません（そういう語が 3 箇所）
```

何が社内用語かも、何の節が必須かも組織ごとに違います。**chaff が決めると、合わない組織で rule ごと
切られます。** 書いていなければ何も言いません。

`jargon` は辞書形（`握る`）でも語幹（`巻き取`）でも書けます。活用していても当たります。

## 揃ったときだけ言う

単独では普通の文章に出る特徴が、同じ文書で 3 つ以上そろったときだけ 1 件にまとめます。

```
「ai-tell、rule-of-three、padded-intro、closing-cliche」が同じ文書にそろっています（4 種、3 種から）
```

**これでも「AI が書いた」とは言いません。** 読み直す場所の目印です。元の指摘も消しません。

## 既定で動く rule と、そうでない rule

45 本のうち **17 本が既定で動きます**。残りは `--experimental` が要ります。

既定に入れる条件は 3 つで、**実文書で発火したこと**が要ります。

1. 実際に公開された文書（`examples/`、20 本）で発火した
2. 出た指摘を読んで、正しいと判断できた
3. `npx chaffjs eval` の目標（誤検知率 5% 未満）を満たしている

**一度も発火していない rule は既定に入れません。** 合成した文書で動くことは確かめてありますが、
それは「壊れていない」証拠であって「既定で出してよい」証拠ではないためです。

## まだ無いもの

spec の rule catalog はすべて実装しました。閾値の多くはまだ実文書で測れていません
（`npx chaffjs eval <dir>` で手元の文書に合わせられます）。

## 実文書で試す

[examples/](./examples/) に、実際に公開した記事と社内文書を置いてあります。作り物ではない文章に対して何が出るかを、すぐ確かめられます。

```bash
yarn example              この場所の文書を全部（1 行形式）
yarn example:friendly     既定の出力で
```

| ディレクトリ | 中身 |
| --- | --- |
| `blog-ja/` | 技術記事 3 本 |
| `blog-en/` | 英語の技術記事 2 本 |
| `business-ja/` | 会の文書 3 本 |

CI でも毎回かけています。指摘の数では落としません（文章の好みの問題なので）が、**実文書で chaff が最後まで動かなければ落ちます**。

## ジャンル

文書の種類で、動く rule が変わります。仕様書に「つかみ」も「締め」も要りません。

| ジャンル | 何を見ないか |
| --- | --- |
| `technical/spec` `technical/readme` | 水増しの導入 / 定型の結び / 文のリズム |
| `blog/tech` `blog/essay` `blog/owned-media` | — |
| `business/proposal` `business/report` ほか | ブログ向けの rule |

判定はパスと内容から自動で行い、1 行目に根拠つきで出ます。`README.md`、`*-spec.md`、`docs/` は技術文書として見ます。

```
chaff-spec.md   technical/spec · 日本語   ジャンルはパスから
```

## 閾値を手元の文書で測り直す

既定の閾値は一般論です。自分たちの文章に合っているかは、測らないと分かりません。

```bash
npx chaffjs eval examples/blog-ja/
```

```
  3 ファイルを corpus として 8 本の rule を測りました。

  ここにある文書は「人間が書いて公開した良い文書」として扱っています。
  そこで多く発火する rule は、閾値が現実に合っていない疑いがあります（目標: 5% 未満）。

  太字の使いすぎ   (bold-density)

         1     3 文書 (100.0%)   指摘  41 件   1万字あたり 15.8
         2     3 文書 (100.0%)   指摘  32 件   1万字あたり 12.3  ← 現在
         4     3 文書 (100.0%)   指摘  18 件   1万字あたり 6.9

    どの閾値でも目標を満たしません。この corpus に対して rule 自体が合っていない可能性があります。
```

**閾値は自動で書き換えません。** 較正は corpus に対する答えであって、正解ではないためです。提示だけして、適用は人が決めます。

corpus が 20 文書に満たないときは、割合が「0 か全部」に振れるので、密度（1 万字あたりの指摘数）のほうを見てください。

## パスごとに設定を変える

```yaml
genre: blog/tech

by_path:
  - files: ["business-ja/**/*.md"]
    genre: business/report
  - files: ["blog-en/**/*.md"]
    language: en
```

後に書いたものが勝ちます。照合は**設定ファイルのある場所からの相対**なので、どこで実行しても結果が変わりません。

## 構成

```
text/                      yarn workspaces のルート
  packages/chaff           core。npm 名 chaff
    rules/*.yaml           rule 定義。分岐も式も書かない
    src/plugin.ts          contract（型のみ。実装を持たない）
    src/document.ts        Markdown → ProseDocument
    src/mask.ts            非 prose を同じ長さの空白で覆う
    src/levels.ts          4 語 → 数値
    src/detectors/         rule 定義の how_to_find が引く
    src/config/            chaff.yaml の読み書き
    src/render/            出力（既定 / --compact / --json）
    src/cli.ts
  examples/                実文書。CI でもここにかける
  packages/lang-ja         @chaffjs/lang-ja。文分割と語彙表
    lexicons/*.yaml        L2 の語彙。ここだけが言語別
  packages/lang-en         @chaffjs/lang-en。同上
  test/                    node:test
```

パッケージ間の import は**型だけ**にする。アダプタは chaff の値に依存せず、単体で動く。

## 仕様

| | |
| --- | --- |
| [chaff-spec.md](./chaff-spec.md) | 実装仕様。冒頭に非エンジニア向けの概要がある |
| [chaff-workflow-spec.md](./chaff-workflow-spec.md) | 利用者側の仕様。導入から規範の更新まで |
| [samples/](./samples/) | 設定ファイルの実物 |
| [natural-language-validation-harness-spec.md](./natural-language-validation-harness-spec.md) | 概念仕様 |

## 開発

```bash
yarn install
yarn format        # prettier。*.md と samples/ は手で整形しているので対象外
yarn lint          # eslint
yarn typecheck     # tsc --noEmit
yarn build         # 各 package の dist
yarn test          # node:test
yarn knip          # 未使用の export（落とさない）
yarn duplication   # コピペ検出（落とさない）
```

CI は `.github/workflows/chaff-ci.yml`。`text/**` を触る PR でだけ走り、ubuntu / macOS / Windows の 3 面で回す。
