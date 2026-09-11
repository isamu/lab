# scoria

TypeScript / JavaScript のコード品質を、既存ツールの機械証拠から定量化し、**時系列の変化**として提示するハーネス。

設計仕様: [scoria-spec.md](./scoria-spec.md) · English: [README.md](./README.md)

まだ **歩く骨格**。probe は 3 本で、外部ツールの統合も baseline も入っておらず、全 dimension が `experimental`。

## 使う

### 対象リポジトリで npx

```bash
cd your-project
npx scoria
```

引数なしならカレントディレクトリを測る。

### package.json のスクリプトに入れる

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

### 公開前のソースから試す

tarball を作って対象リポジトリで実行する。対象リポジトリには何もインストールされない。

```bash
cd lab/coding
yarn install && yarn build
cd packages/scoria && npm pack --pack-destination /tmp

cd your-project
npx --package=/tmp/scoria-0.0.2.tgz -- scoria --lang ja
```

## 設定

初回の実行で `scoria.config.json` を作る。明示的に作るなら `scoria init`。

```json
{
  "profile": "app",
  "stacks": ["vue", "ts"],
  "mode": "report",
  "lang": "ja"
}
```

`profile` と `stacks` は `package.json` から検出する（vue / nuxt → vue、react / next → react、
`bin` → cli、公開される `exports` → library）。

**検出結果はここで凍結される。** 依存が増えても勝手に追随せず、ずれたときは detection drift として報告するだけ。
測り方が run ごとに変わると時系列の比較が成立しないため（spec §9.2）。取り込むなら `scoria init` を打ち直す。

同じ形を `package.json` の `scoria` キーに書いてもよい。

`CI=true` の環境では設定ファイルを書かず、凍結されていないことを警告するだけ。

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
458 ファイル · 59120 sloc · テスト 1456 sloc   設定: config-file

  次元                スコア   信頼度
  ──────────────────────────────────────────────────────────────
  integrity               79   high
  readability             30   high
  type-safety             90   high
  ──────────────────────────────────────────────────────────────
  総合                    66   repo 間では比較できません
```

**スコアは repo 間で比較できない。** 正規化の仕方も、有効な probe も、プロジェクト自身の基準の厳しさも
repo ごとに違う。意味があるのは同じ repo の時系列の変化だけで、report JSON はこれを
`"comparable": false` として構造に持つ（spec §3.3）。バッジは提供しない。

```bash
scoria doctor                  # プロジェクト自身のゲートの抜けを診る
scoria doctor --fix            # 曖昧さの無い修正だけを適用する
scoria --json                  # report JSON
scoria --explain readability   # 点の内訳と、何を直せば何点上がるか
scoria --no-write              # 設定ファイルを作らない
scoria --lang ja               # 端末出力を日本語に
```

端末の出力は翻訳されるが、機械向けの出力はされない。`Finding.message` は英語のままで、
下流のツールが 1 つの語彙を読めるようにしてある。両者は rule id で結ばれる。

## いま測っているもの

| probe              | dimension   | 何を見るか                                                                                |
| ------------------ | ----------- | ----------------------------------------------------------------------------------------- |
| `suppression-scan` | integrity   | `as any` / `@ts-ignore` / `eslint-disable` / `it.skip`。理由の無いものだけを error にする |
| `file-shape`       | readability | ファイル行数の p95 / 最大 / 500 行超の数                                                  |
| `source-mix`       | type-safety | TypeScript プロジェクトに残った `.js` / `.jsx`                                            |

対応スタック: `ts`（`.ts` `.tsx` `.mts` `.cts` `.js` `.jsx` `.mjs` `.cjs`）、
`vue`（SFC の `<script>` だけを走査）、`react`。

### 知っておく価値のある 2 つの判断

**eslint のルール名は理由ではない。** eslint 自身の規約どおり `--` 以降だけを理由とする。
ルール名を理由と数えると `eslint-disable-next-line no-console` が自分自身を正当化してしまい、
測定が丸ごと無意味になる。

**抑制はスコアだけでなく信頼度を下げる。** eslint の警告が 0 件でも `eslint-disable` が 60 箇所あれば、
そのコードが読みやすいのではなく、その次元が測れていない。これを `confidence: low` として報告する（spec §15.4）。

## まだ無いもの

外部 probe（eslint / knip / dependency-cruiser / jscpd）、baseline と ratchet、Tier 1 以上、
GitHub Action、SARIF、較正。すべての閾値は暫定値。

## 開発

```bash
yarn format:check && yarn lint && yarn typecheck && yarn build && yarn test
```

lint は [ever-better](https://github.com/isamu/ever-better) の段に合わせている。
type-aware な typescript-eslint、SonarJS、そして `noInlineConfig` — つまりこのリポジトリでは
`eslint-disable` が一切書けない。scoria は抑制債務を測るツールであり、自分の抑制がゼロであることに意味がある。

## ライセンス

MIT
