# chaff-plugin-legal-contract

日本の契約書（NDA / 業務委託契約書 / 利用規約・プライバシーポリシー）を [chaff](https://isamu.github.io/lab/) で機械検査可能にするプラグイン。ルール・テンプレート・Claude Code 向け skill をバンドルで提供する。

v0 では **NDA（秘密保持契約）** に対応。

## 入っているもの

| 種類 | id / パス | 内容 |
| --- | --- | --- |
| ルール | `legal-contract/party-alias-mix` | 甲乙と役割名（委託者・開示者など）の混在検出 |
| ルール | `legal-contract/required-clauses-nda` | NDA の必須条項 9 種類の欠落検出 |
| ルール | `legal-contract/mono-to-suru-filler` | 「〜ものとする」の冗長表現検出 |
| house style | `legal-contract/nda` | NDA 向けの厳しめプリセット |
| テンプレート | `templates/nda-oneway.md` | 片務型 NDA |
| テンプレート | `templates/nda-twoway.md` | 双務型 NDA |
| skill | `skills/legal-contract/SKILL.md` | Claude Code 向けの使い方 |

## 使う

```yaml
# chaff.yaml
plugins:
  - chaff-plugin-legal-contract
style: legal-contract/nda
```

```bash
# 契約書を検査
npx chaffjs 契約書.md

# NDA テンプレートから新規作成
cp node_modules/chaff-plugin-legal-contract/templates/nda-twoway.md 契約書.md
# 空欄を埋めて chaff にかける
npx chaffjs 契約書.md

# Claude Code にこのパックの skill を注入
cd node_modules/chaff-plugin-legal-contract
npx chaffjs skill
```

## ルール詳細

### `legal-contract/party-alias-mix`

契約書で、同じ当事者を 2 つの呼び方で混在して書いているときに指摘する。

- 「甲」と「委託者」、「乙」と「受託者」
- 「開示者」と「ディスクロージャー」
- など

対応案は、どちらか 1 つに統一する。

### `legal-contract/required-clauses-nda`

NDA の必須条項が欠けている場合に指摘する。見ているのは:

- 秘密情報の定義
- 使用目的の制限
- 第三者への開示禁止
- 秘密情報の返還・廃棄
- 契約期間
- 存続条項
- 損害賠償
- 準拠法
- 合意管轄

意図して外した条項は、`<!-- stet: legal-contract/required-clauses-nda — 理由 -->` で黙らせられる。

### `legal-contract/mono-to-suru-filler`

「〜ものとする」が「〜する」で置き換え可能な箇所を指摘する。意味の変わる箇所（法的な「みなす」を含ませているとき）は残して stet で黙らせる。

## ロードマップ

- v0: NDA（本バージョン）
- v1: 業務委託契約書（準備中）
- v2: 利用規約・プライバシーポリシー（準備中）

詳細は [spec.md](./spec.md) 参照。
