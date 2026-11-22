<!-- chaff-sample
rule: net-amount-mismatch
genre: business/report
file: pay-statement.md
-->

# A net amount that is not the gross amount minus the deductions (`net-amount-mismatch`)

**Where it helps:** pay statements, bonus slips, settlement statements, tax summaries. Any document that ends in "what is left after deductions".

## Original

```markdown chaff-before
# Pay statement, October 2026

Employee: warehouse team, employee no. 0417. Pay date: October 30, 2026.

## Earnings

| Item | Amount |
| --- | --- |
| Regular hours (80 h) | $1,840.00 |
| Overtime (6 h) | $207.00 |

## Deductions

| Item | Amount |
| --- | --- |
| Federal income tax | $162.40 |
| Social Security | $126.91 |
| Medicare | $29.68 |
| Health plan | $84.00 |

## Summary

- Gross pay: $2,047.00
- Total deductions: $402.99
- Net pay: $1,662.01

Net pay is deposited to the account you gave us on your first day.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report pay-statement.md

pay-statement.md   business/report · English   genre from --genre

─── line 25 ──────────────────────────────────────────────────

    $1,662.01

  ⚠  A net amount that is not the gross amount minus the deductions

     "$1,662.01" is written, but the gross amount minus the deductions is $1,644.01
     The "Net pay" of a payslip is the gross pay minus the total deductions. The person paid reads the net and does not subtract again. It goes wrong when a deduction is corrected and the net is not, when the net is copied from last month's payslip, or when a digit is mistyped. When one table or one section names the amount before deductions (Gross pay), the total deductions (Total deductions) and the amount after them (Net pay) once each, each with an amount, the net is compared with the subtraction. A table whose header row has the three names is compared row by row, and one whose first column has them column by column. Outside tables, the lines of a section (from one heading to the next) that are only a name and an amount ("Gross pay: $1,661.00") are read. Where no net is named but a taxable amount is (Taxable income, as on a tax statement), the taxable amount is compared with the same subtraction. Where both are named, the deductions are what is paid out, so only the net is compared. Where the deductions are written one by one instead of as a total, as on a property settlement statement (Purchase price − Earnest money deposit − Loan proceeds = Balance due), they are added up; where a total is written beside them, only the total is taken. Which words name the three is in the language package's lexicon net-amount-label. Amounts with a currency mark must agree to the cent. Amounts in thousands or millions, and numbers without a mark, may be rounded, so a difference of one step of their last digit is not reported.

     → Check which of the gross amount, the deductions and the net is right, and correct the others.

     Relax this rule:  npx chaffjs relax net-amount-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Pay statement, October 2026

Employee: warehouse team, employee no. 0417. Pay date: October 30, 2026.

## Earnings

| Item | Amount |
| --- | --- |
| Regular hours (80 h) | $1,840.00 |
| Overtime (6 h) | $207.00 |

## Deductions

| Item | Amount |
| --- | --- |
| Federal income tax | $162.40 |
| Social Security | $126.91 |
| Medicare | $29.68 |
| Health plan | $84.00 |

## Summary

- Gross pay: $2,047.00
- Total deductions: $402.99
- Net pay: $1,644.01

Net pay is deposited to the account you gave us on your first day.
```

## How it was fixed

Gross pay of $2,047.00 less deductions of $402.99 is $1,644.01, but the statement says $1,662.01.
An $18.00 gap like this is what is left when a deduction is corrected after the net pay was worked out, and the net pay stays as it was.
The employee reads the net pay and nothing else; when the bank deposit comes in $18 short of the statement, the payroll office gets the call.

The fix works the subtraction out again and writes the net pay it gives.
If the net pay was right and a deduction was wrong, correct the deduction instead, so that all three lines agree.

## Settings

A net amount that does not add up is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  net-amount-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

The three amounts are read when one table or one section names the gross amount, the total deductions and the net amount once each ("Gross pay", "Total deductions", "Net pay").
When the deductions are listed one by one with no total, they are added up.
Amounts with a currency mark must agree to the cent; amounts in thousands, or bare numbers, may be rounded by one step of their last digit.
An amount written inside a sentence is not read.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain net-amount-mismatch --genre business/report

  A net amount that is not the gross amount minus the deductions   (net-amount-mismatch)

  The "Net pay" of a payslip is the gross pay minus the total deductions. The person paid reads the net and does not subtract again. It goes wrong when a deduction is corrected and the net is not, when the net is copied from last month's payslip, or when a digit is mistyped. When one table or one section names the amount before deductions (Gross pay), the total deductions (Total deductions) and the amount after them (Net pay) once each, each with an amount, the net is compared with the subtraction. A table whose header row has the three names is compared row by row, and one whose first column has them column by column. Outside tables, the lines of a section (from one heading to the next) that are only a name and an amount ("Gross pay: $1,661.00") are read. Where no net is named but a taxable amount is (Taxable income, as on a tax statement), the taxable amount is compared with the same subtraction. Where both are named, the deductions are what is paid out, so only the net is compared. Where the deductions are written one by one instead of as a total, as on a property settlement statement (Purchase price − Earnest money deposit − Loan proceeds = Balance due), they are added up; where a total is written beside them, only the total is taken. Which words name the three is in the language package's lexicon net-amount-label. Amounts with a currency mark must agree to the cent. Amounts in thousands or millions, and numbers without a mark, may be rounded, so a difference of one step of their last digit is not reported.

  How to fix: Check which of the gross amount, the deductions and the net is right, and correct the others.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax net-amount-mismatch --why "reason"
```

[All samples](README.md)
