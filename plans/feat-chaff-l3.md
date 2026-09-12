# L3 — 品詞を見る rule

issue: #50

## 何を決めたか

サイズの予算（spec §17.1 の 15MB）を外す。辞書は依存として同梱し、L3 は既定で動く。
spec §16 の Tier 1 opt-in（`chaff setup`、`~/.cache/chaff/`）は作らない。

時間の予算は外れていない。品詞を要求する rule が 1 本も動かないときは解析器を初期化しない。

## 採用する解析器

| 言語 | package | unpacked | 初期化 | 出す体系 |
| --- | --- | ---: | ---: | --- |
| ja | `@sglkc/kuromoji` 1.1.0 | 18.3 MB | 1549 ms | IPADIC |
| en | `wink-pos-tagger` 2.2.2 | 0.14 MB | 127 ms | Penn Treebank |

どちらも CommonJS なので `createRequire` で読む。Node 24 ESM で動くことは計測済み。

`lindera-js` は 9.1 MB と小さいが wasm-pack の bundler target で、Node が解決できない。除外。

## 契約の変更（`plugin.ts`）

```ts
export type AdapterNeeds = { readonly pos: boolean };

export type Sentence = {
  readonly span: Span;
  readonly text: string;
  readonly tokens?: readonly Token[];   // 追加。prepare 済みのときだけ入る
};

export type LanguageAdapter = {
  // ...
  readonly prepare?: (need: AdapterNeeds) => Promise<void>;   // 追加
};

export type ProseDocument = {
  // ...
  readonly capabilities: AdapterCapabilities;   // 追加
};

export type RuleDefinition = {
  // ...
  readonly requires: readonly string[];          // 追加。"pos" / "lemma"
  readonly languages: readonly string[] | undefined;  // 追加。未指定は全言語
};
```

`Token.pos` は契約どおり **UPOS**。IPADIC と Penn Treebank をそこへ寄せる。
アダプタ独自の体系を detector に見せない、という既存の決めを崩さない。

## UPOS への対応

IPADIC → UPOS（rule が要る範囲だけ。未知は `X`）

| IPADIC | UPOS |
| --- | --- |
| 名詞,代名詞 | PRON |
| 名詞,固有名詞 | PROPN |
| 名詞（その他） | NOUN |
| 動詞 | VERB |
| 形容詞 | ADJ |
| 副詞 | ADV |
| 助動詞 | AUX |
| 助詞,格助詞 / 係助詞 / 副助詞 | ADP |
| 助詞,接続助詞 | SCONJ |
| 助詞,終助詞 | PART |
| 接続詞 | CCONJ |
| 連体詞 | DET |
| 感動詞 | INTJ |
| 記号 | PUNCT |

Penn Treebank → UPOS は既知の対応表をそのまま使う（`NN*`→NOUN、`VB*`→VERB、`JJ*`→ADJ、`RB*`→ADV、`IN`→ADP、`DT`→DET、…）。

## 誰がいつ 1.5 秒を払うか

```
rule を読む
  ↓
動く rule のうち requires に "pos" があるものを数える
  ↓  1 本以上
await adapter.prepare({ pos: true })      ← ここだけ
  ↓
buildDocument（segment が tokens を返すようになる）
```

0 本なら `prepare` を呼ばない。`capabilities.pos` は「払えばできる」の宣言であって
「もう払った」ではない。この 2 つを混ぜない。

## 満たせないときに黙らない

`requires` を満たさない rule は skip し、理由を出す。既存の語彙表が無いときと同じ扱い。

```
no-doubled-joshi   この言語では品詞解析が使えないため
```

## 最初に通す rule

`agentless-passive`（spec §12.1）。ja と en で **同じ id・別実装**になる唯一の型なので、
これが通れば L3 の設計が通ったと言える。

- ja: 助動詞「れる/られる」の受動用法があり、「〜によって/〜により」が無い
- en: `AUX` + 過去分詞があり、`by` 句が無い

残りの catalog（ja 8 本・en 6 本）は別 PR。

## 検証

- `prepare` を呼ばない経路で今までどおりの時間で終わること（1.07 秒）
- 呼ぶ経路で tokens が入り、rule が動くこと
- `examples/` の実文書 8 本で `agentless-passive` が何件出るか。多すぎれば閾値ではなく rule を疑う（#44 と同じ）
- 3 OS の CI
