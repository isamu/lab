# chaff-plugin-legal-contract

日本の契約書（NDA / 業務委託契約書 / 利用規約・プライバシーポリシー）を [chaff](https://isamu.github.io/lab/) で機械検査可能にするプラグイン。ルール・テンプレート・Claude Code 向け skill をバンドルで提供する。

## 入っているもの

### ルール

| id | 内容 |
| --- | --- |
| `legal-contract/party-alias-mix` | 甲乙と役割名（委託者・開示者など）の混在検出 |
| `legal-contract/required-clauses-nda` | NDA の必須 9 条項の欠落検出 |
| `legal-contract/required-clauses-outsourcing` | 業務委託契約書の必須 14 条項の欠落検出 |
| `legal-contract/required-clauses-tos` | 利用規約の必須 13 条項の欠落検出 |
| `legal-contract/required-clauses-privacy` | プライバシーポリシーの必須 12 項目の欠落検出 |
| `legal-contract/mono-to-suru-filler` | 「〜ものとする」の冗長表現検出 |

### house style

| id | 用途 |
| --- | --- |
| `legal-contract/nda` | NDA 向け（NDA 条項のみ strict、他は off） |
| `legal-contract/outsourcing` | 業務委託契約書向け |
| `legal-contract/tos` | 利用規約向け |
| `legal-contract/privacy` | プライバシーポリシー向け |

### テンプレート

| ファイル | 内容 |
| --- | --- |
| `templates/nda-oneway.md` | 片務型 NDA |
| `templates/nda-twoway.md` | 双務型 NDA |
| `templates/business-outsourcing.md` | 業務委託契約書 |
| `templates/tos.md` | 利用規約 |
| `templates/privacy-policy.md` | プライバシーポリシー |

### skill

| ファイル | 内容 |
| --- | --- |
| `skills/legal-contract/SKILL.md` | Claude Code 向けの使い方 |

## 使う

### 利用規約を書く場合

```yaml
# chaff.yaml
plugins:
  - chaff-plugin-legal-contract
style: legal-contract/tos
genre: legal/contract
```

### 業務委託契約書を書く場合

```yaml
plugins:
  - chaff-plugin-legal-contract
style: legal-contract/outsourcing
genre: legal/contract
```

### 検査する

```bash
npx chaffjs 契約書.md
```

### Claude Code に skill を注入する

```bash
cd node_modules/chaff-plugin-legal-contract
npx chaffjs skill
```

## テンプレートから新規作成する

```bash
# NDA (双務型)
cp node_modules/chaff-plugin-legal-contract/templates/nda-twoway.md ./new-nda.md

# 業務委託契約書
cp node_modules/chaff-plugin-legal-contract/templates/business-outsourcing.md ./new-outsourcing.md

# 利用規約
cp node_modules/chaff-plugin-legal-contract/templates/tos.md ./new-tos.md

# プライバシーポリシー
cp node_modules/chaff-plugin-legal-contract/templates/privacy-policy.md ./new-privacy.md
```

空欄 `___________` を埋めて、chaff にかけます。テンプレートはルールを満たすように書かれているので、空欄を埋めた状態で指摘 0 件になります。

## ルール詳細

ルールごとに、拾う条項と対応案は上記 skills/legal-contract/SKILL.md と各 rules/*.mjs の `why` / `how_to_fix` 参照。

## ロードマップ

- v0: NDA ✅
- v1: 業務委託契約書 ✅
- v2: 利用規約・プライバシーポリシー ✅
- v3: 業種別派生（SaaS 向け利用規約、個人情報取扱委託契約など、要望ベースで追加）

詳細は [spec.md](./spec.md) 参照。
