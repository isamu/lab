(doc :language "en" :path "en/statute.txt" :line 1
  (chapter "pt1" :heading "GENERAL PROVISIONS" :label "Part I" :line 1
    (chapter "pt1.ch1" :heading "PRELIMINARY" :label "Chapter 1" :line 2
      (article "101" :heading "Short title" :label "Section 101" :line 4
        (obligation :marker "may" :type "may" :line 5))
      (article "102" :heading "Definitions" :label "Section 102" :line 7
        (definition :term "personal data" :line 8)))
    (chapter "pt1.ch2" :heading "DUTIES" :label "Chapter 2" :line 10
      (article "201" :heading "Duty of care" :label "Section 201" :line 12
        (item "201.a" :label "(a)" :line 13
          (obligation :marker "shall" :type "must" :line 13))
        (item "201.b" :label "(b)" :line 14
          (obligation :marker "shall not" :type "must-not" :line 14)
          (quantity :unit "years" :value 5 :line 14)
          (item "201.b.1" :label "(1)" :line 15)))))
  (chapter "pt2" :heading "ENFORCEMENT" :label "Part II" :line 17
    (chapter "pt2.ch1" :heading "PENALTIES" :label "Chapter 1" :line 18
      (article "301" :heading "Penalty" :label "Section 301" :line 20
        (reference :label "Section 201(b)" :numbering "section" :target "201.b" :line 21)
        (quantity :unit "$" :value 10000 :line 21)))))
