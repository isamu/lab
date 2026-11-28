<!-- chaff-sample
rule: running-balance-mismatch
genre: business/report
file: petty-cash.md
-->

# A running balance the row above and this row's amounts do not give (`running-balance-mismatch`)

**Where it helps:** petty cash books, bank statements, loan repayment schedules, stock cards. Any table whose balance moves row by row.

## Original

```markdown chaff-before
# Petty cash book, Hillside Community Centre

November 2026. Kept by the centre manager and checked each Friday.

| Date | Description | Deposit | Withdrawal | Balance |
| --- | --- | --- | --- | --- |
| Nov 2 | Brought forward | | | £150.00 |
| Nov 3 | Milk and tea for the coffee morning | | £8.40 | £141.60 |
| Nov 6 | Cash from the jumble sale | £62.00 | | £203.60 |
| Nov 10 | Light bulbs for the main hall | | £17.95 | £186.65 |
| Nov 13 | Stamps | | £9.20 | £176.45 |

Receipts for every withdrawal are kept in the blue folder in the office.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report petty-cash.md

petty-cash.md   business/report · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    £186.65 |

  ⚠  A running balance the row above and this row's amounts do not give

     The balance "£186.65" is written, but the row above and this row give £185.65
     The "balance after payment" of a repayment schedule, the "balance" of a bank statement and the "on hand" of a stock card are the row above's balance moved by this row. Readers trust them without doing the subtraction again. They go wrong when one figure of a row is corrected and the balance is not, when a digit is mistyped, or when a row is copied from another table. Which column is the balance and which holds a row's movement is decided by the heading words alone (Balance, Principal, Payment, Interest, Deposit, Withdrawal), never by where a column stands. With a principal column, the balance is the row above's less the principal. With no principal column and no interest column, it is the row above's less the payment. With deposit and withdrawal columns, it is the row above's plus the deposit less the withdrawal (a blank cell or a dash is zero). Every written number may be rounded to half its last digit. Only the first row of a table that does not add up is reported: a mistyped balance makes the next row fail too, so the check stops there.

     → Check which of this balance, the one above it and this row's amounts is right, and correct the others.

     Relax this rule:  npx chaffjs relax running-balance-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Petty cash book, Hillside Community Centre

November 2026. Kept by the centre manager and checked each Friday.

| Date | Description | Deposit | Withdrawal | Balance |
| --- | --- | --- | --- | --- |
| Nov 2 | Brought forward | | | £150.00 |
| Nov 3 | Milk and tea for the coffee morning | | £8.40 | £141.60 |
| Nov 6 | Cash from the jumble sale | £62.00 | | £203.60 |
| Nov 10 | Light bulbs for the main hall | | £17.95 | £185.65 |
| Nov 13 | Stamps | | £9.20 | £176.45 |

Receipts for every withdrawal are kept in the blue folder in the office.
```

## How it was fixed

£203.60 less £17.95 for light bulbs is £185.65, but the book says £186.65.
The next row, the stamps, was worked out from the right figure, so the slip is in one cell only and the end balance is correct.
That is exactly what makes it hard to find by eye: on Friday, the cash in the tin agrees with the last line, and the wrong figure in the middle stays in the book for the auditor to question.

The fix works out the balance again and writes £185.65.
chaff reports only the first row that does not add up, since a mistyped balance usually makes the rows after it fail too.

## Settings

A running balance that does not follow is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  running-balance-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

The columns are found by their headings alone (Balance, Principal, Payment, Deposit, Withdrawal).
With deposit and withdrawal columns, each balance is the row above's plus the deposit less the withdrawal; a blank cell counts as zero.
A table needs a date or row-number column, since rows without one may be accounts rather than moments in time.
Every written number may be rounded to half its last digit.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain running-balance-mismatch --genre business/report

  A running balance the row above and this row's amounts do not give   (running-balance-mismatch)

  The "balance after payment" of a repayment schedule, the "balance" of a bank statement and the "on hand" of a stock card are the row above's balance moved by this row. Readers trust them without doing the subtraction again. They go wrong when one figure of a row is corrected and the balance is not, when a digit is mistyped, or when a row is copied from another table. Which column is the balance and which holds a row's movement is decided by the heading words alone (Balance, Principal, Payment, Interest, Deposit, Withdrawal), never by where a column stands. With a principal column, the balance is the row above's less the principal. With no principal column and no interest column, it is the row above's less the payment. With deposit and withdrawal columns, it is the row above's plus the deposit less the withdrawal (a blank cell or a dash is zero). Every written number may be rounded to half its last digit. Only the first row of a table that does not add up is reported: a mistyped balance makes the next row fail too, so the check stops there.

  How to fix: Check which of this balance, the one above it and this row's amounts is right, and correct the others.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax running-balance-mismatch --why "reason"
```

[All samples](README.md)
