# scoria: 再利用ワークフロー（計測・SARIF・バッジ）

issue: #1462

## 方針

- `.github/workflows/scoria-measure.yml` を `on: workflow_call` で置く。呼び出し側は `uses: isamu/lab/.github/workflows/scoria-measure.yml@<sha>` の数行だけにする
- ジョブを権限で分ける
  - `measure`: `contents: read` のみ。プロジェクトのコード（install、`before`、scoria）はここでしか動かない。出力は `scoria-out/` にまとめて artifact に
  - `upload`: `security-events: write`。プロジェクトのコードは動かさない。fork からの PR では動かない
  - `badge`: `contents: write`。デフォルトブランチへの push のときだけ。`badges` ブランチ（orphan）に JSON を置き、変化が無ければ commit しない。トークンは push の URL にだけ渡し、git config には残さない
- 書き込み権限を持つジョブの action は SHA で固定する。呼び出し側にも SHA での固定を求める
- 出力を `scoria-out/` にまとめるのは、`targets` が複数のとき scoria がファイル名にディレクトリ名を挟むため

## 確認

- actionlint
- バッジを置くシェル部分を、手元の bare リポジトリをリモートにして 初回 / 変化なし / 変化あり の 3 通りで動かす
- receptron/GUIChatPluginSpreadsheet をこれを呼ぶ形に置き換え、PR で measure / upload、マージ後の push で badge が動き、README のバッジが出ることを見る

## 範囲外

- `targets` が複数のときの SARIF。1 つの upload に複数の run が入る。lab 自身はディレクトリごとに upload を分けている
