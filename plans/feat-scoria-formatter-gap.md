# scoria: 整形ツールの欠けを integrity で減点する

issue: #1452

## 目的

整形ツールが入っていないプロジェクトを、ESLint 設定の欠けと同じく「自分で課しているゲートの抜け」として扱う。

## 方針

- `config-integrity` に `formatter-missing`（warning）を足す。`doctor` に表示され、`gap_ratio` の分子に入る。検査数の定数も一つ増やす
- 判定は `package.json` の dependencies / devDependencies / peerDependencies に `prettier` / `@biomejs/biome` / `dprint` のどれかがあるか（既存の `hasDependency` を使う）
- 設定ファイルだけあって依存が無いものは「入っていない」。エディタだけで効く整形は CI で検査できない
- `--fix` はしない。ツール選びと導入は判断が要る

## 範囲外

- monorepo でルートにだけ依存がある場合も警告になる。ESLint 設定の判定と同じ制限
