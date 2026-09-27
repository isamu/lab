(doc :language "en" :path "en/spec.md" :line 1
  (article "1" :heading "Introduction" :label "1" :line 1
    (date :value "2024-04-01" :line 3)
    (article "1.1" :heading "Scope" :label "1.1" :line 5
      (obligation :marker "must" :type "must" :line 7)))
  (article "2" :heading "Operations" :label "2" :line 9
    (article "2.1" :heading "Create an order" :label "2.1" :line 11
      (obligation :marker "may" :type "may" :line 12))
    (article "2.2" :heading "Cancel an order" :label "2.2" :line 14
      (quantity :unit "days" :value 2.5 :line 16)
      (obligation :marker "may" :type "may" :line 16))))
