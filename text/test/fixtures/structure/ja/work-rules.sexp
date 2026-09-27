(doc :language "ja" :path "ja/work-rules.txt" :line 1
  (chapter "ch1" :heading "総則" :label "第1章" :line 3
    (article "1" :heading "目的" :label "第1条" :line 5)
    (article "2" :heading "適用範囲" :label "第2条" :line 8))
  (chapter "ch2" :heading "勤務" :label "第2章" :line 11
    (chapter "ch2.1" :heading "労働時間及び休憩" :label "第1節" :line 12
      (article "3" :heading "労働時間" :label "第3条" :line 14
        (quantity :unit "日" :value 1 :line 15)
        (quantity :unit "時間" :value 8 :line 15)
        (quantity :unit "週" :value 1 :line 15)
        (quantity :unit "時間" :value 40 :line 15)
        (item "3.2" :label "２" :line 16
          (quantity :unit "分" :value 60 :line 16)))
      (article "4" :heading "休日" :label "第4条" :line 18
        (item "4.1" :label "一" :line 20)
        (item "4.2" :label "二" :line 21)
        (item "4.3" :label "三" :line 22
          (date :value "12-29" :line 22)
          (date :value "01-03" :line 22))))
    (chapter "ch2.2" :heading "休暇" :label "第2節" :line 24
      (article "5" :heading "年次有給休暇" :label "第5条" :line 26
        (quantity :unit "か月" :value 6 :line 27)
        (quantity :unit "割" :value 8 :line 27)
        (quantity :unit "日" :value 10 :line 27))))
  (chapter "ch3" :heading "服務" :label "第3章" :line 29
    (article "6" :heading "遵守事項" :label "第6条" :line 31
      (obligation :marker "なければならない" :type "must" :line 32)
      (item "6.1" :label "（1）" :line 33)
      (item "6.2" :label "（2）" :line 34
        (reference :label "第5条" :target "5" :line 34)))))
