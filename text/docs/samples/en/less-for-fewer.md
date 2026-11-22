<!-- chaff-sample
rule: less-for-fewer
genre: business/report
file: delivery-review.md
-->

# "Less" with a countable plural (`less-for-fewer`)

**Where it helps:** reports, reviews, proposals. Formal writing where numbers are the point.

## Original

```markdown chaff-before
# Delivery review, second quarter

Since we moved to the new routing system in April, drivers have made less mistakes on their rounds, and customers have sent less complaints.
Late deliveries fell from 6% of all deliveries to 4%.

The system needed less training than we planned for, and every driver had finished it by the end of May.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report delivery-review.md

delivery-review.md   business/report · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    Since we moved to the new routing system in April, drivers have made less mistakes on their rounds, and customers have s…

  ·  "Less" with a countable plural

     "less mistakes" counts things; write "fewer mistakes"
     Written English uses "less" for an amount and "fewer" for a count ("less time", "fewer errors"). "Less errors" and "less people" are common in speech, but a formal reader takes them as a slip. Only a "less" directly before a noun that reads clearly as a countable plural is reported. "Less" after a noun or a number means "minus" ("revenue less costs") and is not reported.

     → Use "fewer" before a countable plural ("less errors" becomes "fewer errors"). To speak of an amount, use a word for the amount ("less work").

     Relax this rule:  npx chaffjs relax less-for-fewer


─── line 3 ───────────────────────────────────────────────────

    Since we moved to the new routing system in April, drivers have made less mistakes on their rounds, and customers have s…

  ·  "Less" with a countable plural

     "less complaints" counts things; write "fewer complaints"
     Written English uses "less" for an amount and "fewer" for a count ("less time", "fewer errors"). "Less errors" and "less people" are common in speech, but a formal reader takes them as a slip. Only a "less" directly before a noun that reads clearly as a countable plural is reported. "Less" after a noun or a number means "minus" ("revenue less costs") and is not reported.

     → Use "fewer" before a countable plural ("less errors" becomes "fewer errors"). To speak of an amount, use a word for the amount ("less work").

     Relax this rule:  npx chaffjs relax less-for-fewer


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Delivery review, second quarter

Since we moved to the new routing system in April, drivers have made fewer mistakes on their rounds, and customers have sent fewer complaints.
Late deliveries fell from 6% of all deliveries to 4%.

The system needed less training than we planned for, and every driver had finished it by the end of May.
```

## How it was fixed

Written English uses "less" for an amount and "fewer" for things you can count.
"Less mistakes" and "less complaints" are common in speech, but a manager reading a quarterly review may take them as a slip, and that is not what a page of good results should be remembered for.

The fix writes "fewer" before the two plurals.
"Less training" stays as it was: training is an amount, not a count, and chaff does not report it.

## Settings

This rule sets no limit to count to; its level decides how a finding is marked.
At `normal` and `relaxed` it is a note, and `strict` makes it a warning.

"Less" before an amount ("less time"), before an adjective ("less experienced staff"), meaning minus ("revenue less costs"), "less than", and nouns spelled alike in both numbers ("less data") are not reported.

```yaml chaff-settings
rules:
  less-for-fewer: off
```

The rule does not run on fiction, poetry, plays or speeches, where "less people" in dialogue is the voice.

```text chaff-explain
$ npx chaffjs explain less-for-fewer --genre business/report

  "Less" with a countable plural   (less-for-fewer)

  Written English uses "less" for an amount and "fewer" for a count ("less time", "fewer errors"). "Less errors" and "less people" are common in speech, but a formal reader takes them as a slip. Only a "less" directly before a noun that reads clearly as a countable plural is reported. "Less" after a noun or a number means "minus" ("revenue less costs") and is not reported.

  How to fix: Use "fewer" before a countable plural ("less errors" becomes "fewer errors"). To speak of an amount, use a word for the amount ("less work").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax less-for-fewer --why "reason"
```

[All samples](README.md)
