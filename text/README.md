# chaff

[![npm](https://img.shields.io/npm/v/chaffjs)](https://www.npmjs.com/package/chaffjs)

文章の読みにくいところを見つける道具。**文章は書き換えない。** 直すのは書いた人。日本語と英語の文書をそのまま見る。

**手引きとルールの一覧:** https://isamu.github.io/lab/ja/ （English: https://isamu.github.io/lab/en/）

> chaff finds what makes writing hard to read — in Japanese and English — and never rewrites the text. On an
> English document it speaks English. Pick the kind of document (`--genre legal/contract`, `docs/manual`,
> `academic/paper`, `literature/fiction`, …) and it checks it the way that kind is written. The guide, the genres and
> the reference of every rule are at https://isamu.github.io/lab/en/.

`coding/` の scoria がコードの品質を測るのに対して、こちらは文章の品質を測る。

```bash
npx chaffjs article.md
```

## 文書の種類を選ぶ

契約書の一文はブログより長く、小説は同じ言葉を繰り返し、発言録は話したとおりに残します。どれもその種類の書き方です。
chaff は文書の種類（ジャンル）ごとに、見るルールと閾値を用意しています。種類を選べば、設定を書かずに、その書き方に合わせて見ます。

```bash
npx chaffjs --genre legal/contract 契約書.md    この実行だけ、契約書として見る
npx chaffjs init --genre legal/contract         この場所の chaff.yaml に書く（端末なら一覧から選べる）
npx chaffjs genres                              ジャンルの一覧と、それぞれ何向けか
```

| 文書 | ジャンル |
| --- | --- |
| 仕様書・RFC・設計文書 | `technical/spec` |
| README・開発者向けの説明 | `technical/readme` |
| 技術記事（ジャンルを決めないときはこれ） | `blog/tech` |
| ブログのエッセイ | `blog/essay` |
| 会社や団体が出す記事 | `blog/owned-media` |
| 提案書・企画書・計画書 | `business/proposal` |
| 報告書・白書・社内文書 | `business/report` |
| 仕事のメール・手紙 | `business/email` |
| プレスリリース・お知らせ | `business/press-release` |
| 議事録・議事要旨 | `business/meeting-notes` |
| 契約書・利用規約・プライバシーポリシー | `legal/contract` |
| 法令・規則・社内規程・通達 | `legal/statute` |
| 判決文・決定 | `legal/judgment` |
| 特許の明細書と請求項 | `legal/patent` |
| 使い方の説明・手順書・ヘルプ | `docs/manual` |
| よくある質問 | `docs/faq` |
| 用語集 | `docs/glossary` |
| 論文と要旨 | `academic/paper` |
| 小説・物語 | `literature/fiction` |
| 文学としての随筆 | `literature/essay` |
| 詩・短歌・俳句 | `literature/poetry` |
| 戯曲・脚本 | `literature/play` |
| 読み上げるために書いた演説・挨拶 | `speech/address` |
| 話したことの記録（会見・国会の会議録） | `speech/transcript` |

ジャンルを決めていない文書は、技術記事（`blog/tech`）として見ます。別の種類に見えるときは、1 行目の下にそう出ます。見るジャンルは変えません。

```
契約書.txt   blog/tech · 日本語   ジャンルは既定から
   契約書・規約のようです。--genre legal/contract を試せます
```

ジャンルごとに見ないルールと足すルールは、[サイトのジャンルのページ](https://isamu.github.io/lab/ja/genres/) にあります。同梱の `genres.yaml` から作っているので、ずれません。

## いまどこまで動くか

設定ファイルも API key も言語指定も要らない。ルールの一覧と、それぞれの理由・直し方・段階は
[サイトのルールのページ](https://isamu.github.io/lab/ja/rules/) にある（ルールの定義ファイルから作っているので、ずれない）。

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

  3:1    warning "in today's fast-paced world" is an opening that fits any article
                 padded-intro
  3:67   warning "it is important to note that" emphasises without saying anything
                 empty-intensifier
  11:1   warning Closes with "in conclusion"
                 closing-cliche
```

## 使いはじめ

```bash
npx chaffjs .                    この場所の Markdown を全部見る
npx chaffjs docs/ README.md      ディレクトリもファイルも glob も混ぜてよい
npx chaffjs init                 chaff.yaml を作る（端末ならジャンルを一覧から選ぶ。--genre でも決まる）
npx chaffjs explain bold-density そのルールの意図と根拠を読む
npx chaffjs genres               ジャンル（文書の種類）の一覧と、それぞれ何向けか
npx chaffjs --version            chaffjs と言語パッケージの版
npx chaffjs baseline docs/       いまある指摘を棚上げする
npx chaffjs suppressions docs/   stet で黙らせている指摘を数える
npx chaffjs article.md --watch   保存のたびに、変わったところだけ出す
npx chaffjs rules                ルールの一覧を、グループごとに表で出す（いまの段階つき）
npx chaffjs rules --json         いまの設定とルールの説明を JSON で出す（AI に設定を書かせるときに渡す）
npx chaffjs tree contract.txt    文書を番地の付いた木にする（条・項・定義・参照）
npx chaffjs cite 原文 引用.json  引用が原文にあるかを確かめる
npx chaffjs compare 前.md 後.md  書き換えで事実（数・日付・URL・名前など）が落ちても足されてもいないかを確かめる
npx chaffjs facts 前.md          compare が照合する事実を一覧にする（書き直す前の控え）
npx chaffjs outline 前.md 後.md  見出しの構成と形（見出しの数・節の平均・箇条書きの割合・太字）を前と後で並べる
npx chaffjs fix-plan 前.md      指摘をルールごとにまとめ、直す方向と確かめのコマンドを付けた「直す計画」を出す（書き直す人や AI 向け）
npx chaffjs skill                Claude Code の skill を入れる
npx chaffjs feedback a.md --rule max-sentence-length --line 42   誤った指摘を報告する下書きを作る
```

`--genre business/email` でその実行だけのジャンルを決め、`--experimental` で試験中の rule も動かす。

## 画面の言語

指摘の画面は、文書の言語で出る。日本語の文書には日本語で、それ以外の文書には英語で。いくつものファイルを見たときの締めの行は、そろっていればその言語、混ざっていれば下の決まりに従う。`chaff eval` の測定結果も、測った文書の言語で出る（言語の混ざった文書はまとめて測らない）。`chaff test` も同じで、機械と AI の判定の見出し・AI の指摘・`--dry-run` の送る予定は文書の言語、締めの行（合計、動かなかったときの断り、鍵の案内）はそろっていればその言語、混ざっていれば下の決まりに従う。

文書に結び付かない出力（`--help`、`genres`、`init`、`explain`、`relax`、`rules --json`、設定の警告など）は、`chaff.yaml` の `language`、無ければ端末のロケール（`LC_ALL`、`LC_MESSAGES`、`LANG`）、それも無ければ英語で出る。CI のように端末のロケールが `C` の所で日本語にしたいときは、`chaff.yaml` に `language: ja` を書く。

`explain` と `rules --json` の数字は、その言語の数え方になる（日本語は文字、英語は語）。

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
| `empty-conclusion` | 結びが本文の要約でしかないか | 最後の節に、前に書いていない数・コード・リンクが無いときだけ |
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

## 設定はまず 4 つの言葉で

`strict` / `normal` / `relaxed` / `off` から選ぶ。`chaff.yaml` を開かずにコマンドでも変えられる。

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

4 つの言葉で足りないとき（手本にした文章の一文が `relaxed` より長い、など）は、上限を正の数で書ける。`off` にすると何も見なくなるが、数なら見続ける。その rule は `normal` として扱われ、`rules --json` の `now` にいま効いている数が出る。

```yaml
rules:
  max-sentence-length: 260
```

番号の抜け（`numbering-gap`）のように数えるもののない rule には上限が無い。4 つの言葉は指摘の重さを変え、`relaxed` にしても指摘は消えずに一段軽く出る（エラーは注意に、注意は参考に）。

チームで決めた表記は `prefer:` に「避ける綴り: 使う綴り」で書き、`preferred-term` を動かす。英字や数字の前後に空白を入れるかどうかが文書の中で混ざっているのは `latin-spacing`（日本語）が見る。どちらも試験中なので、`rules:` に名前を書いて動かす。

```yaml
rules:
  preferred-term: normal
  latin-spacing: normal
prefer:
  サーバー: サーバ
  e-mail: email
```

段階で言えない決まりは、その rule の `options:` に書く。いまオプションを持つのは `katakana-long-vowel` で、
語末の「ー」を省くか（`drop`）付けるか（`keep`）と、何音の語から見るか（`min_morae`。語末の「ー」を除いて数える）を決める。
書かなければ立場を取らず、同じ語が両方で書かれた所だけを指摘する。

```yaml
rules:
  katakana-long-vowel: normal
options:
  katakana-long-vowel:
    ending: drop
    min_morae: 3
```

```
  3:4     warning 「サーバー」は語末の「ー」を省いて「サーバ」と書きます（3 音以上の語）
                  katakana-long-vowel
```

`npx chaffjs explain katakana-long-vowel` がオプションのいまの値と、どこで決めたかを出す。

よく知られた書き方の決まりは、`style:` で名前を選ぶだけで使える。選んだスタイルが、rule の段階とオプションをまとめて決める。

| `style:` | 決めること | 出典 |
| --- | --- | --- |
| `ieice` | 「ー」の前が 3 音以上のカタカナ語は、-er・-or・-ar に当たる語末の「ー」を省く（コンピュータ。メニュー、カバーはそのまま） | 電子情報通信学会「和文論文誌 投稿のしおり」2.4 |
| `jis-z8301-2011` | 同上（2019 年版はこの原則を外した） | JIS Z 8301:2011 表 G.3 |
| `bunkacho` | 語末の「ー」を付ける（コンピューター） | 外来語の表記（平成 3 年内閣告示第 2 号） |
| `jis-z8301-2019` | 規定の文末に「すべきである」と文末の「できる」を使わない（`requirement-modal`）。番号を付けた図・表・箇条を「上記の図」「以下の箇条」と指さない（`vague-figure-reference`） | JIS Z 8301:2019 7.3〜7.5、10.6 |
| `koyobun` | 和文の一文は 60 字まで。です・ますとであるを混ぜない。語末の「ー」を付ける | 文化審議会「公用文作成の考え方」（2022）Ⅲ－3 ア、Ⅲ－1 イ、Ⅰ－3 エ |

```yaml
style: ieice
```

```
  3:4     warning 「サーバー」は語末の「ー」を省いて「サーバ」と書きます（3 音以上の語）
                  katakana-long-vowel
```

強さは chaff.yaml の `rules:` と `options:` が最も強く、次にスタイル、次にジャンル、最後に既定。
`explain` と `rules --json` は、どの値がスタイルから来たかを `style: ieice` と出す。知らないスタイル名は、実行を止めて使える名前を並べる。

チームだけの決まりは `custom_rules:` にルールとして書ける。初めの 3 つはプログラムが要らない。

| `type:` | 見つけるもの | 書くもの |
| --- | --- | --- |
| `words` | 決めた語（直す先があればそれも） | `words: { 下さい: ください }` か語の並び |
| `pattern` | 正規表現に当たる所 | `pattern:`（`ignore_case: true` で大文字小文字を区別しない） |
| `tokens` | 品詞・原形・表記の並び（ja / en） | `tokens: [{ pos: 名詞 }, { surface: を }, { base: 行う }]` |
| `module` | 書いた Node の関数が返す所 | `module: ./chaff-rules/no-tbd.mjs`（`chaff.yaml` からの相対パス） |

どのルールにも `id`、`name`、`why`、`how_to_fix`、`example`（`before` と `after`）を書く。読む人に理由と直し方を伝えるため。
`level`（`error` / `warning` / `info`、既定は `warning`）と `languages` は任意。

```yaml
custom_rules:
  - id: team-tbd
    type: pattern
    pattern: 'TBD|未定'
    level: error
    name: 決まっていないことが残っている
    why: 「TBD」「未定」が残ったまま配ると、読み手は決まったものとして動きます。
    how_to_fix: 決める人と期限を書いてください。
    example:
      before: 公開日は TBD です。
      after: 公開日は 10 月 1 日です（佐藤が 9 月 20 日までに確定します）。
```

```
  5:6     error   決まっていないことが残っている:「TBD」
                  team-tbd
```

チームのルールは chaff のルールと同じに扱う。`explain` は例も出し、`rules --json`、`stet`、`relax`、baseline、SARIF もそのまま効く。
書き間違い（読めない正規表現、足りない説明、chaff のルールと同じ id）は、実行を止めて何が悪いかを言う。
`(a+)+` のように長い行で止まらなくなる正規表現、回数の決まらない繰り返し（`*`・`+`・`{1,9}`）が 4 つ以上あるもの、後方参照は、動かす前に断る。
それでも 1 文書に 1 秒以上かかった正規表現は止め、そのルールを「動いていない」一覧に理由付きで出す。

`type: module` のファイルは、文書を受け取って指摘（`{ start, end }`）の一覧を返す関数を `export default` する。型と `defineRule` は `chaffjs/api` にある。
読み込めないファイルは実行を止め、文書を見ている途中で関数がエラーを投げたら、そのルールだけを「動いていない」一覧に理由付きで出す。
いくつものチームで使うルール・語の一覧・スタイルは、プラグイン（`plugins: [chaff-plugin-foo]`）にまとめて配れる。ルールの名前は `foo/rule-id` になり、chaff のルールとぶつからない。
読み込むとそのコードが動くので、信頼できるものだけを入れる。作り方は手引きの「プラグインを作る」と [examples/chaff-plugin-example](examples/chaff-plugin-example) にある。

知らない rule 名（たいていは綴り違い）と読めない値は、検査と `rules --json` が標準エラーに出す。黙って捨てると、効いていない設定を効いていると思い込むため。

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

品詞を見る rule:

| rule | 何を見るか |
| --- | --- |
| `agentless-passive` | 受け身で、誰がしたのか書かれていない（ja / en） |
| `doubled-word` | 語を二度書いた（資料をを / the the / our the）（ja / en、試験中） |
| `agreement-slip` | 限定詞と名詞の単数・複数の食い違い（a significant changes）、主語の位置の所有の語（Your can check）（en、試験中） |
| `no-mixed-desumasu` | ですます調とである調の混在（ja） |
| `no-doubled-joshi` | 「弊社の新製品の販売の計画」のような入れ子（ja） |
| `taigen-dome-in-prose` | 本文の体言止めが続く（ja） |
| `stray-space` | 語句の途中の空白（こころさんが 払った / 確認 しました）。空けた所が文書の中で少ないときだけ（ja、試験中） |
| `katakana-long-vowel` | カタカナ語の語末の「ー」（コンピューター / コンピュータ）。既定は同じ語の混在だけ。`options` で省く・付けるを決める（ja、試験中） |
| `ra-nuki` | ら抜き言葉（見れる / 食べれる / 来れる）。一段・カ変動詞の未然形に付いた「れる」を品詞解析で読む。五段の可能（走れる）は指さない（ja、試験中） |
| `double-negative` | 二重否定（〜ないわけではない / not uncommon）。言い回しは語彙表（ja / en、試験中） |

品詞が要らない日本語の rule:

| rule | 何を見るか |
| --- | --- |
| `double-keigo` | 二重敬語（おっしゃられました） |
| `sasete-itadaku` | 「させていただく」の重なり |
| `hiragana-fukushi` | 表外漢字の副詞（殆ど・勿論） |
| `max-kanji-continuous` | 漢字の連続（情報処理推進機構認定試験） |
| `no-nakaguro-parallel` | 1 文に中黒の並列が何組も入る |
| `latin-spacing` | 英字・数字の前後の空白の有無が文書の中で混ざる（試験中） |
| `kutoten-consistency` | 読点（、と，）と句点（。と．）の書き方が文書の中で混ざる（試験中） |
| `fullwidth-alnum-consistency` | 英字・数字の全角（ＡＢＣ１２３）と半角（ABC123）が文書の中で混ざる。英字一字・語・数字一字・並びを別に比べる（試験中） |

英語固有の rule:

| rule | 何を見るか |
| --- | --- |
| `adverb-overuse` | -ly 副詞の密度 |
| `expletive-construction` | There is / It is ... that |
| `sentence-initial-conjunction-run` | And / But / So で始まる文の連続 |
| `title-case-consistency` | 見出しの大文字化が文書内で揃っているか |
| `oxford-comma-consistency` | 並列の読点が文書内で揃っているか |
| `contraction-consistency` | 短縮形の使いかたが文書内で揃っているか |
| `spelling-consistency` | イギリスとアメリカの綴り（colour / color）が文書内で揃っているか。-ise / -ize は別に比べる（試験中） |

揃っているかを見る rule は**どちらが正しいかを決めません**。1 つの文書で揃っているかだけを見て、少数派を指摘します。

Markdown の記法と URL を見る rule（ja / en、試験中）:

| rule | 何を見るか |
| --- | --- |
| `heading-level-skip` | 見出しの深さが飛ぶ（`##` の次の `####`） |
| `image-alt-text` | 代替テキストの無い画像（`![](図.png)`、alt 属性の無い `<img>`） |
| `broken-link` | 行き先の無いリンク（空の行き先、文書に無い見出しへのページ内リンク、定義の無い参照の形） |
| `url-run-on` | そのまま書いた URL のすぐ後ろに日本語や全角の記号が続き、リンクがそこまで伸びる（`https://example.jp/をご覧ください`）。`.txt` でも見る |
| `duplicate-heading` | 同じ親の見出しの下の、同じ言葉の見出し（版ごとの「Added」のように親が違えばよい） |
| `empty-section` | 中身の無い節。見出しのすぐ後ろに同じ深さか浅い見出しが来る（深い見出しが続くのはよい） |

記法の rule は Markdown の文書でだけ動き、`.txt` では「Markdown の文書ではないため」と出して止まります。

括弧と句読点を見る rule（ja / en、試験中）:

| rule | 何を見るか |
| --- | --- |
| `unbalanced-bracket` | 組になっていない括弧。閉じ忘れた「（」、開きの無い「」」、全角の「（」を半角の「)」で閉じたもの。「1)」「事例）」のような番号の印は数えない |
| `doubled-punctuation` | 句読点の重なり（`。。`、`、。`、`,,`、`i.e.,,`）。`...` や `。。。` のように三つ以上並べたものは数えない |

字を見る rule（試験中）:

| rule | 何を見るか |
| --- | --- |
| `invisible-character` | 見えない字（ゼロ幅の空白、途中の BOM、ソフトハイフン、文字の向きの指定、制御文字、字の後ろに隠れたタグ文字、見出しの印や日本語の隣のノーブレークスペース）。コードの中も見る（ja / en） |
| `hankaku-kana` | 半角の片仮名と半角の句読点（`ﾒｰﾙ`、`｡｢｣､･`）。コード・リンク・鉤括弧で引いた名前の中は数えない（ja） |
| `space-before-punctuation` | 句読点の前の空白（`word .`、`word ,`）。コロン、`. . .`、`.NET`、数の後ろは数えない（en） |

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

## 条文や仕様の構造を見る

契約書・規程・仕様書のように番号の付いた文書は、番地の付いた木として読めます。`.txt` の契約書も読みます。

```bash
npx chaffjs tree contract.txt                  S 式で出す（人と AI が読む）
npx chaffjs tree contract.txt --format json    JSON で出す
npx chaffjs tree contract.txt --language en    言語を決めて読む（推定や chaff.yaml より優先）
```

第3条第2項は `3.2`、Section 4.2(a) は `4.2.a` という番地になります。試験中の構造の rule が、存在しない条への参照（`dangling-reference`）、番号の抜け（`numbering-gap`）、同じ語の二重の定義（`duplicate-definition`）を見ます。

```bash
npx chaffjs cite contract.txt quotes.json
```

`quotes.json` は `[{ "address": "4.2", "quote": "…" }]`。`tree` と同じく `--format json` と `--language` を取ります。回答や要約の引用が原文のその番地に本当にあるかを確かめ、一つでも無ければ 1 で終わります。AI の回答を単体試験のように検査できます。chaff は確かめるだけで、書き換えません。

## 書き換えで事実が落ちていないか

AI っぽい文章を AI に大きく書き換えさせたあと、事実が落ちていないか、増えていないかを機械で確かめます。

```bash
npx chaffjs compare before.md after.md                      人が読む
npx chaffjs compare before.md after.md --json               AI が読んで直す（--compact は 1 件 1 行）
npx chaffjs compare before.md after.md --allow-dropped url  わざと削った種類は失敗にしない
npx chaffjs compare before.md after.md --distinct           一度でも書いてある事実は残ったとみなす（繰り返しを消してよい）
```

数（単位・通貨つき）、日付、時刻、URL、コード、固有名詞と `names:`、「」や "…" の引用、見出し、条項の参照、脚注を、lint と同じ読み手で取り出し、位置を見ずに数で比べます。

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

照合した事実 5 件 → 4 件: 数 2→2、日付 1→1、時刻 0→0、URL 1→0、コード 0→0、固有名詞 0→0、引用 0→0、見出し 1→1、条項の参照 0→0、脚注 0→0
落ちた事実 2 件、足された事実 1 件
```

落ちた事実か足された事実があれば 1 で終わります。1,000 と 1000、2026年4月1日 と 2026/4/1 のような書き方の違いは情報として出すだけです。読めなかった種類（品詞の解析器が無いなど）は理由を添えて出します。

全面的に書き直す前には、`facts` で事実の一覧を控えておけます。`compare` と同じ読み手で取り出すので、ここに並んだものが `compare` の照合する事実です。

```bash
npx chaffjs facts before.md            種類ごとのチェックリスト（行番号つき）
npx chaffjs facts before.md --json     AI が控えとして持つ（--compact は 1 件 1 行）
```

構成を変えたかどうかは `outline` で測ります。見出しの構成を出し、見出しの数、節の平均の長さ、箇条書きの割合、太字の数を測ります。2 つ渡すと前と後を並べます。

```bash
npx chaffjs outline before.md after.md       見出しの数 6 → 3 のように、形がどう動いたかを並べる
```

## Claude Code の skill

```bash
npx chaffjs skill              このフォルダの .claude/skills/chaff/ に入れる
npx chaffjs skill --global     ~/.claude/skills/chaff/ に入れる
```

Claude Code が chaff の使い方（かけ方、指摘の読み方、直す・`stet`・`relax --why` の選び方、`rules --json` での設定、`tree` と `cite`）を知っている状態になります。もう一度実行すると新しい版に入れ替えます。手で直したかもしれない、中身の違うファイルは `--force` を付けないと置き換えません。

## 指摘が誤っているとき

自分の文書で chaff が誤った指摘をした、または言うべきことを言わなかったときは、報告の下書きを作れます。

```bash
npx chaffjs feedback a.md --rule max-sentence-length --line 42   誤った指摘
npx chaffjs feedback a.md --missed --line 42                     見逃し
```

版・OS・一つの指摘と、その前後の 2 行ずつ、`chaff.yaml` のその rule の設定だけを `.chaff-feedback.md` に書き、送り方（`gh issue create -R isamu/lab --title … --body-file .chaff-feedback.md`、または題だけを載せたリンク）を示します。**chaff は何も送りません。** 文書の全体は載せないので、読んでから送るかを決めてください。`chaff.yaml` 全体も載せたいときは `--with-config` を付けます。報告は、そのまま試験と修正になります。

## 言い回しを見る rule

語彙表だけが言語別で、rule は共通です。

| rule | 何を見るか |
| --- | --- |
| `excessive-hedging` | 1 つの文に重ねた逃げの表現と、文書全体の逃げの表現の密度 |
| `cushion-phrase-density` | クッション言葉の密度 |
| `unqualified-superlative` | 比べる相手のない最上級 |
| `repeated-conjunction` | 段落が接続詞で始まり続けていないか |
| `ai-tell` | 生成文にありがちな言い回し（重み付き） |
| `contrast-framing` | 「単なる X ではなく Y」「It's not X, it's Y」の対比の枠の密度（試験中） |
| `stock-transition` | 「さらに」「加えて」「Moreover」で始まる文の密度（試験中） |
| `assistant-residue` | チャットの返事の名残（「私の知識は」「As of my last knowledge update」「お役に立てれば幸いです」）（試験中） |
| `unfilled-placeholder` | 埋め忘れた雛形の空欄（「【会社名】」「[Your Name]」）（試験中） |
| `announcing-opener` | 「重要なのは、」「ポイントは、」「Here's the thing」のように予告で始まる文が重なっていないか（試験中） |
| `colon-lead-in` | 「以下の通りです：」のように、コロンで箇条書きへ渡す文の密度（日本語のみ、試験中） |
| `bold-label-list` | 「- **速さ**：〜」のように、太字の札とコロンで始まる項目の数（日本語のみ、試験中） |

`ai-tell` は**単独で「AI が書いた」とは言いません**。どれも 1 つでは普通の日本語なので、
重みを足し合わせた点だけを出します。
`contrast-framing` と `stock-transition` も、1 つなら普通の書き方なので密度だけを見ます。
`assistant-residue` は、知識の期限や AI としての断り書きなら 1 つで、人も書く礼の言葉は 2 つ重なったときに言います。
`unfilled-placeholder` は文体ではなく埋め忘れなので 1 つで言います。例として置いた「○○」は数えません。
`announcing-opener` は文頭の予告を数で見ます（人の記事も長さによらず 1 つ 2 つは書くため）。
`colon-lead-in` は説明書・法務・技術文書のジャンルでは見ません。英語の文書は、人も同じくらいこの形で書くので見ません。
`bold-label-list` はブログ・ビジネス文書・話し言葉だけで見ます。札がコードだけの項目（引数や設定の一覧）は数えません。英語の文書は、人もよくこの形で書くので見ません。
`ai-tell`（日本語）には、技術文の比喩（「静かに壊れる」「黙って無視される」「時間を溶かす」）も入っています。
入れるかどうかは、生成 AI 以前の技術記事と corpus で測って決めました。「解像度を上げる」「腹落ち」のように、以前から人が同じくらい書いていた語は入れていません。

AI っぽい rule がどれだけ正確かは `yarn bench:ai` で測れます。同じ中身を、人の書きぶり・生成文の書きぶり・書き直した版の 3 通りで書いた見本（`test/fixtures/ai-samples/paired/`）と corpus にかけ、rule ごとに生成文の版に当たった数と、それ以外に当たった数（誤報）を出します。

直すときは、まず `npx chaffjs fix-plan article.md --experimental` で「直す計画」を出します。指摘をルールごとにまとめ、ルールのファイルの `rewrite:` に書いた直す方向、変えないもの、やりがちな間違い、直す前と後の例を付け、勧める直し方と、直したあとにかけるコマンドを並べます。chaff は書き直さず、計画を読む人か AI が書き直します。

直し方は 3 つあります。指摘された所だけ直す部分直し、構成を残して節ごとに直す書き直し、構成から作り直す全面書き直しです。
ブログとエッセイ、`ai-generated-composite` が出た文書には全面書き直しを勧めます。`facts` で事実の控えを取り、`outline` で構成の変化を測り、`compare` で事実が残ったかを確かめます。
手順と例は手引きの「AIっぽさを直す」に、AI 向けの手順は `npx chaffjs skill` で入る skill にあります。

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

チームの固有名詞（組織名・製品名）は `names:` に並べます。並べた名前は 1 つの名前として読み、
`max-kanji-continuous`（漢字の連なり）・`ngram-repetition`（繰り返し）・`undefined-acronym`（略語）では数えず、
`proper-noun-density` では何語に割れても 1 つと数えます。名前の外に続く漢字は今までどおり数えます。

```yaml
names:
  - 個人情報保護委員会
  - 国土交通省鉄道局総務課
```

鉤括弧でまるごとくくった漢字の連なり（「英国大使館別荘記念公園」）は、`names` に書かなくても `max-kanji-continuous` が数えません。

## 揃ったときだけ言う

単独では普通の文章に出る特徴が、同じ文書で 3 つ以上そろったときだけ 1 件にまとめます。

```
「ai-tell、rule-of-three、padded-intro、closing-cliche」が同じ文書にそろっています（4 種、3 種から）
```

**これでも「AI が書いた」とは言いません。** 読み直す場所の目印です。元の指摘も消しません。

## 既定で動く rule と、そうでない rule

一部の rule だけが既定で動きます。残りは試験中で、`--experimental` か `chaff.yaml` の `rules:` に名前を書くと動きます。どれが動いているかは `npx chaffjs rules --json` の `now` と、画面の最後の「動いていない rule」の一覧で分かります。

既定に入れる条件は 3 つで、**実文書で発火したこと**が要ります。

1. 実際に公開された文書（`examples/`）で発火した
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
| `blog-ja/` | 日本語の技術記事 |
| `blog-en/` | 英語の技術記事 |
| `business-ja/` | 会の文書 |

CI でも毎回かけています。指摘の数では落としません（文章の好みの問題なので）が、**実文書で chaff が最後まで動かなければ落ちます**。

## ジャンルが変えるもの

ジャンル（[文書の種類を選ぶ](#文書の種類を選ぶ)）は、動く rule と閾値を変えます。仕様書に「つかみ」も「締め」も要らず、法令の一文は長くて当然です。

- **どの rule を動かすか。** `packages/chaff/genres.yaml` の `rules:` に、ジャンル（と、その群）ごとの段を書いています。
  止めた rule は「動いていない」一覧に、ジャンルを理由に出ます（`ngram-repetition（ジャンル legal/contract では見ないため）`）。
  `legal/contract` と `legal/statute` は、試験中の構造の rule（無い条項への参照・番号の抜け・二重の定義・曜日違い・合わない合計）を既定で動かします。
- **閾値。** 同じ `normal` でも、ジャンルで数字が違います（rule の `by_genre`）。法令・判決・論文の一文は長くてよい。
- **文書の知識。** `legal/statute` は法令の書き方（`statute`）で読みます。

`chaff.yaml` の `rules` はジャンルより強いので、ジャンルが止めた rule も `rules:` に `ngram-repetition: normal` と書けば動きます。

判定はパスと内容から自動で行い、1 行目に根拠つきで出ます。`README.md`、`*-spec.md`、`docs/` は技術文書として見ます。
`chaff.yaml` の `genre` で決めるか、その実行だけなら `--genre` で決めます（`chaff.yaml` より優先）。
一覧（`npx chaffjs genres`）に無いジャンルを書くと、何も検査せずに止まります。
front matter の `genre:` が一覧に無いときは、使わずにそう言い、パスと内容から決めます。
どれでも決まらず既定に落ちた文書だけに、見当（「契約書・規約のようです」）を出します。

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

## 文書の種類（profile）

法令の番地（「第二十二条第二項」）、条の前の行の見出し（「（解雇の予告）」）、前条・同項のような相対の参照のように、ある種類の文書にだけ通じる書き方は、コードではなく `packages/chaff/profiles/*.yaml` に書く。
選ばれた文書にだけ効く。書かなければ内容から選び（`statute` は「第一条　」の形の行が 3 行以上）、`chaff tree` の `:profile` に出る。
`chaff.yaml` の `profile: statute` で選び、`profile: none` で止める。`by_path` にも書ける。
同梱していない種類を書くと、何も検査せずに止まり、どこに書いたかと使える種類を言う。

## パスごとに設定を変える

```yaml
genre: blog/tech

by_path:
  - files: ["business-ja/**/*.md"]
    genre: business/report
  - files: ["blog-en/**/*.md"]
    language: en
  - files: ["laws/**/*.txt"]
    profile: statute
```

後に書いたものが勝ちます。照合は**設定ファイルのある場所からの相対**なので、どこで実行しても結果が変わりません。

## 構成

```
text/                      yarn workspaces のルート
  packages/chaff           core。npm 名 chaffjs
    rules/*.yaml           rule 定義。分岐も式も書かない
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

パッケージ間の import は**型だけ**にする。アダプタは chaff の値に依存せず、単体で動く。

同梱していない言語は、`@chaffjs/lang-<言語>`、無ければ `chaff-lang-<言語>` を探して読む。公式は `@chaffjs/lang-<言語>`、第三者は `chaff-lang-<言語>` と名乗る。語彙表だけでは足りず、文の区切り方などを持つ言語パッケージが要る。

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
yarn corpus        # corpus にかけて corpus/expected.txt と比べる（--verbose で指摘も出す、--update で書き換える）
yarn corpus:health # URL の文書をすべて取り直す。取れない・コミットした写しと上流が違う・結果が変わった、を報告する（週次の CI と同じ）
yarn bench         # 誤りを植えた見本で見逃しを数える（--verbose、--update は corpus と同じ）
```

CI は `.github/workflows/chaff-ci.yml`。`text/**` を触る PR でだけ走り、ubuntu / macOS / Windows の 3 面で回す。
