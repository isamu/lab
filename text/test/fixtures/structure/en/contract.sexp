(doc :language "en" :path "en/contract.txt" :line 1
  (date :value "2024-04-01" :line 3)
  (definition :term "Customer" :line 3)
  (definition :term "Provider" :line 3)
  (article "1" :heading "DEFINITIONS" :label "Article I" :line 5
    (article "1.1" :heading "Definitions" :label "Section 1.1" :line 6
      (definition :term "Services" :line 7)
      (definition :term "Deliverables" :line 8)
      (reference :label "Section 3.2" :target "3.2" :line 8)))
  (article "2" :heading "SERVICES" :label "Article II" :line 10
    (article "2.1" :heading "Performance" :label "Section 2.1" :line 11
      (item "2.1.a" :label "(a)" :line 12
        (obligation :marker "shall" :type "must" :line 12))
      (item "2.1.b" :label "(b)" :line 13
        (obligation :marker "may" :type "may" :line 13)))
    (article "2.2" :heading "Term" :label "Section 2.2" :line 14
      (date :value "2025-03-31" :line 15)
      (reference :label "Section 5.1" :target "5.1" :line 15)))
  (article "3" :heading "FEES" :label "Article III" :line 17
    (article "3.1" :heading "Fees" :label "Section 3.1" :line 18
      (obligation :marker "shall" :type "must" :line 19)
      (quantity :unit "$" :value 5000 :line 19))
    (article "3.2" :heading "Payment" :label "Section 3.2" :line 20
      (item "3.2.a" :label "(a)" :line 21
        (quantity :unit "days" :value 30 :line 21)
        (item "3.2.a.i" :label "(i)" :line 22
          (quantity :unit "percent" :value 1.5 :line 22))
        (item "3.2.a.ii" :label "(ii)" :line 23
          (obligation :marker "shall not" :type "must-not" :line 23)))
      (item "3.2.b" :label "(b)" :line 24
        (obligation :marker "must" :type "must" :line 24))))
  (article "4" :heading "TERMINATION" :label "Article IV" :line 26
    (article "4.1" :heading "Termination for Cause" :label "Section 4.1" :line 27
      (obligation :marker "may" :type "may" :line 28)
      (reference :label "Section 3.2(a)(ii)" :target "3.2.a.ii" :line 28)
      (quantity :unit "business days" :value 15 :line 28))))
