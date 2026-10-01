# chaff — Prose Validation Harness Spec

言語に依存しない文章検証ハーネスである。ビジネス文書とブログ記事を第一の対象とする。

前提仕様: [natural-language-validation-harness-spec.md](./natural-language-validation-harness-spec.md)
利用者側の仕様: [chaff-workflow-spec.md](./chaff-workflow-spec.md)（導入・執筆・検証・規範の更新の流れ）

本 spec は [business-blog-harness-spec.md](./business-blog-harness-spec.md) を置き換える。前版は日本語専用として設計していたが、rule を層に分けた結果、日本語に本質的に依存するのは全体の 1/5 程度であることが分かったため、言語を直交軸として切り出した。

作成日: 2026-09-08

---

## はじめに読む人へ

ここから下は作る人向けの設計書で、専門用語が多い。**先にこの節だけ読めば、何を作ろうとしているかは分かる。**

### ひとことで言うと

文章の読みにくいところを、コンピューターが自動で見つけてくれる道具です。

### 何を見つけるのか

誤字脱字ではない。文章の「組み立て」を見る。

```
一文が長すぎて、読んでいるうちに主語を見失う
太字が多すぎて、どこも目立たなくなっている
見出しと同じことを、その直後の文が繰り返している
「近年、〜が注目されています」など、どの記事にも当てはまる書き出し
提案書なのに、リスクや懸念が一言も書かれていない
「30%削減できます」と書いてあるが、何と比べたのか分からない
「〜が実施されます」と書いてあり、誰がやるのか分からない
```

### やること、やらないこと

| | |
| --- | --- |
| **やる** | 読みにくい場所を指摘する |
| **やる** | どう直すとよいかを文章で提案する |
| **やらない** | **文章を勝手に書き換える。一文字も触らない** |
| **やらない** | 文章に点数をつける |
| **やらない** | 人によるレビューの代わりになる |

最後の 2 つは意図的に外している。点数は「点数を上げる作業」を生むだけで、文章はよくならない。人が見るべきなのは「主張が正しいか」「この読者に必要か」であって、そこはこの道具の担当ではない。

### 2 種類の判定がある

見分けがつかないと、道具を信用しすぎたり、逆に無視したりすることになる。

| | 何を見るか | 実行に必要なもの | 同じ文章なら同じ結果になるか |
| --- | --- | --- | --- |
| **機械が見る** | 長さ、回数、構造、決まった言い回し | なし。手元ですぐ動く | **なる**。何度やっても同じ |
| **AI が見る** | 意味、話の筋、根拠があるか | AI の利用登録（API key） | **ならない**。結果が揺れる |

機械で分かることを AI に聞かない、という原則で作る。速く、安く、結果が毎回同じになるため。

AI の指摘には「確からしさ」の数字が付く。納得できなければ無視してよいし、そのルール自体を止めることもできる。

### 使う人が書くものは 2 つだけ

```
文章そのもの        検証される対象
chaff.yaml          「うちではこう見てほしい」という設定
```

設定は「きびしく / ふつう / ゆるく / 見ない」の 4 つから選ぶだけで、数字を書く必要はない。設定ファイルを開かずに、コマンドでも変えられる。

指摘を受けたときに取れる道は 3 つある。

```
文章を直す              指摘がもっともなとき
この箇所だけ黙らせる    指摘は正しいが、ここは意図的なとき
ルールのほうを変える    その指摘が自分たちの方針に合わないとき
```

3 つ目を用意することが、この道具の設計でいちばん大事な点。これがないと「うるさいから使わない」で終わる。

### 続けて読むなら

| 読む人 | 次に読むもの |
| --- | --- |
| 使う人 | [chaff-workflow-spec.md](./chaff-workflow-spec.md) 導入から日々の使い方まで |
| 設定を書く人 | [samples/README.md](./samples/README.md) 設定ファイルの実物 |
| 作る人 | この先（§0 以降） |

---

## 0. 名前について

`chaff` は籾殻を指す。脱穀したあとに残る、栄養のない外皮のこと。

この名前は **`lint` とまったく同じ命名論理**による。lint は布から出る繊維くずであり、ESLint はそれを名前にしている。linter は「取り除くべきカス」の名を負う道具である、という慣習がすでにある。自然言語版がその慣習を継ぐなら chaff になる。

```bash
npx chaffjs article.md
```

選定の根拠:

| 基準 | 評価 |
| --- | --- |
| 短さ | 5 文字 1 音節。npx で打ちやすく、口に出して言える |
| 比喩 | 「麦と籾殻をより分ける」。ツールの仕事が一語で伝わる |
| 言語中立性 | 聖書由来で多くの言語に等価な慣用句がある（籾殻 / Spreu / paja / balle / ivraie）。特定言語の文化に依存しない |
| 意味の適合 | 「取り除くべきもの」を名指しており、「ツールが直す」を含意しない。検出と修正の分離（§25）と矛盾しない |
| 既知のリスク | 軍事用語（レーダー欺瞞用の金属片）と同綴り。検索性でやや不利になる |

パッケージ名前空間:

```text
chaff                  harness core（npx の入口）
@chaffjs/lang-ja         公式の言語アダプタ
@chaffjs/lang-en
chaff-lang-ko          第三者のアダプタは非 scope で名乗る
```

`@chaff` scope は 2019 年から別人が所有しているため使えない。

**公式は scope、第三者は非 scope** に分ける。`@typescript-eslint/*` と
`eslint-plugin-*`、`@nuxt/*` と `nuxt-*` と同じ形。

| | 名前 | 誰が出すか |
| --- | --- | --- |
| 公式アダプタ | `@chaffjs/<言語>` | この repo |
| 第三者アダプタ | `chaff-lang-<言語>` | 誰でも |

scope 側は名前を押さえられ、非 scope 側は誰でも参入できる。どちらか一方だけを
選ぶと、名前を取られるか、第三者が名乗れなくなるかのどちらかになる。

genre pack（`business` / `blog`）は言語ではないので `@chaffjs` には入らない。
実装するときに `chaff-business` を取るか、別の scope を作るかを決める。

### 0.1 検討して外した候補

記録として残す。同じ検討を繰り返さないため。

| 候補 | 外した理由 |
| --- | --- |
| `stet` | 製品名にしない。校正記号 stet は「この指摘は無視してよい」の意であり、finding 抑制ディレクティブ（§20.3）に予約する |
| `corrigenda` | 意味は全候補中もっとも正確（ラテン語「訂正されるべき事項」＝ finding list の定義）だが、10 文字で口に出しにくい。キャッチーではなく上品 |
| `prosebench` `textbench` `plainprose` `bluepencil` | 明快だがキャッチーではない。定着した開発ツール名はほぼ 4〜6 文字 1〜2 音節の具体名詞であり、説明的な複合語はこの型から外れる |
| `corrigo` | Corrigo Inc.（JLL 傘下の SaaS）と商標衝突 |
| `emendo` `migaku` `akapen` | 「ツールが直してくれる」印象。§25 の検出と修正の分離と矛盾 |
| `strunk` `zinsser` | 英文作法の代名詞であり、言語非依存のハーネス名としてミスリード。実在の人名でもある |
| `crucible` | Atlassian Crucible（コードレビュー製品）と衝突 |
| `nutgraph` | 米ジャーナリズムの内輪語。global 方針と噛み合わない |
| 日本語ローマ字全般 | `suikou` `toishi` `migaku` ほか。global 方針により対象外 |

4 文字の英単語は npm でほぼ枯れている。`taut` `pare` `cull` `crux` `pith` `gist` `nib` `kern` `widow` `orphan` `sift` `winnow` はいずれも取得済みである。この帯で空いていて実用に耐えたのは `chaff` `quoin` `ibid` のみだった。

---

## 1. 概要

自然言語の文章に対して、lint / unit test / review に相当する検証を行う。既存 spec が定めた rule model、finding format、severity、検証レイヤーをそのまま継承し、次の 2 点を追加する。

1. **言語を直交軸として切り出す。** 言語知識は `LanguageAdapter` に閉じ込め、rule 本体と genre profile は言語を知らない。
2. **ジャンル別 rule pack を別パッケージにする。** business と blog を第一の対象とする。

最終形:

```bash
npx chaffjs lint article.md
```

インストールも API key も言語の指定も要らない（言語は自動検出する）。これを設計の最優先制約とする（§17）。

---

## 2. 既存 spec との関係

既存 spec（`nlh`）は概念仕様であり、対象を技術文書に置いていた。本 spec はその rule model を実装可能な形に落とし、対象をビジネス文書とブログに広げ、言語軸を追加する。

継承するもの:

```text
Rule を source of truth にする         既存 §5.2
Linter と Judge を分離する             既存 §5.3
検出と修正を分離する                   既存 §5.4
deterministic first                    既存 §22
finding format                         既存 §10
severity (error / warning / info)      既存 §14
rule status (experimental / stable)    既存 §18
corpus calibration                     既存 §16
textlint は harness ではなく executor  既存 §22
```

変更するもの:

```text
既存 §15 Profile
  ジャンルだけを切り替える単一軸だった
  → 言語 / ジャンル / 検証レイヤーの三軸に分解する（§3）

既存 §7.2 SudachiPy
  日本語形態素解析を前提に置いていた
  → LanguageAdapter の capability の一つに一般化する（§7, §16）

既存 §21 Non-goals
  「日本語のみ」を含んでいた
  → 削除する（§25）
```

---

## 3. 三つの直交軸

rule の振る舞いは三つの軸の積で決まる。

```text
        Language                Genre                  Layer
        言語                    ジャンル                検証レイヤー

        ja                      business/proposal      structural
        en                      business/email         lexical
        ...                     blog/tech              syntactic
                                blog/essay             statistical
                                                       semantic

        LanguageAdapter         GenrePack              Executor
        が提供                   が提供                  が実行
```

一つの rule は次のように分解される。

```text
rule "excessive-hedging"

  Layer     lexical           共通の phrase-density detector を使う
  Language  ja / en           語彙表を adapter から取る
  Genre     business = warning / blog/essay = info
```

この分解により、次が成立する。

- 新しい言語を足すとき、adapter を 1 つ書けば既存 rule の大半がそのまま動く。
- 新しいジャンルを足すとき、profile を 1 つ書けば既存 rule がそのまま動く。
- rule を足すとき、どの層に属するかを決めれば、言語とジャンルへの展開は自動。

---

## 4. Rule の四層モデル

言語依存の度合いで rule を四層に分ける。これが本 spec の中核である。

```text
L1  Universal Detector          言語知識ゼロ
      文書構造と統計のみを見る。adapter の sentenceSplit だけに依存する。
      例: 太字の密度、セクション長の均一さ、文長の変動係数

L2  Lexicon-parameterized       detector 共通、語彙表が言語別
      共通の照合エンジンに、adapter が提供する語彙表を渡す。
      例: 空虚な強調、水増し導入、AI 臭、ヘッジ表現

L3  Language-specific           その言語の形態論・正書法に依存
      adapter が detector ごと提供する。capability が足りなければ skip。
      例: ですます / である混在、二重敬語、中黒の並列、英語の受動態

L4  Semantic                    LLM judge
      rubric を言語別に翻訳して持つ。判定自体は言語非依存。
      例: 結論が根拠に支えられているか、依頼に期限と担当があるか
```

本 spec が定義する rule の内訳:

| 層 | 本数 | 新言語追加時のコスト |
| --- | --- | --- |
| L1 Universal | 16 | ゼロ |
| L2 Lexicon | 11 | 語彙表を書く |
| L3 Language-specific | 言語ごとに 8 前後 | detector を実装する |
| L4 Semantic | 9 | rubric を訳す |

新しい言語のサポートは、L2 の語彙表と L4 の rubric 翻訳だけで 36 本中 27 本が動く状態から始められる。

重要な点として、**L3 の rule でも概念は普遍であることが多い**。`agentless-passive`（主語のない受動態）と `nominalization`（動詞の名詞化）は、日本語では形態素解析、英語では品詞タグという別々の detector を要するが、指摘している悪癖は同一である。したがって rule id は共有し、実装だけを adapter 別に持つ（§6）。

---

## 5. パッケージ構成

```text
chaff                  harness core
  rule model / executor dispatch / finding format
  L1 universal detector
  L2 照合エンジン
  L4 judge runner と candidate filter 基盤
  言語検出
  CLI (lint / test / eval / explain / init / setup)

@chaffjs/lang-ja         日本語アダプタ
  文分割 / 分節 / 形態素解析ブリッジ
  ja lexicon (L2)
  ja 固有 detector (L3)
  textlint ja rule への dispatch

@chaffjs/lang-en         英語アダプタ
  文分割 / トークナイズ / 品詞タグ
  en lexicon (L2)
  en 固有 detector (L3)

chaff-business        ビジネス文書 genre pack
  profile (proposal / report / email / press-release / meeting-notes)
  business 固有の L1 rule と L4 rubric
  required-sections の見出し定義（言語別）

chaff-blog            ブログ genre pack
  profile (tech / essay / owned-media)
  blog 固有の L1 rule と L4 rubric
```

genre pack を core から分ける理由は前版と同じである。

まずリリースサイクルが違う。core の rule model は安定させたいが、threshold は calibration のたびに動く。
依存も違い、genre pack は adapter に依存しない。分けておけば、ジャンルを並列に増やせる。

`chaff-business` と `chaff-blog` は **adapter に依存しない**。これが四層モデルの帰結であり、「ビジネス文書の書き方」が言語を越えて共通であるという主張でもある。

---

## 6. Plugin API

core が公開する contract。genre pack と language adapter はこの型だけに依存する。

```ts
// chaff/plugin

export interface GenrePack {
  readonly kind: "genre";
  readonly id: string;
  readonly apiVersion: 1;
  readonly profiles: Record<string, ProfileDefinition>;
  readonly rules: Record<string, RuleDefinition>;
  readonly detectors: Record<string, Detector>;   // L1 のみ
}

export interface LanguageAdapter {
  readonly kind: "language";
  readonly id: string;                 // BCP 47 の primary subtag: "ja", "en"
  readonly apiVersion: 1;
  readonly capabilities: AdapterCapabilities;
  detect(source: string): number;      // この言語である確度 0..1
  segment(text: string): Segmentation;
  lexicons: Record<string, Lexicon>;   // L2
  rules: Record<string, RuleDefinition>;  // L3
  detectors: Record<string, Detector>;    // L3
}

export interface AdapterCapabilities {
  readonly sentenceSplit: true;   // 必須
  readonly wordSplit: boolean;
  readonly pos: boolean;          // 品詞
  readonly lemma: boolean;
  readonly lengthUnit: "char" | "word";
}
```

rule 定義は必要な capability を宣言する。

```yaml
agentless-passive:
  layer: L3
  name:
    ja: 主語のない受動態
    en: Agentless passive
  why:
    ja: 「〜が実施されます」は、誰がやるのかが消えます。
  how_to_fix:
    ja: 動作の主体を主語にしてください。
  requires:
    pos: true
  implementedBy:
    ja: ja/agentless-passive
    en: en/agentless-passive
  levels:
    strict: 1
    normal: 3
    relaxed: 6
  use_for: [business]
```

`implementedBy` に文書の言語のエントリがなければ、その rule は `unsupported` として報告される。`requires` を満たさなければ `skipped` として報告される。いずれも silent pass にはしない（§17.4）。

detector に渡す文書モデル:

```ts
export interface ProseDocument {
  readonly path: string;
  readonly source: string;
  readonly ast: MarkdownAst;         // textlint 互換 AST
  readonly language: string;         // 検出結果
  readonly adapter: LanguageAdapter;
  readonly sections: Section[];
  readonly paragraphs: Paragraph[];
  readonly sentences: Sentence[];
  readonly lists: ListBlock[];
}

export type Detector = (
  doc: ProseDocument,
  options: Readonly<Record<string, unknown>>,
) => Finding[];
```

core に求める性質:

- detector は純関数とする。fs / network / clock に触れない。core が I/O を済ませてから呼ぶ。
- `apiVersion` が一致しない plugin は起動時に明示的なエラーで拒否する。
- profile は `extends` による継承を持つ。
- L1 detector は `doc.adapter` の `segment` 以外を使ってはならない。これを lint で強制する（§23）。

---

## 7. LanguageAdapter の contract

adapter が最低限提供するもの:

```ts
export interface Segmentation {
  readonly sentences: Span[];
  readonly words?: Span[];     // wordSplit が true のとき
  readonly tokens?: Token[];   // pos が true のとき
}

export interface Token {
  readonly span: Span;
  readonly surface: string;
  readonly pos: string;        // Universal POS tag
  readonly lemma?: string;
}
```

品詞タグは Universal Dependencies の UPOS に統一する。adapter ごとに独自の品詞体系を露出させない。日本語の形態素解析器も英語の POS tagger も UPOS に写像してから返す。これがないと L3 detector が adapter の実装詳細に結合する。

`lengthUnit` の存在理由:

```text
max-sentence-length は L1 rule だが、
  日本語 100 文字  ≒  英語 25 語
であり、閾値の単位が言語で違う。

adapter が lengthUnit を宣言し、
profile は言語別の閾値を持つ（§9）。
```

### 7.1 MVP で実装する adapter

| adapter | sentenceSplit | wordSplit | pos | 解析器 | lengthUnit |
| --- | --- | --- | --- | --- | --- |
| `lang-ja` | 規則ベース（句点・改行・括弧） | 形態素解析 | true | `@sglkc/kuromoji` | char |
| `lang-en` | 規則ベース（略語辞書つき） | 空白 + 句読点 | true | `wink-pos-tagger` | word |

`pos: true` は「払えばできる」の宣言であって「もう払った」ではない。実際の読み込みは `prepare`（§16.1）。
初期化にかかる時間は ja が 2.2 秒、en が 0.13 秒である。動く rule が品詞を要求しなければ、どちらも読まない。

### 7.2 文分割は adapter の責務である（実測）

`sentence-splitter@5.0.1` を日英で実行して確かめた結果を記録する。`sentence-rhythm` と `max-sentence-length` は文長に直接依存するため、分割の誤りはそのまま指標を動かす。

英語は既定で正しく分割できた。`Dr.` `e.g.` `U.S.` `$3.50` をいずれも文末と誤認しない。

ただし数字だけの語 + ピリオドは、行のどこにあっても箇条書きの番号と読み、文末にしない（`in 2026. We shipped` が 1 文になる）。
英語の adapter は、行の途中にあって次の語が大文字で始まる番号だけ、数字を同じ長さの英字に替えてから分割器に渡す。
行頭の番号と、次が小文字の番号はそのまま渡す。

日本語は誤分割する。

```text
入力  「本当に？」と聞かれたが、Dr. 田中は，答えなかった。
既定  「本当に？」と聞かれたが、Dr.   ← ここで切れる
      田中は，答えなかった。
```

`AbbrMarker` の `language` を差し替えても直らない。原因は略語の保護ではなく、`.` を文末と見なすこと自体にある。

日本語の文末は `。！？` と、仮名・漢字・「ー」・閉じ括弧の後の `．`（「，．」で書く論文など）に限られるため、adapter 側の後処理で解決する。数字の後の `．` は番号か小数点なので文末ではない（`１．はじめに`、`３．５％`）。

```text
規則  直前の断片が「。！？」か語の後の「．」（および閉じ括弧）で終わっていなければ、次と結合する
```

この後処理を入れて、略語・小数・URL・英文混在・鍵括弧内の句点の 4 ケースがいずれも期待どおりになることを確認した。

ここから 2 つが従う。

1. **文分割を共通ユーティリティにしてはならない。** adapter が持つ（§6 の `segment`）。言語ごとに終端の定義が違う。
2. 断片を結合するとき、`raw` の連結ではなく元文字列のオフセットを使う。空白ノードが落ちて文長が 1 文字ずれる。

---

## 8. 言語検出

`--lang` 省略時の決定順:

```text
1. 設定ファイルの language
2. front matter の lang / language
3. ファイル名の言語サフィックス   README.ja.md, guide.en.md
4. パス規約                       docs/ja/, content/en/
5. 内容による検出
     各 adapter の detect() を呼び、最大スコアを取る
     ja: ひらがな・カタカナ・漢字の出現率
     en: Latin script 比率と空白密度と機能語の出現
6. 決まらなければエラー。推測で走らせない
```

補足:

- コードブロック、インラインコード、URL、front matter は検出から除外する。技術文書は英語のコードを大量に含むため、除外しないと日本語文書が英語と判定される。
- 混在文書はセクション単位で判定し、セクションごとに adapter を切り替える。多言語 README のように言語別セクションを持つ文書は実在する。
- 検出結果と判定根拠を出力の 1 行目に必ず表示する。どの言語規範で検証されたか分からない結果は使えない。

---

## 9. Genre Profile

```text
prose                     共通の下敷き
  business
    business/proposal
    business/report
    business/email
    business/press-release
    business/meeting-notes
  blog
    blog/tech
    blog/essay
    blog/owned-media
```

profile は言語を知らないが、閾値だけは言語別に持つ必要がある（§7 `lengthUnit`）。

### 9.1 閾値は rule 側に置く

初版はジャンル別の閾値を profile 側のファイル（`chaff-blog/profiles/blog.tech.yaml`）に置く形にしていたが、
**実装では rule のファイルに `by_genre` として置いた**。

```yaml
# rules/max-sentence-length.yaml
levels:
  ja: { strict: 70, normal: 100, relaxed: 140 }
  en: { strict: 18, normal: 25,  relaxed: 35 }

by_genre:
  business/email:
    ja: { strict: 50, normal: 70, relaxed: 100 }
  blog/essay:
    ja: { strict: 100, normal: 140, relaxed: 180 }
```

理由は 2 つ。

- **rule の理由と数字が離れると、数字だけが動く。** なぜ 70 なのかは `why` の隣にあるべきで、
  別ファイルに置くと「この数字は何だったか」を辿るのに 2 ファイル要る
- **profile パッケージの仕組みがまだ無い。** ジャンルはいま文字列でしかなく、
  パッケージとして配る話（§15）と閾値の話を同時に持ち込む必要はない

ジャンルは `/` で階層になっており、**細かいほうが勝つ**。`business/email` の文書に対して
`business/email` → `business` → 既定の `levels` の順に探す。

`by_genre` に段が欠けていれば、そのジャンルの `normal` に落ちる（§18.1 と同じ規則）。

利用者の `chaff.yaml` は、解決した数字に 4 語で上書きをかける。

初期閾値（calibration 前の暫定値。§21 で更新する）:

| profile | 文長 ja / en | 段落あたり文数 | 太字/節 | 文長 CV 下限 |
| --- | --- | --- | --- | --- |
| business/proposal | 90 char / 22 word | 5 | 2 | 0.25 |
| business/report | 100 char / 25 word | 6 | 2 | 0.25 |
| business/email | 70 char / 18 word | 4 | 1 | - |
| business/press-release | 90 char / 22 word | 4 | 1 | - |
| business/meeting-notes | 80 char / 20 word | 3 | 0 | - |
| blog/tech | 100 char / 25 word | 6 | 2 | 0.30 |
| blog/essay | 140 char / 35 word | 8 | 1 | 0.35 |
| blog/owned-media | 90 char / 22 word | 5 | 3 | 0.30 |

### 9.2 ジャンルは preset（`genres.yaml`）

ジャンルの一覧、名前と説明（ja / en）、ジャンルの既定の段は `packages/chaff/genres.yaml` に置く。
ジャンルを選べば、その種類の文書の書き方に合わせて見る。設定を書かずに使えるようにするためのもの。

```yaml
groups:
  - id: legal                # legal/* のどのジャンルにも効く段
    rules: { ngram-repetition: off }
genres:
  - id: legal/contract
    rules: { numbering-gap: normal }   # 群の段に重ねる
  - id: legal/statute
    profile: statute                   # chaff.yaml が profile を書かなければ、これで読む
```

- 段の強さは chaff.yaml の `rules` > ジャンルの `rules`（ジャンル > 群）> status の既定。
  `--experimental` はジャンルが止めた rule を動かさない。
- ジャンルが止めた rule は「動いていない」一覧に、ジャンルを理由に出す。黙って外さない。
  rule をそもそも当てないのは use_for で、こちらは一覧に出ない。新しい群は use_for に入れたうえで、ジャンルの段で止める。
- ジャンルが入れた試験中の rule は、設定で入れたもの（§18.4）とは別に知らせる。
- 数字は §9.1 のとおり rule の `by_genre` に置く。ジャンルの段は 4 語だけを書く。
- profile の強さは by_path > chaff.yaml の `profile` > ジャンルの `profile` > 内容。
- 前からあるジャンルには段も profile も無い。結果は変わらない。

### 9.3 ジャンルを決めていない文書には、見当を出す

ジャンルが既定（`blog/tech`）に落ちた文書だけに、「契約書・規約のようです。--genre legal/contract を試せます」と
見出しの下と「動いていない」一覧の後に出す。**出すだけで、検査のジャンルは変えない。** 黙って切り替えると、
いま使っている人の結果が変わる。

- 手がかりは `genres.yaml` の `suggest:`（データ）。パスの形、言語ごとの行の形と、その行が要る数。
  profile を持つジャンルは、内容がその profile の形なら当たる。
- 強さはパスが最も強く、行はその数を要る数で割ったもの。最も強いものを挙げ、同じならファイルの先のもの。
  契約を論じる会議録は、「本契約」の行より発言者の行が多いので会議録になる。
- `chaff init` は端末でだけ一覧を出して尋ねる。スクリプトと CI は尋ねず、既定を書く。

---

## 10. Rule Catalog — L1 Universal

言語知識を使わない。adapter の `sentences` と Markdown AST だけを見る。新しい言語で無条件に動く。

| id | 見るもの | genre | 既定 severity |
| --- | --- | --- | --- |
| `bold-density` | 1 セクションあたりの強調数 | 両方 | warning |
| `heading-echo` | 見出しの character trigram が直後の文に現れた割合 | 両方 | warning |
| `section-length-uniformity` ✅ | セクション長の変動係数 | blog | info |
| `sentence-rhythm` | 文長の変動係数の下限 | blog | warning |
| `paragraph-length-variance` ✅ | 段落長の変動係数 | blog | info |
| `repeated-sentence-head` | 同じ先頭 N 文字で始まる文の連続 | 両方 | warning |
| `ngram-repetition` ✅ | character n-gram の反復 | 両方 | warning |
| `rule-of-three` ✅ | 3 項目の箇条書きが占める割合 | blog | info |
| `concrete-evidence-density` ✅ | 数値・コード・リンク・引用の密度 | blog | warning |
| `max-sentence-length` | 文長 | 両方 | warning |
| `max-paragraph-length` ✅ | 段落あたり文数 | 両方 | warning |
| `required-sections` ✅ | 必須見出しの有無 | business | error |
| `preamble-length` ✅ | 本題前の段落数 | business | warning |
| `undefined-acronym` ✅ | 略語の初出時の展開 | business | warning |
| `emoji-density` ✅ | 絵文字・装飾記号の密度 | blog | info |
| `heading-level-skip` ✅ | 見出しの深さの飛び（`##` の次の `####`） | 両方 | warning |
| `image-alt-text` ✅ | 代替テキストの無い画像 | 両方 | warning |
| `broken-link` ✅ | 行き先の無いリンク（空・無い見出し・定義の無い参照） | 両方 | warning |
| `url-run-on` ✅ | URL の直後に空白なしで続く ASCII でない字 | 両方 | warning |
| `duplicate-heading` ✅ | 同じ親の下の同じ言葉の見出し（MD024 siblings_only） | 両方 | warning |
| `empty-section` ✅ | 中身の無い節（すぐ後ろに同じ深さか浅い見出し） | 両方 | warning |
| `unbalanced-bracket` ✅ | 節の中で組にならない括弧・引用符、全角と半角の組み違い | 両方 | warning |
| `doubled-punctuation` ✅ | 二つ並んだ句読点（三つ以上は伸ばした書き方として数えない） | 両方 | warning |
| `invisible-character` ✅ | 見えない字（ゼロ幅の字・途中の BOM・ソフトハイフン・向きの指定・制御文字・隠れたタグ文字・印の後ろのノーブレークスペース）。コードの中も見る | 両方 | warning |
| `double-negative` ✅ | 二重否定（ないわけではない / not uncommon）。語彙表の言い回し | 両方 | info |
| ~~`list-length-variance`~~ | 箇条書き項目の長さのばらつき | 落とした（下記） | info |

設計上の注意:

記法の rule（`heading-level-skip` など）は `requires: [markdown]` を持ち、`.txt` では理由を言って止まる。記法は `doc.markup`（見出し・画像・リンクの行き先・書き手が付けた名前・字のまま見える範囲）だけから読む。`.txt` の `doc.markup` は記法を持たず、文書全体が字のまま見える範囲になる。

`heading-echo` と `ngram-repetition` は **character n-gram** を使う。word n-gram にすると `wordSplit` capability を要求することになり L2 に落ちる。character trigram なら日本語でも英語でも同じ実装で動き、精度も実用に足りる。`ngram-repetition` の英語（語単位の言語）の窓は、空白で区切った語の切れ目にそろえる。空白を見るだけなので `wordSplit` は要らない。

`heading-echo` の重なりは **Jaccard ではなく包含率**（見出しの trigram のうち、直後の文に現れたものの割合）で測る。実装して測るまで Jaccard と書いていたが、いちばん典型的な反復を取り逃すことが分かった。

```text
見出し    ## キャッシュの仕組み
直後の文  キャッシュの仕組みについて説明します。

Jaccard  44%   見出しを丸ごと含んでいるのに、文が長いぶん下がる
包含率   100%  見出しの trigram が全部現れている
```

この rule が測りたいのは「見出しのどれだけが繰り返されたか」であって、両者がどれだけ似ているかではない。見出しを丸ごと含んだうえで説明を続ける文は、文が長いというだけで Jaccard が下がる。

短い見出しは偶然の一致で 100% になるため、trigram が 4 つ未満（おおむね 6 文字未満）の見出しは見ない。

`required-sections` の見出し定義は、**chaff も genre pack も持たない。利用者が `chaff.yaml` に書く。**

```yaml
required_sections:
  - リスク
  - 費用
```

初版は genre pack が言語別に持つ設計で、下のような既定の一覧を想定していた。
実装では採らなかった。**何の節が必須かは組織ごとに違い、chaff が決めると合わない組織で
rule ごと切られる。** 書いていなければ何も言わない。

照合は部分一致で、見出しの文言までは縛らない（`リスク` は「リスクと対策」に当たる）。

以下は初版の案である。残してあるのは、既定を持たせたくなったときの出発点として。

```yaml
required-sections:
  layer: L1
  levels:
    strict: error
    normal: error
    relaxed: warning
  sections:
    business/proposal:
      ja:
        - 背景 | 現状 | 課題
        - 提案 | 施策 | 打ち手
        - 効果 | 期待効果
        - コスト | 費用 | 見積
        - リスク | 懸念
        - next action | 次のアクション | 依頼事項
      en:
        - background | context | problem
        - proposal | recommendation
        - impact | expected outcome
        - cost | budget | estimate
        - risk | tradeoff
        - next steps | ask
```

detector は言語を知らず、profile から渡された正規表現の配列を照合するだけ。

`concrete-evidence-density` は「具体例がない」という semantic な指摘を deterministic に近似する proxy であり、本 spec の中心的な仕掛けの一つになっている。数える対象は次のとおり。

**`technical` では動かさない。** 実装時に `blog` から `business` と `technical` へ広げたが、
自分の仕様書にかけたら 17 件出て、中身は「error」「warning」「Phase 1」のような**定義の節**だった。
仕様書の定義に数値もコードも要らないので、rule の理屈（読み終えても持ち帰るものがない）が当てはまらない。
`business` は残す（理念を語る節に具体物が無いのは、業務文書でこそ問題になる）。

```text
具体物 =
    数値表現
  + コードブロック / インラインコード
  + 外部リンク
  + 引用ブロック
```

セクション内の具体物が 0 のとき、そのセクションだけを L4 judge の候補に渡す（§14）。全文を LLM に渡さずに済む。前版では「未知語（固有名詞の近似）」も数えていたが、これは辞書を要するため L2 に移した。

### 10.1 チームが決める rule

4 つの rule は、**chaff が中身を持たない**。チームが `chaff.yaml` に書いたものだけを見る。

```yaml
jargon:            # 社内でしか通じない語
  - 横展開
  - 握る
  - 巻き取

required_sections: # この種類の文書に無いと困る見出し
  - リスク
  - 費用

prefer:            # チームの表記。使わない書き方: 使う書き方
  サーバー: サーバ
  ユーザ: ユーザー
```

`preferred-term` は「使う書き方」の一部として現れた「使わない書き方」を数えない（「ユーザー」の中の「ユーザ」）。
両側が同じ組、空の側がある組は読まない。大文字小文字は区別しない（文頭の「E-mail」も「e-mail」として見つける）。
ただし二つが大文字小文字だけ違う組（`Javascript: JavaScript`）は、それ自体が大文字小文字の決まりなので区別する。

何が社内用語かも、何の節が必須かも、組織ごとに違う。**chaff が決めると、決めた内容が合わない組織で
rule ごと切られる。** 書いていなければ何も言わない（「用語を登録してください」とも言わない）。

`internal-jargon` は**表層でも原形でも当てる**。利用者は辞書形で書く（「握る」）が、本文は活用している
（「握った」）。品詞解析があれば原形で当たり、無くても表層で当たるので、capability は要求しない。

複合動詞は形態素に割れるため原形が現れない（「巻き取ります」→ 巻き[巻く] + 取り[取る]）。
語幹で書けば表層で当たる。how_to_fix にそう書いてある。

`proper-noun-density` は spec の初版で「未知語率」としていたが、**品詞解析があれば PROPN を
数えるだけで足りる**。辞書を別に持つ必要はない。

### 10.2 n-gram は「名前」を数えない

`ngram-repetition` を実文書にかけると、上位は言い回しではなく**固有名詞と識別子**だった。

```
"AGENTS.m"       8 回
"シンギュラリティ"  11 回
"ではありません。"  8 回   ← これだけが言い回し
```

名前は繰り返して当たり前で、指摘しても直せない。**言い回しは、その言語の「つなぎ」を含む**。
日本語ならひらがな、英語なら語の切れ目がそれにあたる。どちらを見るかは adapter が宣言する `lengthUnit` で決める。

ひらがなを持たない `char` 単位の言語が来たら、この見分けは効かなくなる。
そのときは判定を adapter 側へ移す（`Voice=Pass` と同じ形）。

**n-gram は文をまたいで数えない。** またぐと「す。シンギュラリ」のように、
前の文の終わりと名前が繋がって言い回しに見える。

### 10.3 密度の床は単位で分ける

密度を見る rule は短い文書を測らない。1 個で「1000 あたり 100」になるため。
**床の値は言語で分ける。** 英語の 200 語と日本語の 200 文字では長さが桁で違う。

```ts
const FLOOR = { word: 200, char: 500 };
```

### 10.4 `list-length-variance` を落とした理由

実文書の箇条書き 27 個（3 項目以上）で変動係数を測った。

```
CV%  11 13 15 15 15 18 18 19 19 19 19 20 21 21 23 24 24 25 26 28 33 34 34 37 40 45 56
中央値 21
```

**箇条書きは揃うのが普通だった。** 並列の項目を同じ重さで並べるのが箇条書きなので、
長さが近いことは「埋めるために足した」証拠にならない。

閾値を 10% 未満まで下げれば黙るが、それは**黙らせるために閾値を動かす**ことであって、
rule が何かを見分けられるようになるわけではない。段落と節の変動係数は残す
（人が書いた文書で 30〜98% とばらけており、揃っている文書を見分けられる）。

---

## 11. Rule Catalog — L2 Lexicon-parameterized

detector は core が持ち、語彙表を adapter から取る。新しい言語では語彙表を書くだけで動く。

| id | detector | genre | 既定 severity |
| --- | --- | --- | --- |
| `empty-intensifier` | phrase-match | 両方 | warning |
| `excessive-hedging` ✅ | phrase-density + 近接共起 | business | warning |
| `cushion-phrase-density` ✅ | phrase-density | business | info |
| `unqualified-superlative` ✅ | phrase-match + 限定句の不在 | business | warning |
| `unsourced-number` | pattern-cooccurrence | business | warning |
| `internal-jargon` ✅ | phrase-match（ユーザー辞書） | business | warning |
| `preferred-term` | チームの表記（`prefer`） | 両方 | warning |
| `repeated-conjunction` ✅ | 段落先頭の語彙照合 | 両方 | warning |
| `ai-tell` ✅ | weighted phrase-match | blog | info |
| `contrast-framing` ✅ | 対比の枠（frame の語、または打ち消しとそれを返す語）の密度 | blog | info |
| `stock-transition` ✅ | 文頭の決まった接ぎの密度 | blog | info |
| `assistant-residue` ✅ | weighted phrase-match（会話の返事の名残。重み 1 は 1 つで、0.5 は 2 つで届く） | 両方 | warning |
| `unfilled-placeholder` ✅ | 括弧の中が雛形の語（[Your Name]、【会社名】）の空欄 | 両方 | warning |
| `announcing-opener` ✅ | 文頭の予告（重要なのは、Here's the thing）の数。密度ではなく数で見る | blog | info |
| `colon-lead-in` ✅ | コロンで終わり、すぐ後ろに箇条書きが来る地の文の密度（ja のみ） | blog | info |
| `emoji-heading` ✅ | 絵文字（既定で絵文字として描かれる字か、U+FE0F の付いた字）を含む見出しの数 | blog | info |
| `padded-intro` | phrase-match（冒頭限定） | blog | warning |
| `closing-cliche` | phrase-match（末尾限定） | blog | warning |
| `proper-noun-density` ✅ | 固有名詞の密度 | blog | info |

共通 detector は 4 種類しかない。

```text
phrase-match           語彙表との照合。位置制約（冒頭 / 末尾 / 見出し直後）を取る
phrase-density         単位長あたりの出現率が閾値を超える
pattern-cooccurrence   複数条件の同一文内共起、および除外条件
weighted phrase-match  各エントリの weight を合算し、文書スコアを出す
```

lexicon の形式:

```yaml
# @chaffjs/lang-en/lexicons/ai-tell.yaml
id: ai-tell
language: en
entries:
  - pattern: "delve into"
    weight: 0.8
  - pattern: "it's not just \\w+, it's"
    type: regex
    weight: 0.9
  - pattern: "tapestry"
    weight: 0.6
  - pattern: "in today's fast-paced world"
    weight: 0.9
```

```yaml
# @chaffjs/lang-ja/lexicons/ai-tell.yaml
id: ai-tell
language: ja
entries:
  - pattern: "重要なのは"
    weight: 0.4
  - pattern: "見ていきましょう"
    weight: 0.7
  - pattern: "ではないでしょうか"
    weight: 0.5
```

`weight` は corpus calibration で決める（§21）。人間も高頻度で使う表現は weight を下げるか、語彙表から外す。`natural-japanese` が「最後に」を人間 48 回 / AI 2 回の実測により検出対象から外したのと同じ手続きを、言語ごとに繰り返す。

`unsourced-number` の共起パターン:

```yaml
unsourced-number:
  layer: L2
  how_to_find: pattern-cooccurrence
  where: sentence
  require:
    - word_list: numeric-expression   # 言語別。数値の書式が違う
    - word_list: effect-verb          # 向上/改善/削減 | improve/reduce/increase
  exclude:
    - word_list: evidence-marker      # 出典/調査/n= | source/survey/n=
  then: candidate_for_semantic        # L4 judge に渡す（§14）
```

---

## 12. Rule Catalog — L3 Language-specific

adapter が detector ごと提供する。rule id は言語間で共有し、実装だけを差し替える。

### 12.1 言語横断で概念が共通のもの

| id | ja の detector | en の detector | genre |
| --- | --- | --- | --- |
| `agentless-passive` ✅ | 助動詞「れる/られる」の受動用法かつ動作主なし | AUX + VERB(past participle) かつ by 句なし | business |
| `nominalization` | サ変名詞 + 「を行う/を実施する」 | 動詞由来名詞 + 軽動詞（make / conduct / perform） | business |
| `sentence-fragment` | 述語のない文 | 定動詞のない文 | 両方 |
| `list-parallelism` | 項目末尾の品詞の混在 | 項目先頭の品詞の混在 | business |

`agentless-passive` と `nominalization` は Orwell の "Politics and the English Language" が挙げる悪癖と、日本語ビジネス文書で責任の所在が曖昧になる現象が、同一のものであることを示している。rule として一本化する価値がある。

✅ は実装済みを表す。`agentless-passive` は **rule 定義・message・why・how_to_fix を 1 つしか持たない**。
言語で違うのは、アダプタが付ける `Voice=Pass` と、語彙表の動作主の語（によって / by）だけ。
これが四層モデルの主張そのもので、ここが 2 本に割れたら L3 の設計は間違っている。

rule は `requires: [pos]` を宣言する。満たせない言語では理由付きで skip される（§16.1）。

### 12.2 日本語固有

| id | 内容 | requires |
| --- | --- | --- |
| `no-mixed-desumasu` ✅ | ですます調とである調の混在 | pos |
| `taigen-dome-in-prose` ✅ | 箇条書き外の体言止め | pos |
| `no-doubled-joshi` ✅ | 名詞を繋ぐ助詞の入れ子 | pos |
| `stray-space` ✅ | 語句の途中の空白。空けた所が文書の中で少ないときだけ | pos |
| `double-keigo` ✅ | 二重敬語 | - |
| `sasete-itadaku` ✅ | 「させていただく」の回数。上限の回数までは通す | - |
| `no-nakaguro-parallel` ✅ | 中黒の並列 | - |
| `hiragana-fukushi` ✅ | 副詞のひらがな化 | - |
| `max-kanji-continuous` ✅ | 漢字の連続 | - |
| `kutoten-consistency` ✅ | 読点（、，）と句点（。．）の書き方の混在。少ないほうを指摘 | - |
| `fullwidth-alnum-consistency` ✅ | 英数字の全角と半角の混在。英字一字・語・数字一字・並びごとに少ないほうを指摘 | - |
| `ra-nuki` ✅ | ら抜き言葉。lang-ja が一段・カ変動詞の未然形＋「れる」に `PotentialRa=Dropped` を付ける | pos |
| `katakana-long-vowel` ✅ | カタカナ語の語末の「ー」。既定は同じ語の混在だけ。options で省く・付けるを決める | pos |
| `hankaku-kana` ✅ | 半角の片仮名と半角の句読点。コード・リンク・引いた名前の中は除く | - |

`katakana-long-vowel` は語を形態素解析で取る。複合語の中の「ユーザー」（ユーザーインターフェース）も一語として見る。
音は「コ・ン・ピュ・ー・タ・ー」と数え、語末の「ー」も含める（カーは 2 音）。小さい「ャュョァィゥェォ」は前の字と
合わせて 1 音、「ッ」「ン」「ー」は 1 音ずつ。

- **既定は立場を取らない。** 同じ語が両方で書かれた所（サーバーとサーバ）だけを、少ないほうで指摘する。
  違う語どうし（サーバーとブラウザ）は比べない。自作の bench の文書で比べたら、ふつうの文書が両方を混ぜていた。
- **`ending: drop`** は `min_morae` 音以上で「ー」付きの語を指摘する（電子情報通信学会、JIS Z 8301:2011 まで）。
- **`ending: keep`** は「ー」の無い語を指摘する。ただし、辞書がその語を「ー」付きでも知っている（メモリ → メモリー）か、
  文書がほかで「ー」付きで書いているときだけ。辞書が知っているかは lang-ja が `LongVowelEnding=Dropped` で渡す。
  辞書に無い語（データ）は、もとから「ー」が無いかもしれない。
- 辞書が固有名詞と知っている語（PROPN）、`names:` に並べた名前、`except` に並べた語は見ない。

`double-keigo` と `hiragana-fukushi` は spec の初版で `pos` を要求するとしていたが、
**語彙表で足りる**。品詞から二重敬語を組み立てるより、割れない形だけを列挙するほうが精度が高い。
「ご説明させていただきます」のように二重敬語かで議論の分かれる形は入れない。
割れる形を入れると rule ごと無視される（§12.3 の方針）。

実装した 3 本は、いずれも**最初の版が実文書で 0〜30% の精度しか出なかった**。
共通する原因が 2 つあり、どちらも rule ではなく「何を文と見るか」の問題だった。

- **段落として解析されるものに、文でないものが混ざる。** 見出しの下の名前だけの行、引用の出典行、
  表題行。文書全体を分母にする rule はここで狂う。終止符で終わることを条件にすると、ほとんどが落ちる
- **助詞をまとめて数えると、読める形まで当たる。** 「A も B も C も」の並列と
  「コピーして持っていって」の連用は何重に続いても読める。入れ子を作る助詞だけを語彙表で絞る

「これは文か」の判定は `sentence-shape.ts` に 1 つ置く。rule ごとに書くと、rule の数だけ
「文でないもの」の定義が増える。

### 12.3 英語固有

| id | 内容 | requires |
| --- | --- | --- |
| `adverb-overuse` ✅ | -ly 副詞の密度 | pos |
| `expletive-construction` ✅ | there is / there are / it is ... that | pos |
| `oxford-comma-consistency` ✅ | 文書内での一貫性（有無自体は問わない） | pos |
| `sentence-initial-conjunction-run` ✅ | And / But / So で始まる文の連続 | - |
| `title-case-consistency` ✅ | 見出しの大文字化規則の一貫性 | - |
| `contraction-consistency` ✅ | 短縮形の使用が文書内で一貫しているか | - |
| `spelling-consistency` ✅ | イギリスとアメリカの綴りの一貫性。語彙表 spelling-variant と spelling-ize の組ごとに少ないほうを指摘 | - |
| `space-before-punctuation` ✅ | 句読点の前の空白（"word ."）。コロン・空白で区切った点・数の後ろは除く | - |

英語固有 rule は「どちらが正しいか」を決めず、**文書内の一貫性**だけを見るものを優先する。Oxford comma の是非のようにスタイルガイドで割れる論点に立場を取ると、rule が使われなくなる。

`contraction-consistency` は**対**を要する。「do not」が「don't」の展開なのか、
その文だけ硬く書いたのかは、片方だけ数えても分からない。

`LexiconEntry` に `instead_of` を足した。

```yaml
- pattern: "don't"
  instead_of: do not
```

照合は**語の境界**で行う。部分一致だと「it isn't」が「it is」を含み、
短縮形を使っている文が「使っていない」側に数えられる。

日本語の表記ゆれ（「下さい / ください」）は同じ形に見えるが、短縮形とは別の話なので
この rule には入れない。`languages: [en]`。

### 12.4 記号

`no-em-dash` ✅ は記号なので L1 に置けるが、許容度が言語で大きく違うため **rule が言語別 severity を持つ**。
genre profile ではなく rule 側に置いたのは、`levels` が既に言語別に書ける仕組みを持っており、
severity にも同じ畳みかたを通すだけで済んだため。

```yaml
no-em-dash:
  layer: L1
  levels:
    ja: { normal: warning }   # 日本語組版でダッシュは扱いが難しい
    en: { normal: info }      # 英語では正当な用法が多い。ただし現在は AI tell としても強い
```

英語における em dash の多用は、2026 年時点で最も知られた AI 生成のシグナルの一つである。ただし人間の熟練した書き手も多用するため、単独では info とし、複合シグナル（§20.2）で扱う。

---

## 13. Rule Catalog — L4 Semantic

LLM judge が判定する。rubric を言語別に持つ以外は言語に依存しない。

| id | genre | severity | rubric の要点 |
| --- | --- | --- | --- |
| `conclusion-first` | business | warning | 結論・依頼・推奨が冒頭に置かれているか |
| `actionable-ask` | business | warning | 依頼に対して担当と期限が特定できるか |
| `decision-owner` | business | warning | 決裁者と決裁事項が特定できるか |
| `risk-disclosure` | business | warning | リスク・デメリット・不採用時の影響が述べられているか |
| `unsourced-number` | business | warning | 効果を主張する数値に根拠があるか |
| `causal-mechanism` | 両方 | warning | 因果の主張に機構の説明があるか |
| `paragraph-single-topic` | 両方 | warning | 一段落に独立した複数の論点がないか |
| `empty-conclusion` | blog | warning | 結びに本文の要約以上のものがあるか |
| `title-body-alignment` | blog | warning | タイトルが約束した内容を本文が扱っているか |

rubric は adapter ではなく genre pack が持つ。ビジネス文書の規範はジャンルの性質であって言語の性質ではないため。

```yaml
risk-disclosure:
  layer: L4
  levels:
    strict: error
    normal: warning
    relaxed: info
  what_to_check:
    ja: |
      提案を行っている文書について、次のいずれかが本文に存在すること。
      施策のリスク、想定される副作用、不採用時の影響。
      「課題」の記述はリスクの記述として扱わない。
    en: |
      For a document making a proposal, at least one of the following
      must be present: risks of the proposed action, expected side
      effects, or the consequence of not acting.
      A description of the current problem does not count as a risk.
```

judge の出力言語は文書の言語に合わせる。日本語の文書に英語の指摘が返ると使われない。

---

## 14. Semantic の two-stage 設計

既存 spec §5.1「最も安い deterministic check を優先する」を、semantic rule の内部にも適用する。文書全体を LLM に投げる実装は禁止する。

```text
Stage 1  Candidate Filter   deterministic (L1 / L2)
             |              全文から判定対象範囲を絞る
             |              出力: 段落 / 文 / セクションの部分集合
             v
Stage 2  Judge              LLM
             |              絞られた範囲だけを rubric で判定
             v
         Finding
```

**candidate filter を持たない L4 rule は受け付けない。** これを plugin の読み込み時に検証する。

| L4 rule | candidate filter | filter の層 |
| --- | --- | --- |
| `unsourced-number` | 数値 + 効果動詞 + 根拠マーカー欠如を含む文 | L2 |
| `causal-mechanism` | 因果表現を含む文 | L2 |
| `actionable-ask` | 依頼表現を含み、期限表現も担当表現も近傍にない文 | L2 |
| `decision-owner` | 依頼表現を含む文があり、かつ人物・役職の言及がない | L2 |
| `risk-disclosure` | 文書全体。ただし `required-sections` がリスク節を検出したら skip | L1 |
| `empty-conclusion` | 最終セクションのみ。かつ `concrete-evidence-density` が 0 | L1 |
| `paragraph-single-topic` | 段落長が上位 20% かつ接続詞が 2 個以上の段落 | L1 + L2 |
| `title-body-alignment` | タイトルと見出しリストのみを渡す。本文は渡さない | L1 |
| `conclusion-first` | 冒頭 N 段落のみ | L1 |

設計目標は、5000 字相当の文書で LLM に渡すトークンを全文の 1/10 以下にすること。

judge 呼び出しの契約:

- 入力は candidate と rubric と最小限の周辺文脈のみ。
- 出力は `{ violated: boolean, confidence: number, reason: string }` の構造化出力に固定する。
- `(rule, candidate, rubric, model)` のハッシュでキャッシュする。キャッシュは `.chaff-cache/` に置き、CI でも再利用できるようにする。
- `confidence` が profile の閾値未満の finding は info に降格する。

---

## 15. 既存資産の再利用

deterministic rule を全て自作しない。言語 adapter は、その言語で既に存在する linter を executor として dispatch する（既存 spec §22「textlint は harness ではなく executor」）。

### 15.1 lang-ja

2026-09-08 時点で npm 上に存在とバージョンを確認したもの:

| package | version | 用途 |
| --- | --- | --- |
| `textlint` | 15.8.0 | executor 本体 |
| `textlint-rule-preset-ja-technical-writing` | 12.0.2 | 文長・助詞・接続詞 |
| `textlint-rule-preset-jtf-style` | 3.0.3 | 表記統一。パッケージ名は小文字 `jtf-style` |
| `textlint-rule-preset-ja-spacing` | 3.0.3 | 和欧間スペース |
| `textlint-rule-no-mix-dearu-desumasu` | 6.0.4 | 文体混在 |
| `textlint-rule-ja-no-redundant-expression` | 4.0.1 | 冗長表現 |
| `textlint-rule-ja-no-weak-phrase` | 2.0.0 | 弱い表現 |
| `textlint-rule-ja-no-abusage` | 3.0.0 | 誤用 |
| `textlint-rule-no-doubled-joshi` | 5.1.1 | 助詞の連続 |
| `textlint-rule-no-doubled-conjunction` | 3.0.1 | 接続詞の連続 |
| `textlint-rule-no-doubled-conjunctive-particle-ga` | 3.0.0 | 「が」の連続 |
| `textlint-rule-sentence-length` | 5.2.1 | 文長 |
| `textlint-rule-ja-hiragana-fukushi` | 1.3.0 | 副詞のひらがな化 |
| `textlint-rule-max-kanji-continuous-len` | 1.1.1 | 漢字連続 |
| `textlint-rule-ja-unnatural-alphabet` | 2.0.1 | 不自然な英字 |

方針:

- preset をそのまま有効化せず、rule 単位で選び、genre profile ごとに severity を割り当てる。preset の既定 severity は本 spec の severity 体系と一致しない。
- `textlint-rule-preset-jtf-style` は翻訳文向けの表記ルールが多くブログには過剰。`business/press-release` と `business/report` でのみ有効にする。
- 本 spec 独自の L3 detector は、既存 textlint rule で表現できないものに限る。

### 15.2 lang-en

英語には成熟した既存資産があるが、いずれも本 spec の rule model には直接載らない。

```text
Vale          rule 定義が YAML で、思想が近い。ただし Go 実装で npx 経由の同梱に向かない
proselint     Python 実装。同じ理由
write-good    Node 実装で軽量。L3 の一部を dispatch できる
retext        Node 実装の自然言語処理基盤。unified エコシステム
```

MVP では `write-good` と `retext` 系の rule を評価し、載るものだけ dispatch する。Vale の rule 定義形式は L2 lexicon の設計上の参考にするが、実行時依存にはしない。

---

## 16. 品詞解析

L3 rule の多くは `pos` capability を要求する。日本語の品詞解析には辞書が要り、それが 18MB ある。

npm 上の実測値（2026-09-12 時点、Node 24 ESM で実際に動かした）:

| package | npm の unpacked | 依存込み（実測） | license | ESM で動くか | 初期化 | 解析 |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| `@sglkc/kuromoji` 1.1.0 | 18.3 MB | 27 MB | Apache-2.0（辞書は mecab-ipadic） | `createRequire` で可 | 2.2 s | 1 ms |
| `kuromoji` 0.1.2 | 41.3 MB | — | Apache-2.0 | 未検証 | — | — |
| `lindera-js` 0.1.4 | 9.1 MB | — | MIT | **不可** | — | — |
| `wink-pos-tagger` 2.2.2 | 0.14 MB | 13 MB | MIT | `createRequire` で可 | 0.13 s | 3 ms |

**「依存込み」の列を分けてあるのは、`wink-pos-tagger` 単体の 0.14 MB が実態を表さないため。**
本体は小さいが `wink-lexicon` を引き、そこで 13 MB になる。package 単体の数字だけで選ぶと外す。

`lindera-js` は wasm-pack の bundler target で、`import * as wasm from "./lindera_js_bg.wasm"` を含む。
`main`/`exports` が無く `module` しか持たないため Node が解決できない。サイズは魅力だが npx 単体では成立しない。

**採用: ja は `@sglkc/kuromoji`、en は `wink-pos-tagger`。どちらも依存として同梱する。**

### 16.1 宣言と支払いを分ける

以前の版はここに Tier を置き、`pos` を既定で `false` にして `chaff setup <lang>` による
opt-in にしていた。辞書を同梱すると npx の初回取得が数十 MB になる、というサイズの制約が根拠だった。
その制約は外した（§17.1）ので、Tier の機構は作る理由が無い。

代わりに残るのは**時間**の制約である。辞書の初期化は 2 秒かかり、これは lint 全体より長い。

そこで capability を 2 つに割る。

```text
capabilities.pos = true     「払えばできる」の宣言。rule の requires はこれと突き合わせる
adapter.prepare()           実際に払う。動く rule が 1 本も要求しなければ呼ばれない
```

`Sentence.tokens` は `prepare` を済ませたときだけ入る。入っていないことと
「品詞の無い文」を混ぜない。要求を満たせない rule は理由付きで skip し、黙って通さない。

```
no-doubled-joshi   この言語では品詞解析が使えないため
```

### 16.2 detector に言語を見せない

`Token.pos` は UPOS に統一する。IPADIC も Penn Treebank も、アダプタが自分の中で UPOS へ寄せる。
品詞だけでは足りないものは UD の FEATS（`Voice=Pass` など）に畳んでから渡す。

受動がその例である。日本語の「れる/られる」と英語の be + 過去分詞は形が全く違うが、
**どちらも「動作主が書かれていない」という同じ問題を作る**。アダプタが `Voice=Pass` を付け、
detector はそれだけを見る。動作主の語（によって / by）は L2 と同じ語彙表から引く。

言語ごとに違うものがもう一つある。日本語は修飾が名詞の前に来るので「後ろに名詞が無ければ述語」
と言えるが、英語は語順が逆でこれが成立しない。**語順に依存する判断はアダプタから出さない。**
（実文書で測ったところ、名詞を修飾する受動を数えていたぶんが指摘の 7 割を占めていた。§21）

### 16.3 より高精度な解析

`lang-ja` の SudachiPy、`lang-en` の spaCy は、いずれも Python 依存で npx 単体では成立しない。
eval と calibration の専用経路としてなら価値があるが、lint の常用パスには入れない。

---

## 17. npx で動かすための設計

最終目標は `npx chaffjs lint article.md` の一発で動くことである。

### 16.4 判定役は差し替えられる

L4 の判定役は provider ごとに違うが、**違うのは要求の包みかただけ**である。

```
共通   決まり（rubric）/ 候補 / JSON schema / 確からしさの丸め / キャッシュ
別     どの API に、どういう形で渡すか
```

`{violated, confidence, reason}` を返させる JSON schema は provider をまたいで同じものを使う。
**返させる形が provider で変わると、provider を替えたときに判定の意味まで変わる。**

| backend | 構造化出力 | 認証 | 既定モデル |
| --- | --- | --- | --- |
| `anthropic`（既定） | `output_config.format` | `ANTHROPIC_API_KEY` / `ant auth login` | `claude-opus-5` |
| `openai` | `response_format.json_schema` | `OPENAI_API_KEY` | `gpt-5` |

```yaml
ai_backend: openai
ai_model: gpt-5
```

**Claude のサブスクリプション（Claude Code の Pro / Max）は使えない。** SDK が解決するのは
API key / auth token / Console の OAuth プロファイル（`~/.config/anthropic`）/ OIDC federation の
4 つで、Claude Code の認証情報（`~/.claude`）はそのいずれでもない。API は別勘定である。

`claude` CLI を判定役にすれば購読で動くが、**1 判定に 46,906 トークンかかる**（実測）。
Claude Code は自前の system prompt とツール定義を毎回積むため、本文 2 トークンの判定に
その全部が乗る。API 経由の 1 件およそ 500 トークンに対して 100 倍近い。採らない。

---

### 17.1 予算

| 項目 | 目標 |
| --- | --- |
| 5000 字 Markdown 1 本の lint（品詞を要求する rule なし） | 500 ms 以内 |
| 同（品詞を要求する rule あり） | 3 秒以内 |
| `lint` の外部通信 | なし |
| `lint` の API key | 不要 |

**サイズの目標は置かない。** 以前の版は「core + adapter 1 つで 15 MB 以内」を掲げ、
そこから品詞解析器を外に出す設計（§16 の Tier）と `@anthropic-ai/sdk` の遅延読み込みを導いていた。
どちらも、数 MB のために機構を足して経路を増やす取引になっていた。予算のほうを降ろす。

**時間の目標は残す。** サイズは 1 度だけ払うが、時間は実行のたびに払うため。
これが §16.1 で「宣言」と「支払い」を分けている理由で、
動く rule が品詞を要求しないときは辞書を読まない。

### 17.2 既定の依存構成

```text
npx chaffjs          core のみ
  adapter と genre pack は optionalDependencies ではなく、
  実行時に必要になったものだけを npx が解決する
```

問題は、`npx chaffjs article.md` の時点ではまだ言語もジャンルも分からないこと。そこで core は次の順で動く。

```text
1. core だけを起動する
2. 軽量な言語検出（文字種ヒストグラム）で言語を推定する
   これは adapter を必要としない。core が持つ
3. 必要な adapter と genre pack を解決する
   ローカルに無ければ、確認のうえ取得する
4. lint を実行する
```

3 の取得を暗黙に行わない。次を表示して同意を取る。

```text
chaff needs @chaffjs/lang-ja and chaff-blog (2.9 MB).
Install? [Y/n]
```

`--yes` と CI 環境（`CI=true`）では確認を省略する。

### 17.3 実装上の制約

- Node.js 22 以上。ESM のみ。
- `postinstall` スクリプトを持たない。npx 実行時に任意コードを走らせない。
- ネイティブアドオン依存を持たない。プラットフォーム差でインストールが失敗する原因になる。
- 解析器の実行時ダウンロードは `setup` サブコマンドの中だけで行い、暗黙にはしない。
- rule / lexicon YAML を起動時に全部読まない。有効な profile が参照するものだけを遅延読み込みする。
- CLI の終了コードは error が 1 件でもあれば非 0。

### 17.4 skip と unsupported を黙認しない

capability 不足や adapter 不在で rule が走らなかった場合、成功として扱わない。

```text
3 rules skipped (require POS tagging)
  agentless-passive, double-keigo, taigen-dome-in-prose
  run `npx chaffjs setup ja` to enable

1 rule unsupported for language "ko"
  oxford-comma-consistency
```

黙って通すと「lint が通った」という誤った安心を与える。`--strict` で skip を error に昇格できるようにする。

---

## 18. 設定ファイル

キーは平易な英語に統一する。値は書き手の言語で書く。設定ファイルの形が言語ごとに変わってはならない（§3 の言語直交性）。

```yaml
# chaff.yaml
$schema: https://chaff.dev/schema/v1.json

genre: blog/tech
# language: ja        # 省略時は自動検出（§8）

by_path:
  - files: ["proposals/**/*.md"]
    genre: business/proposal
  - files: ["docs/en/**/*.md"]
    language: en

# 既定から変えたものだけを書く。書かなければ既定で動く。
rules:
  bold-density: relaxed
  ai-tell: off

checks: ./checks.yaml          # 利用者が自然文で足す検査（§18.3）

word_lists:
  - ./lexicons/team.yaml

ai_checks: true                # L4。API key が無ければ自動で skip
ai_backend: anthropic    # anthropic（既定）か openai
ai_model: claude-sonnet-5

stet_needs_reason: true
strict: false                  # skip を error に昇格するか
experimental: false            # experimental rule を既定で有効にするか（§22）
```

`chaff init` でこのファイルと `lexicons/` の雛形を生成し、`.gitignore` に `.chaff-cache/` を追記する。

### 18.1 rule の値は 4 語

設定に数値を書かせない。次の 4 つから選ぶ。

```text
strict    きびしく見る
normal    ふつう（既定）
relaxed   ゆるく見る
off       見ない
```

数値との対応は rule 定義の `levels` が持つ（§18.2）。4 語で足りないときは、上限を正の数で直接書ける。上限ちょうどは通り、超えたときだけ指摘する（下限を言う rule は、下限ちょうどは通り、下回ったときだけ指摘する）。message が「N まで」「limit N」と言う数は、この上限そのもの。段階は `normal` として扱い、上限だけがその数になる。単位は rule ごとに違うので、`chaff rules --json` の `levels` の数で見当をつける。

```yaml
rules:
  max-sentence-length: 260   # relaxed（140 字）でも手本の文が引っかかるとき
```

**効いていない設定は黙って捨てない。** 知らない rule 名（打ち間違いがいちばん多い）と、読めない値（`strcit`、0 以下の数、リスト）は、lint と `chaff rules --json` の実行のたびに標準エラーで言う。捨てたまま動くと、書いた人は設定したつもりで何も変わっていない。severity を直接書くことはできない。

**段階が 4 つない rule がある。** `padded-intro` のように、意味のある設定が 2 つしかないものは `levels` に 2 つだけ書く。未定義の段階は `normal` に落ちる。

```yaml
levels:
  normal: 1
  relaxed: 3
# strict は未定義 -> normal と同じ
```

このとき `chaff strict padded-intro` は、設定を書き換える前に無効化であることを告げる。

```text
padded-intro に strict はありません。normal と同じ設定です。
設定は変更しませんでした。
```

**数えるもののない rule がある。** 番号の抜け、参照先の無い参照、日付と曜日の食い違い、合わない合計、語の二重定義は、あるか無いかだけで、数える上限を持たない。こうした rule は `levels` に数ではなく重さを書き、段は指摘の重さを変える。L4 の rule（§13）と同じ書き方。

```yaml
numbering-gap:
  severity: error
  levels: { normal: error, relaxed: warning }        # error の上は無いので strict は書かない
duplicate-definition:
  severity: warning
  levels: { strict: error, normal: warning, relaxed: info }
```

`relaxed` は指摘を消さずに一段軽くする。`chaff relax` が何も変えないように見えると、利用者は chaff が壊れたと思う。止めたいなら `off`。
`severity` は `normal` の段の重さと同じでなければならず、食い違う rule と、重さと数を混ぜて書いた rule は読み込み時に拒否する。重さを段に持つ rule は `by_genre` も持てない（ジャンルによって既定の重さが `severity` と変わってしまうため）。
`chaff relax` / `chaff strict` は重さがどう変わるかを告げ（「指摘は消えず、エラー ではなく 注意 として出ます」）、`chaff explain` は段ごとの重さを、`chaff rules --json` は `level_sets: severity` と重さを出す。
chaff.yaml に数を書くと `normal` として動くだけなので、設定を読んだときにそう言う。`chaff eval` は掃引しない（どの閾値でも同じ件数になる）。

### 18.2 rule 定義に必須のフィールド

利用者向けの表示（§19）を成立させるため、すべての rule は次を持つ。欠けている rule は読み込み時に拒否する。

| フィールド | 用途 |
| --- | --- |
| `name` | 指摘の見出し。言語別 |
| `why` | なぜ問題か。言語別 |
| `how_to_fix` | どうすればいいか。言語別 |
| `message` | 検出内容。`{count}` などを埋める。英語は `{count\|word\|words}` で数に合う形を選ぶ（ちょうど 1 なら前、それ以外は後） |
| `levels` | 4 語と数値の対応。数えるもののない rule は数値の代わりに重さ（§18.1）。2 つ以上 |
| `use_for` | 対象ジャンル |
| `status` | `experimental` / `stable` / `deprecated` |

`message` だけでは、非エンジニアは何が悪いのか分からない。`why` と `how_to_fix` を必須にするのはそのため。

`name` / `why` / `how_to_fix` にも `{preferred}` などを書ける。指摘があれば `message` と同じく指摘の値で埋める。
指摘の無い表示（`chaff explain`、`chaff rules --json`、SARIF の rule、規則の一覧）では、`placeholders:` に言語別に
書いた言葉で読ませる（`preferred: { ja: prefer に並べた使う書き方, en: the spelling listed under prefer }`）。

### 18.3 利用者が自然文で足す検査

`checks.yaml` に書いたものは L4 rule として扱う。キーは英語で書き、中身は書き手の言語で書く。

```yaml
checks:
  - name: 数字には根拠がある
    use_for: business
    check: |
      効果を主張する数値について、算出根拠・対象期間・比較対象の
      いずれかが本文にあること。
    look_at: 数値と「向上」「削減」などの語が同じ文にあるところ
    level: normal
    how_to_fix: 「(2026年4-6月、対前年同期、n=120)」のように括弧で添えてください。
```

`look_at` は §14 の candidate filter にあたる。**括弧の中の語を取り出して文単位の絞り込みにする。**

```
look_at: 「お願いします」「ご確認ください」を含む文
  → 「お願いします」または「ご確認ください」を含む文だけを渡す

look_at: 数値と「向上」「削減」などの語が同じ文にあるところ
  → 数字があり、かつ「向上」または「削減」を含む文だけを渡す
```

変換に LLM も対話も使わない。書き手は「どこを見るか」を説明するとき、
**見るべき語を自然に括弧でくくる**ので、その括弧をそのまま条件として読む。
推測を足さないので、**書いたものと動くものが一致する**。

「数値」「数字」という語があれば、数字を含む文に限る。これも書いてあることをそのまま読んでいる。

括弧が 1 つも無ければ絞り込めない。そのときは文書全体を渡すが、**黙って渡さない**。

```
    依頼には期限と担当がある: 「お願いします」「ご確認ください」を含む 2 文だけを読みました（全 6 文）
    議事録に決定事項がある: 見るところを絞れず、全文を読みました
      look_at に「」で語を書くと、その語を含む文だけになります
```

絞り込めていないことに気づけないと、遅さの原因が分からないまま使い続けることになる。

### 18.4 experimental と明示設定の優先順位

**明示設定は status の既定に勝つ。**

```text
rule が experimental で、chaff.yaml に記載がない    -> 動かない
rule が experimental で、chaff.yaml に normal と記載 -> 動く
```

利用者が名指しで有効にしたものを、status を理由に黙って無効にしない。ただし、そうした rule がある場合は実行のたびに一度報告する。

```text
experimental な rule を 2 件、設定により有効にしています: padded-intro, rule-of-three
```

### 18.5 rule のオプション

段階の 4 語で言えない決まり（語末の「ー」を省くか付けるか、何音から見るか）は、rule が **オプション** として持つ。
オプションは rule の YAML に宣言する。種類（`choice` / `count` / `words`）、既定、何を決めるか（`about`）、選択肢ごとの意味。
宣言が読めない rule ファイルは読み込み時に止まる（chaff の不具合なので）。

```yaml
# chaff.yaml
options:
  katakana-long-vowel:
    ending: drop      # consistent / drop / keep
    min_morae: 3
    except: [カー]
```

- 効かない書き方（知らない rule、オプションの無い rule、知らないオプション、合わない値）は、
  `rules:` と同じく実行のたびに標準エラーで言い、合わない値は既定のまま動く。
- `chaff explain <rule>` はオプションごとに、いまの値、どこから来たか（`chaff.yaml` か `既定`）、選択肢の意味を出す。
  `chaff rules --json` は `options.<名前>` に `kind`・`about`・`choices`・`default`・`now`・`from` を出す。
- detector はオプションの出所を知らない。解決した値だけを `DetectorOptions.settings` で受け取る。

### 18.6 スタイル（`style:`）

よく知られた書き方の決まり（学会の執筆要項、規格、告示）を `packages/chaff/styles/*.yaml` に置き、`style: ieice` で選ぶ。
スタイルは rule の段階（`rules:`）とオプション（`options:`）を決め、出典（`source.title` と `source.url`）を持つ。
**書くのは出典が言っていることだけ。** 出典が決めていても、それを見る rule が chaff に無いもの（IEICE の句読点「．」「，」）は
YAML のコメントに残し、段階もオプションも書かない。

```text
chaff.yaml の rules / options  >  style  >  ジャンルの段（genres.yaml）  >  既定
```

- スタイルの段階は chaff.yaml の `rules:` に下から足す（chaff.yaml が書いたものはそのまま）。だから `--experimental` と
  「設定により有効にしています」の一覧は、スタイルが入れた rule も設定で入れたものとして扱う。
- スタイルのオプションは chaff.yaml の `options:` の下の層。合わない値は次の層（既定）に落ちる。
- `rules --json` は `style`（id・名前・要約・出典）を出し、スタイルが決めた段階の `your_setting.from` とオプションの
  `from` を `style: ieice` とする。`explain` も同じ。
- 知らないスタイル名は、知らないジャンルと同じく実行を止め、使える名前を並べる。
- 同梱のスタイルは test がすべての rule 名とオプションを確かめる。読めないスタイルファイルは chaff の不具合として止まる。

| id | 決めること | 出典 |
| --- | --- | --- |
| `ieice` | `katakana-long-vowel`: `drop`、3 音 | 和文論文誌 投稿のしおり 2.4 (b)（用語は学術用語集 電気工学編）。(d) の句読点は rule が無いので書かない |
| `jis-z8301-2011` | `katakana-long-vowel`: `drop`、3 音 | JIS Z 8301:2011 附属書 G 表 G.3。2019 年版は外来語の表記によるとした |
| `bunkacho` | `katakana-long-vowel`: `keep` | 外来語の表記 留意事項その 2 Ⅲ 3 注 3 |
| `jis-z8301-2019` | `requirement-modal`: `standard: jis-z8301-2019` | JIS Z 8301:2019 7.3〜7.5（JSA「JIS 原案作成のための手引」資料 7）。外来語の長音は業界に任せている（同 Q&A 6-14）ので決めない |

### 18.7 チームのルール（`custom_rules:`）

チームは chaff.yaml に決定的なルールを足せる。コードは書かせない。どれも組み込みの rule と同じ `RuleDefinition` になり、
指摘・`explain`・`rules --json`・`stet`・`relax`・baseline・SARIF がそのまま扱う。

| `type` | 見るもの | detector |
| --- | --- | --- |
| `words` | 語の並び、または「使わない書き方: 使う書き方」。使う書き方の中の一部は数えない（preferred-term と同じ） | `custom-words` |
| `pattern` | 正規表現。文ごとに当てる。`ignore_case: true` で `i` | `custom-pattern` |
| `tokens` | 語の条件の並び。条件は `pos`（UPOS か 名詞・動詞・noun・verb などの名前）、`base`（原形）、`surface`（表記） | `custom-tokens`（`requires: [pos]`） |

- 必須は `id`（英小文字・数字・ハイフン。chaff の rule と同じ id は不可）、`type`、`name`、`why`、`how_to_fix`、
  `example.before`、`example.after`。文言は 1 つの文字列か `{ ja, en }`。`message` を書かなければ種類ごとの既定の文。
- `level` は重さ（`error` / `warning` / `info`）。段階は重さの段（§18.1 の `level_sets: severity`）で、`relax` は一段軽く、
  `strict` は一段重くする。status は `stable`（チームが名指しで書いたものなので、既定で動く）。use_for は全ジャンル。
- **読めないものは実行を止める。** チームのルールが黙って動かないと、きれいな文書に見える。
- **正規表現は動かす前に確かめる。** 長さ 500 字まで。後方参照（`\1`、`\k<name>`）と、空文字列に当たるもの、
  上限の無い繰り返しの中に上限の無い繰り返しか選択肢を持つ群に、上限の無い繰り返しを付けた形（`(a+)+`、`(a|aa)*`、
  `((a+)b)+`）は断る。V8 の正規表現は後戻りするので、この形は長い行で指数時間になる。ただし、先頭の字が互いに違う
  ただの語の選択肢（`(cat|dog)+`）は取り合わないので通す。回数の決まらない繰り返し（`*`、`+`、`{1,9}`）は 3 つまで。
  並んだ繰り返し（`a*a*a*a*b`）は入れ子でなくても、文の長さの「繰り返しの数」乗の時間がかかる。
- **それでも止まらないものは時間で止める。** 形を読むだけでは、すべての危ない形を見分けられない。正規表現は `node:vm` の
  中で 1 文書 1 ルールあたり 1000 ms までで動かし、超えたらそのルールを「動いていない」一覧に理由付きで出す。
- `type: module`（Node の関数）は予約した。いまは「まだ使えない」と言って止める。

---

## 19. CLI と出力例

```bash
npx chaffjs article.md                   # 引数がファイルだけなら lint と同じ
npx chaffjs lint article.md              # deterministic のみ（L1 / L2 / L3）
npx chaffjs test article.md              # L4 を含む
npx chaffjs eval corpus/ja/blog/         # rule の評価と閾値 sweep
npx chaffjs explain sentence-rhythm      # rule の意図と根拠
npx chaffjs compare before.md after.md   # 書き換えで事実が落ちても足されてもいないか（§28）
npx chaffjs facts before.md              # compare が照合する事実の一覧（§28.5）
npx chaffjs outline before.md after.md   # 見出しの構成と形を前と後で測る（§28.6）
npx chaffjs init
npx chaffjs setup ja                     # 品詞解析器の取得

# 設定を変える（chaff.yaml を開かずに済む）
npx chaffjs relax bold-density --why "図の説明で太字を多用するため"
npx chaffjs strict excessive-hedging --why "..."
npx chaffjs off ai-tell --why "..."
npx chaffjs words add "巻き取る" --instead "引き継ぐ"
npx chaffjs checks add                   # 対話で L4 の検査を 1 つ足す

# 状態を見る
npx chaffjs rules --json                 # AI に渡す。現在値・使える値・変更方法（§19.3）
npx chaffjs schema                       # chaff.yaml の JSON Schema
npx chaffjs suppressions                 # stet の集計と設定変更の提案
npx chaffjs baseline docs/               # 既存の指摘を棚上げする
```

### 19.1 既定の出力は非エンジニア向け

1 件につき 4 つを出す。どれが欠けても、書いた人は動けない。

```text
該当箇所の引用       どこの話か
何が起きているか     name + message
なぜ問題か           why
どうすればいいか     how_to_fix
```

```text
$ npx chaffjs article.md

article.md   ブログ記事（技術） · 日本語
             ルールは既定のまま（設定ファイルはありません）


─── 41 行目 ─────────────────────────────────────────────

    ここで **重要** なのは **キャッシュの寿命** です。**TTL** を
    **短く** すると **整合性** は保てますが **負荷** が上がります。

  ⚠  太字の使いすぎ

     このセクションに太字が 6 箇所あります（2 箇所まで）。
     太字は読者の目を止める道具です。多用すると、どこも目立たなく
     なります。

     → 本当に強調したい 1〜2 箇所だけ残して、ほかは普通の文に
       してください

     このルールをゆるめる:  npx chaffjs relax bold-density


─────────────────────────────────────────────────────────

  注意 3 件

  意味を見る検査は動かしていません。動かすには:
      npx chaffjs test article.md          （API key が要ります）

  ほかに 7 つのルールが、まだ試験中のため止まっています:
      npx chaffjs lint article.md --experimental
```

rule の id は「ゆるめる」コマンドの中にだけ出す。非エンジニアが最初に読むのは `name` であり、`bold-density` ではない。

### 19.2 `--compact` がエンジニア向け

```text
$ npx chaffjs lint article.md --compact

article.md  [ja · blog/tech]

   3:1   warning  「近年、AIの活用が注目されています」は水増しの導入です
                  padded-intro
  41:12  warning  太字がこのセクションに 6 箇所あります (上限 2)
                  bold-density

2 warnings
7 rules disabled (experimental), 9 rules skipped (semantic, no API key)
```

`--format json` と `--format lsp` も持つ（§11 の LSP 要件）。

### 19.3 `chaff rules --json` は AI のための入口

AI に設定を書かせるとき、これを渡せば推測せずに書ける。現在値、使える値、数値との対応、なぜ今 off なのか、変更コマンドまでが 1 つに入る。
`level_sets` は段が何を変えるかを言う。`limit` は数える上限、`severity` は指摘の重さ（§18.1 の数えるもののない rule）。後者の `levels` と `now` には数ではなく重さが入る。

```json
{
  "values_you_can_use": ["strict", "normal", "relaxed", "off"],
  "rules": [
    {
      "id": "bold-density",
      "name": { "ja": "太字の使いすぎ" },
      "why": { "ja": "太字は読者の目を止める道具です。..." },
      "your_setting": { "level": "relaxed", "from": "chaff.yaml:24", "why": "図の説明で..." },
      "level_sets": "limit",
      "now": { "level": "relaxed", "limit": 4 },
      "levels": { "strict": 1, "normal": 2, "relaxed": 4 }
    },
    {
      "id": "numbering-gap",
      "level_sets": "severity",
      "now": { "level": "normal", "severity": "error" },
      "levels": { "normal": "error", "relaxed": "warning" }
    }
  ],
  "how_to_change": {
    "by_command": ["npx chaffjs relax <rule-id> --why \"<理由>\""],
    "by_file": "chaff.yaml の rules に <rule-id>: <level> を足す"
  }
}
```

### 19.4 設定の書き戻しはコメントを壊さない

`chaff relax` などは `chaff.yaml` を機械的に書き換えるが、既存のコメントを保持する。設定ファイルがチームの規範そのものである以上（workflow spec §9）、コメントが失われることは規範が失われることに等しい。

書き戻しの規約:

| 規約 | 理由 |
| --- | --- |
| 既存のコメントをすべて保持する | 規範の履歴が消える |
| 新しい rule には `name` と `why` をコメントとして自動で添える | 設定ファイルを開いた人が rule を調べずに済む |
| 理由は `# YYYY-MM-DD 理由 / @who` の形で値の後ろに置く | 誰がいつなぜ変えたかを残す |
| **すでに理由があるものを変えるときは `--why` を必須にする** | 古い理由が新しい値に付いたまま残ると、履歴が嘘になる |

最後の規約がないと、次が起きる。

```yaml
# 変更前
bold-density: relaxed      # 2026-09-11 図の説明で太字を多用するため / @isamu

# chaff strict bold-density を --why なしで実行した場合（禁止する）
bold-density: strict       # 2026-09-11 図の説明で太字を多用するため / @isamu
                           #            ^ きびしくした理由になっていない
```

---

## 20. Finding Format

既存 spec §10 の形式に 3 フィールドを追加する。

```json
{
  "rule": "concrete-evidence-density",
  "severity": "warning",
  "file": "article.md",
  "line": 92,
  "message": "セクション「まとめ」に数値・コード・リンク・引用がありません",
  "executor": "custom",
  "confidence": 1.0,
  "language": "ja",
  "genre": "blog/tech",
  "layer": "L1",
  "signals": ["rule-of-three", "section-length-uniformity"]
}
```

- `language` / `genre`: どの規範で判定されたか。三軸モデルでは必須。
- `layer`: どの層の rule か。コストと再現性の見積もりに使う。
- `signals`: 同一範囲で同時発火した弱いシグナルの一覧。

### 20.2 複合シグナル

✅ 実装済み。`ai-tell` / `rule-of-three` / `section-length-uniformity` / `sentence-rhythm` / `no-em-dash` / `contrast-framing` / `stock-transition` / `announcing-opener` / `colon-lead-in` はいずれも単独では info だが、同一文書で 3 つ以上そろった場合に 1 件の warning を足す。

**元の指摘は消さない。** spec の初版は「集約する」としていたが、`from` に並ぶ rule のうち
`padded-intro` と `closing-cliche` は stable な warning で、単独でも正しい指摘である。
まとめるために消すと、本物の指摘が見えなくなる。

複合シグナルは他の rule の**結果**を読むので、detector の形には収まらない。run の二段目として扱う。

```yaml
ai-generated-composite:
  layer: L1
  levels:
    normal: warning
  requires:
    min_signals: 3
    from:
      - ai-tell
      - rule-of-three
      - section-length-uniformity
      - sentence-rhythm
      - padded-intro
      - closing-cliche
      - no-em-dash
      - contrast-framing
      - stock-transition
      - assistant-residue
      - announcing-opener
      - colon-lead-in
```

集約 rule 自体も rule として定義する。言語別に有効なシグナルが違う（英語では `no-em-dash` が強く、日本語では弱い）ため、`from` は genre profile で言語別に上書きできる。

### 20.3 抑制ディレクティブ

校正記号 stet（ラテン語で「そのままにせよ」）を採用する。

```markdown
<!-- stet: ai-tell -->
この段落では「重要なのは」を意図的に使っています。

<!-- stet-file: bold-density, emoji-density -->
```

`stet` はすぐ下の塊（段落・見出し・箇条書き・表）に、`stet-section` は次の見出しまで、`stet-file` は文書全体に効く。

理由なしの抑制を減らすため、`--require-stet-reason` で理由の記述を必須にできる。

```markdown
<!-- stet: no-em-dash — 引用元の原文を改変しないため -->
```

---

## 21. Calibration と Corpus

閾値と語彙表の weight は **言語 × ジャンル** ごとに測り直す。日本語のブログで測った `sentence-rhythm` の下限は、英語のビジネス文書には使えない。

```text
corpus/
  ja/
    business/{human-good, human-ordinary, ai}
    blog/{human-good, human-ordinary, ai}
  en/
    business/{human-good, human-ordinary, ai}
    blog/{human-good, human-ordinary, ai}
```

corpus 本体はリポジトリに含めない。`corpus/manifest.yaml` に取得元 URL、ライセンス、取得日、内容ハッシュを記録し、`chaff eval --fetch` で取得する。著作物を再配布しないためと、hash によって「いつの corpus で calibration したか」を再現可能にするため。

収集候補:

| 種別 | 候補 |
| --- | --- |
| ja / business / human-good | 官公庁の公開資料、上場企業の IR 資料とプレスリリース |
| en / business / human-good | SEC filings、政府機関の plain-language ガイドに準拠した文書 |
| ja / blog / human-good | 企業技術ブログ、著者が明示された個人記事 |
| en / blog / human-good | 著名な技術ブログ、Creative Commons の記事 |
| human-ordinary | 利用者が自分のリポジトリから供給。同梱しない |
| ai | 同一プロンプトで複数モデルに生成させる。プロンプトも corpus に含めて再現可能にする |

測定する指標:

```text
Human good FP rate
AI detection rate
Precision / Recall
```

目標:

| 対象 | Human good FP |
| --- | --- |
| business（全言語） | 5% 未満 |
| blog | 5% 未満 |
| blog/essay | 3% 未満（表現の自由度が高いため厳しく） |

`eval` は rule ごとに threshold を sweep し、現在値との差分を出す。threshold の更新は自動適用せず、差分を PR として提示する。

---

### 21.1 昇格の条件

`experimental` から `stable`（既定で動く）へ移す条件は 3 つ。**実文書で発火したこと**を要る。

1. `examples/` の実文書で発火した
2. 出た指摘を読んで、正しいと判断できた
3. `chaff eval` の目標（誤検知率 5% 未満）を満たしている

**一度も発火していない rule は昇格させない。** 合成した文書で動くことは「壊れていない」証拠であって、
「既定で出してよい」証拠ではない。0 件は、良い rule と壊れた rule を見分けない。

`agentless-passive` は 1 と 3 を満たすが 2 で止めている。実文書 5 件中 4 件が真で、
残る 1 件は「れる・られる」の多義（§26-6）。**8 割は既定で出すには足りない。**
corpus の日本語業務文書では、決まり・文書の中身・状態を言う受動と、仮定の節を外したあとも、
残る指摘の大半は誰も隠していない一般的な動作（「使用されます」「行われます」）で、2 と 3 のどちらも満たさない（#290）。

`title-case-consistency` と `contraction-consistency` は 3 で止めている。eval が
「どの閾値でも目標を満たさない」と言っている。

## 22. Rule Status と CI

```text
experimental   corpus 評価前。既定で無効。--experimental で有効化
stable         corpus 評価済み。FP 目標を満たす
deprecated     置き換え済み
```

status は **言語ごとに独立**して持つ。`sentence-rhythm` が日本語で stable でも、英語の corpus で評価するまでは英語では experimental のままとする。

```yaml
sentence-rhythm:
  status:
    ja: stable
    en: experimental
```

初期状態で stable を目指すもの（deterministic で反証しやすいもの）:

```text
L1  bold-density, heading-echo, required-sections, undefined-acronym,
    max-sentence-length, max-paragraph-length, preamble-length
L2  empty-intensifier, repeated-conjunction
L3  no-mixed-desumasu, no-nakaguro-parallel (ja) / oxford-comma-consistency (en)

experimental 開始（corpus 評価が必要）
    ai-tell, rule-of-three, section-length-uniformity, sentence-rhythm,
    concrete-evidence-density, padded-intro, cushion-phrase-density,
    proper-noun-density,
    contrast-framing, stock-transition, assistant-residue, unfilled-placeholder,
    announcing-opener, colon-lead-in
```

CI:

```yaml
- name: prose lint
  run: npx chaffjs lint docs/ --changed-only --yes

- name: prose semantic test
  run: npx chaffjs test docs/ --changed-only --yes
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

`lint` は fork PR でも動く（API key 不要）。`test` は key がある環境でのみ実行し、key がなければ finding を出さずに skip 件数を報告して成功する。

---

## 23. Rule の Unit Test

rule ごとに fixture を持つ。言語別に用意する。

```text
tests/
  heading-echo/
    ja/valid.md
    ja/invalid.md
    en/valid.md
    en/invalid.md
    expected.json
```

規約:

- `valid.md` には「その rule が誤検知しやすい正常な文章」を必ず 1 つ以上入れる。禁止語 rule では、その語を正当に使っている実例を valid 側に置く。これがないと fixture が実装を追認するだけになる。
- L1 rule は **全 adapter で同一の期待結果**になることをテストする。言語を変えて結果が変わる L1 rule は、L1 ではない。
- L1 detector が `doc.adapter` の `segment` 以外を参照していないことを、静的解析で検査する（§6）。

---

## 24. MVP と Roadmap

### Phase 1 — npx で動く lang-ja

目標: `npx chaffjs lint article.md` が品詞解析も API key もなしで動く。

```text
core の plugin API 確定（§6）
言語検出（§8）
L1 universal detector 16 本
L2 照合エンジン 4 種
@chaffjs/lang-ja  規則ベース文分割 + ja lexicon
chaff-business  profile と required-sections
chaff-blog      profile
textlint dispatch（§15.1）
JSON / text / SARIF output
GitHub Actions
```

### Phase 2 — lang-en

目標: 言語軸が本当に直交していることを、2 つ目の adapter で証明する。

```text
@chaffjs/lang-en  規則ベース文分割 + en lexicon
en lexicon（L2 を 11 本）
en 固有 L3 detector
L1 rule が両言語で同一結果になることの検証（§23）
genre pack を一切変更せずに en が動くことの確認
```

Phase 2 が genre pack の変更を必要としたら、四層モデルの切り分けが間違っている。これは設計の検証点として意図的に置く。

### Phase 3 — 品詞解析

```text
解析器を依存として同梱（ja kuromoji / en wink）
UPOS と FEATS への写像
requires と prepare（§16.1）
L3 rule（ja 8 本 / en 6 本）
skip と unsupported の表示（§17.4）
```

### Phase 4 — Semantic

```text
candidate filter の実装（§14）
LLM judge と構造化出力
キャッシュ
L4 rule 9 本と言語別 rubric
複合シグナル（§20.2）
抑制ディレクティブ（§20.3）
```

### Phase 5 — Calibration

```text
corpus manifest と取得スクリプト
eval と threshold sweep
言語別の experimental -> stable 昇格（条件は §21.1）
FP dashboard
```

---

## 25. Non-goals

- 文章の面白さ、読者の反応、SEO 順位の予測。
- ブランドボイスへの適合判定。組織ごとの lexicon で近似するにとどめる。
- 単一スコアによる品質評価。既存 spec §21 と同じ理由。
- 自動書き換え。検出と修正の分離（既存 spec §5.4）を維持する。
- AI 生成文章の断定的な判別。§20.2 の複合シグナルは「疑い」を示すものであり、判定器ではない。
- 機械翻訳の品質評価。訳文の検証は原文との対応を要し、本 spec の文書単体モデルに載らない。
  ただし、回答の引用（番地と引用文）が原文に書いてあるかは、原文の木だけで決まるので扱う（§27.5）。意味が合っているかは扱わない。
- **全言語のサポート。** MVP で adapter を実装するのは `ja` と `en` のみ。他言語は adapter を書けば動く設計にするが、同梱しない。

---

## 26. 要決定事項

1. ~~**npm の名前取得。**~~ 解決した。`chaff` は npm に既存名（chai / chalk / charm）と似すぎるとして拒否され、`@chaff` scope は 2019 年から他者が保持していた。**`chaffjs` と `@chaffjs` で取得済み**。CLI は `chaffjs` と `chaff` の両方で起動する。
2. **`nlh` との関係。** 既存 spec を本 spec で置き換えるのか、`nlh` を概念仕様として残すのか。未決のまま。
   実装は本 spec だけを見ており、`natural-language-validation-harness-spec.md` は参照されていない。
3. ~~**`lang-en` を MVP に含めるか。**~~ 解決した。含めた。**genre pack を一切変えずに英語が動いた**ので、Phase 2 が置いていた検証点は満たしている。ただし en の corpus は 11 本で、閾値の根拠は日本語より薄い。
4. **`section-length-uniformity` と `sentence-rhythm` の仮説検証。** 「AI 生成記事は節の長さと文の長さが揃う」は未検証のまま。

   **半分だけ確かめた。** 人が書いて公開した 20 文書では、段落の変動係数が 30〜82%、節が 46〜98% で、
   どちらの rule も発火しない。**「人の文章では揃わない」は言える。**

   残る半分（「AI の文章では揃う」）には AI が書いた corpus が要る。それを作ること自体が
   §25 の non-goal（生成の検出を主目的にしない）に近づくので、優先度は上げていない。
5. **「〜に委ねられる」を動作主ありと見なせるか。** 助詞「に」は動作主も対象も示すため、語彙表に入れると誤検知が増える。区別には係り受け解析が要る。実文書での `agentless-passive` の誤検知 1/5 はこれ。
6. **れる・られるの多義。** 受動・可能・尊敬・自発を形だけでは区別できない。アダプタは「受動の形」として印を付け、断定しない。corpus で誤検知率を測ってから status を stable にする。
7. ~~**`checks.yaml` の `look_at` を絞り込み条件にどう変換するか。**~~ 解決した（§18.3）。
   挙げていた 2 案（AI との対話で条件を作る / 全文を対象にしてコストを警告する）は、
   どちらも取らなかった。**括弧の中の語をそのまま条件として読む**。
   書き手は見るべき語を自然に括弧でくくるので、推測を足さずに絞り込める。
   括弧が無いときだけ全文に落ち、そのことを出力に出す。

---

## 27. 文書の構造

契約書・仕様書・マニュアル・本のような構造のある文章を、番地の付いた木として扱う。
木があれば、機械で確かめられることが増える。存在しない条への参照や番号の抜けは、文章のコンパイルエラーとして出せる。

意味を読むのは chaff の仕事ではない。木を読んで書き換える・答えるのは呼び出す側（Claude Code など）で、chaff は機械で決まることだけを判定する。

### 27.1 木を出す

```bash
npx chaffjs tree contract.txt              # S 式
npx chaffjs tree manual.md --format json   # JSON
```

```lisp
(doc :language "ja" :path "contract.txt" :line 1
  (article "3" :heading "支払" :label "第3条" :line 6
    (quantity :unit "日" :value 30 :line 7)
    (obligation :marker "なければならない" :type "must" :line 7)
    (item "3.2" :label "２" :line 8
      (reference :label "第12条第1項" :target "12.1" :line 8))))
```

- 入れ子になる節点は 4 種類。
  - `section`: 見出し
  - `chapter`: 編・章・節、PART・CHAPTER。番地は `pt2.ch1`、節は章に続けて `ch2.1`。法令は章の番号を編ごとに、節の番号を章ごとに振り直すので、親の番地に続ける。条は通し番号のまま
  - `article`: 条、Article、4.2 のような通し番号
  - `item`: 項、号、(a)
- 葉は `definition`（定義）、`reference`（参照）、`obligation`（義務）、`quantity`（数量）、`date`（日付）の 5 種類。
- 日付の `value` は `2024-04-01`、`2024-04`、`04-01`（年の無い日付）、`2024`（年だけ）のどれか。日付にした年・月・日は数量として二重に数えない。
- 番地は番号を正規化した並び。第3条第2項第1号は `3.2.1`、Section 4.2(a)(ii) は `4.2.a.ii`。参照の `target` も同じ形なので、参照先を木で引ける。
- 番号の無い見出しは並び順で `h2.1` のように振る。飛ばした深さは 0 と数える（`# A` の直後の `### C` は `h1.0.1`）。見出しに書いた番号（`## 第3条`）は、見出しの深さで入れ子にする。
- すべての節点が元の文書の位置（UTF-16）と行を持つ。
- `.txt` も読む。見出しの無い契約書は、行頭の番号だけで木にする。

### 27.2 言語との分担

番号の書き方は言語ごとに違う。「第3条」「２」「一」は日本語の、「Article III」「(a)」「(ii)」は英語の書き方である。
これを読むのは adapter の `structure`（§7）で、core は入れ子と番地だけを決める。
`4.2` のような数字と点だけの通し番号は言語を問わないので core が読む。ただし「1.5 倍」「2.5 days」の 1.5 は番号ではなく数量で、
それを見分けられるのは言語だけなので、adapter の `countedAfter(番号, 後ろ)` に聞き、後ろが単位なら番号にしない。

日本語の数量と日付は形態素で読む。数の直後が助数詞（`名詞,接尾,助数詞`）なら数量で、表に無い「8割」「5件」も読める。
`chaff tree` は adapter の `prepare({ pos: true })` を呼んでから木を作る。解析器が無いときは単位の表で読むので、木は作れる。
IPADIC の癖を二つ、ここで吸収する。数の後ろの「月」を普通の名詞と読むので、数の直後にあるときだけ暦の月として数える。
全角の「４月」を一語と読むので、全角数字は半角にしてから読む（1 文字ずつの置き換えなので位置は変わらない）。

adapter が `structure` を持たない言語では、`chaff tree` はそう言って失敗する。0 件の木を返して黙らない（§17.4）。

同梱していない言語は `@chaffjs/lang-<言語>` を探す。利用者が adapter を書いて入れれば、core を変えずにその言語で動く。

### 27.3 誤読しない

- 行頭の「第3条に定めるとおり」は本文。条の見出しは、番号の直後が空白・括弧・行末のときだけ。英語も同じで、「Article 3 shall apply」は本文。
- 番号だけの項（「２」）と号（「一」）は、条の中で、全角空白で本文と区切ったときだけ読む。本文の「3 人で」「一 人で」を項や号にしない。
- 「(i)」は「(a)」の下ではローマ数字、「(h)」の次では英字。
- コードの中の番号は読まない。コードブロックも、文中の `第99条` のようなインラインコードも同じ。
- 見出しの括弧が無い条（法令の「第三条 事業者は、…。」）の後ろは本文で、見出しにしない。後ろに「。」があれば文とみなす。
- 「第3条」の 3 は番号で、数量にしない。
- 英語の「May」は、文の途中で大文字なら月で、義務の may にしない。月名だけでは日付にせず、年を伴うときだけ日付にする。
- 見本の文書（`test/fixtures/structure/{ja,en}/`）を木にして、人が読んで確かめた S 式と丸ごと比べる。契約書・利用規約・就業規則・法令・仕様書・マニュアル・論文と、誤読してはいけない普通の文章を日英で持つ。見本を足したら `CHAFF_UPDATE_GOLDEN=1 yarn test` で書き出し、中身を読んでから commit する。

### 27.4 構造の規則

木だけで決まる誤りを lint の指摘として出す。どれも `status: experimental` で、層は L3（概念は言語に依らないが、木を作る型は言語パッケージが持つ）。
adapter が `structure` を持たない言語では、指摘 0 件ではなく「構造を読めないため」と理由付きで止まる。

| rule | 見るもの | 誤検出しないための決まり |
| --- | --- | --- |
| `dangling-reference` | 参照の番地が木に無い | 番号付きのまとまりを持たない文書は見ない（他の文書を指しているだけかもしれない）。他の文書の名前が付いた参照（民法第709条、Section 9 of the Master Agreement、RFC 1122, Section 3.3）は、言語パッケージが `document` を付けるので引かない。大文字だけの角括弧の引用タグ（[HTTP]、[RFC8126]）は他の文書の名とみなす。ハイフンを含むタグ（[HTTP-CACHING]）と 1〜3 桁の番号（[19]）は差し込み欄（[BUYER-1]）と書き方が同じなので、文書がそのタグを一覧に載せているときだけ他の文書とみなす。「本契約」「of this Agreement」はこの文書。参照に `fallback` があればそちらでも引く（日本語の「第4条第1項」は番号の無い第 1 項を持つ第4条を指しうる。英語の Section 4.1 には付けない） |
| `numbering-gap` | 番号の抜けと重なり | 比べるのは同じ親の子どうしで、同じ種類のものだけ。最初の番号は見ない（日本語の項は 2 から振る）。英米の法令の Section 101、201 は章が別なので比べない。枝番号（第3条の2）は並びの外。1 に戻った番号は新しい並び（一つの条に箇条書きが二組、附則の第1条）なので、「(a) の直後の (a)」の重なりは見逃す |
| `duplicate-definition` | 同じ語の二度目以降の定義 | 中身が食い違うかは判定しない。二度目の場所と、最初の行を示す |

木は、構造の rule がどれか動くときだけ作る（lint の文書モデルが初めて触れたときに作る）。

並びの中の位置（`NumberedLine.ordinal`）は言語パッケージが付ける。第三条は 3、(ii) は 2、(b) は 2。core はローマ数字も漢数字も知らない。

### 27.5 引用を確かめる（`chaff cite`）

AI が「第3条第2項にこう書いてある」と答えたとき、その番地が原文にあり、引用した文がその範囲に書かれているかを確かめる。

```bash
npx chaffjs cite contract.txt claims.json              # 一件ずつ ✓ / ✗ と理由
npx chaffjs cite contract.txt claims.json --format json
```

`claims.json` は `[{ "address": "4.2", "quote": "前項の委託料を支払わなければならない" }]` の配列。番地は `chaff tree` と同じ形。

| 結果 | 意味 |
| --- | --- |
| `ok` | 番地があり、引用文がその範囲（子を含む）に書いてある |
| `missing-address` | 番地が木に無い |
| `quote-elsewhere` | 引用文は原文にあるが、その番地の外。`foundAt` に、書いてある場所のいちばん内側の番地 |
| `quote-not-found` | 引用文が原文のどこにも無い（数字の書き換え、言い換え） |

- 比べるときは空白と改行を除き、書記素（見た目の一文字）ごとに NFKC で揃える。書き写すときの改行位置、「３０」と「30」、「ｶﾞ」と「ガ」で外れないため。言い換えは一致としない。
- 引用文が空なら、番地だけを確かめる。
- 同じ番地が二つある（附則が第1条から振り直す）ときは、どちらかに書いてあれば一致。
- 二つの項にまたがる引用は、両方を含む条を指していれば一致。`quote-elsewhere` の `foundAt` も、引用の全体を含むいちばん内側の番地。原文に二か所あれば最初の場所。
- コードブロックとインラインコードの中の文も、それを含む節の中身として引用できる。木がコードを覆うのは、コードの中の番号を番号や参照と読まないためで、節の範囲から外すためではない。
- 一つでも外れていれば終了コード 1。AI の回答を単体試験のように検査できる。書き換えはしない。

## 28. 書き換えで事実が落ちていないか（`chaff compare`）

AI っぽい文章を人の文章に大きく書き換えるのは AI の仕事で、chaff の仕事はその後ろにある。
書き換えが大胆なほど、数字が一つ消えた、日付が一日ずれた、URL が抜けた、元に無い数字が増えた、を人が読んで見つけるのは難しい。
`chaff compare` は書き換える前と後の文書から「事実の粒」を同じ読み方で取り出して比べ、落ちたものと足されたものを示す。
判定に model は使わない。同じ二つの文書からは、いつも同じ結果が出る。chaff は比べるだけで、書き換えない。

```bash
npx chaffjs compare before.md after.md                        # 人が読む
npx chaffjs compare before.md after.md --compact              # 1 件 1 行
npx chaffjs compare before.md after.md --json                 # AI が読んで直す
npx chaffjs compare before.md after.md --allow-dropped url    # わざと削った種類は通す
```

### 28.1 事実の粒

新しい読み手は作らず、lint と `chaff tree` が使う読み手で取り出す。

| 種類 | 何を読むか | 読み手 |
| --- | --- | --- |
| `number` | 単位や通貨の付いた数（1,200円、$12.50、25%、３万人）と、単位の付かない数 | 構造の木の `quantity`。木が読まなかった数字は、単位の無い数として読む |
| `date` | 日付 | 構造の木の `date`（2026年4月1日、April 1, 2026）と、年を先に書いた数字だけの日付（2026/4/1、2026-04-01） |
| `time` | 時刻 | 10:30、15:30:05、3 p.m.、午後3時30分、10時半。24 時間の `HH:MM` にそろえる |
| `url` | リンク先と、そのまま書いた URL | `doc.markup` のリンク（使われた参照の定義と autolink も）と `bare-url.ts`。文末の句読点は URL に入れない |
| `code` | インラインコードとコードブロック | Markdown の木。中身を書いたまま比べる |
| `name` | 固有名詞と `chaff.yaml` の `names:` | 品詞の解析器が `PROPN` とした語の並び。`names:` は書いたとおりに探す |
| `quote` | 「」『』 “” "" で引いた言葉 | `quoted-span.ts`。中身を比べ、括弧の種類は書き方とみなす |
| `heading` | Markdown の見出しと、条・章 | 見出しは深さを比べ、言葉は書き方とみなす。条と章は番地を比べる |
| `reference` | 条項への参照（第5条第2項、Section 4.2） | 構造の木の `reference`。番地と、Section / Article の別を比べる |
| `footnote` | 脚注の印 `[^1]` と脚注 `[^1]:` | 印を書いたまま比べる |

一つの数字は一つの事実として数える。日付・時刻・参照・脚注の中の数字と、番号付きの箇条書きの `1.` は、数として読み直さない。
コードと URL の中の数字も数として読まない。

### 28.2 比べ方

- **多重集合として比べる。** 位置は見ない。段落を入れ替えても、事実が動いただけなら何も報告しない。同じ事実を二度書いた文書が一度にすれば、一つ落ちている。
- **落ちた（dropped）**: 前にあって後に無い。失敗。
- **足された（added）**: 後にだけある。失敗。大胆な書き換えでも、事実を作ってはいけない。
- **書き方だけ変わった（reformed）**: 同じ事実の別の書き方。1,000 と 1000、５ と 5、2026年4月1日 と 2026/4/1、午後3時30分 と 15:30、言い換えた見出し。情報として出し、失敗にしない。
- 単位の違う同じ数（5件 と 5人）は別の事実。片方の単位を読み手が読めなかっただけ（30GB と ３０ＧＢ）なら、同じ数の別の書き方とみなす。
- 品詞の解析器は語を文脈で読むので、書き換えで同じ名前が固有名詞と読まれたり読まれなかったりする。名前は、相手の文書がその綴りを同じ回数書いていれば落ちていない。文頭で大文字になっただけの語（同じ文書が小文字でも書く語）は名前にしない。見出しの中の語は名前として読まない（見出しは見出しとして比べる）。
- 一件ごとに、前と後のファイルの行を示す。

### 28.3 出力と終了コード

- 既定は人が読む画面、`--compact` は 1 件 1 行（`dropped` / `added` / `reformed` と種類の名は英語のまま。grep が読む）、`--json` は AI が読む。
- 最後に、種類ごとの数を前と後で並べる（`数 3→2、日付 1→1、…`）。0 件の種類も並べる。「落ちたものは無い」が「何も見ていない」と読まれないため。
- 読めなかった種類は理由を付けて言う（§17.4）。言語パッケージが構造を読まない（単位・日付・参照）、日付を読まない、品詞の解析器が無い（`names:` だけを比べる）、Markdown でない（コードの記法が無い）。
- 落ちた事実か足された事実が一つでもあれば終了コード 1、無ければ 0。
- `--allow-dropped <種類>` と `--allow-added <種類>` は、わざと削った・足した種類を失敗から外す（繰り返すか、`url,quote` のようにカンマで並べる）。外したものも一覧には残る。
- `--distinct` は事実を集合として比べる。相手の文書に一度でも書いてある事実は残ったとみなし、繰り返しを消しても足しても落ちた・足されたにしない。既定は書いた回数まで比べる。
- 画面の言語は前の文書の言語に従う。

### 28.4 速さ

文書の長さに比例して読む。何万もの引用・範囲・同じ数がある文書でも、一つごとに全体を読み直さない（`test/test_compare_linear.ts`）。

### 28.5 書き直す前の控え（`chaff facts`）

全面的に書き直すときは、元の文章を手元に置いたまま文を直すのではなく、事実の一覧から書き起こす。
`chaff facts <file>` はその一覧を出す。取り出すのは `compare` と同じ `extractFacts` で、新しい読み手は作らない。
だから一覧の数は、`compare` が同じ文書を前として読んだときの数と一致する（`test/test_facts.ts`）。

```bash
npx chaffjs facts before.md            # 種類ごとのチェックリスト（行番号つき）
npx chaffjs facts before.md --compact  # 1 件 1 行。種類の名は英語のまま
npx chaffjs facts before.md --json     # path・language・counts・unread・facts（kind / key / text / line）
```

- 並びは `compare` の種類の順、その中は行の順。同じ事実を二度書いていれば二度並ぶ（`compare` は多重集合で比べる）。
- 最初の行に種類ごとの数を 0 件も含めて並べる。読めなかった種類は理由を付けて言う（§28.3 と同じ）。
- 画面の言語は文書の言語に従う。ファイルは一つ。無い、二つ以上、読めないときは終了コード 1。

### 28.6 構成を測る（`chaff outline`）

文を直しても骨組みが元のままなら、生成文の形は残る。構成を変えたかどうかを、印象でなく数で示すために測る。
読み手は lint と同じ `buildDocument` の節（`doc.sections`）・文・箇条書きの範囲で、新しい読み手は作らない。

```bash
npx chaffjs outline before.md                  # 見出しの構成と形
npx chaffjs outline before.md after.md         # 2 つを並べ、形の値が前と後でどう動いたか
npx chaffjs outline before.md --compact        # 1 節 1 行
npx chaffjs outline before.md after.md --json  # before / after それぞれの path・language・unit・shape・outline
```

| 値 | 測り方 |
| --- | --- |
| 見出しの数 | 深さ 1 以上の節の数 |
| 節の平均 | 節ごとの本文の長さ（日本語は字数、英語は語数。`lengthOf` と同じ）の平均。本文の無い節（題だけの h1 など）は数えない |
| 箇条書き | 本文の長さのうち、箇条書きの項目の中にある文の割合（%） |
| 太字 | Markdown の強調（`**…**`）の数 |

- 構成の一覧は、見出しを深さで字下げし、行と、その節だけの本文の長さを付ける。最初の見出しより前の本文は、本文があるときだけ一行に出す（front matter や画像だけなら出さない）。
- 判定はしない。値が良いか悪いかは言わず、ファイルが読めれば終了コード 0。ファイルが無い、三つ以上、読めないときは 1。
- 画面の言語は最初の文書の言語に従う。

### 28.7 全面書き直しの中での使い方

生成文の形を構成から直す「全面書き直し」（skill と手引き「AIっぽさを直す」）は、chaff のこの 3 つで囲む。
書き直すのは AI か人で、chaff は控えと測りと照合だけをする。

1. 書く前に `facts` で事実の控えを取り、`outline` で元の構成を出す。
2. 書いた後に `outline <前> <後>` で構成の変化を、`--experimental` で AI っぽさの特徴を、前と後で並べる。
3. `compare <前> <後> --allow-dropped heading --allow-added heading` で、見出し以外の事実が落ちても足されてもいないことを確かめる。見出しは、わざと作り直した構成なので、落ちたものも足されたものも外す。
