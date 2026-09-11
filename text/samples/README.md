# 設定サンプル

`chaff` の設定を、次の 5 つの制約で作った試作。

1. `lint` と `test` は設定なしで動く
2. rule は極力シンプルで、人間が読んで分かる
3. warn / error になった箇所は、非エンジニアでも分かる
4. rule は非エンジニアでも変更できる
5. rule は AI が設定しやすい

仕様: [chaff-spec.md](../chaff-spec.md) / [chaff-workflow-spec.md](../chaff-workflow-spec.md)

---

## ファイル

| ファイル | 誰が書くか | 何のため |
| --- | --- | --- |
| [chaff.yaml](./chaff.yaml) | 人 | 個人ブログ。既定から変えた 2 行だけ |
| [chaff.team-business.yaml](./chaff.team-business.yaml) | 人 | チームの社内文書。フル |
| [checks.yaml](./checks.yaml) | 人（非エンジニア） | 自然文で書く検査 |
| [lexicons/team.yaml](./lexicons/team.yaml) | 人（非エンジニア） | 社内語・略語・表記ゆれ |
| [rules/bold-density.yaml](./rules/bold-density.yaml) | 開発者 | L1 の rule 定義 |
| [rules/padded-intro.yaml](./rules/padded-intro.yaml) | 開発者 | L2 の rule 定義 |
| [rules/risk-disclosure.yaml](./rules/risk-disclosure.yaml) | 開発者 | L4（意味を見る）の rule 定義 |
| [output-example.txt](./output-example.txt) | — | 非エンジニア向けの出力 |
| [output-compact.txt](./output-compact.txt) | — | エンジニア向けの出力 |
| [rules-for-ai.json](./rules-for-ai.json) | — | AI に渡す現在の状態 |

---

## 5 つの制約をどう満たしたか

### 1. 設定なしで動く

`chaff.yaml` が無くても動く。あっても、**既定から変えたものだけを書く**。サンプルの個人ブログ版は実質 2 行しかない。

設定なしのときの既定:

```text
言語        本文から自動検出
ジャンル    パスと front matter と内容から推定
rule        status: stable のものだけ。experimental は動かさない
意味の検査  API key があれば動く。無ければ skip して、skip したと報告する
```

`test` も同じ。期待値ファイルを書かせない。`checks.yaml` は「足したいものがあれば書く」ものであって、必須ではない。

### 2. rule がシンプル

rule 定義に分岐も式も書かない。数えかたは `detector` に任せ、rule は「何を、いくつまで、なぜ」だけを持つ。

```yaml
id: bold-density
detector: count-per-section
counts: strong
levels:
  strict: 1
  normal: 2
  relaxed: 4
```

意味を見る L4 の rule も形は同じで、`rubric` と `look_at` が増えるだけ。

### 3. 指摘が非エンジニアに分かる

[output-example.txt](./output-example.txt) が既定の出力。1 件につき 4 つを出す。

```text
該当箇所の引用       どこの話か
何が起きているか     太字が 6 箇所あります（2 箇所まで）
なぜ問題か           多用すると、どこも目立たなくなります
どうすればいいか     → 1〜2 箇所だけ残して、ほかは普通の文に
```

rule 名は日本語で先に出し、英語の id は「ゆるめる」コマンドの中にだけ出す。`--compact` でエンジニア向けの 1 行形式に切り替わる。

### 4. 非エンジニアが変更できる

**4 つの言葉しか使わない。** 数値を書かなくていい。

```yaml
rules:
  bold-density: relaxed
```

| 言葉 | 意味 |
| --- | --- |
| `strict` | きびしく見る |
| `normal` | ふつう（既定） |
| `relaxed` | ゆるく見る |
| `off` | 見ない |

数値との対応は rule 定義の `levels` が持つ。数値を書きたい人は直接書ける。

YAML を開かずに変えられる。理由がコメントとして自動で残る。

```bash
npx chaff relax bold-density --why "図の説明で太字を多用するため"
```

```yaml
  # 太字の使いすぎ
  # 太字は読者の目を止める道具です。多用すると、どこも目立たなくなります。
  bold-density: relaxed      # 2026-09-10 図の説明で太字を多用するため / @isamu
```

rule の説明コメントも自動で入る。設定ファイルを開いた人が、rule 名を調べずに意味を掴める。

### 5. AI が設定しやすい

3 つで支える。

**値が列挙**。`strict / normal / relaxed / off` の 4 つ。自由記述の数値より生成が安定する。

**現在の状態を JSON で渡せる**。[rules-for-ai.json](./rules-for-ai.json) がその形。現在値、取りうる値、数値との対応、なぜ今 off なのか、変更コマンドまで入っているので、AI は推測せずに書ける。

```bash
npx chaff rules --json
```

**JSON Schema がある**。`chaff.yaml` の先頭に `$schema` を書く。

```bash
npx chaff schema > chaff.schema.json
```

---

## キーは英語、中身は自分の言葉

キーはすべて英語にした。中学校までに習う範囲の語だけを使う。

```
$schema  ai_checks  ai_model  by_path  check  checks  count  files  full
genre    how_to_find  how_to_fix  id  instead  known_words  language
layer    level  levels  look_at  message  name  not  rules  short  short_forms
skip_if  spelling  status  stet_needs_reason  use  use_for  what_to_check
where    why  word  word_list  word_lists  words_to_avoid
```

値のほうは、書き手の言葉で書く。

```yaml
- name: 数字には根拠がある
  use_for: business
  check: |
    効果を主張する数値について、算出根拠・対象期間・比較対象の
    いずれかが本文にあること。
  look_at: 数値と「向上」「削減」などの語が同じ文にあるところ
  level: normal
  how_to_fix: 「(2026年4-6月、対前年同期、n=120)」のように括弧で添えてください。
```

この分けかたで 3 つが同時に立つ。

| | なぜ成り立つか |
| --- | --- |
| 非エンジニアが書ける | 覚えるキーは 10 個以下。意味は英語のまま読んで分かる |
| AI が書ける | キーが固定なので、言語ごとにスキーマが分岐しない |
| 多言語で使える | 英語話者は値だけ英語で書けばよい。ファイルの形は変わらない |

キーを日本語にすると、`chaff.yaml` の形が言語ごとに変わる。chaff 自体が言語非依存を掲げている以上そこは崩せない、というのが最初の理由だった。実際に英語キーで書き直してみると、**非エンジニアが困るのはキー名ではなく、書く内容が自然文かどうかだった**。`check` の中身をふつうの文で書ければ、キーが英語であることは障害にならない。

平易さのために落としたもの:

| 使わなかった語 | 使った語 |
| --- | --- |
| `severity` | `level` |
| `overrides` | `by_path` |
| `lexicons` | `word_lists` |
| `semantic` | `ai_checks` |
| `detector` | `how_to_find` |
| `rubric` | `what_to_check` |
| `fix` | `how_to_fix` |
| `genres` | `use_for` |
| `scope` | `where` |
| `enabled: true` | `ai_checks: true`（キーごと削除） |

---

## まだ決まっていないこと

### 自然文の検査は、どこを見るか分からない

`checks.yaml` で自然文の検査を足せるようにしたが、[chaff-spec.md](../chaff-spec.md) §14 は「候補を絞り込まない L4 rule は登録できない」と定めている。全文を LLM に投げるのを禁じているため。

サンプルでは `look_at` に自然文で書かせている。

```yaml
look_at: 数値と「向上」「削減」などの語が同じ文にあるところ
```

これを実際の絞り込みに変換する必要がある。案は 2 つ。

1. `chaff checks add` の対話の中で、AI が絞り込み条件を作って確認を取る
2. 書かなければ文書全体を対象にし、コストが高いことを明示して警告する

1 は精度が読めず、2 は §14 の原則を実質的に緩める。**未解決**（spec §26-7 に記載）。

---

## 仕様への反映（済）

サンプルを作る過程で仕様と食い違った点は、[chaff-spec.md](../chaff-spec.md) と [chaff-workflow-spec.md](../chaff-workflow-spec.md) に反映済み。

| # | 変更 | 反映先 |
| --- | --- | --- |
| 1 | `.chaff.yaml` → `chaff.yaml`（ドットを取る）。隠しファイルは非エンジニアが開けない | workflow §6.2 |
| 2 | rule の値を 4 語にし、rule 定義に `levels` を持たせる | spec §18.1 |
| 3 | rule 定義に `name` `why` `how_to_fix` を必須化 | spec §18.2 |
| 4 | `chaff relax` `strict` `off` `words add` `checks add` を CLI に追加 | spec §19 |
| 5 | `chaff rules --json` と `chaff schema` を追加 | spec §19、§19.3 |
| 6 | 既定の出力を非エンジニア向けにし、`--compact` を従来形式に | spec §19.1、§19.2 |
| 7 | `checks.yaml` を新設 | spec §18.3 |
| 8 | キー名を平易な英語に統一 | spec §18 全体 |

### 実装スパイクで見つかった 3 点（修正済み）

実際にコードを動かして確かめたときに出た問題。

| # | 問題 | 直しかた | 反映先 |
| --- | --- | --- | --- |
| 9 | 値を `relaxed` から `strict` に変えても、`relaxed` 時代の理由コメントが残る | すでに理由があるものを変えるときは `--why` を必須にする | spec §19.4、workflow §7.2 |
| 10 | 4 語モデルが合わない rule がある。`padded-intro` は意味のある段階が 2 つしかなく、`strict` と `normal` が同値になっていた | `levels` に書くのは意味のある段階だけ。未定義の段階は `normal` に落ち、`chaff strict` は書き換えずにそう告げる | spec §18.1 |
| 11 | experimental な rule を利用者が明示的に有効にしたとき、動くのかどうかが未定義だった | 明示設定が status の既定に勝つ。ただし実行のたびに一度報告する | spec §18.4 |

あわせて、文分割の実測結果（英語は既定で正しい、日本語は `.` を文末と誤認するので adapter 側で結合する）を spec §7.2 に記録した。

