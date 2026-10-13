# Payslips, bills and statements

Payslips, expense claims, bank and loan statements, bills, checkup results, transcripts, delivery notes, bookings: everyday paperwork is mostly figures and dates.
Its mistakes are figures that do not agree with each other, and dates in the wrong order.
chaff finds them by machine. It does not know which figure is right; the source does.

## What usually goes wrong

Paperwork is often made by copying last month's and changing a few figures.

| Mistake | Example |
| --- | --- |
| A net amount not updated with its deductions | A deduction was corrected, and "Net pay" was not |
| A total that no longer adds up | A row was changed, and the total was not |
| A number with two digits swapped | Employee number 40718 at the top, 40178 at the bottom |
| Dates in the wrong order | A return before the departure, a check-out before the check-in |
| A rate that does not match its figures | Interest that is not the balance at the stated rate |

The reader trusts the figure they need and does not do the sum again.

## Which genre to use

chaff has no genre of its own for paperwork.
Use `business/report` for a document that reports figures: a payslip, a statement, a bill, checkup results, a transcript, a treasurer's report.
Use `business/proposal` for a quote or a price list, which asks the reader to decide.
The checks of figures and dates run the same in both, and in every other business genre.
The genre changes the guide at the top of the screen and a few wording rules.

```bash
npx chaffjs payslip.md --genre business/report    check payslip.md as a report, this run only
npx chaffjs init --genre business/report          write the genre into this folder's chaff.yaml
```

## What chaff checks, and what it does not

Each row was checked with a short document of its kind.
The finding in the last column is what chaff printed.

| Document | What is compared | What chaff says |
| --- | --- | --- |
| Payslip | Net pay and the gross less the deductions ([`net-amount-mismatch`](../../rules/net-amount-mismatch/)) | "$2,587.04" is written, but the gross amount minus the deductions is $2,578.04 |
| Expense claim, quote, invoice | Quantity × unit price and the amount; a total and its rows ([`line-amount-mismatch`](../../rules/line-amount-mismatch/), [`total-mismatch`](../../rules/total-mismatch/)) | The amount £180.00 is not quantity × unit price (2 × £95.00 = £190.00) |
| Bank statement | The closing balance and the opening balance, deposits and withdrawals ([`closing-balance-mismatch`](../../rules/closing-balance-mismatch/)) | "$2,165.56" is written, but the opening balance plus deposits less withdrawals is $2,156.56 |
| Electricity bill | The usage and the difference of the meter readings ([`meter-usage-mismatch`](../../rules/meter-usage-mismatch/)) | The readings' difference (31,420 kWh − 31,050 kWh = 370) is not the usage 390 kWh |
| Loan | The total of payments and the monthly payment × the number of payments ([`installment-total-mismatch`](../../rules/installment-total-mismatch/)) | The payments add up to $7,632.00 ($212.00 × 36), not the total of payments $7,362.00 |
| Checkup results | A BMI and the height and weight ([`bmi-mismatch`](../../rules/bmi-mismatch/)) | BMI 25.0 is written, but the height and weight give 22.5 |
| Transcript | A GPA and the grades and credits ([`gpa-mismatch`](../../rules/gpa-mismatch/)) | The GPA "3.50" is written, but the course grades and credits give 3.25 |
| Delivery note | The delivered and the ordered quantity on one row ([`delivered-over-ordered`](../../rules/delivered-over-ordered/)) | The delivered quantity "600 envelopes" is larger than the ordered quantity "500 envelopes" on the same row |
| Packing list | The net and the gross weight on one row ([`net-over-gross`](../../rules/net-over-gross/)) | The net weight "42.0 kg" is larger than the gross weight "40.5 kg" on the same row |
| Membership statement | A tier and the nights or points that set it ([`tier-threshold-mismatch`](../../rules/tier-threshold-mismatch/)) | The tier "Platinum" needs "30 nights or more stayed last year", but "26 nights" falls in "Gold" |
| Booking, trip | Two dates that come in order ([`due-before-issue`](../../rules/due-before-issue/)) | "Check-out" 10 November 2026 is before "Check-in" 12 November 2026 |
| Any of them | A booking, policy or employee number written two ways ([`reference-number-variant`](../../rules/reference-number-variant/)) | The number PL-48231 is PL-48213 with two neighbouring characters swapped |

How these checks work as a family, and what a finding of this kind means, is in [Numbers and dates that disagree](./numbers-and-dates).

Some things are left out on purpose.

- chaff never rewrites the text. Fixing is the writer's job.
- It does not check that a figure is true. Whether the hotel cost £190.00 is for the receipt to say.
- It knows no tax rates, pay rules or prices. It compares what the document writes with what the same document writes elsewhere.
  The one exception is a Japanese property sale settlement statement: there a brokerage fee written as "consumption tax included" with no rate is checked at 10% ([`formula-amount-mismatch`](../../rules/formula-amount-mismatch/), the `property-sale` profile in [Choosing the kind of document](./configuration#choosing-the-kind-of-document)).
- Figures inside sentences are read less than figures in tables and labelled lines ([What chaff does not read](./numbers-and-dates#what-chaff-does-not-read)).

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The payslip below was saved as `payslip.md`. The names are made up.

```markdown file=payslip.md
# Payslip: October 2026

Employee: Dana Whitfield
Employee number: 40718
Pay period: 1 October 2026 to 31 October 2026
Pay date: 25 September 2026

## Earnings

| Item | Hours | Rate | Amount |
| --- | --- | --- | --- |
| Basic pay | 160 | $18.50 | $2,960.00 |
| Overtime | 12 | $27.75 | $333.00 |
| Gross pay | | | $3,293.00 |

## Deductions

| Item | Amount |
| --- | --- |
| Income tax | $412.00 |
| Social security | $204.17 |
| Pension | $98.79 |
| Total deductions | $714.96 |

## Summary

- Gross pay: $3,293.00
- Total deductions: $714.96
- Net pay: $2,587.04

Questions about this payslip go to payroll, quoting employee number 40178.
```

In the folder that holds the payslip, type:

```bash
npx chaffjs payslip.md --genre business/report --compact    check payslip.md, one line per finding
```

```
$ npx chaffjs payslip.md --genre business/report --compact

payslip.md   business/report · English   genre from --genre

  6:11    error   "Pay date" 25 September 2026 is before the start of the "Pay period", 1 October 2026
                  due-before-issue
  29:12   warning "$2,587.04" is written, but the gross amount minus the deductions is $2,578.04
                  net-amount-mismatch
  31:69   warning The number 40178 is 40718 with two neighbouring characters swapped
                  reference-number-variant

{counts}
```

## What each finding means

| Line | Finding | What it means | Where to look |
| --- | --- | --- | --- |
| 6 | [`due-before-issue`](../../rules/due-before-issue/) | The pay date comes before the pay period starts | The payroll calendar |
| 29 | [`net-amount-mismatch`](../../rules/net-amount-mismatch/) | $3,293.00 less $714.96 is $2,578.04, not $2,587.04 | The deductions table, and the amount actually paid |
| 31 | [`reference-number-variant`](../../rules/reference-number-variant/) | 40178 is 40718 with two digits swapped | The employee record |

The bank transfer was $2,578.04, so the net amount is the one to fix: two digits were swapped there too.
Line 31 is fixed from the employee record, not from the line at the top; either one could have been the slip.

## When a finding is right in general but not here

A pay date before the pay period starts usually means a wrong date.
At this employer, though, salary is paid in advance, on the 25th of the month before, so the date is right.
Put this line just above the paragraph that holds the dates, and say why:

```markdown
<!-- stet: due-before-issue — salary is paid in advance, on the 25th of the month before -->
Employee: Dana Whitfield
```

`stet` marks a spot whose finding is silenced. Write the reason after `—`.
It is a Markdown comment, so nobody reading the payslip sees it.
Run it again: the pay date finding is gone, and the other two are still there.

<!-- chaff-screen: stet -->
```
$ npx chaffjs payslip.md --genre business/report --compact

payslip.md   business/report · English   genre from --genre   1 stet

  30:12   warning "$2,587.04" is written, but the gross amount minus the deductions is $2,578.04
                  net-amount-mismatch
  32:69   warning The number 40178 is 40718 with two neighbouring characters swapped
                  reference-number-variant

{counts}
```

When every payslip your team writes is paid this way, you can change the rule for the team instead of writing `stet` in each one.
`npx chaffjs relax due-before-issue --why "reason"` keeps the finding as a `warning` instead of an `error`, so it no longer fails the run.
`npx chaffjs off due-before-issue --why "reason"` stops it, and with it every other pair of dates it checks, such as a check-out before a check-in.
Either one records the reason in `chaff.yaml` ([Changing how strict a rule is](./configuration#changing-how-strict-a-rule-is)).
For one spot, `stet` is the narrower choice.

## After fixing

The net amount and the employee number are fixed, and the pay date keeps its `stet`.

```markdown file=payslip-fixed.md
# Payslip: October 2026

<!-- stet: due-before-issue — salary is paid in advance, on the 25th of the month before -->
Employee: Dana Whitfield
Employee number: 40718
Pay period: 1 October 2026 to 31 October 2026
Pay date: 25 September 2026

## Earnings

| Item | Hours | Rate | Amount |
| --- | --- | --- | --- |
| Basic pay | 160 | $18.50 | $2,960.00 |
| Overtime | 12 | $27.75 | $333.00 |
| Gross pay | | | $3,293.00 |

## Deductions

| Item | Amount |
| --- | --- |
| Income tax | $412.00 |
| Social security | $204.17 |
| Pension | $98.79 |
| Total deductions | $714.96 |

## Summary

- Gross pay: $3,293.00
- Total deductions: $714.96
- Net pay: $2,578.04

Questions about this payslip go to payroll, quoting employee number 40718.
```

```
$ npx chaffjs payslip-fixed.md --genre business/report --compact

payslip-fixed.md   business/report · English   genre from --genre   1 stet


{counts}
```

No findings means the payslip agrees with itself.
Whether it agrees with the hours worked and the bank transfer is still for payroll to check.

## What to read next

- How the checks of figures and dates work, and what they do not read, is in [Numbers and dates that disagree](./numbers-and-dates).
- How to read the screen, and the three ways to respond to a finding, are in [Getting started](./getting-started).
- Every rule is explained in the [rule reference](../../rules/).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
