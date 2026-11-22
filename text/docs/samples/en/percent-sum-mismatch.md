<!-- chaff-sample
rule: percent-sum-mismatch
genre: business/report
file: survey.md
-->

# Shares of a whole that do not add up to 100% (`percent-sum-mismatch`)

**Where it helps:** survey results, budget breakdowns, market-share tables, reports. Any breakdown of a whole into percentages.

## Original

```markdown chaff-before
# Visitor survey: summer season

We asked 640 visitors to the museum how they first heard about us.

Breakdown of answers:

| Source | Share |
| --- | --- |
| Friends or family | 43% |
| Social media | 27% |
| Our website | 18% |
| Local newspaper | 9% |
| Tourist office | 8% |
| Other | 6% |

Word of mouth is still the biggest source, so the autumn plan puts more into the members' referral scheme.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report survey.md

survey.md   business/report · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    43% |

  ⚠  Shares of a whole that do not add up to 100%

     The shares add up to 111%, not 100%
     When the shares of a whole do not add up to 100%, the reader has to work out which figure is wrong or which item is missing. It happens when an item is added or removed, or when one figure is changed. The percentages are added only when the column's header, or the sentence or heading right above the list or the table, names the parts of a whole (breakdown, market share, composition). A column whose header is only "Weight", "Share", "Percentage" or "Proportion" (a unit in brackets aside) is added too, unless the sentence or heading right above the table, or one of its rows, names a rate (growth, interest rate, year over year). A breakdown written in one sentence ("software made up 50% of sales, maintenance 30% and training 25%") is added too, when the sentence has such a word and three or more percentages, or when its last percentage is the rest of the whole ("other 5%"), which only the parts of one whole have, unless a word for which way values moved stands right next to a percentage (grew 45%). Rounding is allowed, up to half the last digit per item (at least one point).

     → Check the figures. Correct the wrong one, or add the missing item (such as "Other").

     Relax this rule:  npx chaffjs relax percent-sum-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Visitor survey: summer season

We asked 640 visitors to the museum how they first heard about us.

Breakdown of answers:

| Source | Share |
| --- | --- |
| Friends or family | 34% |
| Social media | 27% |
| Our website | 18% |
| Local newspaper | 9% |
| Tourist office | 8% |
| Other | 6% |

Word of mouth is still the biggest source, so the autumn plan puts more into the members' referral scheme.
```

## How it was fixed

Every visitor gave one answer, so the shares should add up to 100%, and these add up to 111%.
The survey sheet says 34% for friends and family; the two digits were swapped when the figure was typed into the table.
It is the largest figure in the table and the one the next sentence builds a plan on, so the board reading it would overrate word of mouth by nine points.

The fix restores 34%, and the shares add up to 100% again.
When a breakdown falls short instead, the usual cause is a missing row, and the fix is to add it ("Other").

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  percent-sum-mismatch: relaxed
```

The percentages are added only when the column's header, or the sentence or heading right above the table, names the parts of a whole (breakdown, share, composition).
A sum within rounding of 100% (half a point for each figure, and at least one point) is read as right.
Rates (growth, interest), multiple-answer counts, signed changes (+3%) and a table with a total row are not added.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain percent-sum-mismatch --genre business/report

  Shares of a whole that do not add up to 100%   (percent-sum-mismatch)

  When the shares of a whole do not add up to 100%, the reader has to work out which figure is wrong or which item is missing. It happens when an item is added or removed, or when one figure is changed. The percentages are added only when the column's header, or the sentence or heading right above the list or the table, names the parts of a whole (breakdown, market share, composition). A column whose header is only "Weight", "Share", "Percentage" or "Proportion" (a unit in brackets aside) is added too, unless the sentence or heading right above the table, or one of its rows, names a rate (growth, interest rate, year over year). A breakdown written in one sentence ("software made up 50% of sales, maintenance 30% and training 25%") is added too, when the sentence has such a word and three or more percentages, or when its last percentage is the rest of the whole ("other 5%"), which only the parts of one whole have, unless a word for which way values moved stands right next to a percentage (grew 45%). Rounding is allowed, up to half the last digit per item (at least one point).

  How to fix: Check the figures. Correct the wrong one, or add the missing item (such as "Other").

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax percent-sum-mismatch --why "reason"
```

[All samples](README.md)
