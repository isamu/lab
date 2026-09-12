# scoria

コードの状態を点数にして、**前より良くなったか悪くなったか**を見えるようにするツールです。

English: [README.md](./README.md) · 設計の詳細: [scoria-spec.md](./scoria-spec.md)

まだ作りかけです。見ている項目は 5 つだけで、履歴との比較もまだできません。

## 何をしてくれるの

コードを読んで、こういうものを数えます。

- エラーを黙らせている箇所（`as any`、`@ts-ignore`、`eslint-disable` など）
- 大きすぎるファイル
- TypeScript のプロジェクトに残っている `.js` ファイル
- チェックの仕組みそのものの抜け（eslint の設定がない、CI がテストを回していない など）

そして 0〜100 の点を出します。

## 使ってみる

インストールは要りません。プロジェクトのフォルダで次を打つだけです。

```bash
cd 自分のプロジェクト
npx scoria
```

日本語で表示したいときは `--lang ja` を付けます。

```bash
npx scoria --lang ja
```

## 出てきた画面の見方

```text
/path/to/your-project  [vue · ts]  profile: app
458 files · 59120 sloc · 1456 test sloc   config: config-file

  Dimension            Score   Confidence
  ──────────────────────────────────────────────────────────────
  integrity               79   high
  readability             30   high
  type-safety             90   high
  ──────────────────────────────────────────────────────────────
  Overall                 66   not comparable across repos

8 findings at severity error
  src/components/CustomerInfo.vue:108  eslint-disable-no-reason  理由のない eslint の抑制

63 warnings
  god-file                 21
  untyped-source           42
```

上から順に。

**1 行目** は測った場所です。`[vue · ts]` は「Vue と TypeScript のプロジェクトだと判断した」という意味。

**2 行目** は規模です。`sloc` は空行を除いたコードの行数。

**真ん中の表** が本体です。3 つの観点で点を出しています。

| 名前          | 平たく言うと                                   |
| ------------- | ---------------------------------------------- |
| `integrity`   | エラーをどれだけ黙らせているか。少ないほど高い |
| `readability` | ファイルが大きくなりすぎていないか             |
| `type-safety` | 型のチェックがちゃんと効いているか             |

`Overall` は 3 つの平均です。おまけ程度に見てください。

**`Confidence`（信頼度）は点より先に見てください。** ここが `medium` や `low` のときは、
その点自体があまり当てになりません。理由は次に書きます。

**下の 2 つ** が具体的な指摘です。`findings` は直すべき箇所で、ファイルと行番号まで出ます。
`warnings` は軽い指摘で、件数だけ出ます。

## 気をつけてほしいこと

### 他のプロジェクトと点を比べても意味がありません

測り方も、動いているチェックも、そのプロジェクトが自分に課している基準の厳しさも違うからです。

**点は、同じプロジェクトの変化を見るためのものです。** 初回の実行はただの出発点だと思ってください。

### 点が高い = 良い、とは限りません

たとえば eslint の警告が 0 件でも、`eslint-disable` が 60 箇所あれば、
それは「きれいなコード」ではなく「**eslint を黙らせているので分からない**」だけです。

こういうときに `Confidence` が `medium` や `low` になります。
**点が高くて信頼度が低いときは、良いのではなく分かっていない**と読んでください。

## で、何をすればいいの

### 1. まず error の指摘を見る

`findings at severity error` に出るのは、全部「**理由が書かれていない抑制**」です。

やることは 2 つに 1 つ。理由を書くか、抑制をやめるかです。

```ts
// eslint-disable-next-line no-console -- CLI の出力なので console を使う
// @ts-expect-error 上流の型に stream 版の定義がない (nodejs/undici#3421)
```

eslint の場合、**理由は `--` のあとに書きます**。ルール名（`no-console` など）は理由として数えません。
ルール名を書くだけで許されるなら、この計測に意味がなくなってしまうからです。

### 2. 点の内訳を見る

どこを直せば何点上がるのかは `--explain` で分かります。

```text
$ npx scoria --explain readability --lang ja

  metric                                       value            scale     pts
  ──────────────────────────────────────────────────────────────
  file-shape.sloc_p95                         353.00        150 → 800    34.4
  file-shape.max_file_sloc                   2673.00       300 → 2000     0.0
  file-shape.god_file_count                     7.00           0 → 20    13.0
  ──────────────────────────────────────────────────────────────
                                                                         47.4

  file-shape.sloc_p95 に効いているファイル
        2673  src/data/scriptTemplates.ts
        1403  src/data/markdownStyles.ts
```

- `value` が実際の数値、`scale` が「この数値なら満点 / この数値なら 0 点」の基準、`pts` が今もらえている点です。
- 2 行目の `max_file_sloc`（一番大きいファイルの行数）は **30 点満点で 0 点**。基準の外まで振り切っています。
  つまり**ここを直すのが一番効きます**。
- 原因のファイルは下の一覧が名前で教えてくれます。2,673 行のファイルが 1 つあります。
- 点の計算は単純な比例なので、**`pts` の列がそのまま「直したら何点上がるか」になります**。

### 3. 設定ファイルを commit する

`config: detected` と出ていたら、設定ファイルを読まずにその場で判断して測った、という意味です。

初回の実行で `scoria.config.json` が作られているので、これを commit してください。
次からは毎回同じ測り方になり、点の変化がコードの変化だけを表すようになります。

## 設定の抜けを診てもらう

```bash
npx scoria doctor
```

「このプロジェクトが**本来やっているはずのチェック**」の抜けを教えてくれます。

```text
4 gaps in the gates this project sets for itself

  ! No `typecheck` script
      CI cannot run what package.json does not define, so nothing enforces typecheck.
      fixable with --fix

  × 1 step swallows their failure
      `continue-on-error: true` or `|| true` makes a job green whatever it found.
```

たとえばこういうものです。

- eslint の設定ファイルがない
- `test` や `typecheck` のスクリプトが書かれていない
- `strict` が off になっている
- CI がテストを回していない
- CI に `|| true` があって、失敗しても緑になる

これは好みの問題ではありません。**どれも他の点を実際より良く見せてしまいます**。
だから `integrity` の点にも反映されます。

```bash
npx scoria doctor --fix
```

`--fix` が直すのは、**答えが 1 つしかないものだけ**です。

- `.gitignore` に `node_modules/` を足す
- TypeScript を使っているのに `typecheck` スクリプトがなければ足す

eslint の設定を代わりに選ぶような、判断が要ることはしません。報告するだけです。
ツールの導入そのものをやってほしい場合は [ever-better](https://github.com/isamu/ever-better) を使ってください。

## 知っておいてほしい弱点

**大きなデータファイルが不当に減点されます。**

`file-shape` は中身を見ずに行数だけを数えます。
なので 2,673 行のテンプレート集が、2,673 行のロジックと同じだけ減点されます。
この 2 つは読みにくさが全然違います。

調整が済むまで、`data/` の下にある大きなファイルは「誤検知」と思って構いません。

## 見ている項目の一覧

| 項目               | 観点                     | 見ているもの                                                                                |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------------------- |
| `oxlint`           | correctness, readability | **scoria 自身のルール** 133 個。相手に何もインストールしなくても動きます                    |
| `tsc`              | type-safety              | **プロジェクト自身の** TypeScript が出す型エラー                                            |
| `knip`             | architecture             | どこからも参照されていないファイル・export・依存                                            |
| `jscpd`            | readability              | コピペの重複                                                                                |
| `audit`            | security                 | 既知の脆弱性。プロジェクト自身のパッケージマネージャに聞きます                              |
| `circular`         | architecture             | 循環依存。「使われていないコード」とは別の壊れ方で、knip には見えません                     |
| `test-presence`    | test-coverage            | テストコードの量（対象コードとの比）                                                        |
| `coverage`         | test-coverage            | 行・分岐・関数のカバレッジ。プロジェクトが出力済みのレポートを読みます                      |
| `suppression-scan` | integrity                | `as any` / `@ts-ignore` / `eslint-disable` / `it.skip`。理由がないものだけを error にします |
| `config-integrity` | integrity                | eslint の設定はあるか、`strict` は on か、必要なスクリプトはあるか                          |
| `ci-integrity`     | integrity                | CI が lint / typecheck / build / test を回しているか、失敗を握りつぶしていないか            |
| `file-shape`       | readability              | ファイルの大きさ（上位 5% の大きさ、最大値、500 行超の本数）                                |
| `source-mix`       | type-safety              | TypeScript のプロジェクトに残っている `.js` / `.jsx`                                        |

### 測る基準は「あなたの設定」ではなく scoria のものです

プロジェクト自身の lint 設定は緩いかもしれません。そこだけを基準にすると、
**ルールを全部切ったリポジトリが満点を取ります**。
これは `integrity` が捕まえようとしている問題そのものなので、
他の観点では scoria のルール（oxlint の 133 個）で測り、そう明記します。

ですから「CI の lint は緑なのに scoria は低い」は不具合ではありません。それが指摘です。

`tsc` だけは例外です。型チェックはそのプロジェクトの tsconfig と型定義が揃って初めて意味を持つので、
プロジェクト自身のものを動かします。

### テストは実行しません

カバレッジは、プロジェクトがすでに出力したレポート（`coverage/coverage-summary.json`。Vitest / Jest / nyc が出します）を読みます。
テストは数分かかることも、DB に触ることも、認証情報を要することも、状態を残すこともあります。
点数を聞かれただけでそれを引き起こすツールは、二度と実行してもらえません。
レポートが無ければ skip とし、`test-presence` がより粗い問いに答えます。

### プロジェクトの install が要る項目があります

`tsc` と `knip` は import の関係をたどるので `node_modules` が要ります。
無い場合は **skip** と報告し、その観点は「何割測れたか」を出します。
**誰も見ていないものを満点にはしません。**

## 変化を追う

```bash
npx scoria baseline      # 今回の結果を記録する
git add .scoria/baseline.json
```

次回から差が出ます。

```text
動いたもの
    -30.0  integrity      suppression-scan.source_per_kloc   0 → 975
    -20.0  integrity      suppression-scan.unreasoned_ratio  0 → 1
```

どの指標がどれだけ動いたかを名指しします。
ツールを更新するとルールが増えて点が下がりますが、それは劣化ではありません。
scoria は baseline にツールの版数を記録しておき、その場合はそう報告します。

scoria 自体を更新したときは、また別の話です。
指標が増えると、その観点が何でできているかが変わるので、前回の点と今回の点は同じものを測った数字ではありません。
そのまま引き算すると、更新しただけで改善したことになってしまいます。
そういう観点は `—` と出し、baseline を録り直すまで増減を出しません。

指摘に出てくる名前の意味です。

| 名前                       | 意味                                                 |
| -------------------------- | ---------------------------------------------------- |
| `as-any-no-reason`         | 理由なしに `as any` で型をすり抜けている             |
| `ts-directive-no-reason`   | 理由なしに `@ts-ignore` などで型チェックを止めている |
| `eslint-disable-no-reason` | 理由なしに eslint の指摘を消している                 |
| `test-skip-no-reason`      | テストが `skip` / `only` / `todo` のままになっている |
| `god-file`                 | ファイルが大きすぎる（500 行超）                     |
| `untyped-source`           | `.js` のままなので型チェックされていない             |

対応しているのは TypeScript / JavaScript（`.ts` `.tsx` `.js` `.jsx` など）、
Vue（`.vue` の `<script>` の中だけ見ます）、React です。

## CI に入れる

```yaml
- name: scoria
  run: npx -y scoria
```

**CI は落ちません。** 点と指摘を表示するだけです。
悪くなったら止める、という機能はまだありません。

GitHub Actions では、実行結果のページの **ジョブサマリー** にも同じ内容を出します。
表とバーで表示され、指摘は折りたたみで開けます。

```markdown
## scoria — 63 / 100

`vue · ts` · profile: app · 458 ファイル · 59120 sloc · テスト 1456 sloc

| 次元        | スコア |              | 信頼度 |
| ----------- | -----: | ------------ | ------ |
| integrity   |     67 | `███████░░░` | high   |
| readability |     30 | `███░░░░░░░` | high   |
| type-safety |     90 | `█████████░` | high   |
```

ログは誰も読みません。レビューする人がすでに見ているページに出したほうが伝わります。
トークンも `permissions:` の設定も要りません。実行環境が用意したファイルに書き足すだけです。

いらない場合は `--no-summary` を付けてください。

### Security タブと差分行への表示

```yaml
- name: scoria
  run: npx -y scoria --sarif scoria.sarif

- uses: github/codeql-action/upload-sarif@v4
  with:
    sarif_file: scoria.sarif
    category: scoria
  # permissions に security-events: write が必要です
```

`--sarif` は SARIF 2.1.0 を書きます。アップロードすると、指摘がリポジトリの **Security タブ**と、
さらに **PR の変更行にインライン**で出ます。その行を書いた本人がすでに見ている場所に出る、というのが要点です。
ログの中の点数はわざわざ見に行く必要がありますが、行のコメントはそうではありません。

ルール名は `scoria/<probe>/<rule>` の形にしてあるので、同じツールを直接動かした結果とぶつかりません。

## 設定ファイル

```json
{
  "profile": "app",
  "stacks": ["vue", "ts"],
  "mode": "report",
  "lang": "ja"
}
```

`package.json` を見て自動で判断します
（vue や nuxt があれば vue、react や next があれば react、`bin` があれば cli、公開用の `exports` があれば library）。

**一度判断したら固定します。** あとからパッケージが増えても勝手に変えません。

毎回判断し直すと、パッケージを 1 つ足しただけで点が大きく動いてしまい、
「良くなったか悪くなったか」が分からなくなるからです。
ずれたときは教えてくれるので、取り込みたければ `scoria init` を打ち直してください。

CI の中（`CI=true`）では設定ファイルを書きません。

プロジェクトが JSON にも Prettier をかけている場合は、`.prettierignore` に次を足してください。

```
.scoria/
scoria.config.json
```

scoria は `JSON.stringify` で書くので配列が常に展開されますが、Prettier は短い配列を 1 行に畳みます。
整形対象にすると、実行のたびに両者が交互に書き換え合います。

## そのほか

```bash
npx scoria --json         # 結果を JSON で出す
npx scoria --no-write     # 設定ファイルを作らない
npx scoria init           # 設定ファイルだけ作る
```

画面の表示は日本語にできますが、JSON の中身は英語のままです。
あとから機械で処理するとき、言葉が揺れると困るためです。

## まだできないこと

悪化したら CI を落とす仕組み、`dependency-cruiser`、テストのカバレッジと mutation、
SARIF 出力、点の基準の調整。

**点の基準はすべて暫定です。** どの観点もまだ実験段階だと思ってください。

## 開発

```bash
yarn format:check && yarn lint && yarn typecheck && yarn build && yarn test
```

lint は [ever-better](https://github.com/isamu/ever-better) と同じ厳しさにしてあります。
このリポジトリでは `eslint-disable` が 1 つも書けません。
抑制の量を測るツールなので、自分の抑制がゼロであることに意味があります。

## ライセンス

MIT
