# 設定サンプル

`chaff` の設定を、次の 5 つの制約で作った試作。

1. `lint` と `test` は設定なしで動く
2. rule は極力シンプルで、人間が読んで分かる
3. warn / error になった箇所は、非エンジニアでも分かる
4. rule は非エンジニアでも変更できる
5. rule は AI が設定しやすい

仕様: [chaff-spec.md](../chaff-spec.md) / [chaff-workflow-spec.md](../chaff-workflow-spec.md)

---

## 読むまえに: 2 つの軸

サンプルを読むとき、どの検査にも次の 2 つが付いている。混ざると設計を読み違える。

### 軸 1 — 誰が判定するか

| | 判定するもの | API key | 速さ | 同じ入力で同じ結果になるか |
| --- | --- | --- | --- | --- |
| **機械** | 数え上げ、文字列照合、文書構造、統計 | 不要 | 速い（1 文書 数十 ms） | **なる** |
| **AI** | 意味、文脈、主張の成立 | 要る | 遅い（1 候補 1〜3 秒） | ならない。confidence が付く |

機械で判定できるものを AI に聞かない。これが仕様の最重要原則（[nlh spec §22](../natural-language-validation-harness-spec.md) の deterministic first）。

いま `lint` が動かすのは機械だけ。AI は `test` でのみ動き、key が無ければ黙って飛ばさず「飛ばした」と報告する。

### 軸 2 — chaff が何をするか

| | すること | 誰が文章を直すか |
| --- | --- | --- |
| **検出** | 場所を指摘する | — |
| **提案** | 直しかたを文字列で見せる | **人** |
| **置換** | **しない** | — |

**chaff は文章を書き換えない。** 一文字も触らない（[chaff-spec §25](../chaff-spec.md)）。

`lexicons/team.yaml` の `instead:` や `spelling:` の `use:` は、置換ではなく**提案の文面**である。ここを読み違えやすいので注記しておく。

```yaml
words_to_avoid:
  - word: 巻き取る
    instead: 引き継ぐ / 担当する      # ← これは「こう直してください」という表示文であって、
                                      #    chaff が書き換えるわけではない
```

自動で置き換えない理由は 3 つ。

```text
同じ表現でも意図的なことがある   引用文の原文を改変できない
文脈を壊すことがある             前後の係り受けが変わる
誤検知がある                     置換された誤検知は、指摘された誤検知より直しにくい
```

### 出力でも 2 軸が見える

読む人が「これは揺れる判定か」を知らないと、AI の誤検知に振り回される。`test` の出力は機械と AI を見出しで分ける（[output-test-example.txt](./output-test-example.txt)）。

```text
═══ 機械による判定 ═══════════════════════════════
    同じ文章なら何度実行しても同じ結果になります

═══ AI による判定 ════════════════════════════════
    文章の意味を読んでいます。実行するたび結果が変わることが
    あります。おかしいと思ったら、そのまま無視して構いません。

    118 文のうち 4 文を読みました（残りは機械が対象外と判断）
```

AI の指摘にだけ「確からしさ」を出し、納得できないときの逃げ道を 2 つ添える。

```text
  ⚠  数字の根拠がありません            確からしさ 0.88

     この指摘が違うと思ったら:
       この箇所だけ黙らせる    <!-- stet: unsourced-number — 理由 -->
       ルールごとゆるめる      npx chaff relax unsourced-number
```

どちらの出力も末尾に「文章は書き換えていません。直すのは書いた人です」と出す。

---

## ファイル

| ファイル | 誰が書くか | 判定 | chaff がすること |
| --- | --- | --- | --- |
| [chaff.yaml](./chaff.yaml) | 人 | — | 設定。個人ブログ。既定から変えた 2 行だけ |
| [chaff.team-business.yaml](./chaff.team-business.yaml) | 人 | — | 設定。チームの社内文書。フル |
| [checks.yaml](./checks.yaml) | 人（非エンジニア） | **AI** | 検出 + 提案 |
| [lexicons/team.yaml](./lexicons/team.yaml) | 人（非エンジニア） | **機械**（文字列照合） | 検出 + 提案（置換はしない） |
| [rules/bold-density.yaml](./rules/bold-density.yaml) | 開発者 | **機械**（数え上げ） | 検出 + 提案 |
| [rules/padded-intro.yaml](./rules/padded-intro.yaml) | 開発者 | **機械**（語彙照合） | 検出 + 提案 |
| [rules/risk-disclosure.yaml](./rules/risk-disclosure.yaml) | 開発者 | **AI**（rubric 判定） | 検出 + 提案 |
| [output-example.txt](./output-example.txt) | — | — | 出力。`lint`（機械のみ） |
| [output-test-example.txt](./output-test-example.txt) | — | — | 出力。`test`（機械 + AI を分けて表示） |
| [output-compact.txt](./output-compact.txt) | — | — | 出力。エンジニア向け |
| [rules-for-ai.json](./rules-for-ai.json) | — | — | AI に渡す現在の状態 |

`rules-for-ai.json` の「AI」は判定ではなく**設定を書かせる相手**のこと。軸 1 の AI とは別物。

### rule 定義のどこを見れば分かるか

`layer` が軸 1 を決める。

```text
layer: L1    機械。文書構造と統計だけ。言語を問わず動く
layer: L2    機械。語彙表との照合。語彙だけが言語別
layer: L3    機械。品詞解析が要る。setup が済んでいないと飛ばされる
layer: L4    AI。rubric で判定する。API key が要る
```

`how_to_fix` があることが軸 2 を決める。全 rule が持ち、**表示するだけ**である。

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

