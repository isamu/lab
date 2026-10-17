# scoria: グラフを横向きにする

issue: #1454

## 方針

- `renderChart` が出す Mermaid を `xychart-beta horizontal` にする。次元名が縦軸に一行ずつ並ぶので、次元が増えても重ならない
- 棒（今回）と線（baseline）の意味は変えない
- 確認: 実際の scoria 実行で得た要約からグラフを取り出し、Mermaid 11 で描画した画像を目で見る。GitHub 上の表示は、この PR の `quality` ジョブの要約で確かめる
