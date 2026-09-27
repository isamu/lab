(doc :language "ja" :path "ja/contract.txt" :line 1
  (definition :term "甲" :line 3)
  (definition :term "乙" :line 3)
  (article "1" :heading "目的" :label "第1条" :line 5
    (reference :label "第3条" :target "3" :line 6))
  (article "2" :heading "定義" :label "第2条" :line 8
    (definition :term "成果物" :line 9))
  (article "3" :heading "業務" :label "第3条" :line 11
    (obligation :marker "なければならない" :type "must" :line 12)
    (item "3.1" :label "一" :line 13)
    (item "3.2" :label "二" :line 14)
    (item "3.3" :label "三" :line 15))
  (article "4" :heading "委託料" :label "第4条" :line 17
    (quantity :unit "円" :value 500000 :line 18)
    (item "4.2" :label "２" :line 19
      (quantity :unit "日" :value 30 :line 19)
      (obligation :marker "なければならない" :type "must" :line 19))
    (item "4.3" :label "３" :line 20
      (quantity :unit "%" :value 3 :line 20)
      (obligation :marker "ものとする" :type "must" :line 20)))
  (article "5" :heading "再委託" :label "第5条" :line 22
    (obligation :marker "してはならない" :type "must-not" :line 23))
  (article "6" :heading "契約期間" :label "第6条" :line 25
    (date :value "2024-04-01" :line 26)
    (date :value "2025-03-31" :line 26)
    (item "6.2" :label "２" :line 27
      (quantity :unit "か月" :value 3 :line 27)
      (quantity :unit "年間" :value 1 :line 27)
      (obligation :marker "することができる" :type "may" :line 27)))
  (article "7" :heading "解除" :label "第7条" :line 29
    (reference :label "第4条第2項" :target "4.2" :line 30)
    (reference :label "第5条" :target "5" :line 30)
    (obligation :marker "することができる" :type "may" :line 30)))
