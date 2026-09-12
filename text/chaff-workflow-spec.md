# chaff — User Workflow Spec

ユーザーが chaff をどう使うか。導入から、書き、検証し、直し、規範を育てるまでの一連の流れを定義する。

実装仕様: [chaff-spec.md](./chaff-spec.md)
概念仕様: [natural-language-validation-harness-spec.md](./natural-language-validation-harness-spec.md)

作成日: 2026-09-10

---

## はじめに読む人へ

ここから下は設計書なので、用語が多い。**先にこの節だけ読めば、使い方は分かる。**

chaff が何をする道具かは [chaff-spec.md](./chaff-spec.md) の冒頭に書いてある。ここでは「どう使うか」だけを書く。

### まず試す（設定はいらない）

ファイルを指定して実行するだけ。インストールも、AI の利用登録も要らない。

```
npx chaffjs article.md
```

日本語か英語か、ブログか提案書かは、中身を見て自動で判断する。判断した結果は必ず 1 行目に出るので、外れていたら分かる。

### 指摘はこう出る

どこが、何が問題で、なぜよくないか、どう直すか。この 4 つが必ず揃う。

```
─── 41 行目 ────────────────────────────────

    ここで **重要** なのは **キャッシュの寿命** です。**TTL** を
    **短く** すると **整合性** は保てますが **負荷** が上がります。

  ⚠  太字の使いすぎ

     このセクションに太字が 6 箇所あります（2 箇所まで）。
     太字は読者の目を止める道具です。多用すると、どこも目立たなく
     なります。

     → 本当に強調したい 1〜2 箇所だけ残して、ほかは普通の文に
       してください

     このルールをゆるめる:  npx chaffjs relax bold-density
```

**文章は書き換えられない。** 直すのは書いた人。

### 指摘されたら、道は 3 つ

どれを選んでもよい。3 つ目があることが大事で、これがないと「うるさいから使わない」で終わる。

| 道 | どんなとき | やること |
| --- | --- | --- |
| **直す** | 指摘がもっともなとき | 文章を書き直す |
| **この箇所だけ黙らせる** | 指摘は正しいが、ここは意図的なとき | 文章に一行書き足す |
| **ルールを変える** | その指摘が自分たちの方針に合わないとき | 設定を変える |

3 つ目は、コマンド 1 行でできる。理由も一緒に記録される。

```
npx chaffjs relax bold-density --why "図の説明で太字を多用するため"
```

同じルールで「黙らせる」を何度もやっていると、それは 3 つ目を選ぶべきサイン。chaff がそれを見つけて教えてくれる。

### 覚える言葉は 4 つだけ

ルールの強さは、この 4 つから選ぶ。数字を書く必要はない。

```
strict    きびしく見る
normal    ふつう（何も書かなければこれ）
relaxed   ゆるく見る
off       見ない
```

### チームで使うと、設定が「うちの文章の決まりごと」になる

`chaff.yaml` を共有すると、それがそのままチームの文章規範になる。Notion に書いたスタイルガイドと違って、守られているかを自動で確かめられる。

既に文書がたくさんある場合でも、全部直してから始める必要はない。いまある指摘をいったん脇に置いて、「これ以上増やさない」ところから始められる。

### この先に書いてあること

| | |
| --- | --- |
| §5〜§7 | 試す、設定する、指摘に応える |
| §8〜§10 | 既存の文書に入れる、チームで使う、自動チェックに載せる |
| §11〜§12 | 書いている最中の使い方、設定を育てる |
| §14〜§15 | うまくいかないときの表示、避けたい使い方 |

設定ファイルの実物は [samples/README.md](./samples/README.md) にある。

---

## 1. このドキュメントの位置づけ

`chaff-spec.md` は「どう作るか」を定めている。rule の四層モデル、Plugin API、LanguageAdapter、finding format。

本 spec は **その一段上、「どう使われるか」** を定める。

```text
本 spec            ユーザーの行動と判断
                     何を書き、何を実行し、指摘にどう応答し、いつ設定を変えるか
       ↑
chaff-spec.md      システムの構造
                     rule / detector / adapter / profile / finding
       ↑
既存 nlh spec      検証という営みの原理
                     deterministic first / 検出と修正の分離 / rule を source of truth に
```

本 spec が実装仕様に対して持つ拘束力:

- ここで定義した**ユーザーの行動**を実現できない設計は、実装仕様の側を直す。
- 逆に、ユーザーが取る必要のない行動のための機能は作らない。

---

## 2. 中心にある考え方

chaff がユーザーに書かせるものは 2 つしかない。

```text
document        検証される対象
config          何を良しとするかの宣言
```

finding は成果物ではない。**この 2 つのうちどちらを直すべきかを指す矢印**である。

```text
              ┌────────────────────┐
              │   規範（暗黙）      │   頭の中、あるいは Notion のスタイルガイド
              └──────────┬─────────┘
                         │  明文化する
                         v
        ┌──────────┐          ┌──────────┐
        │ document │          │  config  │
        └────┬─────┘          └────┬─────┘
             │                     │
             └──────────┬──────────┘
                        v
                   chaff lint
                        │
                        v
                    findings
                        │
          ┌─────────────┼─────────────┐
          v             v             v
     (a) 直す      (b) 抑制する   (c) 規範を変える
          │             │             │
          v             v             v
      document      document       config
```

ほとんどの linter が現場で死ぬのは、**(c) の道を用意しないから**である。指摘が自分たちの規範に合わないとき、ユーザーに残された手は「無視する」しかなくなり、やがて全体が無視される。

chaff は (c) を一級の応答として設計する。§7 がこの spec の中核。

---

## 3. 想定する使い方

4 つの入り口がある。それぞれ最初に触る機能が違う。

| # | 誰が | 何のために | 最初に使うもの |
| --- | --- | --- | --- |
| 1 | 個人が記事を書く | 公開前に自分の癖を見る | `npx chaffjs article.md` |
| 2 | 個人が提案書を書く | 出す前に抜けを見つける | `npx chaffjs proposal.md`（required-sections） |
| 3 | チームが文書を保守する | 規範を共有し、CI で守る | `chaff init` と `chaff.yaml` の commit |
| 4 | AI に書かせた文章を見る | 生成物の癖を検出する | 複合シグナル（`ai-generated-composite`） |

1 と 2 は設定なしで完結できなければならない。3 と 4 は設定が要る。

**設計上の含意**: 設定を書かせる前に価値を出すこと。`chaff init` を最初のステップにしない。

---

## 4. ライフサイクル全体

```text
  ①  試す        npx chaffjs article.md              設定なし。所要 1 分
       │
       v
  ②  決める      npx chaffjs init                    規範を選ぶ。所要 10 分
       │
       v
  ③  書く        エディタ + chaff lint --watch      日常
       │
       v
  ④  検証する    chaff lint  /  chaff test
       │
       v
  ⑤  応答する    直す / 抑制する / 規範を変える      ★中核（§7）
       │
       ├──────────────────► ③ に戻る（直した）
       │
       v
  ⑥  共有する    chaff.yaml を commit             チームの規範になる
       │
       v
  ⑦  自動化する  CI に載せる
       │
       v
  ⑧  育てる      lexicon 追加 / threshold 調整      規範が現実に追いつく
       │
       └──────────────────► ⑤ に戻る
```

①から④までを一度も止まらずに通せることを最優先とする。②を飛ばして④まで行けることも要件（§5）。

---

## 5. ① 試す — 設定を書く前に価値を出す

```bash
npx chaffjs article.md
```

この一回で満たすべき条件:

| 条件 | 理由 |
| --- | --- |
| インストール不要 | 試すコストをゼロにする |
| API key 不要 | key の取得で 9 割が離脱する |
| 言語もジャンルも指定不要 | 何を指定すべきか、初回のユーザーは知らない |
| **stable な rule しか動かさない** | 第一印象で誤検知を出したら二度と使われない |
| 指摘は上限件数で打ち切る | 60 件並ぶと読まれない |
| 何を根拠に判定したかを表示する | 推定が外れたときに気づける |
| 次の一手を必ず示す | 出しっぱなしにしない |

出力:

```text
$ npx chaffjs article.md

article.md  [ja · blog/tech]  言語は本文から推定 (0.97) / ジャンルはパスから推定

   3:1   warning  「近年、AIの活用が注目されています」は水増しの導入です
                  padded-intro

  24:1   warning  見出し「キャッシュの仕組み」を直後の文がほぼ反復しています
                  heading-echo

  41:12  warning  太字がこのセクションに 6 箇所あります (上限 2)
                  bold-density

  58:1   warning  文長の変動係数 0.18 (下限 0.30)。文の長さが単調です
                  sentence-rhythm

4 warnings

experimental な 7 rule は既定で無効です。--experimental で有効化できます。

  npx chaffjs explain sentence-rhythm   このルールの意図と根拠を読む
  npx chaffjs init                      規範を固定して、チームで共有する
```

### 5.1 推定が外れたとき

推定を 1 行目に出す理由は、外れたことにユーザーが気づけるようにするため。外れていた場合の回復手段を同じ行から辿れること。

```bash
npx chaffjs article.md --genre business/proposal
npx chaffjs article.md --lang en
```

推定に失敗した場合は、推測して走らせずに止める。

```text
article.md  ジャンルを推定できませんでした

  パス、front matter、内容のいずれからも判定できません。
  指定してください:

    npx chaffjs article.md --genre blog/tech
    npx chaffjs article.md --genre business/report

  一覧は npx chaffjs genres
```

---

## 6. ② 決める — `chaff init`

対話で聞くのは 3 つだけ。それ以外は既定値で埋め、あとから直させる。

```text
$ npx chaffjs init

1. ここに置く文書は主に何ですか？
   > ブログ記事 (blog)
     ビジネス文書 (business)
     両方（パスで振り分ける）

2. 主な言語は？
   > 日本語 (ja)
     英語 (en)
     混在（文書ごとに自動検出）

3. どのくらい厳しくしますか？
     minimal   error のみ。誤検知をほぼ出さない
   > standard  推奨。stable な rule を全部
     strict    experimental も含める。規範を積極的に育てたい人向け

作成しました:
  chaff.yaml          規範の宣言。commit してください
  checks.yaml         自分たちで足す検査を書く場所（空）
  lexicons/team.yaml  社内語・禁止語を書く場所（空）
  .gitignore          .chaff-cache/ を追記しました

次:
  npx chaffjs lint .           全体を見る
  npx chaffjs baseline .       既存文書の指摘を一旦棚上げする（§8）
```

### 6.1 `chaff.yaml` は人が読めるものであること

3 つを守る。この設定ファイルがそのままチームの文章規範になる（§9）ため。

| | |
| --- | --- |
| 既定から変えたものだけを書く | 全 rule が並んだファイルは読まれない |
| 値は 4 語から選ぶ | 非エンジニアに数値を書かせない |
| なぜその設定かをコメントに残す | 規範の履歴になる |

```yaml
# チームの文章規範。ここが唯一の source of truth。
#
# 値は strict / normal / relaxed / off から選びます。
# コマンドでも変えられます:
#   npx chaffjs relax bold-density --why "図の説明で太字を多用するため"

$schema: https://chaff.dev/schema/v1.json

genre: blog/tech

by_path:
  - files: ["proposals/**/*.md"]
    genre: business/proposal

rules:
  # 太字の使いすぎ
  # 太字は読者の目を止める道具です。多用すると、どこも目立たなくなります。
  bold-density: relaxed      # 2026-09-11 図の説明で太字を多用するため / @isamu

checks: ./checks.yaml
word_lists:
  - ./lexicons/team.yaml

ai_checks: true
ai_backend: anthropic    # anthropic（既定）か openai
ai_model: claude-sonnet-5
```

rule の説明コメント（`name` と `why`）は `chaff relax` が自動で書く。設定ファイルを開いた人が、rule を調べずに意味を掴めるようにするため。

### 6.2 ファイル名の頭にドットを付けない

`chaff.yaml` であって `.chaff.yaml` ではない。隠しファイルは Finder にもエディタのファイルツリーにも既定で出ない。**非エンジニアが開けない設定ファイルは、非エンジニアが変更できない設定ファイルである。**

ツールしか触らないもの（`.chaff-cache/`）はドット付きのままでよい。

---

## 7. ⑤ 応答する — 指摘への 3 つの道

**本 spec の中核。** 1 件の finding に対して、ユーザーが取れる応答は 3 つしかない。どれを選ぶべきかを、ツールの側から示す。

```text
finding
  │
  ├── (a) 文章を直す
  │       指摘が正しく、直したほうが良くなる。もっとも多い
  │       → document を編集する
  │
  ├── (b) この箇所だけ抑制する
  │       指摘は一般には正しいが、この箇所は意図的
  │       → document に stet コメントを書く
  │
  └── (c) 規範のほうを変える
          指摘が自分たちの規範に合っていない
          → chaff.yaml を編集する
```

### 7.1 (b) 抑制する

校正記号 stet（ラテン語で「そのままにせよ」）を使う。

```markdown
<!-- stet: no-em-dash — 引用元の原文を改変しないため -->
> The question is not whether machines think—but whether men do.
```

```markdown
<!-- stet-section: bold-density — 用語集なので太字が多いのは意図的 -->
```

```markdown
<!-- stet-file: ai-tell, rule-of-three -->
```

規約:

- 理由は `—` の後ろに書く。`--require-stet-reason` で必須にできる。
- 理由なしの抑制は、半年後に誰も判断できなくなる。CI で必須にすることを推奨する。
- 抑制は rule 名を必ず指定する。全 rule の一括抑制は用意しない。

### 7.2 (c) 規範を変える

4 語のどれかに変えるだけ。数値は書かなくてよい。

```yaml
rules:
  bold-density: relaxed     # ゆるく見る
  sentence-rhythm: off      # 見ない
  excessive-hedging: strict # きびしく見る
```

`chaff.yaml` を開かずに、コマンドでも変えられる。理由と rule の説明がコメントとして自動で入る。

```bash
npx chaffjs relax bold-density --why "図の説明で太字を多用するため"
```

```yaml
  # 太字の使いすぎ
  # 太字は読者の目を止める道具です。多用すると、どこも目立たなくなります。
  bold-density: relaxed      # 2026-09-11 図の説明で太字を多用するため / @isamu
```

規約:

| 規約 | 理由 |
| --- | --- |
| 既存のコメントを壊さない | 規範の履歴が消える |
| **すでに理由が付いているものを変えるときは `--why` を必須にする** | 古い理由が新しい値に残ると、履歴が嘘になる |
| 段階が 2 つしかない rule に、無い段階を指定したら何もしない | 変えたつもりで変わっていない状態を作らない |

最後の 2 つは実装仕様に定義がある（chaff-spec §18.1、§19.4）。

段階が無い場合の応答:

```text
$ npx chaffjs strict padded-intro

padded-intro に strict はありません。normal と同じ設定です。
設定は変更しませんでした。
```

### 7.3 (b) と (c) の見分け方

同じ rule に対して抑制が積み上がったら、それは (b) ではなく (c) のサインである。chaff がこれを検出して提案する。

```bash
$ npx chaffjs suppressions

抑制されている指摘: 23 件

  bold-density              9 件  ← 設定の見直しを検討してください
      docs/glossary.md, docs/api.md, docs/faq.md ほか 6 ファイル
      すべて「用語集・一覧なので意図的」という理由です。
      max_per_section を上げるか、これらのパスで off にすることを検討してください。

  no-em-dash                7 件  ← 設定の見直しを検討してください
      すべて引用文中です。
      引用ブロックを対象外にする設定を検討してください。

  padded-intro              2 件
  heading-echo              1 件

理由が書かれていない抑制: 4 件
  docs/setup.md:12, docs/setup.md:40, README.md:3, README.md:88
```

閾値は既定で 5 件。`suppressions.warn_threshold` で変更できる。

**この機能がないと、抑制は静かに溜まり、規範と現実の乖離が見えなくなる。**

### 7.4 応答しないという道は用意しない

(a)(b)(c) のいずれも選ばずに finding を残したまま進むことはできる。ただし chaff はそれを「未応答」として数え、報告し続ける。無視は状態として可視化する。

```text
5 warnings (うち 3 件は前回の実行でも出ています)
```

---

## 8. ⑧ 既存文書への導入 — baseline

実務で最大の壁。記事が 200 本ある repo に入れると 4000 件出る。全部直してから導入することは誰にもできない。

```bash
$ npx chaffjs baseline docs/

docs/ を走査しました。

  4127 findings を .chaff-baseline.json に記録しました。
  以後、これらは報告されません。新しく増えたものだけが出ます。

  内訳:
    sentence-rhythm            1204
    bold-density                891
    padded-intro                623
    heading-echo                402
    ...

  .chaff-baseline.json を commit してください。
```

規約:

| 規約 | 理由 |
| --- | --- |
| baseline は commit する | チーム全員が同じ地点から始める |
| baseline にある finding は報告しない | 既存を直さずに導入できる |
| 新規の finding だけが CI を落とす | 増やさないことだけを守らせる |
| baseline は**減る方向にしか自動更新しない** | 直したぶんは自動で確定し、後戻りできなくする |
| 増加方向の更新は明示フラグが要る | `--accept-regression` と理由の記録を要求する |
| baseline は行番号ではなく内容ハッシュで持つ | 前後の編集で baseline が崩れないようにする |

```bash
npx chaffjs lint docs/                 # baseline との差分だけ
npx chaffjs lint docs/ --show-baseline # 棚上げ分も含めて全部見る
npx chaffjs baseline --prune           # 直った分を baseline から落とす
```

---

## 9. ⑥ チームで使う — 設定が規範になる

`chaff.yaml` を commit した時点で、それがチームの文章規範の実体になる。

### 9.1 スタイルガイドとの二重管理を避ける

多くのチームは Notion や `STYLE.md` にスタイルガイドを持っている。chaff を入れると、規範が 2 箇所に存在することになり、必ず乖離する。

方針:

```text
機械が判定できるもの   → chaff.yaml だけに書く。STYLE.md からは消す
機械が判定できないもの → STYLE.md に残す（主張の組み立て方、読者への態度など）
```

`chaff.yaml` のコメントに「なぜこの設定か」を書けるようにしているのは、STYLE.md の該当部分を丸ごと移せるようにするため。

`chaff explain` は rule の意図を出力するので、これを使って規範ドキュメントを生成できる。

```bash
npx chaffjs explain --all --format markdown > STYLE.generated.md
```

### 9.2 レビューでの分担

chaff が見る層と、人間が見る層を明示的に分ける。

```text
chaff が見る          構造、統計、語彙、そして rubric で書ける semantic な性質
人間が見る            主張が正しいか、事実か、この読者に必要か、面白いか
```

レビュアーに「chaff が通っているか」を見させない。CI が見る。人間は上の層に集中する。

---

## 10. ⑦ CI に載せる

```yaml
- name: prose lint
  run: npx chaffjs lint docs/ --changed-only --yes

- name: prose semantic test
  run: npx chaffjs test docs/ --changed-only --yes
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

規約:

| 規約 | 理由 |
| --- | --- |
| PR で変更された文書だけを見る | 全体を見ると、無関係な既存 finding で落ちる |
| **error だけが CI を落とす** | warning で落とすと、必ず無効化される |
| warning は PR の annotation として出す | 見えるが、止めない |
| `lint` は key なしで動く | fork からの PR でも動く |
| `test` は key がなければ skip して成功する | ただし skip 件数は必ず報告する |
| 導入初日は baseline で緑から始める | 赤い状態で始めると、赤が常態になる |

error にするものは絞る。既定では次だけ。

```text
required-sections      必須セクションの欠落
no-mixed-desumasu      文体の混在
理由なしの stet        --require-stet-reason 有効時
```

---

## 11. ③ 書いている最中の体験

```bash
npx chaffjs lint article.md --watch
```

保存のたびに再検証する。出力は差分だけを出す。

```text
watching article.md

18:23:41  ✓ 4 warnings → 3 warnings   (padded-intro 解消)
18:25:02  ✗ 3 warnings → 4 warnings   (bold-density 42:8)
```

エディタ統合は本 spec の範囲外だが、そこへ繋げるための要件だけ課す。

- finding は LSP の Diagnostic に**そのまま写像できる**こと（range、severity、code、source）。
- `chaff lint --format lsp` で LSP Diagnostic の JSON を吐けること。
- これにより、エディタ拡張を chaff 本体と別に、後から作れる。

---

## 12. ⑧ 規範を育てる

設定が現実に追いつくための経路を 4 つ用意する。

### 12.1 抑制の集積から

§7.3 の `chaff suppressions` が起点。もっとも多い経路。

### 12.2 自分たちの文書から閾値を決める

既定の閾値は一般的な corpus で決めたもので、そのチームには合わないことがある。

```bash
$ npx chaffjs eval docs/ --rule sentence-rhythm

docs/ の 212 文書に sentence-rhythm を適用しました。

  現在の閾値 0.30  →  38 文書が該当 (17.9%)

  閾値ごとの該当数:
    0.20    4 文書  (1.9%)
    0.25   14 文書  (6.6%)
    0.30   38 文書  (17.9%)   ← 現在
    0.35   79 文書  (37.3%)

  該当した 38 文書のうち、過去 90 日に更新されたものは 3 件です。
  多くは古い文書であり、いま直す対象ではない可能性があります。

  推奨: 0.25。差分を chaff.yaml に適用しますか？ [y/N]
```

自動適用はしない。必ず提示して選ばせる。

### 12.3 社内語の追加

```yaml
# lexicons/team.yaml
internal-jargon:
  - pattern: "よしなに"
    message: 社外文書では具体的に書いてください
  - pattern: "巻き取る"
    message: 「引き継ぐ」「担当する」など具体的に

undefined-acronym:
  known:
    - { term: "SLA", expansion: "Service Level Agreement" }
    - { term: "PRD", expansion: "Product Requirements Document" }
```

### 12.4 新しいジャンルを足す

既存 profile を継承して差分だけ書く。

```yaml
# chaff.yaml
profiles:
  business/incident-report:
    extends: business/report
    rules:
      required-sections:
        sections:
          ja: ["事象", "影響範囲", "原因", "対処", "再発防止"]
      excessive-hedging: strict    # 障害報告で曖昧な表現は許容しない
```

---

## 13. 成果物と保存場所

ユーザーが管理するものの全体。

| 何 | 場所 | commit | 誰が編集するか |
| --- | --- | --- | --- |
| 規範の宣言 | `chaff.yaml` | する | 人。チームで合意して変える |
| 自分たちで足した検査 | `checks.yaml` | する | 人（非エンジニア）。自然文で |
| 語彙表 | `lexicons/*.yaml` | する | 人（非エンジニア） |
| 棚上げした指摘 | `.chaff-baseline.json` | する | ツールが生成。人は触らない |
| 抑制 | 文書内の `<!-- stet: -->` | する | 人。理由つきで |
| judge のキャッシュ | `.chaff-cache/` | **しない** | ツール。`.gitignore` に入れる |
| 生成した規範ドキュメント | `STYLE.generated.md` | 任意 | ツールが生成 |

`chaff init` は `.gitignore` に `.chaff-cache/` を追記する。

---

## 14. うまくいかないときの体験

「黙って成功する」を禁じる。何かが走らなかったなら、必ずそう言う。

| 状況 | 出力 | 終了コード |
| --- | --- | --- |
| 言語を判定できない | 候補と指定方法を示して停止 | 非 0 |
| ジャンルを判定できない | 同上 | 非 0 |
| adapter が未取得 | サイズを示して取得の可否を聞く。CI では `--yes` で自動 | 0（取得後に続行） |
| capability 不足で rule が skip | skip した rule 名と `setup` の案内 | 0。`--strict` で非 0 |
| その言語に rule の実装がない | `unsupported` として rule 名を列挙 | 0 |
| API key がない（`test`） | semantic を skip した件数を報告 | 0 |
| 設定ファイルが壊れている | 行番号と、期待する形を示す | 非 0 |
| 対象ファイルが 0 件 | glob が何にもマッチしなかったと明示 | 非 0 |

最後の行が重要。マッチ 0 件を成功として返すと、「CI は通っているが何も検証していない」状態が延々と続く。

---

## 15. アンチパターン

この設計が避けようとしているもの。実装時の判断基準として使う。

| アンチパターン | 何が起きるか | 本 spec の対策 |
| --- | --- | --- |
| 初回から全 rule を有効にする | noise で埋まり、二度と使われない | 既定は stable のみ（§5） |
| warning で CI を落とす | 全員が無効化する | error だけが落とす（§10） |
| 既存文書を全部直させる | 導入できない | baseline（§8） |
| 抑制を理由なしで貼れる | 半年後に誰も判断できない | `--require-stet-reason`（§7.1） |
| 抑制が溜まっても気づけない | 規範と現実が乖離する | `chaff suppressions`（§7.3） |
| 設定を変える道を示さない | 「chaff がうるさい」で終わる | 3 つの応答を明示（§7） |
| スタイルガイドと設定の二重管理 | 必ず乖離する | 機械判定可能なものは設定だけに（§9.1） |
| 単一スコアを出す | 点数を上げる作業が目的化する | スコアを出さない（chaff-spec §25） |
| skip を黙って成功にする | 検証していないのに緑になる | skip を必ず報告（§14） |
| 閾値を自動で書き換える | なぜその値なのか誰も知らなくなる | 提示して選ばせる（§12.2） |

---

## 16. 実装仕様への要求

本 spec から `chaff-spec.md` に追加で必要になるもの。

| # | 要求 | 対応する節 |
| --- | --- | --- |
| 1 | `chaff baseline` サブコマンドと `.chaff-baseline.json` 形式。内容ハッシュで finding を同定する | §8 |
| 2 | `chaff suppressions` サブコマンド。抑制の集計と設定変更の提案 | §7.3 |
| 3 | `chaff eval --rule <id>` の閾値 sweep を、対話的な設定適用まで繋ぐ | §12.2 |
| 4 | `chaff genres` サブコマンド。利用可能な profile の一覧 | §5.1 |
| 5 | `chaff explain --all --format markdown` | §9.1 |
| 6 | `--format lsp` で LSP Diagnostic を出力する | §11 |
| 7 | `--watch` と、前回結果との差分表示 | §11 |
| 8 | `stet-section` と `stet-file` のスコープ指定 | §7.1 |
| 9 | `--require-stet-reason` | §7.1 |
| 10 | 未応答 finding の継続カウント（前回実行との比較） | §7.4 |
| 11 | 対象ファイル 0 件を失敗として扱う | §14 |
| 12 | `chaff init` が `.gitignore` に `.chaff-cache/` を追記する | §13 |
| 13 | `chaff relax` / `strict` / `off` によるコメント保持の書き戻し。既存の理由を上書きするときは `--why` 必須 | §7.2 |
| 14 | `chaff words add` と `chaff checks add` | §12.3、§12.4 |
| 15 | 段階が定義されていない level を指定したら、書き換えずに告げる | §7.2 |
| 16 | 設定ファイル名は `chaff.yaml`（ドットなし） | §6.2 |

これらは `chaff-spec.md` §18 と §19 に反映済み。

---

## 17. 要決定事項

1. **`chaff lint` の既定を stable のみにするか。** 第一印象を守る効果は大きいが、experimental rule が永久に試されない懸念がある。`init` の「厳しさ」で strict を選んだ場合に有効化する設計にしているが、既定を standard にすること自体の妥当性は corpus 評価後に再検討する。
2. **baseline を行番号ではなく内容ハッシュで持つ場合、文章の軽微な編集で同定が外れる。** どこまでの編集を「同じ finding」とみなすか。正規化の範囲を決める必要がある。
3. **`chaff suppressions` の閾値（既定 5 件）。** 少なすぎると設定変更を促しすぎ、多すぎると乖離に気づけない。
4. **未応答 finding の継続カウント（§7.4）をどこに保存するか。** `.chaff-cache/` に置くと CI では機能しない。commit する対象を増やすかどうか。
5. **`STYLE.generated.md` の生成を推奨するか。** 生成物を commit させると、それ自体が古くなる問題を持ち込む。CI で再生成して差分を検出する運用と、生成しない運用のどちらを既定にするか。
