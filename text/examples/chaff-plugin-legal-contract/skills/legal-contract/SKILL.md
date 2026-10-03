---
name: legal-contract
description: 日本の契約書（NDA / 業務委託 / 利用規約）を chaff で検査しながら書く・レビューするときに使う skill。甲乙の表記統一、必須条項の有無、「ものとする」の冗長表現を自動で見る。
---

# legal-contract — 契約書を chaff で検査する

このスキルは、chaff-plugin-legal-contract を使って契約書を検査・修正するときの手順です。契約書を新規作成する場合、既存の契約書をレビューする場合、どちらにも使えます。

## 前提

- `chaff.yaml` の `plugins:` に `chaff-plugin-legal-contract` が入っていること
- 対象ファイルは Markdown または plain text で、chaff の legal/contract ジャンルで読まれる場所にあること

## やること

### 1. まず chaff にかける

```bash
npx chaffjs 契約書.md --compact
```

結果に次のいずれかが出たら、それぞれの対応を取ります。

### 2. ルール別の対応

#### `legal-contract/party-alias-mix`（甲乙の表記ゆれ）

- 「甲」と「委託者」、「乙」と「受託者」など、同じ当事者を 2 つの呼び方で混在して書いています
- どちらに統一するか決めて、全箇所を置換
- 契約書の冒頭で「甲」「乙」を定義しているなら、本文もそれで統一するのが素直

#### `legal-contract/required-clauses-nda`（NDA の必須条項欠落）

- 以下の条項のうち、文書内に見当たらないものを指摘しています:
  - 秘密情報の定義
  - 使用目的の制限
  - 第三者への開示禁止
  - 秘密情報の返還・廃棄
  - 契約期間
  - 存続条項
  - 損害賠償
  - 準拠法
  - 合意管轄
- 意図的に外した条項があるなら、`<!-- stet: legal-contract/required-clauses-nda — 理由 -->` で該当節を黙らせる
- 入れ忘れなら、templates/nda-oneway.md または nda-twoway.md から該当条項をコピーして追加

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

NDA を新規に書くときは、`templates/nda-oneway.md`（片務型：片方だけが秘密情報を開示する場合）か `templates/nda-twoway.md`（双務型：双方が開示し合う場合）をコピーしてから、以下を埋めます。

- 当事者名（甲・乙）
- 本目的（第 3 条）
- 契約期間（第 6 条、通常 1〜3 年）
- 存続期間（第 7 条、通常 3〜5 年）
- 合意管轄裁判所（第 10 条、どちらかの本店所在地が通例）

埋めたら上記の手順で chaff にかけて検証します。

## 作法

- 契約書は「読み直して意味が通る」のが最優先。chaff の指摘を直すことで読みにくくなるなら、stet で黙らせる方を選ぶ
- 準拠法と合意管轄は、省略すると万一のときに決まらないので、意図して外す場合でもコメントで理由を残す
- 「秘密情報の定義」は NDA の心臓部。例外（公知情報、独自開発情報など）を明示するテンプレートが安全
- 業務委託契約書と利用規約には別のチェックリストが要る（今後 required-clauses-outsourcing / required-clauses-tos を追加予定）

## 関連ファイル

- `rules/party-alias-mix.mjs` — 甲乙と役割名の混在検出
- `rules/required-clauses-nda.mjs` — NDA 必須条項チェック
- `rules/mono-to-suru-filler.mjs` — 「ものとする」冗長検出
- `templates/nda-oneway.md` — 片務型 NDA
- `templates/nda-twoway.md` — 双務型 NDA
- `spec.md` — このパック全体の方針
