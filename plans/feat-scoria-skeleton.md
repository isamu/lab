# scoria 歩く骨格

issue: #5 / spec: `coding/scoria-spec.md`（#3）

## 目的

probe を 9 本書いてから spec §8 の contract の誤りに気づくと手戻りが大きい。
probe 2 本で **contract → probe → rubric → report → CLI** を縦に 1 本通し、契約が成立するかを先に確かめる。

## 構成

```
coding/                          yarn workspaces のルート
  packages/scoria                core。npm 名 scoria
    src/plugin.ts                contract（型のみ。実装を持たない）
    src/files.ts                 走査・読み込み・FileKind 付与
    src/stats.ts                 percentile など純関数
    src/rubric.ts                scale → 点。線形 + clamp
    src/rubric-load.ts           YAML 読み込みと declares の検証
    src/probes/suppression-scan.ts
    src/probes/file-shape.ts
    src/report.ts                ProbeResult → Report
    src/diff.ts                  Report 2 つ → movers（純関数）
    src/render.ts                Report → 端末出力
    src/cli.ts
    rubrics/{readability,integrity}.yaml
  packages/stack-ts              @scoria/stack-ts。classify と detect
  test/                          node:test
```

## 設計上の判断

### probe には分類済みのファイル集合を渡す

spec §8 は probe が `StackAdapter.classify` 以外でファイル種別を判定することを禁じている。
これを静的検査で守るのではなく、**contract の形で守る**。
core が走査・読み込み・分類を済ませた `SourceFile[]` を `ProbeContext` に載せて渡し、
probe は生のパスを受け取らない。規約違反が書けなくなる。

fs / child_process の直接呼び出しの禁止だけは構造で防げないので、静的検査で見る（§26.2）。

### baseline は作らないが、差分の純関数は作る

baseline のファイル入出力は範囲外。しかし「差分の帰属」は線形 scale を選んだ理由そのもの（§16.2）であり、
`Σ movers[].points == dimension.delta` は設計を守る不変条件（§26.3）。
`diff.ts` を Report 2 つを受け取る純関数として実装し、テストする。
baseline の永続化は次の issue。

### scale は spec の値をそのまま使う

スパイクで `sloc_p95` の good:150 は厳しすぎると分かった（maintained な repo は 261〜331）が、
勝手に直さない。spec を single source of truth とし、実測とのずれは CLI の出力で見えるようにして、
較正の判断材料にする（issue #5 の「決めること」）。

## 手順

1. workspaces ルート、tsconfig、prettier、oxlint
2. `plugin.ts` — contract
3. `stack-ts` — classify
4. `files.ts` — 走査と分類
5. `stats.ts` → `rubric.ts` → `rubric-load.ts`
6. probe 2 本
7. `report.ts` → `diff.ts` → `render.ts` → `cli.ts`
8. test と fixture
9. 実 repo 3 本で実行し、issue #5 の実測値と照合
10. CI

## 完了条件

issue #5 の 9 項目。
