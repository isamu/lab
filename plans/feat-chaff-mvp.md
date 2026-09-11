# chaff MVP — 設定なしで動く lint

issue: #2 / spec: `text/chaff-spec.md`, `text/chaff-workflow-spec.md` / 前提: PR #8（モノレポと文分割）

## 目的

`npx chaff article.md` が、設定ファイルも API key も言語指定もなしで動き、指摘 1 件につき
「引用 / 何が起きているか / なぜ問題か / どう直すか」の 4 つを出す。

rule を 20 本書いてから出力の形が違うと分かると手戻りが大きい。**L1 を 5 本だけ**にして、
**Markdown 解析 → rule → 4 語の解決 → 出力 → 設定の書き戻し** を縦に 1 本通す。

## 作らないもの

L2 語彙表 / L3 品詞解析 / L4 意味の検査 / `baseline` / `suppressions` / `eval` / `--watch` /
`--format lsp` / corpus calibration。`checks.yaml` は `look_at` の変換が未決（spec §26-7）。

## 構成

```
text/packages/chaff/
  rules/*.yaml              rule 定義。samples/rules/ と同じ形
    bold-density.yaml
    heading-echo.yaml
    sentence-rhythm.yaml
    max-sentence-length.yaml
    repeated-sentence-head.yaml
  src/
    plugin.ts               既存に ProseDocument / Detector / Finding / RuleDefinition を足す
    document.ts             Markdown → ProseDocument（section / paragraph / sentence / list）
    levels.ts               strict/normal/relaxed/off → 数値。未定義の段は normal に落ちる
    rule-load.ts            rules/*.yaml の読み込みと必須フィールド検査
    detectors/
      count-per-section.ts  bold-density
      heading-echo.ts
      sentence-rhythm.ts
      sentence-length.ts    max-sentence-length
      repeated-head.ts      repeated-sentence-head
    genre.ts                ジャンルの推定
    config/
      load.ts               chaff.yaml の読み込み
      write.ts              コメントを保持した書き戻し
    render/
      friendly.ts           既定の出力
      compact.ts            --compact
      rules-json.ts         chaff rules --json
    cli.ts                  差し替え
```

## 段取り

1. **contract を先に決める**（`plugin.ts`）。`ProseDocument` / `Detector` / `Finding` /
   `RuleDefinition`。ここが違うと 5 本とも書き直しになる。
2. **`document.ts`**。`mdast-util-from-markdown` で Markdown を読み、見出しで section を切る。
   コードブロック・インラインコード・URL を本文から外す（いまの CLI はコードブロックを
   本文として数えており、858 文字の「文」が出ている）。
3. **`levels.ts`**。4 語 → 数値。段が未定義なら normal に落とす（spec §18.1）。
4. **rule を 2 本**（`bold-density`, `max-sentence-length`）。contract が成立するか確かめる。
5. **`render/friendly.ts`**。4 つ揃った出力。ここで形を決めてから残り 3 本を書く。
6. **残り 3 本**（`heading-echo`, `sentence-rhythm`, `repeated-sentence-head`）。
7. **`config/`**。`chaff.yaml` の読み込みと、コメント保持の書き戻し。
8. **`rules --json`** と `--compact`。
9. `cli.ts` を差し替え、ゲートを通す。

## 決めてあること（spec から）

| | |
| --- | --- |
| 設定ファイル名 | `chaff.yaml`（ドットなし。隠しファイルは非エンジニアが開けない） |
| rule の値 | `strict` / `normal` / `relaxed` / `off` の 4 語。数値は rule 定義の `levels` |
| 段が未定義のとき | `normal` に落ちる。`chaff strict <rule>` は書き換えずにそう告げる |
| 理由コメント | 既存の理由を上書きするときは `--why` 必須（spec §19.4） |
| experimental | 明示設定が status の既定に勝つ。ただし実行ごとに一度報告する（spec §18.4） |
| 既定の出力 | 非エンジニア向け。`--compact` が従来形式 |
| rule 定義の必須 | `name` / `why` / `how_to_fix` / `message` / `levels` / `use_for` / `status` |

## 検証

- `node:test`。rule ごとに `valid` と `invalid` の fixture を持ち、**`valid` には「その rule が
  誤検知しやすい正常な文章」を必ず 1 つ以上入れる**（workflow spec §23）。
- コメント保持の書き戻しは、実際に `chaff.yaml` を書き換えて元のコメントが残ることを検査する。
- `--why` なしで既存の理由を上書きしようとしたら拒否することを検査する。
- クリーン install（`rm -rf node_modules && yarn install --frozen-lockfile`）から
  format:check / lint / typecheck / build / test / knip を通す。
- 依存の合計が 15 MB 以内（spec §17.1）。`yaml` 686KB + `micromark` 210KB +
  `mdast-util-from-markdown` 97KB + `sentence-splitter` 215KB で約 1.2 MB の見込み。

## リスク

| | |
| --- | --- |
| `sentence-rhythm` の閾値 0.30 は未検証の仮説 | experimental で出す。corpus 評価まで既定では動かさない |
| section の切り方（同レベル見出しまで / 下位を含む） | 先に決めて `document.ts` のテストに書く |
| コードブロックの除外漏れ | いまの CLI が現に間違えている。document.ts の最初のテストにする |
| 別セッションが同じ作業コピーを使用中 | worktree で隔離する。`node_modules` は symlink にし、終了前に必ず外す |
