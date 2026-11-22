<!-- chaff-sample
rule: share-amount-mismatch
genre: business/report
file: visit-statement.md
-->

# An amount paid that is not the stated share of the total (`share-amount-mismatch`)

**Where it helps:** medical and dental bills, clinic receipts, insurance statements, any split bill. Any table with a total, a share and what was paid.

## Original

```markdown chaff-before
# Statement for your visit

Riverside Physiotherapy Clinic. Visit date: November 12, 2026.

| Service | Total charges | Your share | Amount paid |
| --- | --- | --- | --- |
| Assessment, 45 minutes | $140.00 | 20% | $28.00 |
| Ultrasound therapy | $65.00 | 20% | $12.00 |
| Home exercise plan | $35.00 | 20% | $7.00 |

Your insurer pays the rest directly to the clinic. Please keep this statement for your records.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report visit-statement.md

visit-statement.md   business/report · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    $12.00 |

  ⚠  An amount paid that is not the stated share of the total

     The amount $12.00 is not 20% of the total $65.00 ($13.00)
     On a medical bill or receipt, a 30% patient share of a $600.00 total is $180.00. When the amount paid is not that, the patient cannot tell whether they paid too much or too little. It happens when the total is corrected and the share is not, when another patient's amount is copied, or when the share is mixed up. In a table, the three cells of one row are compared, in the columns whose headings name the total, the share and the amount paid. With no share column, the rate in brackets in the amount's heading (Your share (30%)) or the one share the document states on a line of its own (Patient share: 30%) is used. Outside a table, a "Total:" line is compared with a "Your share:" line below it in the same section.

     → Check the total and the share, and work the amount out again.

     Relax this rule:  npx chaffjs relax share-amount-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Statement for your visit

Riverside Physiotherapy Clinic. Visit date: November 12, 2026.

| Service | Total charges | Your share | Amount paid |
| --- | --- | --- | --- |
| Assessment, 45 minutes | $140.00 | 20% | $28.00 |
| Ultrasound therapy | $65.00 | 20% | $13.00 |
| Home exercise plan | $35.00 | 20% | $7.00 |

Your insurer pays the rest directly to the clinic. Please keep this statement for your records.
```

## How it was fixed

The patient pays 20% of each charge, and the insurer pays the rest.
20% of $65.00 is $13.00, but the statement says $12.00 for the ultrasound.
The other two rows are right, which makes the third look deliberate; a patient who checks it cannot tell whether they were undercharged or whether the share for that service is different.

The fix works out the share again and writes $13.00.
If the share really was different for one service, write that share in its row, and the amount will agree with it.

## Settings

An amount that is not the share of the total is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  share-amount-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

In a table, the three cells of a row are compared, in the columns whose headings name the total, the share and the amount paid.
With no share column, a rate in the amount's heading ("Your share (20%)") or one share stated on a line of its own is used.
Rounding down, to the nearest or up, to the cent, is read as right; an amount written in a sentence is not read.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain share-amount-mismatch --genre business/report

  An amount paid that is not the stated share of the total   (share-amount-mismatch)

  On a medical bill or receipt, a 30% patient share of a $600.00 total is $180.00. When the amount paid is not that, the patient cannot tell whether they paid too much or too little. It happens when the total is corrected and the share is not, when another patient's amount is copied, or when the share is mixed up. In a table, the three cells of one row are compared, in the columns whose headings name the total, the share and the amount paid. With no share column, the rate in brackets in the amount's heading (Your share (30%)) or the one share the document states on a line of its own (Patient share: 30%) is used. Outside a table, a "Total:" line is compared with a "Your share:" line below it in the same section.

  How to fix: Check the total and the share, and work the amount out again.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax share-amount-mismatch --why "reason"
```

[All samples](README.md)
