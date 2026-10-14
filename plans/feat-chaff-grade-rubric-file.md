# chaff grade --rubric — 採点の基準をファイルで渡す

issue: #1167（1 番目の項目）

## 何のためか

LLM のベンチマークは、採点の基準をデータと一緒に持ち運びたい。いまの基準は chaff.yaml の `grade:` にしか書けない。
`chaff grade items.jsonl --rubric rubric.yaml`（または `.json`）で、その回だけ `grade:` の代わりにファイルの基準で採点する。

## 決めたこと

- **形は `grade:` と同じ。** ファイルの最上位が `grade:` の中身。読むのは既存の `parseRubric` で、読み手は増やさない。
  拡張子で YAML（`.yaml` `.yml`）か JSON（`.json`）かを決める。空のファイルは空の基準（裸の `grade:` と同じ）。
- **置き換えであって重ね合わせではない。** `--rubric` を渡すと chaff.yaml の `grade:` は使わない。
- **stamp にファイルの中身の hash を入れる。** settings の `grade` が `{ file: sha256:… }` になる。
  基準の違う回は `--baseline` が比べずに止まる。`--rubric` を使わない回の stamp は変わらない。
- **読めない基準は exit 2。** 無いファイル、YAML/JSON として読めないもの、知らない拡張子、形の誤りは、
  ファイル名と（形の誤りなら）最上位からの点区切りの場所を出して止まる。`--rubric` の後にファイルが無いのも使い方の誤り。
- 純粋な部分は `grade/rubric-file.ts`（拡張子・構文・形・hash）。ファイルを読むのはコマンドの側。

## 範囲外

- ガイドのページ（#1167 の 4 番目）、`expect`（2 番目）、`tasks`（3 番目）。
