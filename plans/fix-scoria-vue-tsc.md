# scoria: Vue プロジェクトは vue-tsc で型を見る

issue: #1458

## 方針

- どの検査器を使うかを純関数 `chooseTypeChecker`（`packages/scoria/src/type-checker.ts`）に切り出す。入力は stack と、対象リポジトリから bin を引く関数
- Vue の stack なら `vue-tsc`。入っていなければ `tsc` で代用せず「見つからない」を返し、probe は skipped になる
- それ以外は従来どおり `tsc`
- `toolVersions` のキーは使った検査器の名前にする。検査器が変わると baseline 比較で道具の変更として扱われ、その回の上下は退行と見なされない
- finding の rule（`tsc/TS…`）と metric の id は変えない

## 確認

- receptron/GUIChatPluginSpreadsheet で、プロジェクト自身の `vue-tsc --noEmit` と scoria の型エラー件数が一致すること
