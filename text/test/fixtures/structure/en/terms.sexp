(doc :language "en" :path "en/terms.md" :line 1
  (section "h1" :heading "Terms of Service" :line 1
    (definition :term "Terms" :line 3)
    (article "1" :heading "Acceptance" :label "1" :line 5)
    (article "2" :heading "Accounts" :label "2" :line 9
      (obligation :marker "must" :type "must" :line 11)
      (quantity :unit "years" :value 13 :line 11)
      (item "2.a" :label "(a)" :line 13)
      (item "2.b" :label "(b)" :line 14
        (obligation :marker "must not" :type "must-not" :line 14)))
    (article "3" :heading "Fees" :label "3" :line 16
      (quantity :unit "$" :value 9.99 :line 18)
      (reference :label "Section 2" :target "2" :line 18))))
