# scoria: 道具が動かなかった次元の信頼度を下げる

issue: #1456

## 方針

- 判定は純関数 `judgeConfidence`（`packages/scoria/src/confidence.ts`）に切り出す。入力は抑制の密度・件数、rubric の重みの合計、動かなかった probe とその重み
- 二つの信号の低い方を採る。抑制は従来の閾値のまま。動かなかった重みの割合は、0 より大きければ medium、半分以上なら low
- 理由は、採った水準に効いた信号のものだけを出す。両方が同じ水準なら両方
- 「動かなかった」は probe の status が skipped で、`notApplicable` でないもの。absent は「本来あるべきものが無い」で 0 点として測られているので含めない
- `notApplicable` を付けるのは: source-mix（JS プロジェクト）、ui-token（UI ファイルが無い）、tsc（JS プロジェクトで tsconfig が無い）
- probe は動いたが値を出さなかった metric（引数が無いので文書化率が無い等）は当てはまらないものとして扱い、下げない

## 確認

- 抑制だけで決まる場合（全 probe が動いた場合）は旧実装と同じ結果になることを、生成した入力で旧コードと並べて確かめる
- 実リポジトリ（receptron/GUIChatPluginSpreadsheet）で旧版と新版を走らせ、点数が変わらず信頼度だけが変わることを見る
