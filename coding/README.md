# scoria

TypeScript / JavaScript のコード品質を、既存ツールの機械証拠から定量化し、時系列の変化として提示するハーネス。

設計仕様: [scoria-spec.md](./scoria-spec.md)

まだ **歩く骨格**（issue #5）。probe は 3 本で、外部ツールの統合も baseline も入っていない。

## 使う

### 1. 対象リポジトリで npx（npm 公開後）

```bash
cd ~/your/project
npx scoria
```

引数なしならカレントディレクトリを測る。

### 2. package.json に入れる

```bash
yarn add --dev scoria
```

```json
{
  "scripts": {
    "quality": "scoria"
  }
}
```

```bash
yarn quality
```

### 3. 手元のソースから試す（npm 公開前）

このリポジトリを clone して、tarball を作って対象リポジトリで実行する。
対象リポジトリには何もインストールされない。

```bash
cd lab/coding
yarn install && yarn build
cd packages/scoria && npm pack --pack-destination /tmp

cd ~/your/project
npx --package=/tmp/scoria-0.1.0.tgz -- scoria
```

ソースを直接叩くこともできる。

```bash
node ~/ss/llm/lab/coding/packages/scoria/bin/scoria.js ~/your/project
```

## 設定

初回の実行で `scoria.config.json` を作る。明示的に作るなら `scoria init`。

```json
{
  "profile": "app",
  "stacks": ["vue", "ts"],
  "mode": "report"
}
```

`profile` と `stacks` は `package.json` から検出する（vue / nuxt → vue、react / next → react、bin → cli、
公開される exports → library）。

**検出結果はここで凍結される。** 依存が増えても勝手に追随せず、ずれたときは detection drift として報告するだけ。
測り方が run ごとに変わると時系列の比較が成立しないため（spec §9.2）。取り込むなら `scoria init` を打ち直す。

`package.json` の `scoria` キーに同じ形で書いてもよい。

`CI=true` の環境では設定ファイルを書かない。凍結されていないことを警告するだけ。

## CI に入れる

```yaml
- name: scoria
  run: npx -y scoria
```

`mode: report` が既定なので **CI を落とさない**。スコアと指摘が出るだけ。
劣化でゲートする ratchet は未実装（spec §17）。

## 出力

```text
/Users/isamu/ss/ownplate  [vue · ts]  profile: app
458 files · 59120 sloc · 1456 test sloc   config: config-file

  Dimension            Score   Confidence
  ──────────────────────────────────────────────────────────────
  integrity               79   high
  readability             30   high
  type-safety             90   high
  ──────────────────────────────────────────────────────────────
  Overall                 66   not comparable across repos

8 findings at severity error
  src/components/CustomerInfo.vue:108   eslint-disable-no-reason  理由が書かれていません

63 warnings
  god-file               21 件
  untyped-source         42 件
```

**スコアは repo 間で比較できない。** 正規化の仕方も、有効な probe も、プロジェクト自身の基準の厳しさも
repo ごとに違う。意味があるのは同じ repo の時系列の変化だけで、report JSON はこれを
`"comparable": false` として構造に持つ（spec §3.3）。

```bash
scoria --json                  # report JSON
scoria --explain readability   # 点の内訳と、何を直せば何点上がるか
scoria --no-write              # 設定ファイルを作らない
```

## いま測っているもの

| probe              | dimension   | 何を見るか                                                                                |
| ------------------ | ----------- | ----------------------------------------------------------------------------------------- |
| `suppression-scan` | integrity   | `as any` / `@ts-ignore` / `eslint-disable` / `it.skip`。理由の無いものだけを error にする |
| `file-shape`       | readability | ファイル行数の p95 / 最大 / 500 行超の数                                                  |
| `source-mix`       | type-safety | TypeScript プロジェクトに残った `.js` / `.jsx`                                            |

対応スタック: `ts`（`.ts` `.tsx` `.mts` `.cts` `.js` `.jsx` `.mjs` `.cjs`）、`vue`（SFC の `<script>` だけを走査）、`react`。

## まだ無いもの

外部 probe（eslint / knip / dependency-cruiser / jscpd）、baseline と ratchet、Tier 1 以上、
GitHub Action、SARIF、較正。すべての dimension は `experimental` で、scale の `good` / `bad` は暫定値。

## 開発

```bash
yarn format:check && yarn lint && yarn typecheck && yarn build && yarn test
```

lint は `~/ss/llm/ever-better` の段に合わせている。`noInlineConfig` が有効なので `eslint-disable` は書けない。
scoria は抑制債務を測るツールであり、自分の抑制がゼロであることに意味がある。
