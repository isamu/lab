# scoria: baseline に絶対パスを残さない

issue: #1468

## 方針

- `writeBaseline` は `forCommit(report)`（`root` を `"."` にした report）を書く。読む側は `root` を使っていないので、読み込みは変えない
- 既にある baseline は、次の `scoria baseline` で書き直されたときに直る。lab 自身の baseline も、取り直すときに直る
