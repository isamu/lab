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

## 使いはじめ

```bash
npx chaff .                    この場所の Markdown を全部見る
npx chaff docs/ README.md      ディレクトリもファイルも glob も混ぜてよい
npx chaff init                 chaff.yaml を作る
npx chaff explain bold-density そのルールの意図と根拠を読む
npx chaff genres               ジャンルの一覧
```

`node_modules` `dist` `build` `coverage` は見ない。対象が 1 つも見つからなければ**失敗にする**（「CI は通っているが何も検証していない」状態を作らないため）。

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

L2 語彙表 / L3 品詞解析 / L4 意味の検査（`checks.yaml`）/ `baseline` / `suppressions` / `eval` / `--watch`。

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
  packages/lang-ja         @chaff/lang-ja。文分割（Tier 0）
  packages/lang-en         @chaff/lang-en。文分割（Tier 0）
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
