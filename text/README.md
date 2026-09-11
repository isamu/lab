# chaff

文章の読みにくいところを見つける道具。**文章は書き換えない。** 直すのは書いた人。

`coding/` の scoria がコードの品質を測るのに対して、こちらは文章の品質を測る。

```bash
npx chaff article.md
```

## いまどこまで動くか

L1 rule が 5 本。設定ファイルも API key も言語指定も要らない。

```
$ npx chaff article.md

article.md   blog/tech · 日本語   ジャンルは既定から

─── 5 行目 ───────────────────────────────────────────────

    キャッシュの仕組みについて説明します。

  ⚠  見出しの繰り返し

     見出し「キャッシュの仕組み」を直後の文がほぼそのまま繰り返しています
     見出しで言ったことを次の文が繰り返すと、読者はそこで何も受け取れません。

     → 見出しが約束したことの中身から書き始めてください。

     このルールをゆるめる:  npx chaff relax heading-echo

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
$ npx chaff en.md --compact

  3:67   warning "it is important to note that" emphasises without saying anything
                 empty-intensifier
  3:1    warning "in today's fast-paced world" is an opening that fits any article
                 padded-intro
  11:1   warning Closes with "in conclusion"
                 closing-cliche
```

## 使いはじめ

```bash
npx chaff .                    この場所の Markdown を全部見る
npx chaff docs/ README.md      ディレクトリもファイルも glob も混ぜてよい
npx chaff init                 chaff.yaml を作る
npx chaff explain bold-density そのルールの意図と根拠を読む
npx chaff genres               ジャンルの一覧
npx chaff baseline docs/       いまある指摘を棚上げする
npx chaff suppressions docs/   stet で黙らせている指摘を数える
```

`node_modules` `dist` `build` `coverage` は見ない。対象が 1 つも見つからなければ**失敗にする**（「CI は通っているが何も検証していない」状態を作らないため）。

## 指摘されたら、道は 3 つ

どれを選んでもよい。3 つ目があることが大事で、これが無いと「うるさいから使わない」で終わる。

| 道 | どんなとき | やること |
| --- | --- | --- |
| **直す** | 指摘がもっともなとき | 文章を書き直す |
| **この箇所だけ黙らせる** | 指摘は正しいが、ここは意図的なとき | `<!-- stet: rule-id — 理由 -->` |
| **ルールを変える** | 自分たちの方針に合わないとき | `npx chaff relax rule-id --why "理由"` |

抑制の範囲は 3 つ。

```markdown
<!-- stet: bold-density — 用語集なので意図的 -->          直後の箇所だけ
<!-- stet-section: bold-density — 一覧なので -->          次の見出しまで
<!-- stet-file: ai-tell, rule-of-three — 引用が多い -->   ファイル全体
```

同じルールを何度も黙らせているなら、それは 3 つ目を選ぶべきサイン。`chaff suppressions` が数えて教える。

```
$ npx chaff suppressions docs/

  抑制されている指摘: 6 件

  bold-density                6 件  ← 設定の見直しを検討してください
      docs/g1.md, docs/g2.md, docs/g3.md ほか 3 ファイル
      理由: 用語集なので太字が多いのは意図的
      ルールごとゆるめる: npx chaff relax bold-density --why "..."

  理由が書かれていない抑制: 1 件
      docs/x.md
```

## 既にある文書に入れる

記事が 200 本ある repo に入れると数千件出る。全部直してから始めることは誰にもできない。

```bash
npx chaff baseline docs/       いまある指摘を棚上げする
```

以後、棚上げしたものは報告されず、**新しく増えたものだけ**が出る。`.chaff-baseline.json` を commit すれば、チーム全員が同じ地点から始められる。

行番号ではなく内容で同定するので、前後に段落を足しても棚上げは剥がれない。棚上げ分も見たいときは `--show-baseline`。

## 設定は 4 つの言葉だけ

数字は書かない。`chaff.yaml` を開かずにコマンドでも変えられる。

```bash
npx chaff relax bold-density --why "図の説明で太字を多用するため"
```

```yaml
rules:
  # 太字の使いすぎ
  # 太字は読者の目を止める道具です。多用すると、どこも目立たなくなります。
  bold-density: relaxed # 2026-09-11 図の説明で太字を多用するため / isamu
```

説明コメントは自動で入り、既存のコメントは壊さない。既に理由があるものを変えるときは `--why` が要る。古い理由が新しい値に残ると履歴が嘘になるため。

AI に設定を書かせるときは `npx chaff rules --json` を渡す。今の値・使える値・なぜ今 off なのか・変更コマンドが 1 つに入っている。

## まだ無いもの

L3 品詞解析 / L4 意味の検査（`checks.yaml`）/ `eval` / `--watch`。

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
  packages/lang-ja         @chaff/lang-ja。文分割と語彙表
    lexicons/*.yaml        L2 の語彙。ここだけが言語別
  packages/lang-en         @chaff/lang-en。同上
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
