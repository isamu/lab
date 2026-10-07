# chaff（開発者向け）

[![npm](https://img.shields.io/npm/v/chaffjs)](https://www.npmjs.com/package/chaffjs)

このディレクトリ（`text/`）は、文章の linter とユニットテストである chaff を作る yarn workspaces です。
ここは chaff に手を入れる人のための README です。使い方は npm の README（[packages/chaff/README.md](./packages/chaff/README.md)）と、
[日本語のサイト](https://isamu.github.io/lab/ja/)・[英語のサイト](https://isamu.github.io/lab/en/) にあります。

**ブラウザで試す:** [プレイグラウンド（日本語）](https://isamu.github.io/lab/ja/playground/) ·
[Playground (English)](https://isamu.github.io/lab/en/playground/)

chaff は文書を機械で確かめる側です。同じ文章なら何度かけても同じ結果を出し、文章は書き換えません。
意味を読まないと決まらないことだけを、`chaff test` が候補を絞ってから AI に渡します。lint の道筋にモデルは入れません。

## 構成

```text
text/                      yarn workspaces のルート
  packages/chaff           core。npm 名 chaffjs
    rules/*.yaml           ルールの定義（名前・理由・メッセージ・強さを日英で）。分岐も式も書かない。サイトのルールのページもここから作る
    genres.yaml            ジャンルごとに動かすルールと強さ、ジャンルの指針。サイトのジャンルのページもここから作る
    profiles/*.yaml        文書の種類（法令など）の知識。コードは種類を知らず、ここを読む
    styles/                style: で選ぶ表記スタイル
    src/plugin.ts          contract（型のみ。実装を持たない）
    src/detectors/         ルール定義の how_to_find が引く検出器
      registry/            検出器の登録。how_to_find 1 つにつき 1 ファイル（文書をまたぐものは cross-registry/）
    src/config/            chaff.yaml の読み書き
    src/render/            出力（既定 / --compact / --json）
    src/browser.ts         chaffjs/browser の入口（プレイグラウンドもこれで動く）
    src/cli.ts
    skills/chaff/SKILL.md  npx chaffjs skill が入れる Claude Code の skill
  packages/lang-ja         @chaffjs/lang-ja。文分割と語彙表
    lexicons/*.yaml        語彙。ここだけが言語別
  packages/lang-en         @chaffjs/lang-en。同上
  corpus/                  実文書（法令、corpus/docs）と、そこでの結果の期待値（corpus/expected/、rules-measure.json）
  test/                    node:test（test/test_*.ts）
    fixtures/bench/        誤りを植える自作の見本と、bench の期待値
  examples/                実際に公開した記事と社内文書、プラグインの例。CI でもここにかける
  scripts/                 corpus・bench・rules:measure・サイト用の生成など
  site/                    ドキュメントサイト（Astro）。https://isamu.github.io/lab/
  docs/ChangeLog.md        変更履歴
```

パッケージのあいだの import は型だけにしています。言語のアダプタは chaff の値に依存せず、単体で動きます。
ルールの名前・理由・メッセージは YAML のデータで、コードには法令や契約の語彙を書きません。文書の種類の知識は `profiles/` に置きます。

## コマンド

```bash
yarn install
yarn format          # prettier。*.md と samples/ は手で整形しているので対象外（CI は yarn format:check）
yarn lint            # eslint
yarn typecheck       # tsc --noEmit
yarn build           # 各 package の dist
yarn test            # node:test
yarn knip            # 未使用の export（落とさない）
yarn duplication     # コピペ検出（落とさない）
```

`yarn test` は既定でコアの数だけテストを並べて走らせます。一台で何本も走らせるときは `CHAFF_TEST_JOBS=4 yarn test` のように数を絞ります。
`yarn test --part 2/5` は 5 つに分けた 2 つ目だけを走らせます（CI は部分ごとに別の job で並べます）。

実文書と見本にかけて、結果が動いていないかを確かめるコマンドです。

```bash
yarn corpus:fetch    # corpus/manifest.json の文書を取ってくる（再配布できないものは git に入らない corpus/.cache/ へ）
yarn corpus          # corpus にかけて corpus/expected/ と比べる（--verbose で指摘も出す、--update で書き換える）
yarn corpus:health   # URL の文書をすべて取り直し、取れない・上流と違う・結果が変わった、を報告する（週次の CI と同じ）
yarn bench           # 誤りを植えた見本で見逃しを数え、test/fixtures/bench/expected/ と比べる（--verbose、--update は corpus と同じ）
yarn planted         # 誤りを仕込んだ文書の組（test/fixtures/planted/<組>/）で種類ごとに見つけた数を数え、組の expected.json と比べる（--update で書き換える）
yarn bench:ai        # AI っぽさのルールを、人・生成文・書き直しの見本と corpus にかけ、当たりと誤報を数える
yarn rules:measure   # ルールごとに、各ジャンルの人の文書の何割で指摘するかと bench の成績を表にする
yarn example         # examples/ の実文書にかける（1 行形式。yarn example:friendly で既定の出力）
yarn screens:update  # サイトの手引きに載せた画面を、chaff がいま出すものに書き換える（en/commands.md のようにページを渡すとそのページだけ）
```

`yarn rules:measure --write` は測った結果を `corpus/rules-measure.json` に書き、`--apply` はそれに合わせて各ルールの `status`（experimental / stable）と、切るジャンルの群（`off_for`）を書き換えます。
`test/test_rule_policy.ts` が、各ルールの設定をこのファイルと突き合わせます。
測る文書は `corpus/rules-measure-documents.json` に固定してあり、手元に無いものがあれば `yarn corpus:fetch` を促して止まり、載っていない取得済みの文書は測りません（どの手元でも同じ結果になるように）。

サイトは `site/` で `yarn build` のあと `yarn docs:links` を回すと、サイトと README のリンク切れを見ます。

CI は `.github/workflows/chaff-ci.yml` で、`text/**` を触る PR でだけ、ubuntu・macOS・Windows の 3 つで回ります。
`yarn corpus` と `yarn bench` の結果が期待値から動いたら落ちるので、意図した変化なら `--update` で書き換えて PR に含めます。

## ルールを足す

1. `packages/chaff/rules/<id>.yaml` を書きます。名前（`name`）、理由（`why`）、メッセージ（`message`）、直し方（`how_to_fix`）、例（`example`）を日英の両方で、
   強さ（`levels`）、使うジャンル（`use_for`）、`group` と `summary` も書きます。新しいルールは `status: experimental` で入れます。既存のルールのファイルが手本です。
2. 検出器が新しく要るなら、`packages/chaff/src/detectors/<how_to_find>.ts` に書き、`src/detectors/registry/<how_to_find>.ts` で登録します。共有の一覧は書き換えません。
   言語ごとに違う語は `packages/lang-*/lexicons/` に置きます。
3. 試験を `test/test_<何を見るか>.ts` に書きます。中身は自分で書いた文か、パブリックドメインの実文書の短い抜粋だけにします。落ちるのを見てから直し、通るのを見ます。
4. `yarn bench` で見逃しを、`yarn corpus` と `yarn rules:measure` で人の文書での誤報を確かめます。測った結果で `yarn rules:measure --apply` が、既定で動かすか（`stable`）とどのジャンルで切るかを決めます。

チームが自分たちのルールを書くとき（`chaff.yaml` の `custom_rules` やプラグイン）の書き方は、サイトの
[ルールを足す](https://isamu.github.io/lab/ja/guide/adding-rules/) と [プラグインを作る](https://isamu.github.io/lab/ja/guide/writing-plugins/) にあります。

## よくしていく流れ

chaff がどこで間違えるか（誤った指摘）、どこを見逃すかは、実文書と利用者の報告が教えてくれます。そのひとつひとつを試験と修正にします。

1. 実文書（`yarn corpus:fetch` で取る corpus）か、利用者の報告（`npx chaffjs feedback` が下書きを作る）に chaff をかけます。
2. 誤った指摘を見つけたら、その一件ではなく型を探します。同じ道筋を通るほかの文書はどれか、です。
3. 最小の実文書の抜粋（パブリックドメインのものだけ）を試験に入れ、落ちるのを見て、直し、通るのを見ます。
4. corpus にかけ直し、ほかに動いたものが無いことを確かめます。

## 仕様

- [chaff-spec.md](./chaff-spec.md): 実装の仕様。冒頭に非エンジニア向けの概要があります。
- [chaff-workflow-spec.md](./chaff-workflow-spec.md): 導入から規範の更新までの利用者側の仕様。
- [natural-language-validation-harness-spec.md](./natural-language-validation-harness-spec.md): 概念の仕様。
- [samples/](./samples/): 設定ファイルの実物。

`docs/ChangeLog.md` は、リリースのときに、前のリリースから取り込んだ PR の題から書きます。機能の PR は ChangeLog を書き換えません。`npm publish` はメンテナが実行します。

## In English

This folder (`text/`) is the yarn workspaces root that builds chaff, a linter and unit tests for prose. This README is
for people working on chaff; how to use it is in the npm README ([packages/chaff/README.md](./packages/chaff/README.md))
and on [the English site](https://isamu.github.io/lab/en/). **Try chaff in your browser:**
[the playground](https://isamu.github.io/lab/en/playground/).

- **Layout:** `packages/chaff` is the core (`rules/*.yaml` hold each rule's names, reasons and messages in both
  languages; `src/detectors/registry/` registers one detector per file), `packages/lang-ja` and `packages/lang-en` the
  language adapters, `corpus/` the real documents, `test/` the tests, `site/` the guide site.
- **Commands:** `yarn format`, `yarn lint`, `yarn typecheck`, `yarn build` and `yarn test`. To share a machine, run
  `CHAFF_TEST_JOBS=4 yarn test`; `--part 2/5` runs one part. `yarn corpus`, `yarn bench` and `yarn planted` compare the results on
  real documents, on seeded mistakes and on the planted sets of whole documents with what is committed (`--update` to accept a change). `yarn rules:measure`
  measures each rule on the human documents pinned in `corpus/rules-measure-documents.json` (`--apply` sets its status
  and the genres it is off for); it stops when a pinned one has not been fetched (`yarn corpus:fetch`). `yarn screens:update`
  rewrites the guide's screens to what chaff prints now.
- **Adding a rule:** a rule file under `packages/chaff/rules/` with `status: experimental`, a detector registered in
  `src/detectors/registry/` if it needs a new one, a test that fails first, then `yarn bench`, `yarn corpus` and
  `yarn rules:measure`.
- **The loop:** run chaff on real documents or a user's report, find the pattern behind each wrong finding, put a
  minimal public-domain excerpt in a test, fix it, and re-run the corpus to confirm nothing else moved.
