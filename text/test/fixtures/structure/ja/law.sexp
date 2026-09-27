(doc :language "ja" :path "ja/law.txt" :line 1
  (chapter "pt1" :heading "総則" :label "第一編" :line 1
    (chapter "pt1.ch1" :heading "通則" :label "第一章" :line 2
      (article "1" :heading "趣旨" :label "第一条" :line 4
        (obligation :marker "ものとする" :type "must" :line 5))
      (article "2" :heading "定義" :label "第二条" :line 7
        (definition :term "個人情報" :line 8)
        (item "2.2" :label "２" :line 9
          (definition :term "本人" :line 9))))
    (chapter "pt1.ch2" :heading "義務" :label "第二章" :line 11
      (article "3" :label "第三条" :line 13
        (obligation :marker "しなければならない" :type "must" :line 13)
        (item "3.2" :label "２" :line 14
          (obligation :marker "てはならない" :type "must-not" :line 14)))
      (article "3-2" :label "第三条の二" :line 16
        (item "3-2.1" :label "一" :line 17)
        (item "3-2.2" :label "二" :line 18))))
  (chapter "pt2" :heading "罰則" :label "第二編" :line 20
    (chapter "pt2.ch1" :heading "罰則" :label "第一章" :line 21
      (article "10" :label "第十条" :line 23
        (reference :label "第三条第二項" :target "3.2" :line 23)
        (quantity :unit "年" :value 1 :line 23)
        (quantity :unit "円" :value 1000000 :line 23)))))
