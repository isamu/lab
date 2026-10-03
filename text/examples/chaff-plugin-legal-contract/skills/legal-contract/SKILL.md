---
name: legal-contract
description: 日本の契約書（NDA / 業務委託契約書 / 利用規約 / プライバシーポリシー）を chaff で検査しながら書く・レビューするときに使う skill。甲乙の表記統一、必須条項の有無、「ものとする」の冗長表現を自動で見る。
---

# legal-contract — 契約書を chaff で検査する

このスキルは、chaff-plugin-legal-contract を使って契約書を検査・修正するときの手順です。契約書を新規作成する場合、既存の契約書をレビューする場合、どちらにも使えます。

## 前提

- `chaff.yaml` の `plugins:` に `chaff-plugin-legal-contract` が入っていること
- 対象ファイルは Markdown または plain text で、chaff の legal/contract ジャンルで読まれる場所にあること

## 文書種別ごとに house style を切り替える

このパックは 4 種類の文書に対応しており、該当する house style を使ってください。

```yaml
# chaff.yaml
plugins:
  - chaff-plugin-legal-contract
genre: legal/contract
style: legal-contract/nda           # 秘密保持契約書
# style: legal-contract/outsourcing # 業務委託契約書
# style: legal-contract/tos         # 利用規約
# style: legal-contract/privacy     # プライバシーポリシー
```

該当する style を選ぶと、その文書種別の必須条項チェックが有効になり、他の文書種別のチェックは off になります。

## やること

### 1. まず chaff にかける

```bash
npx chaffjs 契約書.md --compact
```

結果に出た指摘ごとに、以下の対応を取ります。

### 2. ルール別の対応

#### `legal-contract/party-alias-mix`（甲乙の表記ゆれ）

- 「甲」と「委託者」、「乙」と「受託者」など、同じ当事者を 2 つの呼び方で混在して書いています
- どちらに統一するか決めて、全箇所を置換
- 契約書の冒頭で「甲」「乙」を定義しているなら、本文もそれで統一するのが素直

#### `legal-contract/required-clauses-nda`（NDA の必須条項欠落）

NDA で以下の 9 条項のいずれかが欠けている場合に指摘します:

- 秘密情報の定義 / 使用目的の制限 / 第三者への開示禁止 / 秘密情報の返還・廃棄 / 契約期間 / 存続条項 / 損害賠償 / 準拠法 / 合意管轄

対応: `templates/nda-oneway.md` または `templates/nda-twoway.md` から該当条項をコピーして追加。意図して外した場合は `<!-- stet: legal-contract/required-clauses-nda — 理由 -->` で黙らせる。

#### `legal-contract/required-clauses-outsourcing`（業務委託契約書の必須条項欠落）

業務委託契約書で以下の 14 条項のいずれかが欠けている場合に指摘します:

- 業務内容 / 委託料 / 支払条件 / 納期または契約期間 / 成果物の定義 / 著作権の帰属 / 再委託の可否 / 契約不適合責任（瑕疵担保）/ 報告義務 / 契約解除 / 損害賠償 / 秘密保持 / 準拠法 / 合意管轄

対応: `templates/business-outsourcing.md` から該当条項をコピー。著作権の帰属は特に注意（委託料支払時に受託者 → 委託者へ譲渡が通例）。

#### `legal-contract/required-clauses-tos`（利用規約の必須条項欠落）

利用規約で以下の 13 条項のいずれかが欠けている場合に指摘します:

- 本規約の適用範囲 / 定義 / サービス内容 / 会員登録 / 禁止事項 / 利用料金 / サービスの変更・中止 / 免責事項 / 規約の変更 / 知的財産権 / 個人情報の取扱い / 準拠法 / 合意管轄

対応: `templates/tos.md` から該当条項をコピー。消費者契約法の無効条項（事業者の責任を全部免除する条項など）に該当しないか人間レビューで確認。

#### `legal-contract/required-clauses-privacy`（プライバシーポリシーの必須記載事項欠落）

プライバシーポリシーで以下の 12 項目のいずれかが欠けている場合に指摘します:

- 個人情報取扱事業者の名称・住所 / 取得する個人情報の種類 / 利用目的 / 第三者提供 / 業務委託先への提供 / 保有期間 / 安全管理措置 / 開示・訂正・削除請求 / 外国への移転 / Cookie 等の利用 / 問い合わせ窓口 / プライバシーポリシーの変更

対応: `templates/privacy-policy.md` から該当項目をコピー。個人情報保護法改正への追随は定期的に見直す必要があります。

#### `legal-contract/mono-to-suru-filler`（「ものとする」の冗長）

- 「〜ものとする」が「〜する」で置き換え可能な箇所です
- 置換して読み直して、意味が変わらなければそのまま
- 法的な「みなす」のニュアンスを持たせているなら、残して stet コメントを付ける

### 3. 修正したら、再度 chaff にかける

```bash
npx chaffjs 契約書.md --compact
```

指摘が 0 になれば機械で判定できる部分は OK。残っている違和感は人間レビューに回します。

## テンプレートから新規作成する場合

| 作る文書 | テンプレート |
| --- | --- |
| 片務型 NDA | `templates/nda-oneway.md` |
| 双務型 NDA | `templates/nda-twoway.md` |
| 業務委託契約書 | `templates/business-outsourcing.md` |
| 利用規約 | `templates/tos.md` |
| プライバシーポリシー | `templates/privacy-policy.md` |

いずれも空欄 `___________` を埋めるだけで、ルールを満たした雛形になります。埋めたら上記の手順で chaff にかけて検証します。

## 作法

- 契約書は「読み直して意味が通る」のが最優先。chaff の指摘を直すことで読みにくくなるなら、stet で黙らせる方を選ぶ
- 準拠法と合意管轄は、省略すると万一のときに決まらないので、意図して外す場合でもコメントで理由を残す
- 「秘密情報の定義」は NDA の、「業務内容」と「成果物」は業務委託契約の、「禁止事項」は利用規約の、「利用目的」はプライバシーポリシーの心臓部。テンプレートに準じた形で例外を明示するのが安全
- 業務委託契約書で著作権の帰属が「乙に留保」のパターンを使う場合は、ライセンス範囲を別途明記する（stet だけで済ませない）
- プライバシーポリシーは法令改正への追随が必要（個人情報保護法の 3 年ごとの見直しに合わせて再チェック）

## 関連ファイル

- `rules/party-alias-mix.mjs` — 甲乙と役割名の混在検出
- `rules/required-clauses-nda.mjs` — NDA 必須条項チェック
- `rules/required-clauses-outsourcing.mjs` — 業務委託契約書必須条項チェック
- `rules/required-clauses-tos.mjs` — 利用規約必須条項チェック
- `rules/required-clauses-privacy.mjs` — プライバシーポリシー必須記載事項チェック
- `rules/mono-to-suru-filler.mjs` — 「ものとする」冗長検出
- `templates/*.md` — 各文書種別のテンプレート
- `spec.md` — このパック全体の方針
