# chaff

文章の読みにくいところを見つける道具。**文章は書き換えない。** 直すのは書いた人。

`coding/` の scoria がコードの品質を測るのに対して、こちらは文章の品質を測る。

```bash
npx chaff article.md
```

## いまどこまで動くか

歩く骨格まで。言語の判定と文の分割が動き、rule はまだ 1 つも実装されていない。

```
$ node packages/chaff/bin/chaff.js chaff-workflow-spec.md

chaff-workflow-spec.md   日本語   本文から推定 (0.45)

  193 文 / 平均 90 文字
  いちばん長い文: 858 文字  (2630 文字目から)

  まだ rule は実装されていません。文章は書き換えていません。
```

Markdown をまだ解析していないので、コードブロックも本文として数えている。MVP（issue #2）で直す。

## 構成

```
text/                      yarn workspaces のルート
  packages/chaff           core。npm 名 chaff
    src/plugin.ts          contract（型のみ。実装を持たない）
    src/detect-language.ts アダプタを読む前の言語の当て推量
    src/detect.ts          言語の推定
    src/adapter-load.ts    アダプタの実行時解決
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
