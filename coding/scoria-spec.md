# scoria — Code Quality Assay Harness Spec

TypeScript / JavaScript プロジェクトの品質を、既存ツールの機械証拠から定量化し、
**時系列の変化**として提示するハーネス。vibe coding で作られたプロジェクトの客観評価を第一の対象とする。

姉妹仕様: [../text/chaff-spec.md](../text/chaff-spec.md)（散文の検証ハーネス）

chaff が散文に対して行うことを、scoria はコードに対して行う。ただし決定的な違いが一つある。
**散文には linter が無かったので chaff は detector を書くが、コードには linter が有りすぎるので scoria は detector を書かない。**
scoria の仕事は測定・正規化・採点・差分の提示であり、検出そのものは既存ツールに委ねる（§3）。

作成日: 2026-09-11

---

## 0. 名前について

`scoria` は鉱滓。鉱石を製錬して金属を取り出したあとに残る、価値のない滓のこと。

この名前は **`lint` および `chaff` とまったく同じ命名論理**による。lint は布から出る繊維くず、chaff は脱穀後の籾殻であり、
どちらも「取り除くべき残滓」を名前にしている。scoria は同じ語族を冶金から取る。

```bash
npx scoria
```

選定の根拠:

| 基準         | 評価                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| 比喩         | 「鉱石から価値を取り出したあとに残るもの」。コードベースに対して測りたいものと一致する        |
| 命名の系統   | lint（繊維）→ chaff（農）→ scoria（冶金）。lab の 2 本のハーネスが同じ論理で並ぶ              |
| 意味の適合   | 滓を名指すだけで「ツールが直す」を含意しない。検出と修正の分離（chaff §25）と矛盾しない       |
| 採点との相性 | 製錬・試金の語彙圏にあるため、grade / assay / baseline といった周辺語がそのまま設計語彙になる |
| npm          | `scoria` も `@scoria` scope も 2026-09-11 時点で未取得。実装着手前に取得すること              |
| 既知のリスク | 火山学の用語（火山礫）でもある。また一般的な英単語ではないため、初見で意味が伝わらない        |

パッケージ名前空間:

```text
scoria                 harness core（npx の入口）
@scoria/stack-react
@scoria/stack-vue
@scoria/stack-node
@scoria/probe-*        probe adapter 群
@scoria/action         GitHub Action
```

### 0.1 検討して外した候補

記録として残す。同じ検討を繰り返さないため。npm の取得状況は 2026-09-11 時点の実測値。

| 候補                                                              | 状態                | 外した理由                                                                                                                                                        |
| ----------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dross`                                                           | 空き                | 意味・長さ（5 文字 1 音節）ともに最適で、最後まで残った。語感が強すぎる（「お前のコードはかすだ」と読める）ため見送り。取得はしておく価値がある                   |
| `assay`                                                           | 取得済み（2013 年） | 「試金＝鉱石の品位を分析して数値を出すこと」は本ツールの定義そのもの。名前として最良だったが取れない                                                              |
| `swarf`                                                           | 取得済み            | 切削くず。冶金・機械加工の語族で適合するが、既存パッケージが React 関連の別物                                                                                     |
| `slag`                                                            | —                   | 鉱滓としては scoria と同義だが、英国俗語で女性への侮蔑語。採用しない                                                                                              |
| `touchstone` / `hallmark` / `karat` / `gauge` / `proof` / `grade` | 取得済み            | 試金石・純度証明の刻印。意味は良いがいずれも取得済み                                                                                                              |
| `crucible`                                                        | —                   | Atlassian Crucible（コードレビュー製品）と衝突。chaff spec §0.1 で既に却下済み                                                                                    |
| `cupel`                                                           | 空き                | 灰吹き皿（試金で貴金属を分離する器）。意味は正確だが難読で、初見の推測が効かない                                                                                  |
| `fineness`                                                        | 空き                | 金属の純度。「高いほど良い」方向の名前であり、lint 系の「取り除くべきものを名指す」命名から外れる                                                                 |
| `millscale`                                                       | 空き                | 黒皮（熱間圧延で表面にできる酸化スケール）。2 語に見えるうえ意味が遠い                                                                                            |
| 説明的な複合語全般                                                | —                   | `codequality` `quality-harness` `vibecheck` ほか。定着した開発ツール名はほぼ 4〜8 文字の具体名詞であり、説明的な複合語はこの型から外れる（chaff §0.1 と同じ論理） |

---

## 1. 概要

TS/JS プロジェクトに対し、複数の既存ツールを実行して機械証拠を集め、
それを固定された rubric で正規化し、次元別のスコアと **前回からの差分** として提示する。

```bash
npx scoria
```

インストール不要、API key 不要、設定不要（自動検出）。これを設計の最優先制約とする（§19）。

CI に載せたときの体験が本命であり、単発実行はその副産物である。

```text
PR ごとに走り、
  何が良くなり何が悪くなったか
  そのスコアを動かした具体的なファイルと行
を PR コメントに出す。
```

### 1.1 このツールが解こうとしている問題

vibe coding は動くコードを速く作るが、次の腐り方をする。

```text
型エラーを直さず黙らせる          as any / @ts-ignore / eslint-disable
同じ処理を微妙に違う形で再生産する  重複、命名の揺れ
使われないコードが残り続ける        dead export / orphan file
テストが実装を追認するだけになる    assert が弱い、mock だらけ
ドキュメントが実装から乖離する      README の例が動かない
UI の値がその場しのぎで決まる       spacing / color の値の種類が増え続ける
```

これらはどれも「動くか」では検出できず、レビューでしか見つからない。
そしてレビューする人間の総量は、生成されるコードの量に追いつかない。

scoria はこの差分を機械で埋める。**全部を判定するのではなく、人間が見るべき場所を絞る。**

---

## 2. chaff との関係

chaff は自然言語、scoria はコード。対象が違うだけで、設計の骨格は共有する。

継承するもの:

```text
harness と executor の分離          chaff §15（textlint は executor）
検出と修正の分離                   chaff §25
finding format と severity          chaff §20
rule status (experimental / stable) chaff §22
corpus / calibration による閾値決定  chaff §21
skip を黙認しない                   chaff §17.4
npx 一発で動くことを最優先制約にする  chaff §17
三つの直交軸に分解する              chaff §3
```

変えるもの:

| chaff                        | scoria                                                         | 理由                                                                  |
| ---------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| detector を自前で書く        | detector は既存ツール。scoria は書かない                       | コードには成熟した linter がある。散文には無かった（§3）              |
| 単一スコアを non-goal にする | 単一スコアを出す。ただし repo 間で比較不能なものとして定義する | 「改善・劣化が分かる」ことが要求。ただし §16 の制約下でのみ意味を持つ |
| 言語軸（ja / en）            | Stack 軸（ts / react / vue / node）                            | 同じ位置にある直交軸。adapter で吸収する構造も同じ                    |
| Genre 軸（business / blog）  | Profile 軸（app / library / cli）                              | どの rule が適用されるかを決める軸。同じ役割                          |
| Layer（L1〜L4、言語依存度）  | Tier（0〜5、コストと再現性）                                   | scoria では言語依存度より **実行コスト** が階層の軸になる（§5）       |

---

## 3. 中心にある三つの主張

この spec の設計判断はほぼすべて、次の 3 つから導かれる。

### 3.1 scoria は harness であって linter ではない

新しい検査規則を書かない。既存ツールを executor として起動し、その出力を正規化する。

```text
scoria が持つもの      probe の契約、正規化、rubric、採点、差分、レポート、CI 連携
scoria が持たないもの   構文解析、型検査、検査規則そのもの
```

例外は §13 と §14 の一部で、既存ツールに相当物が無いもの（抑制債務の計数、design token 逸脱、
コメント質）だけを scoria が直接測る。これらは AST を要さず、ファイル走査で足りる範囲に限る。

### 3.2 scoria は自分の基準を持ち込む

**2026-09-11 改訂。初版はこの逆を書いていた。**

初版の §3.2 は「scoria が測るのはプロジェクト自身のゲートである」とし、
プロジェクトの eslint をそのまま起動して、その基準に照らして測ると定めていた。
理由は「CI の lint は緑なのに scoria は 40 点」という食い違いを避けるためだった。

**これは誤りだった。** プロジェクト自身の基準だけで測ると、
**ルールを全部切った repo が満点を取る。**

これは §15 の integrity がまさに捕まえようとしている「採点者の買収」そのものであり、
初版はそれを integrity 以外のすべての次元で素通りさせていた。
`eslint-disable` を 1 行書くと integrity が下がるのに、
eslint の設定でそのルールごと切ると何も起きない、という非対称が生まれていた。

したがって:

```text
原則   scoria は自分の基準を持ち込み、その基準に照らして測る
帰結   「CI の lint は緑なのに scoria は低い」は不具合ではなく、報告すべき事実である
       ただし、どちらの基準で測ったかは常に明示する
```

プロジェクト側の基準との差そのものにも意味がある。
「あなたの設定は scoria が見ている検査のうち N 個を無効にしている」は integrity の入力になる。
ただし rule の名前空間が揃わないため、比較の実装方法は未決とする（§30）。

### 3.2.1 持ち込む基準は相手の node_modules に依存してはならない

この原則には実装上の帰結がある。**プロジェクトの node_modules を当てにできない。**
`npx scoria` は install していないディレクトリでも動く必要があり、
プロジェクトの eslint に相乗りすると、その設定とプラグインに縛られる。

実測（2026-09-11）:

| ツール               | 相手の install | .vue         | 速度                | 備考                                         |
| -------------------- | -------------- | ------------ | ------------------- | -------------------------------------------- |
| `oxlint` 1.82.0      | **不要**       | **直接読む** | 313 ファイル 1.8 秒 | 133 rule（correctness + suspicious + perf）  |
| `jscpd` 4            | **不要**       | 対応         | 186 ファイルで即時  | 重複 2.13% を検出                            |
| `knip`               | 必要           | —            | 未計測              | 依存解決にプロジェクトの install が要る      |
| `dependency-cruiser` | 必要           | —            | 未計測              | 設定ファイル必須。加えて解決情報が要る       |
| `tsc --noEmit`       | 必要           | —            | 未計測              | プロジェクトの typescript と tsconfig を使う |

したがって **lint は eslint ではなく oxlint で持ち込む。**
Rust 実装で単体で動き、`.ts` `.tsx` `.js` `.jsx` `.vue` を自前で解析し、
プロジェクトの設定にもプラグインにも依存しない。
型情報を使う検査はできないが、それは Tier 1 の `tsc` が担う。

この判断は scoria 自身の lint（type-aware な typescript-eslint、§28 参照）とは別である。
自分のソースを厳しく保つことと、他人のリポジトリをどこでも測れることは要求が違う。

### 3.3 スコアは repo 間で比較できない

正規化の仕方、有効な probe、プロジェクトの基準の厳しさがすべて repo ごとに違う以上、
`A は 72 点、B は 64 点だから A のほうが良い` は成立しない。

```text
意味があるもの    同じ repo の、同じ設定における、時系列の変化
意味がないもの    repo 間の絶対値の比較、バッジ、ランキング
```

これを **データ構造に埋め込む**。report JSON は `"comparable": false` を必ず持つ。
バッジは出せるが（§21、§29）、**比較できるもののふりをさせない**。
文言に `this repo only` を含め、色は水準ではなく baseline からの増減で決める。
水準で色が変わるバッジは「どの repo でも 90 は緑」という普遍スケールの主張であり、
それはこの節が否定しているものそのものである。

この制約を受け入れる代わりに、時系列の変化については強い保証を与える。
そのための仕組みが baseline / ratchet / rebaseline（§17）である。

---

## 4. 三つの直交軸

probe の振る舞いは三つの軸の積で決まる。

```text
        Stack                   Profile                Tier
        技術スタック             プロジェクト種別        コストと再現性

        ts                      app                    0  instant
        react                   library                1  build
        vue                     cli                    2  runtime
        node-server             monorepo-package       3  browser
        electron                                       4  judge (AI)
                                                       5  human

        StackAdapter            ProfilePack            Runner
        が提供                   が提供                  が実行
```

一つの probe は次のように分解される。

```text
probe "unused-exports" (knip)

  Tier      0                  ファイルを読むだけ。ビルド不要
  Stack     ts / react / vue   entry point の求め方が stack ごとに違う
  Profile   library では別扱い  library の public export は「未使用」ではない
```

この分解により、次が成立する。

- 新しい stack を足すとき、adapter を 1 つ書けば既存 probe の大半がそのまま動く。
- 新しい profile を足すとき、重みと適用範囲を書けば既存 probe がそのまま動く。
- probe を足すとき、どの tier に属するかを決めれば、CI のどこで走るかが自動的に決まる。

---

## 5. Tier — コストと再現性の階層

ユーザーが元々持っていた「機械 → AI → 人間」の 3 層を、実行コストで 6 段に細分したもの。
**下ほど安価で再現性が高く、上ほど柔軟で高価**という性質は保たれる。

```text
Tier 0  instant     ファイルを読むだけ。ビルドもテストも要らない
                    eslint / knip / dependency-cruiser / jscpd / 抑制債務 / UI token
                    PR ごとに毎回。目標 60 秒以内
                    API key 不要。fork PR でも動く

Tier 1  build       型検査とビルドが要る
                    tsc --noEmit / publint / bundle size
                    PR ごとに毎回。数分

Tier 2  runtime     テスト実行が要る
                    coverage / mutation / import smoke
                    coverage は PR ごと。mutation は変更ファイルのみ、全体は nightly

Tier 3  browser     アプリの起動が要る
                    Lighthouse / axe-core / 視覚回帰
                    UI に触れた PR、または nightly

Tier 4  judge       LLM。API key が要る
                    命名 / 責務分割 / ドキュメント十分性 / doc↔code 乖離
                    advisory 固定。ゲートにしない（§24）

Tier 5  human       機械にも AI にもできない判断
                    要件との適合、プロダクトとしての一貫性、UI の自然さ
                    scoria は「人が見るべき問い」を生成するところまでを担う（§24.2）
```

Tier 0 と 1 だけで §11 の 9 次元中 6 次元が測れる。これは制約ではなく設計目標であり、
§13 の probe 選定と §14 の静的な UI 測定はこの目標から導かれている。

**MVP は Tier 0 と Tier 1 のみ**（§28）。

---

## 6. Dimension と Probe

### 6.1 二つは many-to-many で結ばれる

ここを曖昧にすると採点が破綻する。**probe は証拠を出し、dimension は証拠を解釈する。**
1 つの probe が複数の dimension に効き、1 つの dimension は複数の probe から作られる。

```text
Probe                       feeds Dimensions
────────────────────────────────────────────────────────────
tsc-strict                  type-safety
tsconfig-integrity          type-safety, integrity
eslint (core)               readability
eslint (sonarjs)            readability, correctness
eslint (complexity)         readability
knip                        architecture
dependency-cruiser          architecture
jscpd                       readability, architecture
file-shape                  readability
suppression-scan            integrity  → 加えて全 dimension の confidence を下げる
comment-quality             readability, documentation
test-presence               test-coverage
coverage                    test-coverage
mutation                    test-efficacy
audit                       security
secret-scan                 security
publint / attw              packaging        (library profile のみ)
readme-contract             documentation
ui-token                    ui-consistency
component-shape             ui-consistency
```

### 6.2 probe の出力は「値」であって「点」ではない

probe は正規化しない。生の metric を出す。点に変換するのは dimension の rubric（§16）。

```text
悪い設計   probe が 0-100 の点を返す
           → 閾値が probe に埋まり、profile ごとに変えられない
           → calibration が probe の改修になる

良い設計   probe は warnings_per_kloc = 11.4 を返す
           dimension の rubric が scale: {good: 0, bad: 20} で点に落とす
           → 閾値は YAML。calibration は YAML の更新
```

---

## 7. パッケージ構成

```text
scoria                 harness core
  probe contract / runner / tier dispatch
  正規化と rubric エンジン
  baseline / ratchet / rebaseline
  stack 検出
  report と finding の生成、SARIF 変換
  CLI (run / init / explain / baseline / enable / doctor)
  Tier 0 の内製 probe（抑制債務、file-shape、comment-quality、ui-token）

@scoria/stack-ts       TypeScript 基本アダプタ
@scoria/stack-react    react / next
@scoria/stack-vue      vue / nuxt
@scoria/stack-node     hono / express / fastify

@scoria/probe-eslint   既存ツールの起動と出力正規化
@scoria/probe-knip
@scoria/probe-depcruise
@scoria/probe-jscpd
@scoria/probe-coverage
@scoria/probe-mutation
@scoria/probe-lighthouse

@scoria/action         GitHub Action
@scoria/judge          Tier 4（LLM rubric）
```

`@scoria/probe-*` を core から分ける理由は、**外部ツールの版数と CLI が動くため**。
eslint が flat config に移行したときのような変更を、core の release cycle に持ち込まない。

`@scoria/stack-*` は probe に依存しない。probe は stack に依存しない。
両者は core の contract（§8）だけを介して結ばれる。これは chaff の四層モデルと同じ帰結を狙う。
**新しい stack を足したときに probe パッケージの変更が必要になったら、切り分けが間違っている。**

---

## 8. Plugin API

core が公開する contract。stack adapter と probe adapter はこの型だけに依存する。

```ts
// scoria/plugin

export type Tier = 0 | 1 | 2 | 3 | 4 | 5;

/** probe が返す 1 本の測定値。点ではない（§6.2） */
export interface Metric {
  readonly id: string; // "eslint.warnings_per_kloc"
  readonly value: number;
  readonly unit: "count" | "ratio" | "per_kloc" | "ms" | "bytes" | "pct";
  /** この値に寄与した上位ファイル。差分の説明に使う（§22） */
  readonly topContributors?: readonly { file: string; value: number }[];
}

/** probe が動いたかどうかの 3 状態。§18 で厳密に区別する */
export type ProbeStatus =
  | { readonly kind: "ok" }
  | { readonly kind: "absent"; readonly reason: string } // 対象が存在しない = 0 点
  | { readonly kind: "skipped"; readonly reason: string }; // 環境が足りない = 採点しない

export interface ProbeResult {
  readonly probe: string;
  readonly status: ProbeStatus;
  readonly metrics: readonly Metric[];
  readonly findings: readonly Finding[];
  /** 正規化に使った外部ツールの版数。rebaseline の判定に使う（§17.3） */
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly durationMs: number;
}

export interface ProbeContext {
  readonly root: string;
  readonly stacks: readonly StackAdapter[];
  readonly profile: ProfileId;
  /** 変更ファイル限定実行のための集合。未指定なら全体 */
  readonly changedFiles?: readonly string[];
  readonly cacheDir: string;
  /** 外部コマンドの起動。core が版数記録・タイムアウト・キャッシュを担う */
  readonly exec: (cmd: string, args: readonly string[], opts?: ExecOptions) => Promise<ExecResult>;
}

export interface Probe {
  readonly kind: "probe";
  readonly id: string;
  readonly apiVersion: 1;
  readonly tier: Tier;
  /** この probe が出しうる metric の宣言。rubric の静的検証に使う（§26） */
  readonly declares: readonly string[];
  /** 実行可能かの事前判定。ok でなければ run を呼ばない */
  readonly detect: (ctx: ProbeContext) => Promise<ProbeStatus>;
  readonly run: (ctx: ProbeContext) => Promise<ProbeResult>;
}

export interface StackAdapter {
  readonly kind: "stack";
  readonly id: string; // "react"
  readonly apiVersion: 1;
  /** package.json / 設定ファイルからの検出。confidence を返す（§9） */
  readonly detect: (root: string) => Promise<{ matched: boolean; confidence: number; evidence: string[] }>;
  /** entry point。knip / dep-cruiser / bundle 系が使う */
  readonly entryPoints: (root: string) => Promise<readonly string[]>;
  /** ファイル分類。probe はこれ以外の方法でファイル種別を判定してはならない */
  readonly classify: (file: string) => FileKind;
  /** UI トークンの定義元。無ければ undefined（§14） */
  readonly designTokenSource?: (root: string) => Promise<TokenSource | undefined>;
}

export type FileKind = "source" | "test" | "story" | "config" | "generated" | "script" | "type-only" | "ignored";
```

制約:

- **probe は `ctx.exec` 以外でプロセスを起動してはならない。** 版数記録とキャッシュが core を通らなくなるため。
- **probe は `StackAdapter.classify` 以外の方法でファイル種別を判定してはならない。**
  拡張子や `__tests__` の直書きを probe 側に持つと、stack を足すたびに全 probe を直すことになる。
  これは §7 の切り分けが守られているかの検証点であり、静的解析で検査する（§26）。
- **probe は点を返さない**（§6.2）。`Metric` に 0-100 の値を入れることは契約違反とする。

---

## 9. スタック検出と、その凍結

### 9.1 検出

`package.json` の依存と設定ファイルの存在から推定する。

```text
react / react-dom              → stack: react
next                           → stack: react + next
vue                            → stack: vue
nuxt                           → stack: vue + nuxt
hono / express / fastify / koa → stack: node-server
electron                       → stack: electron
typescript + tsconfig.json     → stack: ts
tailwindcss / unocss           → ui token source あり（§14）
vitest / jest                  → test runner
package.json の bin            → profile: cli
exports があり private でない   → profile: library
private: true かつ bin なし     → profile: app
workspaces / pnpm-workspace    → monorepo（§10.2）
```

### 9.2 検出結果を凍結する

**これは scoria で最も重要な設計判断の一つである。**

自動検出を毎回走らせると、依存を 1 つ足しただけでスコアが飛ぶ。

```text
react を足す
  → react preset が有効になる
  → 新しい probe が増える
  → スコアが 71 → 58 に落ちる
  → 「劣化した」と CI が言う
  → 実際には何も劣化していない
```

時系列の比較を成立させる唯一の方法は、**測り方を固定すること**である。したがって:

```text
scoria init      検出を本気で行い、結果を設定に書き出す
それ以降の run   設定を source of truth として読む。再検出しない
検出と設定がずれたら  detection drift として warn する。勝手に追随しない
```

```text
$ npx scoria

detection drift
  package.json に vue が増えていますが、設定の stacks に vue がありません。
  この run は設定どおり [ts, react] で測っています。
  取り込むなら `npx scoria init --update`（baseline の再取得が必要になります）
```

設定が無い状態（zero config）の初回実行は検出結果でそのまま走るが、
その run のレポートは `frozen: false` を持ち、baseline としては採用できないものとする。

---

### 9.3 測る対象のディレクトリ

scoria は**指定された1ディレクトリだけ**を測る。勝手に下に潜らない。

駆動するツールはどれも「1つのルート」に紐づいている。`tsc` は渡された tsconfig を読み、
`audit` は1つの lockfile を読み、`knip` は1つの依存グラフを解決する。
2つのプロジェクトを含む repo に向けると、**ツール系は外側だけを見て、ファイル系は両方を数える**。

```text
ownplate
  src/         Vue アプリ       ルートの tsconfig / lockfile
  functions/   Firebase Functions   独自の tsconfig / package.json / yarn.lock

  ルートから測ったとき
    tsc          0 errors   ← src/ しか見ていない。functions/ の 93 ファイルは未チェック
    audit        high 3     ← functions/yarn.lock の high 4 / moderate 19 が見えていない
    file 系      両方を集計  ← 分母だけ全体
```

分母が全体で分子が半分という、いちばん悪い組み合わせになる。

境界を推測しない。**設定で明示させる。**

```jsonc
{
  "targets": ["packages/*", "agents/*"], // モノレポ
}
```

```jsonc
{
  "targets": [".", "functions"], // 2つのデプロイ単位を持つ repo
}
```

**展開規則は scoria のものではない。`repo.json` §9.2-§9.3 に従う。**
リポジトリが単位を一度宣言したら、それを読むどのツールも同じ集合を得るべきだからである。

- `path` は `repo.json` §6 で解決する。リポジトリの外に出るもの、絶対パス、URL スキームを持つものは拒否。
- **`.` はリポジトリルートを指す正当な path**（§9.2）。`[".", "functions"]` は ownplate の形そのもの。
- ワイルドカードは **segment がちょうど `*`** のときだけ。`**` と segment 内の部分一致（`we*`）は
  §9.2 が「このバージョンでは未定義」としているので、**推測せず拒否して報告する**。
- ディレクトリにのみマッチし、`.` で始まる名前と `node_modules` / `vendor` にはマッチしない。
- ワイルドカードの一致は **UTF-16 code unit 順**（§9.3）。`localeCompare` ではない —
  大文字小文字・数字・アクセントで結果が変わり、2つのツールが別の順序を出す。
- 宣言順は意味を持つ。**1ディレクトリ＝1プロジェクト**で、最初に指したエントリが位置を取る。
  重複は無視して報告する。
- `targets` が無ければ、指定されたディレクトリ1つだけ。既存の設定はすべてこの意味のままである。
- 各 target は**そこで scoria を起動したのと同じ**ように測る。設定も baseline も target ごと。
- **落としたものは必ず報告する**（§11.3）。黙って落とすと「落ちなかった」と区別がつかない。
  何も解決しなければ exit 1。
- target が複数あるとき、`--sarif` / `--badge-json` の出力先にはディレクトリ名が挿入される
  （`scoria.sarif` → `scoria.web.sarif`）。1つのときは変わらない。

#### extent（§9.4）

target は入れ子になってよく、**互いに素だと仮定してはならない**。
ある target の extent は、そのディレクトリから**入れ子の target のディレクトリを引いたもの**である。

```text
targets: [".", "functions"]

  .           functions/ を含まない
  functions   自分自身
```

これをやらないと `functions/` を二重に数える。scoria では、ファイル収集から除外するだけでなく、
ディレクトリ全体を舐めるツールにも渡す必要がある — oxlint は `--ignore-pattern`、
jscpd は `--ignore`、madge は `--exclude`。`tsc` / `knip` / `audit` は自身の設定で根が決まっており、
その根のプロジェクトを見ているので触らない。

---

## 10. Project Profile

profile はどの dimension が適用され、どの重みを持つかを決める。

| profile            | 適用しない dimension | 特徴                                                                                         |
| ------------------ | -------------------- | -------------------------------------------------------------------------------------------- |
| `app`              | packaging            | ui-consistency の重みが高い。public API の概念が無い                                         |
| `library`          | ui-consistency       | packaging（publint / attw）と documentation の重みが高い。**public export は未使用ではない** |
| `cli`              | ui-consistency       | packaging を軽く適用。documentation は README の CLI 例と実装の一致を重く見る                |
| `monorepo-package` | —                    | 親の設定を継承し、パッケージ単位で採点する（§10.2）                                          |

profile ごとの重み（暫定値。calibration 前のため全体が `experimental`。§25）:

```yaml
# profiles/app.yaml
weights:
  type-safety: 15
  readability: 15
  architecture: 15
  test-coverage: 10
  test-efficacy: 10
  security: 10
  documentation: 5
  ui-consistency: 10
  integrity: 10
```

```yaml
# profiles/library.yaml
weights:
  type-safety: 15
  readability: 15
  architecture: 15
  test-coverage: 10
  test-efficacy: 10
  security: 10
  documentation: 10
  packaging: 5
  integrity: 10
```

`app` の配点は元の要求（Correctness 15 / 読みやすさ 15 / アーキテクチャ 15 / テスト 10 /
Mutation 10 / セキュリティ 10 / ドキュメント 10 / UI 10 / CI 5）をほぼ踏襲しつつ、
**ドキュメントを 10 → 5 に下げ、その 5 を integrity に回している。**
理由は §15 に述べる。ビルド再現性・CI の 5 点は独立次元とせず、後述の `integrity` に吸収した。

### 10.2 monorepo

パッケージ単位で採点し、リポジトリ全体のスコアは **加重平均ではなく最小値と分布**で示す。

```text
理由   10 パッケージのうち 1 つが崩れているとき、平均は 3 点しか動かない。
       「どこが悪いか」が消えるスコアには意味がない。

出力   packages/core     78
       packages/ui       71
       packages/legacy   34   ← worst
       repo              34 (worst) / 71 (median)
```

---

## 11. Dimension カタログ

9 次元。`packaging` は library / cli profile のみ。

| dimension        | 何を測るか                       | 主な probe                                        | Tier  |
| ---------------- | -------------------------------- | ------------------------------------------------- | ----- |
| `type-safety`    | 型がどれだけ機能しているか       | source-mix, tsc-strict, tsconfig-integrity        | 0 / 1 |
| `readability`    | 読んで理解できる形か             | eslint, jscpd, file-shape, comment-quality        | 0     |
| `architecture`   | 構造と依存が壊れていないか       | knip, dependency-cruiser, jscpd                   | 0     |
| `test-coverage`  | どれだけ実行されているか         | test-presence, coverage                           | 2     |
| `test-efficacy`  | テストが本当に壊れを検出するか   | mutation                                          | 2     |
| `security`       | 既知の危険があるか               | audit, secret-scan, eslint-security               | 0     |
| `documentation`  | 説明が存在し、実装と合っているか | readme-contract, comment-quality, judge:doc-drift | 0 / 4 |
| `ui-consistency` | 見た目の決定が一貫しているか     | ui-token, component-shape, axe                    | 0 / 3 |
| `packaging`      | 配布物として正しいか             | publint, attw, cross-platform-ci                  | 1     |
| `integrity`      | 測定そのものが信用できるか       | suppression-scan, config-integrity, ci-integrity  | 0     |

`integrity` は他と性質が違う。詳細は §15。

---

## 12. Probe カタログ（Tier 0 / 1 = MVP 範囲）

外部ツールを起動する probe と、scoria が内製する probe に分かれる。

### 12.1 外部ツールを起動するもの

**2026-09-11 改訂。** §3.2.1 の方針転換により、起動するツールと層の切り方を実測で決め直した。
層を分ける軸は、**相手のリポジトリが install 済みである必要があるか**である。

#### Tier 0 — 相手の install を必要としない

`npx scoria` がどんなディレクトリでも動くのは、この層だけで一通りの点が出るからである。

| probe    | 外部ツール    | 主な metric                                                       | 次元                      |
| -------- | ------------- | ----------------------------------------------------------------- | ------------------------- |
| `oxlint` | oxlint 1.82.0 | `violations_per_kloc`, `by_category{correctness,suspicious,perf}` | readability, correctness  |
| `jscpd`  | jscpd 4       | `duplicated_lines_pct`, `clone_count`                             | readability, architecture |

`oxlint` は eslint の代わりである（§3.2.1）。Rust 実装で単体で動き、
`.ts` `.tsx` `.js` `.jsx` `.vue` を自前で解析する。
`-D correctness -D suspicious -D perf` で 133 rule が有効になる。

実測（2026-09-11）:

| 対象              | ファイル数 | 指摘 |                     時間 |
| ----------------- | ---------: | ---: | -----------------------: |
| ownplate/src      |        313 |   48 | 1.8 秒（npx の解決込み） |
| mulmocast-cli/src |        178 |   73 |                        — |
| mulmoterminal/src |        364 |   63 |                        — |

`jscpd` も単体で動く。mulmocast-cli/src で 31 clone / 重複率 2.13% を検出した。

#### Tier 1 — 相手の install が必要

CI では `yarn install` が先に走っているので、この層も使える。
install されていないディレクトリでは `skipped` になり、§18.1 に従って採点から外れる。

| probe        | 外部ツール                | 主な metric                                     | 次元         |
| ------------ | ------------------------- | ----------------------------------------------- | ------------ |
| `tsc-strict` | プロジェクトの typescript | `type_errors`, `strict_flags_enabled`           | type-safety  |
| `knip`       | knip                      | `unused_files`, `unused_exports`, `unused_deps` | architecture |
| `depcruise`  | dependency-cruiser        | `circular_count`, `orphan_count`                | architecture |

`tsc` だけはプロジェクトのものを使う。型検査は tsconfig と依存の型定義が揃って初めて成立し、
scoria が自分の tsconfig を持ち込んでも、そのプロジェクトの型を検査したことにならないため。
**§3.2 の例外はここだけである。**

`dependency-cruiser` は設定ファイルが無いと起動しない。scoria が自分の設定を持ち込む（§3.2 と整合）。

#### 版数の実測（2026-09-11 時点、`dist.unpackedSize`）

| package              | version | unpacked |
| -------------------- | ------- | -------- |
| `oxlint`             | 1.82.0  | 2.41 MB  |
| `jscpd`              | 5.2.0   | 0.01 MB  |
| `knip`               | 6.35.1  | 1.93 MB  |
| `dependency-cruiser` | 18.2.0  | 1.01 MB  |

**外部ツールの CLI フラグを spec に書かない。** 版数で動くうえ、spec が腐る原因になる。
probe adapter が吸収すべき責務であり、spec が定めるのは §8 の contract だけとする。
adapter は起動した実バージョンを `toolVersions` に記録する義務を負う（§17.3）。

### 12.2 scoria が内製するもの（Tier 0）

既存ツールに相当物が無く、かつ AST を要さずファイル走査で足りるもの。

| probe              | 主な metric                                                                             | 節  |
| ------------------ | --------------------------------------------------------------------------------------- | --- |
| `suppression-scan` | `as_any`, `ts_ignore_unreasoned`, `eslint_disable`, `test_skip`, `empty_catch`          | §15 |
| `config-integrity` | `strict_disabled`, `rules_turned_off`, `coverage_excludes`, `duplicate_configs`         | §15 |
| `ci-integrity`     | `has_lint_job`, `has_typecheck_job`, `has_test_job`, `continue_on_error_count`          | §15 |
| `file-shape`       | `sloc_p95`, `max_file_sloc`, `fn_length_p95`, `god_file_count`                          | §13 |
| `comment-quality`  | `comment_density`, `what_comment_ratio`, `stale_todo_count`                             | §13 |
| `readme-contract`  | `has_sections{...}`, `cli_flags_documented_ratio`                                       | §13 |
| `ui-token`         | `raw_color_count`, `raw_spacing_cardinality`, `inline_style_count`, `style_block_count` | §14 |
| `component-shape`  | `props_count_p95`, `near_duplicate_components`                                          | §14 |
| `source-mix`       | `untyped_file_ratio`, `untyped_sloc_ratio`, `untyped_file_count`                        | §15 |
| `secret-scan`      | `hardcoded_secret_candidates`                                                           | —   |
| `test-presence`    | `modules_without_test_ratio`                                                            | —   |

---

## 13. 生成コード固有の probe

vibe coding で作られたコードに特徴的な腐り方を直接測る。ここが scoria の主要な差別化になる。

### 13.1 `file-shape` — 巨大ファイルと巨大関数

LLM は文脈を切らないために 1 ファイルへ書き足し続ける傾向がある。

```text
metric
  sloc_p95            ファイル行数の 95 パーセンタイル
  max_file_sloc       最大ファイル行数
  fn_length_p95       関数行数の 95 パーセンタイル
  god_file_count      500 行超かつ export が 10 以上のファイル数
```

平均ではなく **パーセンタイルと最大値**を使う。平均は小さいファイルが大量にあると隠れる。

### 13.2 `comment-quality` — WHAT コメントの率

「次の行を言い換えただけのコメント」を数える。生成コードで最も濃く出るシグナルの一つ。

```text
判定   コメント行の語彙と、直後の実行行の識別子を正規化して比較する
       識別子を分解（camelCase / snake_case）した語の集合との Jaccard 係数が閾値以上なら WHAT コメント

例     // Initialize counter          → counter, initialize と const counter = 0 が一致  → WHAT
       // 締切を過ぎた分は日割りしない  → 一致しない                                     → WHY（減点しない）
```

これは自然言語の判定であり、chaff 側の資産（語の正規化、n-gram）を再利用できる。
**scoria と chaff が実装を共有しうる唯一の箇所**であり、共有パッケージにするかは §30 の要決定事項とする。

```text
metric
  comment_density       コメント行 / 総行数
  what_comment_ratio    WHAT と判定された率
  stale_todo_count      TODO / FIXME のうち、git blame で 90 日以上動いていないもの
```

`comment_density` は **高くても低くても悪い**という非単調な指標である。
rubric は単調な scale しか持たないため（§16.2）、`what_comment_ratio` を主指標とし、
`comment_density` は confidence の材料としてのみ使う。

### 13.3 `readme-contract` — README が実装と合っているか

Tier 0 で測れる範囲に限る。深い乖離は Tier 4（§24）。

```text
metric
  has_sections{install, usage, api, license}
  cli_flags_documented_ratio    profile: cli のとき。実装のフラグ定義と README の記載を突き合わせる
  broken_relative_links         README 内の相対リンクのうち、対象が存在しないもの
  code_fence_lang_missing       言語指定のないコードフェンス数
```

`cli_flags_documented_ratio` は「実装から抽出できるフラグ」と「README に現れるフラグ」の差集合であり、
機械で決着がつく。**doc drift のうち、機械で判定できる部分を Tier 0 に降ろす**という設計。

### 13.4 依存の膨張

`knip` の `unused_deps` / `unlisted_deps` に加えて、**用途が重複する依存**を数える。

```text
同一用途クラスタの例
  日付        moment, dayjs, date-fns, luxon
  ユーティリティ lodash, ramda, underscore
  HTTP        axios, node-fetch, got, ky
  状態管理     redux, zustand, jotai, mobx, recoil
  スキーマ     zod, yup, joi, superstruct
```

クラスタ定義は YAML で持ち、stack pack が追加できる。
1 クラスタに 2 つ以上入っていたら `redundant_dep_clusters` を 1 数える。
これは vibe coding で頻出し、かつ既存ツールがまったく見ていない領域である。

---

## 14. UI 一貫性を静的に測る

元の要求では Storybook / Chromatic / Lighthouse（すべて Tier 3）が挙がっていたが、
**UI 一貫性の相当部分は Tier 0 で測れる。** MVP に UI 次元を入れられるのはこのためである。

### 14.1 `ui-token` — design token からの逸脱

`StackAdapter.designTokenSource` が tailwind / unocss / CSS 変数の定義を返す。
そこに無い生の値がソースに現れた数を数える。

```text
metric
  raw_color_count           token に無い hex / rgb() の出現数
  raw_spacing_cardinality   px / rem の値の「種類数」
  inline_style_count        style={{...}} / :style の数
  style_block_count         <style> ブロックと .css ファイルの数（utility 方針の repo で意味を持つ）
  arbitrary_value_ratio     Tailwind の [..] 任意値の比率
```

`raw_spacing_cardinality` が要点である。デザインシステムが機能していれば spacing の値は
4 / 8 / 12 / 16 のように少数に収束する。vibe coding では 5, 7, 13, 17, 23 が混ざり、
**種類数が単調に増える。** 総数ではなく種類数を見ることで、規模の増加と混乱を分離できる。

この probe は repo の方針に強く依存するため、既定では `info` 相当の軽い重みとし、
`ui.tokenPolicy: "strict"` を設定した repo でのみ重くする（§20）。

### 14.2 `component-shape` — 近い名前で似たものが増えていないか

```text
metric
  props_count_p95           props / defineProps の数の 95 パーセンタイル
  near_duplicate_components 名前の編集距離が近く、かつ props 集合の Jaccard 係数が高い組の数
```

`Button` / `Btn` / `PrimaryButton` / `ButtonPrimary` が同居する状態を検出する。
jscpd の重複検出はコード片が一致していないと当たらないため、この指標が別に要る。

### 14.2.1 実装の範囲（2026-09-13 追記）

`ui-token` は入れた。`component-shape` は入れていない。
props の数と名前の近さを測るには props の宣言を構文解析する必要があり、
`defineProps` / interface / 分割代入 / `withDefaults` の組み合わせを取りこぼすと
**「似たコンポーネントが無い」と報告してしまう**。無いと言うのは、言わないより悪い。

`ui-token` のうち `arbitrary_value_ratio` も入れていない。
Tailwind を使っていない repo では意味を持たず、使っている repo かどうかの判定が
`designTokenSource`（未実装）に依存するため。

実測（6つの UI プロジェクト、2026-09-13）:

```text
                 UIファイル   色   spacing   inline/kloc   styleブロック率
ownplate              243     14        17          1.7            0.03
mulmocast-app         147      5        21          0.4            0.03
graphai-demo-web       45      2         5          0.5            0.07
grapys                 17      0         2          1.5            0.00
MulmoChat              10      0         2          1.9            0.30
mulmoterminal         109    201        89          2.3            0.03
```

種類数を見るという設計はここで効いている。6本中5本が色14以下・spacing 21以下に収まるなか、
1本だけが色201・spacing 89。しかもそれは単一のテーマ定義ファイルではなく、
通常のコンポーネントに散っている（1コンポーネントに34色）。

### 14.3 Tier 3 に残るもの

コントラスト比、フォーカス順序、実際のレンダリング結果、パフォーマンス。
これらは `@scoria/probe-lighthouse` と axe-core で Phase 3 に扱う（§28）。

---

## 15. Integrity — 採点者の買収を検出する

### 15.1 なぜ独立した次元にするか

すべての静的指標には共通の逃げ道がある。

```text
eslint の警告が多い     → ルールを off にする
型エラーが出る          → as any / @ts-ignore を書く
テストが落ちる          → it.skip する
coverage が低い         → coverage の exclude を広げる
CI が赤い               → continue-on-error: true を足す
```

どれもスコアを上げる。そして **どれもコードを何一つ良くしない。**

vibe coding では、この逃げ道が特に選ばれやすい。行き詰まったモデルが最短で緑にする手段が抑制だからである。
したがって scoria は、抑制そのものを測定対象にする。

**integrity は「ごまかしの量」であり、これを数えないスコアは自動的にごまかされる。**

### 15.2 何を数えるか

```text
suppression-scan（コード中）
  as any / as unknown as
  @ts-ignore
  @ts-expect-error（理由コメントを伴わないもの）
  @ts-nocheck
  eslint-disable / eslint-disable-next-line（理由コメントを伴わないもの）
  it.skip / describe.skip / test.todo / it.only
  空の catch 節、catch して console.log するだけの節

config-integrity（設定）
  tsconfig の strict 系フラグのうち無効なもの
  既定 preset に対して off にされている eslint ルール数
  coverage 設定の exclude が覆う sloc
  eslintignore / tsconfig exclude が覆う source ファイル数
  重複・矛盾する設定ファイルの同居（.eslintrc と eslint.config.js など）

ci-integrity（ワークフロー）
  lint / typecheck / build / test のジョブが存在するか
  continue-on-error: true の数
  || true で握りつぶしている step の数
```

### 15.2.1 計数は FileKind ごとに分ける

**実測による追補。** 総数で数えると嘘になる。

graphai の `as any` 94 件のうち **69 件（73%）が test 配下**だった。
テストの `as any` はモックのために正当なことが多く、source の 25 件が総数に埋もれる。

したがって `suppression-scan` は `StackAdapter.classify` の結果ごとに分けて数え、
rubric は source の密度を主指標に、test には小さい重みだけを与える。

### 15.2.2 `.js` は型検査のファイル単位の抑制である

TypeScript プロジェクトに残っている `.js` / `.jsx` は、型検査を丸ごと回避している。
`@ts-nocheck` と効果は同じで、しかもコード上に痕跡が残らない。
`source-mix` probe がこれを数え、`type-safety` 次元に効かせる。

**typescript を依存に持たない repo では測らない**（`skipped`）。
JavaScript のプロジェクトに「TypeScript にしろ」と言うのは、この probe の仕事ではない。

### 15.3 理由の有無で扱いを変える

抑制そのものは悪ではない。**説明の無い抑制**が問題である。

```ts
// @ts-expect-error upstream types omit the `stream` overload (nodejs/undici#3421)
const res = await client.request(opts);
```

これは減点しない。理由が書かれており、判断の是非を後から検証できるため。

```ts
// @ts-expect-error
const res = await client.request(opts);
```

これは減点する。

判定はディレクティブの種類で分ける。**eslint はルール名を理由と数えてはならない。**
`// eslint-disable-next-line no-console` の `no-console` を理由とみなすと、
ルール名を書くだけで正当化され、integrity の測定が丸ごと無意味になる。
eslint の規約どおり `--` 以降だけを理由とし、ルール名欄を持たない TypeScript のディレクティブだけ、
ディレクティブより後ろを理由とみなす。
`// @ts-expect-error fix later` のような無内容な理由は通ってしまうが、
これを機械で弾こうとすると誤検知が支配的になる。**Tier 4 の judge が理由の質を見る**役割分担にする（§24）。

### 15.4 integrity は他の次元の confidence を下げる

減点するだけでは足りない。抑制が多い repo では、**他の probe の測定値そのものが信用できない。**

```text
eslint の警告が 0 件
  ただし eslint-disable が 60 箇所ある
  → readability が高いのではない。測れていない
```

したがって integrity は、自分自身が 1 次元であることに加えて、
他の dimension の `confidence` を下げる入力になる。

```text
  Readability           88   +0     low     ← 60 suppressions in scope
```

confidence の算出:

```text
suppression_density = 対象 dimension に効く抑制数 / kloc

  < 0.5   high
  < 2.0   medium
  >= 2.0  low
```

confidence が `low` の dimension は、**ratchet の対象から外す**（§17.2）。
測れていない値で CI を落とすのは誤りであり、代わりに integrity 自体が ratchet を担う。

### 15.5 新規分だけを error にする

既存の抑制 60 件を初日に全部 error にすると、誰も導入しない。
baseline に既存数を記録し、**baseline より増えた分だけ**を error に昇格させる。

```text
integrity  62  -6
  suppressions 32 → 38 (+6)
  新規 6 件のうち 3 件が理由なし   ← これが error
```

これは SonarQube の Clean as You Code、および betterer の ratchet と同じ考え方であり（§27）、
scoria ではこの仕組みを integrity 以外の全次元に一般化する（§17）。

---

## 16. スコアの計算

### 16.1 rubric

dimension ごとに、どの metric をどの scale で点に変換するかを YAML で定義する。

```yaml
# dimensions/readability.yaml
id: readability
status: experimental # calibration 前（§25）
metrics:
  - metric: eslint.warnings_per_kloc
    scale: { good: 0, bad: 20 }
    weight: 0.30
  - metric: sonarjs.cognitive_complexity_p95
    scale: { good: 8, bad: 40 }
    weight: 0.20
  - metric: file-shape.fn_length_p95
    scale: { good: 20, bad: 120 }
    weight: 0.15
  - metric: file-shape.sloc_p95
    scale: { good: 150, bad: 800 }
    weight: 0.15
  - metric: jscpd.duplicated_lines_pct
    scale: { good: 0, bad: 15 }
    weight: 0.10
  - metric: comment-quality.what_comment_ratio
    scale: { good: 0.05, bad: 0.40 }
    weight: 0.10
confidence_from:
  - suppression-scan.eslint_disable
  - suppression-scan.ts_ignore_unreasoned
```

### 16.2 線形かつ clamp、非線形にしない

```text
score(metric) = clamp01( (bad - value) / (bad - good) ) * 100
dimension     = Σ weight_i * score_i
overall       = Σ profile_weight_d * dimension_d / Σ profile_weight_d
```

非線形なカーブを入れたい誘惑は常にあるが、採らない。

```text
線形の利点   「この 1 件を直すと何点上がるか」が説明できる
             差分の内訳（§22 の movers）が加法的に分解できる
非線形の害   改善が点に現れない領域ができ、「直したのに動かない」が起きる
             差分の帰属が計算できず、レポートが「何が動かしたか」を言えなくなる

判断        説明可能性を精度より優先する
```

`good` を下回る値、`bad` を上回る値は clamp される。
**過剰達成でスコアを稼げないようにする**ためであり、これがないと coverage を 100% にして
他の崩壊を隠す、といった最適化が可能になる。

### 16.3 規模で正規化する。ただし規模そのものも報告する

生の件数は規模に比例するため、密度（per kloc / per file / 比率）を使う。
ただし密度には別の抜け道がある。

```text
テストを大量に足す → 分母の sloc が増える → 密度が下がる → 点が上がる
```

そこで:

- `sloc` は `StackAdapter.classify` が `source` と判定したファイルのみを数える。
  test / generated / config は分母に入れない。
- レポートの先頭に規模そのもの（files / sloc / test sloc）を常に出し、
  **規模が大きく動いた run はスコア差分に注記を付ける**（§22）。

```text
  214 files · 18,422 sloc · 5,120 test sloc     (+1,204 sloc since baseline — scores are density-based)
```

### 16.4 overall を出すが、比較不能として出す

overall は「全体が良くなったか悪くなったか」を一目で見るためだけに存在する。

```text
report JSON に必ず入れる
  "overall": { "score": 63, "delta": -2, "comparable": false }

scoria が提供しないもの
  repo ランキング、公開ダッシュボード、スコアの水準で色が変わるバッジ
```

`comparable: false` を構造に埋めるのは、後から誰かがこの JSON でバッジを作ろうとしたときに、
**その場でフィールドが目に入る**ようにするためである（§29）。

---

## 17. Baseline と Ratchet

### 17.1 baseline

`.scoria/baseline.json` を repo にコミットする。

```jsonc
{
  "schemaVersion": 1,
  "createdAt": "2026-09-11T00:00:00Z",
  "commit": "abc1234",
  "frozen": true,
  "profile": "app",
  "stacks": ["ts", "react", "node-server"], // 凍結された検出結果（§9.2）
  "configHash": "sha256:...",
  "size": { "files": 214, "sloc": 18422 },
  "dimensions": { "readability": 74, "integrity": 68 },
  "metrics": { "eslint.warnings_per_kloc": 8.1 },
  "toolVersions": { "eslint": "10.10.0", "typescript": "7.0.2", "knip": "6.35.1" },
}
```

metric の生値まで残すのは、**差分の説明（§22 movers）を baseline 側の再計算なしに行う**ため。
スコアだけを残すと「何が動かしたか」が言えない。

### 17.2 三つの mode

既定は `report` である。**何もゲートしない。**

```text
report      既定。exit 0。PR にレポートを出すだけ
ratchet     baseline より劣化したら exit 1
threshold   絶対値の下限を割ったら exit 1   （未実装）
```

`threshold` は下限をどこに書くかが決まっていないため実装していない。
スケールが未較正（§26）である以上、絶対値の下限に置ける根拠がまだ無い。
mode は CLI フラグではなく **コミットされる設定ファイル**に置く。
ゲートを入れるかどうかは出力ではなく方針であり、diff でレビューされるべきものだから。

導入初日に CI が真っ赤になるツールは使われない。`report` で数週間眺め、
baseline が安定してから `ratchet` に上げる、という順序を既定の導線にする（§23 の `init`）。

`ratchet` の判定:

```text
落とす条件（いずれか）
  dimension score が baseline - tolerance を下回った   （既定 tolerance: 1.0 点）
  integrity の新規抑制が理由なしで増えた                （§15.5）
  severity: error の新規 finding がある

finding の同一性は rule + file で見る。行番号は上の行を編集しただけで動くので、
行まで含めると「直っていないものが新しい指摘として出る」。

落とさない条件
  confidence が low の dimension の劣化              （測れていない。§15.4）
  toolVersions が変わった probe に起因する劣化        （§17.3）
  規模が 20% 以上変化した run の密度指標の劣化         （警告に格下げし、rebaseline を促す）
```

どれも「劣化していない」ことにはしない。**ゲートしなかった劣化は必ず表示する**（`Regressed, but not gated`）。
黙って除外すると、劣化が無かったのと区別がつかず、そのときゲートは嘘をついている。

密度指標かどうかは rubric の `density: true` で宣言する。metric 名の `_per_kloc` から
推測しない — それは命名規約であって契約ではない。

改善したときは baseline を自動で書き換えない。**書き換える差分を提示する。**

```text
5 dimensions improved. run `npx scoria baseline --accept` to lock in the gains.
（CI では `--accept` をコミットする step を任意で足せる。既定では足さない）
```

自動で上げない理由は、ratchet が「上がったら二度と下がれない」性質を持つため。
意図しない一時的な改善（テストを一時的に足した、生成コードを消した）で天井が上がると、
次の PR が理由なく落ちる。**天井を上げるのは人間の判断とする。**

### 17.3 ツール版数が変わったときの rebaseline

実運用で最も効く仕組みである。

```text
eslint 10.10 → 10.11 に上げる
  新しいルールが既定で有効になる
  警告が 8.1 → 12.4 /kloc に増える
  readability が 74 → 66 に落ちる
  ratchet が CI を落とす
  → 「scoria があるから依存を上げられない」という最悪の状態になる
```

したがって:

```text
baseline の toolVersions と実行時の toolVersions を比較する
差があった probe に依存する dimension は、その run では
  ratchet の対象から外す
  レポートに「rebaseline required」として明示する
  新しい baseline 値を提示する
```

```text
rebaseline required
  eslint 10.10.0 → 10.11.0
  readability の差分 -8 はツール版数の変更を含むため、この run ではゲートしていません。
  `npx scoria baseline --accept --reason "eslint 10.11"` で基準を取り直してください。
```

**版数を上げると必ず赤くなるツールは、依存を上げない文化を作る。** それは品質ツールとして自己矛盾している。

---

## 18. absent と skipped を区別する

chaff §17.4 の「skip を黙認しない」を、scoria では 3 状態に分ける。
これを曖昧にすると、**テストが 1 行も無いプロジェクトが満点を取る。**

```text
ok        probe が動いて値が出た

absent    測定対象が存在しない = 0 点として採点する
          例: テストが 1 本も無い → test-coverage は skip ではなく 0 点
              README が無い      → documentation は 0 点
              CI 設定が無い      → ci-integrity は 0 点

skipped   環境が足りず測れなかった = 採点しない。confidence を下げ、レポートで赤く報告する
          例: mutation が tier 2 で未有効
              tsc がプロジェクトに無い
              audit がオフラインで失敗した
```

境界の判定規則:

```text
「そのプロジェクトが本来持つべきものが無い」  → absent（0 点）
「scoria 側の都合で測れなかった」              → skipped（採点しない）
```

`skipped` を含む run は overall を出すが、`"complete": false` を付ける。

### 18.1 採点は 3 状態を区別しなければならない

**2026-09-11 追記。実装がこれを守っておらず、実害が出ていた。**

初版は probe の 3 状態を契約で定めたが、**採点側がそれを見ていなかった。**
metric の値が無いとき `?? 0` で 0 として扱い、低いほど良い指標では 0 が満点になる。

実測した壊れ方:

```text
ソースファイル 0 件、eslint 設定なし、CI なしのディレクトリ

  integrity               71   high
  readability            100   high      ← source が無いのに満点
  type-safety            100   high      ← 判定を skip したのに満点
  Overall                 90
```

しかも `high`（信頼できる）と表示される。**間違っている方向が最悪である。**
これは §18 の冒頭が「テストが 1 本も無い repo が満点を取るのを防ぐため」と書いた失敗そのもの。

採点の規則を明示する。

```text
ok       値を scale に通して点にする

absent   そのプロジェクトが本来持つべきものが無い
         → その metric は 0 点。重みはそのまま。
         例: source が 1 つも無い、テストが 1 つも無い

skipped  scoria 側の都合で測れなかった
         → その metric を採点から外し、残りの重みを再正規化する
         → 次元に「何割を測れたか」(coverage) を出し、confidence を下げる
         例: プロジェクトに typescript が無くて型検査ができない
             外部ツールの取得を断られた
```

**skipped を 0 点にしてはならない。** 測れなかったことを罰するのは、
「scoria がインストールに失敗した repo は品質が低い」と言うのと同じ。

**absent を非採点にしてもならない。** 持つべきものが無いのは、そのプロジェクトの状態である。

次元の coverage が 0（全 metric が skipped）なら、その次元は点を出さず `—` とする。
`Overall` はそのとき、点の出た次元だけの平均とし、何次元から計算したかを併記する。

`--strict` で skipped を error に昇格できる（chaff §17.4 と同じ）。

---

## 19. npx で動かすための設計

#### 18.1.1 測れる重みが変われば、比較もできない

**2026-09-13 追記。§16.2 の差分と組み合わせたときの穴。**

points は**測れた重みで正規化される**。だから、ある指標が単独でその観点を支えていたところに
別の指標が値を出し始めると、**その指標の値が改善していても points は大きく下がる**。

実測した壊れ方:

```text
coverage が初めてレポートを読めた run
  test_to_source_ratio   0.499 → 0.57     値は改善している
  報告された points      -69.8            劣化として表示された
```

rubric は1文字も変わっていないので、指標の集合を比べる §16.2 の判定は通ってしまう。
**比較可能の条件に「測れた重みが同じであること」を加える。** 違えば差分を出さない。

---

### 19.1 予算

**2026-09-11 改訂。** 初版の予算は §3.2 が「プロジェクトの eslint を使う」と定めていた前提で書かれていた。
§3.2 を逆転し、scoria が自分のルールを持ち込むことにした以上、その lint 本体を配る必要がある。

実測（2026-09-11、`yarn install` 後のディスク使用量）:

| 依存                   | サイズ | 必要な理由                                     |
| ---------------------- | -----: | ---------------------------------------------- |
| `@oxlint/binding-*`    |  12 MB | lint 本体。プラットフォームごとに 1 つだけ入る |
| `oxlint`               | 2.3 MB | 上のラッパー                                   |
| `knip`                 | 5.1 MB | 到達不能コードの検出                           |
| `@jscpd/*`             | 5.7 MB | 重複検出                                       |
| scoria 本体（tarball） |  98 KB | 展開 402 KB                                    |

| 項目                                  | 目標              | 実測     |
| ------------------------------------- | ----------------- | -------- |
| install 後のディスク使用量            | **30 MB 以内**    | 約 25 MB |
| Tier 0 + Tier 1 の測定（18,000 sloc） | 3 分以内          | 8.7 秒   |
| Tier 0 の外部通信                     | なし              | なし     |
| API key                               | Tier 4 以外は不要 | 不要     |

初版の「5 MB 以内」は達成できない。**lint を持ち込むという決定と両立しない。**
予算は 30 MB に改める。数字を守るために測定をやめるのは本末転倒であり、
代償を払うのは `npx` の初回だけで、以降は npm のキャッシュが吸収する。

Tier 0 の外部ツール（oxlint、jscpd）は相手の install を必要としないため、
どんなディレクトリでも一通りの点が出るという性質は保たれている（§3.2.1）。

### 19.2 probe の取得

```text
1. core だけを起動する
2. package.json と設定ファイルから stack / profile を検出する（§9）
3. probe を解決する
   プロジェクトが持っているもの（eslint / typescript / vitest）はそのまま使う
   持っていないもの（knip / dependency-cruiser / jscpd）は、確認のうえ取得する
4. Tier 0 から順に実行する
```

暗黙に取得しない。

```text
scoria needs knip, dependency-cruiser, jscpd (3.0 MB) for 4 probes.
Install? [Y/n]
```

`--yes` と CI 環境（`CI=true`）では確認を省略する。
取得を断った場合、該当 probe は `skipped` であって `absent` ではない（§18）。

### 19.3 実装上の制約

- Node.js 22 以上。ESM のみ。
- `postinstall` を持たない。npx 実行時に任意コードを走らせない。
- ネイティブアドオン依存を持たない。
- **probe の実行は必ずサンドボックス外プロセスとして `ctx.exec` 経由**（§8）。版数記録とタイムアウトを core が担う。
- probe に無制限のタイムアウトを与えない。既定 120 秒、超過は `skipped`。
- rubric YAML を起動時に全部読まない。有効な profile が参照するものだけを遅延読み込みする。
- 終了コードは mode に従う（§17.2）。`report` では常に 0。

### 19.4 キャッシュ

```text
キー   probe id + tool version + config hash + 対象ファイルの内容ハッシュ
場所   .scoria/cache/（gitignore する）
       CI では actions/cache で持ち回る
```

`--changed-only` は PR の差分ファイルだけを probe に渡す。
ただし **密度指標の分母は全体のまま**とする。分母まで差分にすると数値の意味が変わる。

---

## 20. 設定ファイル

「eslint のように、しかしとても簡単に」という要求に対して、3 段の梯子を用意する。

### 20.1 第 1 段 — 設定なし

```bash
npx scoria
```

検出して走る。レポートの末尾で設定の固定を促す。この run は baseline にできない（§9.2）。

### 20.2 第 2 段 — package.json の 3 行

大半のプロジェクトはここで終わる。

```json
{
  "scoria": {
    "profile": "app",
    "stacks": ["ts", "react", "node-server"],
    "mode": "report"
  }
}
```

`scoria init` が検出結果をこの形で書き込む。**init の出力は人間が読んで直せる形であること**を要件とする。
検出は魔法であってはならず、結果は常に平文で repo に残る。

### 20.3 第 3 段 — `scoria.config.js`

eslint flat config と同じ形。合成と部分上書きが要るときだけ使う。

```js
// scoria.config.js
import { defineConfig } from "scoria";
import react from "@scoria/stack-react";
import node from "@scoria/stack-node";

export default defineConfig({
  profile: "app",
  stacks: [react(), node({ entry: "src/server/index.ts" })],

  mode: "ratchet",
  tolerance: 1.0,

  tiers: [0, 1], // MVP の既定。2 以上は明示的に有効化する

  ui: { tokenPolicy: "strict" }, // §14.1

  dimensions: {
    documentation: { weight: 10 }, // profile の既定重みを上書き
    "ui-consistency": { enabled: false },
  },

  probes: {
    jscpd: { minTokens: 70 },
    knip: { config: "knip.json" }, // プロジェクト側の設定を明示
  },

  ignore: ["src/generated/**", "packages/legacy/**"],
});
```

`ignore` は **integrity が監視する**（§15.2）。無視範囲を広げてスコアを上げる操作は
`config-integrity.ignored_sloc` に現れ、integrity の減点になる。
どの設定項目も、それ自体がスコアを上げる方向に使えるなら integrity の観測対象にする、という原則を置く。

---

## 21. CLI と出力例

```bash
npx scoria                      # Tier 0 + 1 を実行しレポート
npx scoria --changed-only       # PR 向け。差分ファイルのみ probe に渡す
npx scoria init                 # 検出して設定を書き、baseline を作る
npx scoria init --update        # detection drift を取り込む
npx scoria baseline --accept    # 現在値を baseline にする
npx scoria explain readability  # 次元の内訳と、点を動かしている metric
npx scoria enable mutation      # Tier 2 の probe を有効化
npx scoria doctor               # probe の実行可否と版数を診断
npx scoria --json               # report JSON を stdout に
npx scoria --sarif out.sarif    # finding を SARIF に
npx scoria --badge-json b.json  # shields.io endpoint 用の JSON を書く（§3.3）
```

### 21.1 通常の出力

```text
$ npx scoria

my-app  [ts · react · node-server]  profile: app
214 files · 18,422 sloc · 5,120 test sloc      (+1,204 sloc since baseline — scores are density-based)
scoria 0.1.0 · baseline abc1234 (12 days old) · tiers 0,1

  Dimension          Score    Δ     Confidence
  ──────────────────────────────────────────────────────────────
  Type safety           82   +0     medium   16 suppressions
  Readability           71   -3     low      38 suppressions
  Architecture          64   +2     high
  Test coverage         41   -9     high
  Test efficacy          —    —     absent   no mutation run (tier 2 not enabled)
  Security              95   +0     high
  Documentation         38   +0     medium
  UI consistency        57   -1     medium
  Integrity             62   -6     —
  ──────────────────────────────────────────────────────────────
  Overall               63   -2              not comparable across repos

What moved
  -9.0  test-coverage    line 68% → 51%          src/pricing/** added without tests (1,204 sloc)
  -6.0  integrity        suppressions 32 → 38    6 new, of which 3 have no reason
  -3.0  readability      eslint 8.1 → 11.4/kloc  src/pricing/quote.ts (22 warnings)
  +2.0  architecture     circular deps 3 → 1     src/store ↔ src/api resolved

3 findings new since baseline
  src/pricing/quote.ts:118   as-any              `as any` on API response
  src/pricing/quote.ts:141   ts-ignore-no-reason `@ts-expect-error` without a reason
  src/pricing/index.ts:12    module-without-test new module, no test file

1 probe absent, 1 skipped
  absent   mutation       tier 2 not enabled. `npx scoria enable mutation` (~4 min on this repo)
  skipped  publint        profile is `app`; packaging is not scored

readability confidence is low: 38 active suppressions in scope.
  the score may not reflect the code. see `npx scoria explain integrity`.

exit 0   mode: report — nothing gates.
         `npx scoria init --mode ratchet` to fail CI on regression.
```

### 21.2 `explain`

```text
$ npx scoria explain readability

readability  71  (-3 since baseline)   status: experimental   confidence: low

  metric                                value    baseline   scale         pts   Δ
  ───────────────────────────────────────────────────────────────────────────────
  eslint.warnings_per_kloc               11.4        8.1     0 → 20      13.2  -3.0
  sonarjs.cognitive_complexity_p95         22         22     8 → 40      11.3   0.0
  file-shape.fn_length_p95                 41         39    20 → 120     11.9  -0.1
  file-shape.sloc_p95                     310        298   150 → 800     10.6  -0.1
  jscpd.duplicated_lines_pct              4.2        4.2     0 → 15       7.2   0.0
  comment-quality.what_comment_ratio     0.31       0.30  0.05 → 0.40     1.7  -0.1
  ───────────────────────────────────────────────────────────────────────────────
                                                                         71.0  -3.3

  confidence: low
    38 suppressions affect this dimension (2.1 /kloc)
      eslint-disable            26   of which 19 have no reason
      @ts-ignore                 8
      @ts-expect-error unreasoned 4
    this dimension is excluded from ratchet while confidence is low.

  top contributors to eslint.warnings_per_kloc
    src/pricing/quote.ts        22
    src/pricing/table.tsx       14
    src/components/Modal.tsx     9
```

`explain` が「何点の内訳か」と「何を直せば何点上がるか」を両方出すことが、
線形 scale を選んだ理由（§16.2）の実際の見返りである。

---

## 22. Report Format と Finding Format

### 22.1 二つの出力を分ける

```text
report    dimension ごとの score / metric / delta / mover。PR コメントと時系列に使う
finding   個別の指摘（file / line / rule / severity）。SARIF にして PR の差分表示に出す
```

### 22.2 report

```jsonc
{
  "schemaVersion": 1,
  "scoria": "0.1.0",
  "commit": "def5678",
  "baselineCommit": "abc1234",
  "frozen": true,
  "complete": false, // skipped probe があるため（§18）
  "profile": "app",
  "stacks": ["ts", "react", "node-server"],
  "tiers": [0, 1],
  "size": { "files": 214, "sloc": 18422, "testSloc": 5120, "slocDelta": 1204 },

  "dimensions": {
    "readability": {
      "score": 71,
      "delta": -3,
      "status": "experimental",
      "confidence": "low",
      "confidenceReason": "38 suppressions in scope (2.1/kloc)",
      "ratcheted": false, // confidence low のため除外（§17.2）
      "metrics": [
        {
          "id": "eslint.warnings_per_kloc",
          "value": 11.4,
          "baseline": 8.1,
          "scale": { "good": 0, "bad": 20 },
          "weight": 0.3,
          "points": 13.2,
          "delta": -3.0,
          "topContributors": [{ "file": "src/pricing/quote.ts", "value": 22 }],
        },
      ],
    },
  },

  "movers": [
    {
      "dimension": "test-coverage",
      "metric": "coverage.line_pct",
      "from": 68,
      "to": 51,
      "points": -9.0,
      "attribution": "src/pricing/** added without tests (1,204 sloc)",
    },
  ],

  "integrity": {
    "suppressions": { "as_any": 12, "ts_ignore": 8, "ts_expect_error_unreasoned": 4, "eslint_disable": 26, "test_skip": 2, "empty_catch": 1 },
    "newSinceBaseline": 6,
    "newWithoutReason": 3,
  },

  "probes": [
    { "probe": "mutation", "status": { "kind": "absent", "reason": "tier 2 not enabled" } },
    { "probe": "publint", "status": { "kind": "skipped", "reason": "profile app" } },
  ],

  "toolVersions": { "eslint": "10.10.0", "typescript": "7.0.2", "knip": "6.35.1" },
  "rebaselineRequired": [],

  "overall": { "score": 63, "delta": -2, "comparable": false },
}
```

### 22.3 finding

chaff §20 の形式を踏襲し、scoria 固有の 3 フィールドを足す。

```json
{
  "rule": "ts-ignore-no-reason",
  "severity": "error",
  "file": "src/pricing/quote.ts",
  "line": 141,
  "message": "@ts-expect-error に理由が書かれていません",
  "probe": "suppression-scan",
  "dimension": "integrity",
  "tier": 0,
  "confidence": 1.0,
  "newSinceBaseline": true
}
```

- `probe` / `dimension` / `tier`: どの証拠から来た指摘か。コストと再現性の見積もりに使う。
- `newSinceBaseline`: ratchet の対象かどうか。既存分と新規分を PR 上で区別するために必須。

### 22.4 SARIF

finding は SARIF 2.1.0 に変換して `github/codeql-action/upload-sarif` に渡す。
これにより PR の Files changed に指摘がインラインで出る。

外部ツールが既に SARIF を吐ける場合（eslint は `@microsoft/eslint-formatter-sarif` 3.1.0）は、
`ruleId` の名前空間を `scoria/<probe>/<rule>` に前置して統合する。**元の rule id を失わない**こと。

---

## 23. CI と GitHub Actions

### 23.1 最小の導入

```yaml
# .github/workflows/scoria.yml
name: scoria
on: [pull_request]
permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  assay:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # baseline との比較に履歴が要る
          persist-credentials: false
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: yarn }
      - run: yarn install --frozen-lockfile
      - uses: scoria-dev/action@v1
```

action が行うこと:

```text
Tier 0 と 1 を実行する
.scoria/baseline.json と比較する
PR に sticky comment を 1 つ出す（毎回同じコメントを更新し、増やさない）
SARIF を upload する
mode に従って exit code を返す
.scoria/cache を actions/cache で持ち回る
```

### 23.2 PR コメント

```markdown
### scoria 63 / 100 (-2)

| Dimension     | Score |      Δ | Confidence |
| ------------- | ----: | -----: | ---------- |
| Type safety   |    82 |     ±0 | medium     |
| Readability   |    71 | **-3** | low ⚠      |
| Architecture  |    64 |     +2 | high       |
| Test coverage |    41 | **-9** | high       |
| Security      |    95 |     ±0 | high       |
| Integrity     |    62 | **-6** | —          |

**What moved**

- `-9.0` test-coverage — `src/pricing/**` を 1,204 sloc 足してテストがありません
- `-6.0` integrity — 抑制が 6 件増え、うち 3 件に理由がありません
- `+2.0` architecture — 循環依存 3 → 1

<details><summary>3 findings new since baseline</summary>

- `src/pricing/quote.ts:118` — `as any` on API response
- `src/pricing/quote.ts:141` — `@ts-expect-error` without a reason
- `src/pricing/index.ts:12` — new module, no test file

</details>

<sub>mode: report — このコメントは CI を落としません。スコアは repo 間で比較できません。</sub>
```

### 23.3 fork PR

Tier 0 と 1 は secrets を要さないため fork PR でも動く。
`pull_request` イベントでは `pull-requests: write` が付かないため、
コメントは `pull_request_target` を使う別ワークフローか、`actions/upload-artifact` 経由に退避する。
**fork の PR で `pull_request_target` を使うときに checkout する ref を PR 側にしない。**
これは scoria 固有の問題ではないが、テンプレートとして配る以上、間違えた形を配らないこと。

### 23.4 nightly

```yaml
on:
  schedule: [{ cron: "0 17 * * *" }] # UTC
```

Tier 2 以上（mutation、browser）は nightly に置く。
失敗したときの行き先を必ず決める（chaff §23 の「名前の付いた行き先」と同じ要件）。
行き先の無い red な定期ジョブは、全員が無視することを学習する。

---

## 24. AI レイヤーと人間レイヤー

### 24.1 Tier 4 — judge

**機械証拠を先に集め、その結果を AI に解釈させる。** repo 全体を読ませて点を付けさせない。

```text
入力   report JSON（機械証拠）＋ 該当箇所のソース抜粋
       repo 全体は渡さない
出力   固定 rubric に対する構造化された判定と confidence

rubric（MVP 候補）
  naming            識別子が何であるかを言っているか
  responsibility    1 つの関数・モジュールが 1 つのことをしているか
  doc-sufficiency   ドキュメントが、実装を読まずに使える程度に足りているか
  doc-drift         README / コメントの記述が実装と食い違っていないか
  suppression-reason 抑制に書かれた理由が実際に妥当か（§15.3 の残り）
  test-intent       テストが「意図」を書いているか、実装を追認しているだけか
```

規律:

```text
temperature 0
判定はキャッシュする（rubric 版数 + 証拠ハッシュ + モデル ID をキー）
confidence を必ず返させ、閾値未満は出さない
Tier 4 の結果は advisory 固定。ratchet にも threshold にも入れない
```

最後の 1 行が重要である。LLM の判定は再現性がなく、モデルの更新で勝手に動く。
**再現しないものでビルドを落とさない。**

加えて、記録しておくべき偏りがある。
**vibe coding で書かれたコードを、それを書いたのと同じモデル族が採点する。**
自分の癖を悪癖と判定しない可能性があり、judge の較正（§25）では
人間のレビュー結果との一致率を必ず測る。

### 24.2 Tier 5 — human

機械にも AI にもできない判断がある。要件との適合、プロダクトとしての一貫性、UI の自然さ。

scoria はこれを採点しない。代わりに **人が見るべき問いを生成する**ところまでを担う。

```text
$ npx scoria --ask

機械では判定できません。次を人が見てください。

  src/pricing/quote.ts  過去 30 日で 14 回変更され、循環的複雑度が 22 です。
                        変更が多く複雑な箇所は、設計が要求に追いついていない兆候です。

  src/components/       Button, Btn, PrimaryButton が同居しています。
                        どれが正なのか、コードからは決められません。

  README.md             `--format` フラグが README にありますが実装にありません。
                        機能を消したのか、ドキュメントが古いのかを判定できません。
```

「変更頻度 × 複雑度」は CodeScene の中心的な指標（§27）であり、git 履歴から Tier 0 で計算できる。
scoria ではこれを **スコアではなく問いとして**出す。
変更が多いこと自体は悪ではなく、良し悪しの判断に文脈が要るためである。

---

## 25. Calibration

§16.1 の `scale: { good, bad }` はいま全部が勘である。勘のまま出荷すると、
スコアは「scoria の作者の好み」を測る道具になる。すべての dimension は `experimental` から始める。

### 25.1 corpus

```text
corpus/
  ts-library/{maintained, ordinary, generated}
  ts-app/{maintained, ordinary, generated}
  react-app/{maintained, ordinary, generated}
```

```text
maintained   数年の運用実績があり、複数人が継続保守している OSS
ordinary     普通の個人・社内プロジェクト。利用者が自分の repo から供給する
generated    同一の仕様書から複数のモデルに生成させたプロジェクト。
             生成プロンプトも corpus に含めて再現可能にする
```

chaff §21 と同じく、corpus 本体は repo に含めない。
`corpus/manifest.yaml` に取得元、commit hash、ライセンス、取得日を記録し、`scoria eval --fetch` で取得する。
commit hash を固定するのは、「いつの corpus で較正したか」を再現可能にするためである。

### 25.2 決めること

```text
scale の good / bad
  maintained の分布の中央値を good、generated の分布の 75 パーセンタイルを bad に置くのを初期値とし、
  profile ごとに測り直す。library の分布を app に流用しない

目標
  maintained    overall 75 以上
  generated     overall 40〜60
  ordinary      その間に分布する

metric の取捨
  maintained と generated を分離できない metric は落とす。
  「良さそうに見えるが差が出ない指標」を抱え込むと、スコアが規模のノイズで動くようになる
```

### 25.3 最も重要な検証

絶対値の分布よりも、**変化の向き**が正しいことのほうが重要である（§3.3）。

```text
検証   maintained repo の実際の PR を時系列で流し、
       scoria の delta と、その PR に対する人間のレビュー結果（approve / changes requested）を突き合わせる

要件   「changes requested が付いた PR で scoria が改善と言う」率を測り、公開する
```

これが高い間は ratchet を既定にしてはならない。

### 25.4 threshold の更新

較正の結果は自動適用しない。差分を PR として提示する（chaff §21 と同じ）。
scale が変わると全 repo の baseline が無効になるため、
**scale の変更は scoria 本体の minor バージョンを上げ、rebaseline required を立てる**（§17.3）。

---

## 26. Probe の Unit Test

### 26.1 fixture repo

probe ごとに小さな fixture repo を持つ。

```text
tests/fixtures/
  suppression-scan/
    valid/      理由の書かれた @ts-expect-error、正当な as const
    invalid/    理由なしの抑制
    expected.json
  ui-token/
    valid/      tailwind token だけを使うコンポーネント
    invalid/    生の hex と 7 種類の spacing
    expected.json
```

規約:

- **`valid/` には「その probe が誤検知しやすい正常なコード」を必ず 1 つ以上入れる。**
  抑制系なら、理由付きで正当に抑制している実例を valid 側に置く。
  これが無い fixture は実装を追認するだけになる（chaff §23 と同じ規約）。
- fixture repo は `yarn install` を要さないこと。probe の実行に依存解決が要るなら、
  その probe は Tier 0 ではない。

### 26.2 契約の静的検査

§8 の制約は書いただけでは守られない。検査する。

```text
probe が ctx.exec 以外で child_process を呼んでいないこと
probe が StackAdapter.classify 以外でファイル種別を判定していないこと
   （拡張子リテラルと "__tests__" の直書きを検出する）
probe の返す Metric に 0-100 の「点らしき値」が入っていないこと（§6.2）
rubric が参照する metric id が、どれかの probe の declares に存在すること
   （存在しない metric を参照する rubric は静かに 0 点になる。最も見つけにくい壊れ方）
```

### 26.3 差分の加法性

線形 scale（§16.2）を選んだことの不変条件であり、テストできる。

```text
Σ movers[].points == dimension.delta   （丸め誤差の範囲で）
```

これが崩れたら、レポートの「何が動かしたか」が嘘になっている。
scale に非線形を入れた瞬間にこのテストは落ちる。**設計判断を守るテストとして置く。**

### 26.4 ゴールデンレポート

corpus の `maintained` から 3 repo を固定 commit で選び、report JSON 全体をゴールデンとして保存する。
probe の改修で意図しない指標変動が起きたことを検出する。

---

## 27. 先行事例との関係

いずれも 2026-09-11 時点の確認。

| 既存                                          | 何をするか                                                                       | scoria との違い                                                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MegaLinter** / super-linter                 | 多数の linter を 1 つの Action でまとめて実行する（`mega-linter-runner` 10.1.0） | 実行は統合するが、**採点も差分も無い**。出力は linter ごとのログのまま                                                                                              |
| **betterer**（`@betterer/cli` 6.0.0-alpha.1） | 結果のスナップショットを取り、悪化したら落とす                                   | ratchet の考え方そのもの。ただし**何を測るかは利用者が自分で書く**。統合も採点もしない。scoria の §17 はここから来ている                                            |
| **SonarQube / SonarCloud**                    | 次元別の指標、Quality Gate、Clean as You Code（新規コードのみ判定）              | 最も機能が近い。サーバ運用が要り、多言語汎用で、**プロジェクト自身の eslint ではなく Sonar の基準で測る**（§3.2 と逆）。scoria は npx 一発と TS/JS 特化で差別化する |
| **CodeScene**                                 | git 履歴から変更頻度 × 複雑度、Code Health 1〜10                                 | 履歴の分析は scoria も Tier 0 で行うが、**スコアではなく「人への問い」として出す**（§24.2）                                                                         |
| **Codecov**                                   | coverage の差分を PR コメントに出す                                              | 1 指標に対する差分提示の体験の手本。scoria はそれを 9 次元に広げたものと言える                                                                                      |
| **qlty**                                      | 複数の linter を束ねる統合 CLI（npm 配布ではない）                               | 統合の方向は近い。採点・baseline・AI 層は持たない                                                                                                                   |

scoria が新しく主張するのは次の 4 点に絞られる。

```text
1  抑制債務を 1 次元として測り、他の次元の confidence を下げる（§15）
2  スコアの差分を、それを動かした metric とファイルまで分解して出す（§16.2, §22）
3  stack 検出を凍結し、測り方が勝手に変わらないことを保証する（§9.2）
4  機械 → AI → 人間の層を明示し、再現しないものでビルドを落とさない（§5, §24）
```

この 4 つ以外は既存ツールの組み合わせで実現できる。**それ以外を作らないことが設計方針である。**

---

## 28. MVP と Roadmap

### Phase 1 — Tier 0 が npx で動く

目標: `npx scoria` が、設定もビルドもテスト実行も無しに、9 次元中 6 次元のスコアを出す。

```text
probe contract 確定（§8）
stack 検出（§9）と凍結（§9.2）
内製 probe: suppression-scan, config-integrity, ci-integrity,
            file-shape, comment-quality, readme-contract,
            ui-token, component-shape, test-presence
外部 probe: eslint, knip, dependency-cruiser, jscpd
rubric エンジンと線形 scale（§16）
report / finding フォーマット（§22）
mode: report のみ
@scoria/stack-ts, stack-react, stack-vue, stack-node
```

### Phase 2 — Tier 1 と CI（ここまでが MVP）

```text
tsc-strict, audit, publint / attw
baseline / ratchet / rebaseline（§17）
absent と skipped の区別（§18）
GitHub Action と sticky PR comment（§23）
SARIF 出力
explain
較正の着手（corpus を集め始める。scale はまだ experimental）
```

MVP の完成条件を「動く」ではなく、**次の 2 つが成立すること**とする。

```text
1  自分の repo 3 本に入れて 2 週間動かし、レポートが毎回同じ理由で動いていないこと
   （ノイズで毎日 ±5 動くなら、scale か正規化が間違っている）
2  ratchet を有効にしても、依存を上げる PR が落ちないこと（§17.3 の検証）
```

### Phase 3 — Tier 2

```text
coverage probe（vitest / jest）
mutation probe（Stryker）。変更ファイル限定と nightly 全体
test-efficacy 次元の有効化
```

mutation は「カバレッジ 90% でも assert が無ければ意味がない」を暴くための中核指標だが、
実行時間が桁で違う。**PR では変更ファイル限定、全体は nightly** の設計が成立して初めて入れる。

**2026-09-13 決定: mutation は入れない。** StrykerJS は対象のテストを何度も実行する。
これは「scoria はプロジェクトのテストを実行しない」という §12 の前提と正面から衝突し、
開いたままの未計測問題（§30 の 7）を解く前に、その衝突を受け入れる判断が要る。
受け入れないことにした。`test-efficacy` 次元はこの版では存在しない。

### Phase 4 — Tier 3

```text
Lighthouse / axe-core / eslint-plugin-jsx-a11y
ui-consistency の Tier 3 部分（コントラスト、フォーカス順序）
アプリ起動の抽象化（プロジェクトごとに起動方法が違う問題）
```

### Phase 5 — Tier 4 / 5

```text
judge rubric と構造化出力、キャッシュ（§24.1）
doc-drift, suppression-reason, test-intent
--ask（人への問いの生成、§24.2）
judge と人間レビューの一致率の測定
```

### Phase 6 — 較正の完了

```text
corpus manifest と取得
metric の取捨（§25.2）
experimental → stable の昇格
変化の向きの検証（§25.3）
```

`stable` な dimension が 1 つも無いうちは、scoria を「品質を測るツール」と説明しない。
**「品質の証拠を集めて差分を見せるツール」**として説明する。

---

## 29. Non-goals

- **repo 間のスコア比較。** ランキングと公開ダッシュボードを提供しない（§3.3）。
  バッジは `--badge-json` で shields.io endpoint 用の JSON を書くところまで。
  文言に `this repo only` を、色に増減を載せる。**スコアの水準で色を変えない。**
- **自動修正。** 検出と修正の分離を維持する（chaff §25 と同じ）。`--fix` は提供しない。
  既存ツールの `--fix` を scoria から呼ぶこともしない。
- **新しい lint ルールを作ること。** §3.1。内製 probe は既存ツールに相当物が無いものに限る。
- **TS / JS 以外の言語。** 多言語対応は SonarQube の領域であり、そこで戦わない。
- **アプリを起動して測ること（2026-09-13 決定）。** Playwright / axe-core / Lighthouse は入れない。
  どれも対象アプリが動いていることを前提にする。起動方法はプロジェクトごとに違い、
  認証情報や外部サービスを要することもあり、**scoria が知りようのないことを知っている必要がある。**
  §12 の「対象のコードを実行しない」という前提はここでも効いていて、
  mutation（§28）を落としたのと同じ理由である。
  加えて、起動したアプリから得た数値は実行ごとに揺れる。ratchet（§17.2）は2回の実行を比べる仕組みなので、
  **同じ入力に対して違う答えを返す測定は、差分そのものを読めなくする。**
  コントラスト比やフォーカス順序は静的にも部分的に測れるが、
  「測れる部分だけ測って ui-consistency に足す」のは、
  測っていないものを測ったように見せることになるのでやらない。
- **AI によるレビューを点数に混ぜること（2026-09-13 決定）。** 判定器としての LLM を dimension に入れない。
  理由は3つ。**非決定的**であること — 同じ入力に違う答えを返すものを ratchet の下に置けない。
  **実行ごとに課金される**こと — 測るたびに金がかかる道具は測る回数が減り、
  「毎回 CI で回す」という設計の前提を壊す。そして **API キーを要する**こと —
  `npx scoria` がどのディレクトリでも動くという Tier 0 の性質を失う。
  LLM の判断を finding として**取り込む口**（§6 の probe 契約）は開いたままにする。
  点にしないだけである。
- **実行時性能のプロファイリング。** 上記のとおり Lighthouse も入れない。
- **本格的な SAST。** Semgrep / CodeQL の結果を finding として取り込む口は用意するが、
  scoria が脆弱性解析そのものを行わない。
- **「AI が書いたコードかどうか」の判別。** §13 の probe は生成コードに濃く出る指標だが、判定器ではない。
  レポートに「このコードは AI 製です」と書かない。測るのは腐り方であって出自ではない。
- **人間のレビューの置き換え。** §24.2 の通り、scoria の到達点は「人が見るべき場所を絞る」ことである。
- **バグ密度や障害の予測。** 相関を主張できる根拠が無い。

---

## 30. 要決定事項

1. **npm の名前取得。** `scoria` と `@scoria` scope は 2026-09-11 時点で未取得（§0）。実装着手前に押さえる。
   `dross` も空いているため、押さえておくかを決める。

2. **chaff との共有。** §13.2 の `comment-quality` は自然言語処理であり、chaff の語正規化と n-gram を必要とする。
   共有パッケージを切るか、scoria 側に小さく複製するか。共有すると両者のリリースが結合する。

3. **eslint をプロジェクトのものに委ねる原則（§3.2）の例外。**
   eslint を設定していない repo は珍しくない。その場合 scoria の既定 preset を使うと定めたが、
   「既定 preset で測った 62 点」と「プロジェクトの基準で測った 62 点」は意味が違う。
   別の値として扱う（`readability` と `readability (default preset)` を分ける）べきかを決める。

4. **重みをユーザーが変えられるようにするか。** §20.3 では変更可能にしているが、
   重みを変えると時系列が壊れる。`configHash` の変化で rebaseline required を立てる仕組みはあるが、
   「重みをいじってスコアを上げる」は §15 の思想からすると integrity の観測対象であるべきかもしれない。

5. **monorepo の集約（§10.2）。** worst と median を出す方針にしたが、
   ratchet を worst に掛けると 1 パッケージが全体を止める。パッケージ単位で ratchet すべきか。

6. **較正 corpus の入手。** `generated` は自分で作れるが、`maintained` の選定に恣意が入る。
   選定基準を先に文章で固定する必要がある。

7. **mutation の実用性（Phase 3）。** 18,000 sloc の repo で変更ファイル限定の mutation が
   PR の許容時間に収まるかは未計測。収まらなければ test-efficacy は nightly 専用になり、
   配点 10 点の扱いを変える必要がある。

8. **GitHub Action の配布形態。** `scoria-dev/action@v1` を別 repo にするか、
   `@scoria/action` を npm で配って composite action にするか。

9. **`ui-consistency` を MVP に入れるか。** Tier 0 で測れる（§14）が、repo の方針依存が最も強い次元であり、
   誤検知が出たときに「このツールは分かっていない」という印象を最初に作る場所でもある。
   既定は無効にして opt-in にする選択もある。

10. **`overall` を出すこと自体の是非。** §3.3 の制約を付けたうえで出す設計にしたが、
    chaff は同じ理由で単一スコアを non-goal にしている。
    姉妹仕様で判断が割れている状態を、意図的なものとして残すか、揃えるかを決める。
