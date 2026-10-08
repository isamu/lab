# wrapkit API リファレンス

wrapkit は、文章を決まった幅の行に折り返すライブラリです。このページはバージョン 3.2.0 について説明します。

## 目次

- [wrap](#wrap)
- [measure](#measure)
- [オプション](#オプション)

## wrap

```ts
wrap(text: string, width = 72, options?: WrapOptions): string[]
```

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `text` | string | 折り返す文章 |
| `width` | number | 1行の最大の長さ（文字数） |
| `options` | WrapOptions | [オプション](#オプション)を参照 |

`width` の既定値は 72 文字です。

戻り値：`string[]`。1行ごとに1要素です。

```ts
const lines = wrap("折り返したい長い文です。", 10);
```

## measure

```ts
measure(text: string, tabSize = 4): number
```

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `text` | string | 幅を測る行 |
| `tabSize` | number | タブ1つの幅 |

戻り値：`number`。行の幅を桁数で返します。

measure は、幅を桁数の数値で返します。

## オプション

| オプション | 既定値 | 説明 |
| --- | --- | --- |
| `prefix` | "" | 各行の先頭に付ける文字列 |
| `hyphenate` | false | 長い単語をハイフンで分ける |
| `indent` | 0 | 3.0.0 から非推奨。`prefix` を使ってください |

```ts
const quoted = wrap(text, 60, { prefix: "> " });
```
