# scoria

TypeScript / JavaScript のコード品質を、既存ツールの機械証拠から定量化し、時系列の変化として提示するハーネス。

設計仕様: [scoria-spec.md](./scoria-spec.md)

現在は **歩く骨格**（issue #5）。probe contract が成立するかを確かめるために、
probe 2 本で contract → rubric → report → CLI を縦に 1 本通した段階であり、まだ実用品ではない。

## 使う

```bash
yarn install
yarn build
node packages/scoria/bin/scoria.js <dir>
node packages/scoria/bin/scoria.js <dir> --json
node packages/scoria/bin/scoria.js <dir> --explain readability
```

出力の例:

```text
/path/to/repo  [ts]
450 files · 16637 sloc · 17003 test sloc

  Dimension            Score   Confidence
  ──────────────────────────────────────────────────────────────
  integrity               46   high
  readability             86   medium   27 suppressions in scope
  ──────────────────────────────────────────────────────────────
  Overall                 66   not comparable across repos
```

**スコアは repo 間で比較できない。** 正規化の仕方も、有効な probe も、プロジェクト自身の基準の厳しさも
repo ごとに違う。意味があるのは同じ repo の時系列の変化だけで、report JSON はこれを
`"comparable": false` として構造に持つ（spec §3.3）。

## いま動くもの

|           |                                                                  |
| --------- | ---------------------------------------------------------------- |
| probe     | `suppression-scan`（抑制債務）、`file-shape`（ファイルの大きさ） |
| dimension | `integrity`、`readability`                                       |
| tier      | 0 のみ。ビルドもテスト実行も外部ツールも要らない                 |
| mode      | `report` のみ。何もゲートしない                                  |

## まだ無いもの

外部 probe（eslint / knip / dependency-cruiser / jscpd）、baseline と ratchet、検出の凍結、
`scoria init`、GitHub Action、SARIF、較正。すべての dimension は `experimental` であり、
scale の `good` / `bad` は較正前の暫定値。

## 構成

```text
packages/scoria       core。contract / rubric / report / CLI / 内製 probe
packages/stack-ts     @scoria/stack-ts。FileKind の分類
test/                 node:test。fixture は test/fixtures/
```

`@scoria/stack-ts` が `scoria` に対して持つのは型の依存だけで、実行時には消える（peerDependency）。
probe は stack に依存せず、stack は probe に依存しない。
新しい stack を足したときに probe の変更が要るなら、切り分けが間違っている（spec §7）。

## 開発

```bash
yarn format:check && yarn lint && yarn typecheck && yarn build && yarn test
```

lint は `~/ss/llm/ever-better` の段に合わせている。`noInlineConfig` が有効なので
`eslint-disable` は書けない。scoria は抑制債務を測るツールであり、自分の抑制がゼロであることに意味がある。
