# examples

実際に公開された記事と社内文書を置いてあります。作り物ではない文章に chaff をかけると
何が出るのかを、手元でもすぐ確かめられるようにするためです。

```bash
yarn example              この場所の文書を全部
yarn example:friendly     既定の（非エンジニア向けの）出力で
```

`text/` の外から直接動かすこともできます。

```bash
cd text/examples && npx chaffjs .
```

## 置いてあるもの

| ディレクトリ | 中身 | 出所 |
| --- | --- | --- |
| `blog-ja/` | 技術記事 3 本 | [zenn.dev/singularity](https://zenn.dev/singularity) に公開したもの |
| `blog-en/` | 英語の技術記事 2 本 | 同上 |
| `business-ja/` | 会の文書 3 本 | [社団法人シンギュラリティ・ソサエティ](https://singularitysociety.org) のサイトに公開したもの |

いずれも公開済みの文章です。`chaff.yaml` の `by_path` で、`business-ja/` だけ
`business/report` として、`blog-en/` は英語として検査します。

## これが何の役に立つか

**手で書いた例だけで rule を作ると、実文書で初めて誤検知に気づきます。** 表のセルの
太字を「強調の使いすぎ」と数えていた不具合（#38）は、chaff を chaff 自身の仕様書に
かけて見つかりました。ここにある文書は、その次に効く場所です。

CI でも毎回かけています。落ちはしません（指摘の数は文章の好みの問題なので）が、
**実文書で chaff が異常終了したら CI が赤くなります**。作り物では通るのに実文書で
壊れる、という状態に気づけるようにするためです。
