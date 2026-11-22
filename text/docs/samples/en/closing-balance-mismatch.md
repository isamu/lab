<!-- chaff-sample
rule: closing-balance-mismatch
genre: business/report
file: treasurer-report.md
-->

# A closing balance that is not the opening balance plus deposits less withdrawals (`closing-balance-mismatch`)

**Where it helps:** treasurer's reports, account statements, petty cash summaries, points statements. Any summary that goes from an opening balance to a closing one.

## Original

```markdown chaff-before
# Club treasurer's report, October 2026

Westbrook Cycling Club, current account.

## Account summary

- Opening balance: $3,182.45
- Total deposits: $1,260.00
- Total withdrawals: $947.30
- Closing balance: $3,459.15

## Notes

Deposits are the autumn membership fees. Withdrawals are the hall hire for the annual dinner and the new first-aid kits.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report treasurer-report.md

treasurer-report.md   business/report · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    $3,459.15

  ⚠  A closing balance that is not the opening balance plus deposits less withdrawals

     "$3,459.15" is written, but the opening balance plus deposits less withdrawals is $3,495.15
     On a statement summary the closing balance is the opening balance plus the total deposits less the total withdrawals. The reader takes the closing balance as given and does not add it up again. It goes wrong when a transaction is corrected and the balance is not, when the balance is copied from last month's statement, or when a digit is mistyped. When one table or one section names the balance at the start (Opening balance), the total paid in (Total deposits), the total paid out (Total withdrawals) and the balance at the end (Closing balance) once each, each with an amount, the closing balance is compared with the sum. A table whose header row has the four names is compared row by row, and one whose first column has them column by column. Outside tables, the lines of a section (from one heading to the next) that are only a name and an amount ("Opening balance: $2,418.36") are read. Which words name the four is in the language package's lexicon closing-balance-label. Amounts with a currency mark must agree to the cent. Amounts in thousands, and numbers without a mark, may be rounded, so a difference of up to two steps of their last digit is not reported. A dated note after a name (as of June 30, 2026) is not a unit, and a bare number under a column heading that is a unit word (Points) is read in that unit.

     → Check which of the opening balance, the two totals and the closing balance is right, and correct the others.

     Relax this rule:  npx chaffjs relax closing-balance-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Club treasurer's report, October 2026

Westbrook Cycling Club, current account.

## Account summary

- Opening balance: $3,182.45
- Total deposits: $1,260.00
- Total withdrawals: $947.30
- Closing balance: $3,495.15

## Notes

Deposits are the autumn membership fees. Withdrawals are the hall hire for the annual dinner and the new first-aid kits.
```

## How it was fixed

$3,182.45 plus $1,260.00 less $947.30 is $3,495.15; the report says $3,459.15.
Two digits were swapped when the figure was copied from the bank's website.
The members trust the closing balance without adding it up, and next month's report will start from it: if the mistake is carried forward, the club's books will be $36 out from the bank's until someone goes back to find out why.

The fix adds the summary up again and writes $3,495.15.
If one of the totals was the wrong figure, correct that one, so that the four lines agree.

## Settings

A closing balance that does not add up is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  closing-balance-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

The four amounts are read when one table or one section names the opening balance, the total deposits, the total withdrawals and the closing balance once each.
Amounts with a currency mark must agree to the cent; amounts in thousands, or bare numbers, may be off by up to two steps of their last digit.
A table of transactions row by row (Date, Deposit, Withdrawal, Balance) is the job of `running-balance-mismatch`.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain closing-balance-mismatch --genre business/report

  A closing balance that is not the opening balance plus deposits less withdrawals   (closing-balance-mismatch)

  On a statement summary the closing balance is the opening balance plus the total deposits less the total withdrawals. The reader takes the closing balance as given and does not add it up again. It goes wrong when a transaction is corrected and the balance is not, when the balance is copied from last month's statement, or when a digit is mistyped. When one table or one section names the balance at the start (Opening balance), the total paid in (Total deposits), the total paid out (Total withdrawals) and the balance at the end (Closing balance) once each, each with an amount, the closing balance is compared with the sum. A table whose header row has the four names is compared row by row, and one whose first column has them column by column. Outside tables, the lines of a section (from one heading to the next) that are only a name and an amount ("Opening balance: $2,418.36") are read. Which words name the four is in the language package's lexicon closing-balance-label. Amounts with a currency mark must agree to the cent. Amounts in thousands, and numbers without a mark, may be rounded, so a difference of up to two steps of their last digit is not reported. A dated note after a name (as of June 30, 2026) is not a unit, and a bare number under a column heading that is a unit word (Points) is read in that unit.

  How to fix: Check which of the opening balance, the two totals and the closing balance is right, and correct the others.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax closing-balance-mismatch --why "reason"
```

[All samples](README.md)
