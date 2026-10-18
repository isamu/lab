# scoria: ジョブ要約の末尾に scoria への導線を入れる

issue: #1466

## 方針

- README のバッジは Actions の実行結果へリンクする。そこで初めて scoria を見た人がたどり着けるよう、要約の末尾に「Measured by scoria <版>」と npm へのリンク、`npx scoria` の一言を出す（英・日）
- npm の URL は `src/home.ts` の定数に置き、SARIF の `informationUri` と共有する
- 版は CLI から渡す。要約の組み立ては純粋なまま。版が渡されなければ出さない
