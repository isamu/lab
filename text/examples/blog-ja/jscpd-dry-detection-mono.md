---
title: "jscpd で重複コードを機械的に潰す — 定期監査とCI差分チェックの二段構え"
emoji: "✂️"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["jscpd", "TypeScript", "CI", "リファクタリング", "SonarQube"]
published: true
publication_name: "singularity"
---

:::message
この記事は重複検出（jscpd）だけを深掘りしたものです。ESLint / SonarJS / knip も含めた**全体の組み立て**は [AIでがんがん書く時代の「きれいなコード」の守り方](https://zenn.dev/singularity/articles/clean-code-ci-for-ai-era)、そもそも**なぜ機械に守らせるのか**は [1日500コミットは、もう読めない](https://zenn.dev/singularity/articles/stopped-reviewing-my-code) にあります。
:::

この記事の結論を先に書きます。

> **DRY をレビューで守るのは諦めて、jscpd に検出させる。使い方は二段構え——「定期的な全体監査」で棚卸しし、「CI の差分チェック」で新規流入を止める。**

そして地味に大事なのが、**この 2 つは設定も見るべき数字もまったく別物**だという点です。同じツールを同じように使うと、たいてい片方が機能しません。以下、使い方・設定・結果の見方を中心に説明します。

## DRY とは

**DRY（Don't Repeat Yourself）** は『達人プログラマー』（Andy Hunt / Dave Thomas, 1999）の設計原則で、原文の定義はこうです。

> Every piece of knowledge must have a single, unambiguous, authoritative representation within a system.
> （すべての知識は、システム内において単一・明確・信頼できる表現を持たなければならない）

「同じコードを 2 回書くな」と要約されがちですが、本来は**コードの重複**ではなく**知識の重複**を戒める原則です。罪なのは「似ていること」自体ではなく、**仕様が変わったとき 2 箇所直さないといけない**こと。片方だけ直して壊れる、あれが DRY 違反のコストです。

裏を返すと、**たまたま似ているだけのコードは無理に共通化しなくてよい**。この区別が、後述の「結果の見方」で決定的に効いてきます。ツールが出すのは「似ているコード」であって「知識の重複」ではないからです。

## なぜ機械に任せるのか

DRY はレビューで守るのに最も向いていない原則です。目の前の差分がどれだけ綺麗でも、**300 ファイル向こうに同じ関数がすでにある**かどうかは、レビュアーの記憶に頼るしかありません。人間の記憶は数十万行をカバーできないので、放っておくと同じ関数が何個も生えます。

一方、「トークン列が一致しているか」の判定は完全に機械的です。ここは機械に任せて、人間は「これは知識の重複か、たまたま似ているだけか」の判断に集中する——これが役割分担として素直です。

## jscpd を入れる

[jscpd](https://github.com/kucherenko/jscpd) はコピペコード検出（Copy/Paste Detector）の定番です。**v5 系から Rust 実装**になり（v4 系は TypeScript 実装）、プリビルドバイナリが配られるので Node ランタイムなしでも動きます。223 言語・13 レポーター対応。

まずは何も入れずに試せます。

```bash
npx jscpd@5 src
```

プロジェクトに入れるなら:

```bash
npm i -D jscpd     # yarn add -D jscpd / pnpm add -D jscpd
```

### 主なオプション

| オプション | 短縮 | 既定 | 意味 |
|---|---|---|---|
| `--min-tokens` | `-k` | 50 | クローンとみなす最小トークン数 |
| `--min-lines` | `-l` | 5 | クローンとみなす最小行数 |
| `--mode` | `-m` | `mild` | 検出モード `mild` / `weak` / `strict` |
| `--skip-comments` | — | — | `--mode weak` のエイリアス |
| `--format` | `-f` | 全部 | 対象フォーマットを絞る |
| `--ignore-pattern` | `-i` | — | 除外グロブ |
| `--reporters` | `-r` | `console` | レポーター（カンマ区切り） |
| `--threshold` | `-t` | — | **超えたら exit 1** |
| `--blame` | `-b` | — | git blame で作者を付与 |
| `--skip-local` | — | — | 同一ディレクトリ内のクローンを無視 |

`--threshold` を超えると **exit code 1** になるので、CI はこれだけで落とせます。

### `.jscpd.json` で設定を固める

毎回フラグを並べるのは現実的でないので、プロジェクトルートに置きます。

```json
{
  "minTokens": 30,
  "minLines": 3,
  "format": ["javascript", "typescript"],
  "ignorePattern": ["node_modules", "dist", "*.min.js"],
  "reporters": ["console", "json"],
  "output": "report",
  "threshold": 5,
  "blame": false
}
```

### レポーター

`console`（既定）/ `console-full`（blame 付きの左右比較）/ `json` / `html` / `markdown` / `xml` / `csv` / `silent` / `ai` など 13 種。用途で使い分けます。

- **人が眺める** → `console`、`html`
- **機械で処理する** → `json`
- **LLM に食わせる** → `ai`（後述）

## 結果の見方 — ここが本番

実行するとこういう表が出ます。実際に **26.7 万行の TypeScript モノレポ**（[MulmoClaude](https://github.com/receptron/mulmoclaude)、Vue + TS、`packages/` に 25 超のワークスペース）に当てた結果です。

```bash
npx jscpd@5 src server packages \
  -i "**/node_modules/**" -i "**/dist/**" -i "**/*.d.ts"
```

| Format | Files | Total lines | Clones found | Duplicated lines |
|---|---|---|---|---|
| **typescript** | 1,170 | 163,210 | 314 | 5,332 (**3.27%**) |
| markdown | 58 | 8,010 | 84 | 1,818 (22.70%) |
| json | 78 | 5,607 | 45 | 858 (15.30%) |
| javascript | 20 | 1,757 | 7 | 189 (10.76%) |
| css | 29 | 13,080 | 27 | 620 (4.74%) |
| html | 129 | 34,970 | 35 | 687 (1.96%) |
| **vue** | 132 | 35,088 | **0** | 0 (0.00%) |
| **Total** | **1,666** | **267,098** | **512** | **9,504 (3.56%)** |

実行時間は **127ms**。26.7 万行を 0.1 秒台で舐めるので、CI に置くコストは実質ゼロです。

この表から読み取るべきことが 3 つあります。

### 1. Total の数字で語ってはいけない

**Total 3.56% を「このリポジトリの重複率」と呼んではいけません。** 言語別に分解すると:

- **markdown 22.70% / json 15.30%** — これは**ノイズ**です。json は 25 超のパッケージの `package.json` 定型（`scripts` や `devDependencies` が似るのは当たり前）、markdown は docs。**どちらも共通化すべき対象ではない**。
- 見るべきは **typescript の 3.27%** です。

対策は `format` で絞るだけ。

```json
{ "format": ["typescript", "javascript"] }
```

これをやらないと、「重複率が高い」と騒いだ挙句に犯人が `package.json` だった、という無意味な時間を過ごします。

### 2. 行 % とトークン % は別物で、後者は壊れることがある

jscpd は「重複行 %」と「重複トークン %」の両方を出しますが、上の計測では **markdown の重複トークンが 561.90%** と 100% を超えました。重複ブロックの多重カウントに由来するアーティファクトと思われます。

`.vue` / `.svelte` / `.astro` / `.md` は**ブロック単位でトークナイズ**されてファイル跨ぎの検出ができる仕組みになっており、その分こうした指標が直感と合わなくなることがあります。**閾値に使うなら行 %**、そして**対象言語を絞ってから**が安全です。

### 3. 数字が高い＝悪、ではない

同じリポジトリで、`src` + `server` だけなら TypeScript は **1.90%**（113 クローン）。`packages/` を足すと **3.27%**（314 クローン）に上がりました。

犯人は「似た定型の多いアダプタ群」です。25 個超の bridge パッケージ（Slack / Discord / Telegram / …）が、それぞれ似た初期化・送信・エラーハンドリングを持つのは**構造上ある程度自然**で、無理に共通化すると分岐だらけの共通関数が生まれて逆に読みにくくなります。

ここで冒頭の DRY の定義が効きます。**ツールが出すのは「似ているコード」であって「知識の重複」ではない。** 最後の採否は人間が決めるものだと割り切ってください。ちなみに Vue SFC は両計測とも 0 クローンでした。

### ノイズの削り方まとめ

| 症状 | 対策 |
|---|---|
| 設定ファイルや docs が上位に来る | `format` を絞る |
| 些細な数行が大量に出る | `minTokens` / `minLines` を上げる |
| コメントだけ同じものが出る | `--mode weak`（= `--skip-comments`） |
| ビルド成果物が混ざる | `ignorePattern` に `dist` / `*.min.js` |
| 同一ディレクトリ内の似たファイルが煩い | `--skip-local` |

## 運用① 定期的な全体監査

**目的は「棚卸し」であって、ゲートではありません。** 見るのは % ではなく**クローンの一覧**です。

```bash
npx jscpd@5 src server -f typescript -r console-full,html --blame
```

- `--blame` を付けると **git blame で、誰がいつ書いたコピペかまで出ます。** 犯人探しではなく、「この定型は当時こういう事情で…」という文脈をたどるのに有用です。
- `html` レポーターで一覧を出し、上位から「これは共通化すべきか？」を人間が判断していきます。
- 頻度は週次〜月次で十分。スケジュール実行の GitHub Actions に置いて、レポートを artifact に上げておくのが楽です。

ここで **`--threshold` は使いません。** 監査は「落とす」ためではなく「見る」ためのものだからです。

## 運用② CI による差分チェック

こちらが本命です。そして**ここに一番大きな落とし穴があります**。

### 落とし穴: グローバル % の閾値は新規重複を止められない

`--threshold 5` を CI に置けば DRY が守られる、と思いがちですが——**止まりません。**

理由は算数です。16 万行に対して新しく 20 行の関数をコピペしても、全体の重複率はほぼ動きません。**3.27% が 3.28% になるだけ**で、閾値 5% には永遠に届かない。閾値を越えないまま、重複だけが静かに増えていきます。

冒頭で触れたような「同じ `truncate()` が 6 実装に増える」タイプの事故は、**全体 % ゲートでは 1 件も止まらない**わけです。閾値を入れて安心するのが一番危ない。

全体 % 閾値は、**「大崩れの保険」と割り切りましょう。** 安いので入れてよいものです。新規流入を止めたいなら、母数に薄められない指標が要ります。

### 解: 公式 Action + SARIF + Code Scanning

jscpd の公式 GitHub Action は、検出結果を **SARIF として GitHub Code Scanning にアップロード**します。

```yaml
- uses: kucherenko/jscpd@master
  with:
    threshold: 5
```

これが効くのは、**Code Scanning が「この PR で新しく増えたアラート」を GitHub 側で差分表示してくれる**からです。全体 % に薄められることなく、「この PR がコピペを 1 件持ち込んだ」が PR 上に出ます。自前でベースライン比較スクリプトを書かなくても、**新規流入を PR 単位で捕まえる**という本来やりたかったことが達成できます。

:::message
SARIF のアップロードには、ワークフローに `permissions: security-events: write` が必要です。
:::

Code Scanning を使わない場合は、`json` レポーターの出力を main のベースラインと突き合わせて「新しく増えたクローン」だけを抽出する、という自作スクリプトが必要になります。やることは同じですが、素直に公式 Action に乗るほうが楽です。

### pre-commit で手前に出す

CI まで待たず手元で弾きたいなら Husky でも動きます。

```bash
echo 'npx jscpd --threshold 5 --reporters console,silent .' > .husky/pre-commit
```

ただし前述のとおり `--threshold` は新規重複には鈍いので、**pre-commit はあくまで気づきの補助**です。

## 他の選択肢 — SonarJS / SonarQube

jscpd だけが手ではありません。**レイヤが違うので、競合ではなく補完**です。

### [eslint-plugin-sonarjs](https://github.com/SonarSource/SonarJS/tree/master/packages/jsts/src/rules)

すでに [ESLint](https://eslint.org) を使っているなら、これが一番導入コストが低い選択肢です。

```bash
npm i -D eslint-plugin-sonarjs
```

```js
import sonarjs from "eslint-plugin-sonarjs";

export default [
  sonarjs.configs.recommended,
];
```

`no-identical-functions`（同一関数）、`no-duplicate-string`（同一文字列リテラル）、`cognitive-complexity`（認知的複雑度）など、**AST ベース**のコードスメル検出が効きます。

**jscpd との違い**は見ている対象です。

| | 見ているもの | 得意 |
|---|---|---|
| **jscpd** | **トークン列**の一致 | 変数名が少し違うコピペ、関数の一部だけのコピペ、ファイル跨ぎのブロック |
| **sonarjs** | **AST** の構造 | 完全に同一の関数、同一条件式、複雑度などのスメル |

ESLint に乗るぶん sonarjs は日常の開発フローに溶け込みますが、「ファイル跨ぎのコピペ」は jscpd のほうが広く拾えます。**両方入れるのが素直**です。

### [SonarQube](https://www.sonarsource.com/products/sonarqube/) / [SonarCloud](https://www.sonarsource.com/products/sonarcloud/)

組織で回すならこちら。Duplication に加えて Maintainability / Cognitive Complexity / Security までまとめて見て、PR ごとに `Duplication: 3.2%` のようにデコレーションしてくれます。Quality Gate で「新規コードの重複率」を条件にできるのが強く、**先ほどの「新規流入を止める」問題にそのまま答えが用意されている**のが利点です。

一方で、サーバ or SaaS の運用コストがかかります。**個人〜小規模なら jscpd + sonarjs、組織なら SonarQube** くらいの温度感で良いと思います。

## AI と組み合わせる

jscpd には**LLM に食わせる前提の導線が公式にあります**。

```bash
npx jscpd@5 src --reporters ai
```

`ai` レポーターは**トークン効率の良い重複レポート**を出します。人間向けの装飾を削って LLM に渡しやすくしたもので、そのまま「この重複を共通関数に抽出して」に繋げられます。さらに公式に **MCP サーバ**と **`dry-refactoring` スキル**まであります。

```bash
npx skills add https://github.com/kucherenko/jscpd --skill dry-refactoring
```

ここまで来ると分業が綺麗に決まります。

- **検出は機械**（トークン一致なので決定的・高速）
- **抽出方針の提案は LLM**（「この 3 箇所はこう共通化できる」）
- **採否は人間**（「これは知識の重複か、たまたま似ているだけか」）

特に相性が良いのが **運用② との組み合わせ**です。PR で新しく増えたクローンだけを `ai` レポーター経由で LLM に渡せば、**母数に薄められない単位でリファクタ案が出る**。全体監査の結果を丸ごと LLM に投げると量が多すぎて機能しませんが、差分なら現実的なサイズに収まります。

## まとめ

- **DRY はコードの重複ではなく知識の重複の話。** ツールが出すのは「似ているコード」なので、採否の判断は人間が持つ。
- **jscpd v5 は Rust 製で速い。** 26.7 万行 / 127ms。CI コストは実質ゼロ。
- **結果は Total で見ない。** `format` で言語を絞る。markdown / json は基本ノイズ。閾値に使うなら行 %。
- **使い方は二段構え。** 定期監査は `--blame` + `html` で一覧を眺める（閾値なし）。CI は公式 Action の **SARIF + Code Scanning** で新規流入を差分で捕まえる。
- **全体 % 閾値は新規重複を止めない。** 母数に薄まるので保険と割り切る。
- **sonarjs は AST、jscpd はトークン列。** 補完関係なので両方入れてよい。組織なら SonarQube の Quality Gate。
- **`ai` レポーター / MCP / `dry-refactoring` スキル**で、検出→提案→採否の分業が既製品で組める。

「入れたら安心」ではなく「**何を止めたいのか**」を先に決める。全体監査と差分チェックはまったく別の道具だ、という整理さえできていれば、あとは設定するだけです。

---

## 関連記事

AI に思い切り書かせるための9本です。どこから読んでも大丈夫ですが、この順に並んでいます。

1. [ターミナルを自作したら、1日のコミット数が500を超えて、生産性がバグった話](https://zenn.dev/singularity/articles/diy-terminal-500-commits) — 並列運用の始まり。道具そのものを作った話
2. [1日500コミットは、もう読めない ── だからコードレビューをやめた](https://zenn.dev/singularity/articles/stopped-reviewing-my-code) — 読まなくても壊れない仕組みの全体像
3. [ユーザーの困りごとは、その日のうちに直す ── 中央値1.2時間、最速9分](https://zenn.dev/singularity/articles/issue-median-one-hour) — 機械に移せなかったものは何か
4. [strict を入れても as は止まらない ── ESLint と tsconfig の「入れたつもり」を数える](https://zenn.dev/singularity/articles/what-else-was-off) — 規約に書いても、機械が止めていなければ守られない
5. [AIでがんがん書く時代の「きれいなコード」の守り方](https://zenn.dev/singularity/articles/clean-code-ci-for-ai-era) — ESLint / SonarJS / jscpd / knip を CI に置く実装編
6. **jscpd で重複コードを機械的に潰す** ← **いまここ**
7. [AIに大きな仕様書を渡して一気に作らせるのは、宝くじを買うようなものです](https://zenn.dev/singularity/articles/small-teams-ai) — そもそも作る前に、どこまで決めておくのか
8. [1日500コミットを日常にするツールを作りました ── これを使えばだれでも余裕です](https://zenn.dev/singularity/articles/ever-better-pm2) — その足回りを作る道具。★43,000のOSSで実測した記録つき
9. [1日500コミットを続けたら、Macが熱で落ちるようになりました](https://zenn.dev/singularity/articles/bottleneck-descends) — 速くしたら何が壊れたか。認知から物理まで、詰まる場所が降りていく話
