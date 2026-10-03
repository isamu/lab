# 説明書・API の文書でできること

説明書や API の文書は、読み手が見出しをたどり、リンクを押し、コードを写して使う文書です。
chaff は、たどれない見出し、行き先の無いリンク、説明の無い画像を機械で見つけます。
ジャンルは `docs/manual` です。手順書やヘルプのページも同じジャンルで見ます。

## 説明書でよく起きる崩れ

説明書は、機能が増えるたびに節を足したり、移したりします。そのとき、つながりが切れます。

| 崩れ | 例 |
| --- | --- |
| 行き先の無いリンク | 見出しの名前を変えたのに、そこへのリンクを直していない |
| 説明の無い画像 | `![](images/settings.png)` と、画像の説明が空になっている |
| 見出しの深さが飛ぶ | `##` の次に、いきなり `####` がある |
| 中身の無い節 | 見出しだけを先に作り、本文を書き忘れた |
| 同じ見出しが二つ | 節を移したときに、元の節を消し忘れた |
| URL に文字が続く | `詳しくはhttps://example.com/…を見てください` と、URL の直後に日本語が続く |

最後の崩れは、画面ではリンクが「を」まで伸び、押すと開けないページに飛びます。

## chaff が見ること、見ないこと

このジャンルで見る主なルールは、次のとおりです。`image-alt-text` は既定で動きます。ほかは試験中で、`--experimental` を付けたときに動きます。

| ルール | 見つけるもの |
| --- | --- |
| `broken-link` | 文書の中に無い見出しへのリンク |
| `image-alt-text` | 説明（代替テキスト）の無い画像 |
| `heading-level-skip` | 2 段以上深くなる見出し |
| `empty-section` | 中身の無い見出し |
| `duplicate-heading` | 同じ親の下にある、同じ言葉の見出し |
| `url-run-on` | URL の直後に続く日本語 |

見ないことも決めてあります。

- コードが動くかは見ません。JSON の書き方や、API が本当にその値を返すかは、書いた人が試して確かめます。
- 外のサイトへのリンクが開けるかは見ません。見るのは、文書の中の見出しへのリンクだけです。
- 画像のファイルがあるかは見ません。
- 手順の順番が正しいかは見ません。読み手と同じ手順を、書いた人がたどって確かめます。

説明書では、生成文の形や受け身のルールは動きません。ジャンルの設定で外してあります。
外したルールは、画面の最後の「動いていない」一覧に、ジャンルを理由として並びます。

## かけてみる

準備がまだなら、先に[準備する](./documents#準備する)を済ませます。
次の説明書を `manual.md` という名前で保存しました。API の名前と URL は架空です。

````markdown file=manual.md
# 予約 API の使い方

この文書では、会議室の予約 API で予約を作り、確かめ、取り消す手順を説明します。

## 準備

API key は、管理画面の「設定」から発行します。発行の手順は[鍵の発行](#鍵を発行する)を見てください。

![](images/settings.png)

## 予約を作る

#### リクエスト

`POST /v1/reservations` に、次の JSON を送ります。

```json
{ "room": "B", "start": "2026-10-14T10:00:00+09:00", "minutes": 60 }
```

#### レスポンス

成功すると、予約の番号が返ります。詳しくはhttps://example.com/docs/reservationsを見てください。

## 予約を取り消す

## 予約を作る

同じ時間に予約があると、`409` が返ります。そのときは、別の時間で予約し直してください。

## よくあるエラー

| コード | 意味 |
| --- | --- |
| 401 | API key が無いか、間違っています |
| 409 | 同じ時間に予約があります |
````

ジャンルを付けずにかけると、ファイル名の「manual」を見て、説明書のジャンルを勧めます。

```
$ npx chaffjs manual.md --compact

manual.md   blog/tech · 日本語   ジャンルは既定から
   マニュアル・手順書のようです。--genre docs/manual を試せます

  9:1     warning 画像「![](images/settings.png)」に代替テキストがありません
                  image-alt-text

{counts}
```

勧められたとおり、ジャンルを付けて、試験中のルールも動かします。
`--compact` は、1 件を 2 行にまとめて出す印です。

```
$ npx chaffjs manual.md --genre docs/manual --experimental --compact

manual.md   docs/manual · 日本語   ジャンルは --genre から

  7:34    warning リンク「[鍵の発行](#鍵を発行する)」が指す「#鍵を発行する」の見出しがこの文書にありません
                  broken-link
  9:1     warning 画像「![](images/settings.png)」に代替テキストがありません
                  image-alt-text
  13:1    warning 見出し「リクエスト」の深さが 2 から 4 へ飛んでいます（3 のはず）
                  heading-level-skip
  23:22   warning URL「https://example.com/docs/reservations」の直後に「を」が続いています。リンクがそこまで伸びます
                  url-run-on
  25:1    warning 見出し「予約を取り消す」の下に中身がありません
                  empty-section
  27:1    warning 見出し「予約を作る」は、同じ親の下の 11 行目の見出しと同じです
                  duplicate-heading

{counts}
```

## 指摘の意味と直しかた

| 行 | 指摘 | 意味 | 直しかた |
| --- | --- | --- | --- |
| 7 | `broken-link` | 「鍵を発行する」という見出しが、文書にありません | 見出しを足すか、リンクの行き先を今の見出しに直します |
| 9 | `image-alt-text` | 画像に説明がありません。画像が出ない画面や、読み上げで使う人には何も伝わりません | `![設定の画面。右上に「API key を発行」のボタンがある](images/settings.png)` のように、画像が伝えることを書きます |
| 13 | `heading-level-skip` | `##` の下に、いきなり `####` があります | `###` にします。目次も正しく組めるようになります |
| 23 | `url-run-on` | URL の直後に「を」が続き、リンクが「を」まで伸びます | URL の前後に空白を入れるか、`[予約の説明](https://example.com/docs/reservations)` のようにリンクにします |
| 25 | `empty-section` | 「予約を取り消す」の下に本文がありません | 取り消しの手順を書くか、見出しを消します |
| 27 | `duplicate-heading` | 「予約を作る」が二つあります | 2 つ目の見出しを、中身に合わせて「予約が重なったとき」のように変えます |

25 行目と 27 行目は、節を移したときの消し忘れのように見えます。
どちらの節を残すかは、chaff は決めません。中身を読んで、書いた人が決めます。

## 意味を読む検査は無い

このジャンルでは、`npx chaffjs test` で AI に送る箇所はありません。
`npx chaffjs test manual.md --genre docs/manual --dry-run` で確かめると、送る箇所は 0 箇所と出ます。

## chaff.yaml の始め方

説明書を置くフォルダに、次の `chaff.yaml` を置きます。

```yaml
genre: docs/manual
language: ja

rules:
  broken-link: normal
  image-alt-text: normal
  heading-level-skip: normal
  empty-section: normal
  duplicate-heading: normal
  url-run-on: normal
```

この `chaff.yaml` を置くと、`npx chaffjs manual.md --compact` だけで、上の指摘がすべて出ます。
説明書のフォルダに README や仕様書も置くなら、[設定](./configuration) の「パスごとに変える」で、パスごとにジャンルを分けます。

## 次に読むページ

- 一箇所だけ黙らせる方法と、ルールをゆるめる方法は、[業務報告書でできること](./documents-report) にあります。
- ルールごとの説明は、[リファレンス](./reference) にあります。
- ほかの種類は、[文書の種類ごとにできること](./documents) に戻って選びます。
