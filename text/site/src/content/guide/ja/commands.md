# コマンド

chaff のコマンドとオプションを一覧にしました。どれも、何が起きるかを横に一言添えてあります。
自分で打つときは、`chaff` の前に `npx` を付けて `npx chaffjs` と打ちます。

## コマンドの一覧

`npx chaffjs --help` で出る一覧を、表にまとめました。

| コマンド | 何が起きるか |
| --- | --- |
| `npx chaffjs <file\|dir\|glob>...` | 検査します。設定も API key も要りません |
| `npx chaffjs .` | この場所の Markdown を全部見ます |
| `npx chaffjs init` | `chaff.yaml` を作ります（端末ならジャンルを尋ねます。`--genre` でも決まります） |
| `npx chaffjs explain <rule>` | そのルールの意図と根拠を読みます |
| `npx chaffjs genres` | ジャンルの一覧を、何向けかと一緒に出します |
| `npx chaffjs --version` | chaffjs と、同梱の言語パッケージの版を出します |
| `npx chaffjs rules` | ルールの一覧を、グループごとに表で出します。いまの段階もわかります |
| `npx chaffjs rules --json` | いまの設定とルールの説明を JSON で出します。AI に渡す用です |
| `npx chaffjs relax\|strict\|off <rule>` | ルールの強さを変えます。`--why "理由"` を添えます |
| `npx chaffjs baseline <dir>` | いまある指摘を棚上げします |
| `npx chaffjs suppressions <dir>` | `stet` で黙らせている指摘を数えます |
| `npx chaffjs tree <file>` | 文書を番地の付いた木にします |
| `npx chaffjs cite <原文> <引用.json>` | 回答の引用が原文にあるかを確かめます |
| `npx chaffjs skill` | Claude Code の skill を入れます。`--global` を付けると `~/.claude/` に入れます |
| `npx chaffjs feedback <file> --rule <rule>` | 誤った指摘や見逃しの報告の下書きを作ります。何も送りません |
| `npx chaffjs test <file\|dir>...` | 意味を読む検査も動かします。API key が要ります |
| `npx chaffjs eval <dir>` | 手元の文書で閾値を測り直します |

検査のときに付けられるオプションは、次のとおりです。

| オプション | 何が起きるか |
| --- | --- |
| `--compact` | エンジニア向けの 1 行形式で出します |
| `--watch` | 保存のたびに見直し、変わったところだけ出します |
| `--experimental` | 試験中のルールも動かします |
| `--genre <ジャンル>` | この回だけジャンルを決めます。`chaff.yaml` より優先します |
| `--show-baseline` | 棚上げした分も含めて全部見ます |
| `--sarif <path>` | 指摘を SARIF で書き出します。GitHub の PR の行に出すためです |

`tree` と `cite` は [構造と引用](./structure) で、`--sarif` は [CI](./ci) で詳しく説明します。

## 1 行ずつ短く見る

`--compact` を付けると、1 件の指摘を 2 行で出します。
上の行は「行:列」「重さ」「本文」で、下の行はルール名です。

```
$ npx chaffjs sample.md --compact

sample.md   blog/tech · 日本語   ジャンルは既定から

  62:1    info    この文に中黒が 7 個あります（5 個まで）
                  no-nakaguro-parallel
  83:1    warning この文は 102 文字あります（100 文字まで）
                  max-sentence-length
  132:1   info    本文に体言止めが 11 文あります（4 文まで）
                  taigen-dome-in-prose
  170:22  warning この文は 102 文字あります（100 文字まで）
                  max-sentence-length
  344:1   warning この文は 129 文字あります（100 文字まで）
                  max-sentence-length

指摘 5 件、動いていない rule 40 件
```

最後の行は、指摘の数と、動かなかったルールの数です。

## 書きながら見る

`--watch` を付けると、保存するたびに見直します。出すのは変わったところだけです。
全件を出し直すと、何が変わったのか分からなくなるためです。

```
$ npx chaffjs article.md --watch

  1 ファイルを見ています。いまの指摘は 2 件です。
  保存するたびに、変わったところだけ出します。止めるには Ctrl-C。

08:21:41  article.md  ✓ 2 → 1 件   (-1 bold-density)
08:21:44  article.md  ✗ 1 → 2 件   (+1 closing-cliche)
```

`✓` は指摘が減ったこと、`✗` は増えたことを表します。
括弧の中には、増えたり減ったりしたルールの名前が出ます。

## 試験中のルールも動かす

既定では、試験中のルールは動きません。`--experimental` を付けると、それも動きます。

```bash
npx chaffjs report.md --experimental
```

試験中のルールを既定に入れるには、次の 3 つを満たす必要があります。

1. 実際に公開された文書で発火した
2. 出た指摘を読んで、正しいと判断できた
3. `npx chaffjs eval` の目標（誤検知率 5% 未満）を満たしている

一度も発火していないルールは、既定に入れません。
合成した文書で動くことは、壊れていない証拠にはなります。
それでも、既定で出してよい証拠にはならないためです。

## ルールの中身を見る

`explain` は、ルールが何を見て、なぜそうするのかを出します。
`strict` `normal` `relaxed` の裏にある数字と、いまの強さも出ます。

```
$ npx chaffjs explain max-sentence-length

  一文が長すぎる   (max-sentence-length)

  長い文は、読んでいるうちに主語を見失います。

  直しかた: 接続助詞のところで 2 文に割ってください。それだけで読めるようになります。

  設定できる値（単位: 文字）:
    strict   70
  → normal   100
    relaxed  140
    off      見ない

  この数字は 既定 のものです。ほかに business/email / business/meeting-notes / business/proposal / business/press-release / blog/essay / blog/owned-media / legal / legal/statute / legal/judgment / academic で別の数字を持っています。

  いまは normal です。

  変える:  npx chaff relax max-sentence-length --why "理由"
```

## コマンドでルールを変える

`relax` `strict` `off` は、`chaff.yaml` を開かずにルールの強さを変えます。
`relax` はゆるめ、`strict` はきびしくし、`off` は止めます。
番号の抜けのように数えるもののないルールでは、`relax` は指摘を消さずに一段軽くします（[数えるもののないルール](./configuration#数えるもののないルール)）。

```
$ npx chaffjs relax bold-density --why "図の説明で太字を多用するため"
bold-density を relaxed にしました（…/chaff.yaml）
```

`chaff.yaml` には、ルールの説明のコメントと、日付・理由・名前が入ります。

```yaml
rules:
  # 太字の使いすぎ
  # 太字は読者の目を止める道具です。多用すると、どこも目立たなくなります。
  bold-density: relaxed # 2026-09-28 図の説明で太字を多用するため / isamu
```

`chaff.yaml` にもともと書いてあったコメントは壊しません。
既に理由があるルールを変えるときは、`--why` で新しい理由が要ります。
古い理由が新しい値に残ると、履歴が嘘になるためです。

```
$ npx chaffjs off bold-density
bold-density には既に理由が書かれています:
  2026-09-28 図の説明で太字を多用するため / isamu
値を変えるときは --why で新しい理由を書いてください。
```

## ジャンルの一覧を見る

`genres` は、書けるジャンル（文書の種類）を、群ごとに、何向けかと一緒に出します。

```
$ npx chaffjs genres

  ジャンル（文書の種類）を選ぶと、その種類の書き方に合わせて見ます:

  技術文書
    technical/spec          仕様書・RFC・設計文書。読み手に間違えさせないための文書
    technical/readme        README と開発者向けの説明

  ブログ
    blog/tech               技術記事。ジャンルを決めないときはこれで見ます
    blog/essay              自分の考えを書くブログのエッセイ
    blog/owned-media        会社や団体が読者に向けて出す記事

  ビジネス文書
    business/proposal       提案書・企画書・計画書
    business/report         報告書・白書・社内文書
    business/email          仕事のメールと手紙
    business/press-release  プレスリリースと、お知らせ
    business/meeting-notes  議事録・議事要旨

  法務
    legal/contract          契約書・利用規約・プライバシーポリシー
    legal/statute           法令・規則・社内規程・通達
    legal/judgment          判決文・決定
    legal/patent            特許の明細書と請求項

  説明書
    docs/manual             使い方の説明・手順書・ヘルプ
    docs/faq                問いと答えを並べたページ
    docs/glossary           用語と、その説明を並べたページ

  学術
    academic/paper          論文と、その要旨

  文学
    literature/fiction      小説・物語
    literature/essay        文学としての随筆。ブログのエッセイは blog/essay
    literature/poetry       詩・短歌・俳句
    literature/play         戯曲・脚本

  話し言葉
    speech/address          読み上げるために書いた演説・挨拶
    speech/transcript       話したことを書き起こした記録（会見・国会の会議録）

  この実行だけ:    npx chaffjs --genre legal/contract 契約書.md
  この場所に決める: npx chaffjs init --genre legal/contract   （chaff.yaml の genre に書きます）
```

`--genre` を付けると、その回だけジャンルを決められます。`chaff.yaml` の `genre` より優先します。
画面の 1 行目は `ジャンルは--genreから` になります。

いつも同じジャンルにするには、`npx chaffjs init --genre <ジャンル>` で `chaff.yaml` を作るか、`chaff.yaml` の `genre` に書きます。
ジャンルごとに見ないルールと足すルールは、[ジャンルのページ](../../genres/)にあります。

## いまある指摘を棚上げする

既にたくさんの文書があると、最初にかけたときに指摘が大量に出ます。
全部直してから始めるのは無理なので、`baseline` でいまある指摘を棚上げします。

```
$ npx chaffjs baseline docs/

  1 ファイルを走査しました。

  1 件の指摘を .chaff-baseline.json に記録しました。
  以後、これらは報告されません。新しく増えたものだけが出ます。

  .chaff-baseline.json を commit してください。
```

以後は、棚上げした指摘は出ません。画面の 1 行目に、棚上げした数が出ます。

```
$ npx chaffjs docs/ --compact

docs/a.md   technical/readme · 日本語   ジャンルはパスから   棚上げ 1 件


指摘 0 件、動いていない rule 27 件
```

棚上げした分も見たいときは、`--show-baseline` を付けます。

```
$ npx chaffjs docs/ --show-baseline --compact

docs/a.md   technical/readme · 日本語   ジャンルはパスから

  3:1     warning この文は 108 文字あります（100 文字まで）
                  max-sentence-length

指摘 1 件、動いていない rule 27 件
```

CI に入れるときの使いかたは、[CI](./ci) で説明します。

## 黙らせた箇所を数える

`stet` で黙らせた指摘は、`suppressions` で数えられます。
同じルールを何度も黙らせているなら、ルールを変える道を選ぶ時期です。

```
$ npx chaffjs suppressions docs/

  抑制されている指摘: 7 件

  bold-density                7 件  ← 設定の見直しを検討してください
      docs/g1.md, docs/g2.md, docs/g3.md ほか 4 ファイル
      理由: 用語集なので太字が多いのは意図的
      ルールごとゆるめる: npx chaff relax bold-density --why "..."

  理由が書かれていない抑制: 1 件
      docs/x.md
```

理由を書かずに黙らせた箇所も、ここに出ます。

## 意味を読む検査と閾値の測り直し

この手引きでは、次の 2 つは名前だけ紹介します。

| コマンド | 何が起きるか |
| --- | --- |
| `npx chaffjs test <dir>` | 機械では判定できないものを AI に読ませます。API key が要ります |
| `npx chaffjs eval <dir>` | 手元の文書を使って、閾値が合っているかを測り直します |
