(doc :language "ja" :path "ja/spec.md" :line 1
  (article "1" :heading "概要" :label "1" :line 1
    (article "1.1" :heading "目的" :label "1.1" :line 5
      (quantity :unit "秒" :value 30 :line 7)
      (obligation :marker "しなければならない" :type "must" :line 7))
    (article "1.2" :heading "用語" :label "1.2" :line 9
      (definition :term "注文" :line 11)))
  (article "2" :heading "機能" :label "2" :line 13
    (article "2.1" :heading "注文の登録" :label "2.1" :line 15
      (quantity :unit "回" :value 1 :line 16)
      (quantity :unit "件" :value 100 :line 16))
    (article "2.2" :heading "注文の取消" :label "2.2" :line 18
      (quantity :unit "倍" :value 1.5 :line 20)
      (quantity :unit "秒" :value 2 :line 20)
      (obligation :marker "なければならない" :type "must" :line 20))))
