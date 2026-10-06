# tidyq

tidyq は、CSV ファイルの列名と日付の書式をそろえるコマンドラインツールです。現在の版は 2.4.0 です。

## 目次

- [インストール](#インストール)
- [使い方](#使い方)
- [設定](#設定)
- [オプション](#オプション)

## インストール

Node.js 22 以上が必要です。npm から 2.4.0 を入れます。

```bash
npm install --global tidyq@2.4.0
```

## 使い方

```bash
tidyq fix sales.csv --out sales.fixed.csv
```

1 ファイルの上限は 200 MB です。それより大きいファイルは、`--split` で 50 MB ずつに分けて処理します。

## `tidyq check`

書き換えずに、直す所の一覧だけを出します。

```bash
tidyq check sales.csv
```

## 設定

設定ファイル `tidyq.json` に、そろえる日付の書式を書きます。

```json
{ "dateFormat": "YYYY-MM-DD", "encoding": "utf-8" }
```

## オプション

| オプション | 既定値 | 説明 |
| --- | --- | --- |
| `--out` | なし | 書き出すファイル |
| `--split` | 50 MB | 分ける大きさ |
| `--encoding` | utf-8 | 読む文字コード |

設定の書き方は [設定](#設定) を見てください。
