<!-- chaff-sample
rule: installment-total-mismatch
genre: business/proposal
file: payment-plan.md
-->

# A total of payments that is not the payments added up (`installment-total-mismatch`)

**Where it helps:** payment plans, loan offers, finance agreements, school trip letters paid in instalments. Any document that gives a number of payments, a payment and a total.

## Original

```markdown chaff-before
# Payment plan: upright piano, Model U-121

Thank you for choosing to spread the cost of your piano. Your plan is set out below.

- Cash price: $4,560.00
- Number of payments: 36
- Monthly payment: $132.50
- Total of payments: $4,860.00

The first payment is taken on the 1st of the month after delivery. You can pay off the balance early at any time with no charge.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal payment-plan.md

payment-plan.md   business/proposal · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    - Monthly payment: $132.50 - Total of pa

  ⚠  A total of payments that is not the payments added up

     The payments add up to $4,770.00 ($132.50 × 36), not the total of payments $4,860.00
     When a loan or installment plan says "48 monthly payments of $537.50; total of payments $25,800", readers trust the total without multiplying. It goes wrong when the plan is redone with another rate or term and the payment or the total is left as it was. When the number of payments, the regular payment and the total of payments are each stated once, the number times the payment is compared with the total; a first or final payment stated apart is added as written (first + payment × the rest + final). Without labels, the payments of one sentence ("47 payments of $550.53 and 1 payment of $550.71") are added up. Each regular payment may be rounded by half its last written digit. When a school trip or camp notice lists numbered instalments as table rows or list items ("1st payment: £150", "Final payment: $60") and states the cost in the same section ("The trip costs £300 per student"), the instalments are added up and compared with the cost.

     → Check which of the number of payments, the payment and the total is right, and correct the others. If a first or final payment absorbs the rounding, state its amount.

     Relax this rule:  npx chaffjs relax installment-total-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Payment plan: upright piano, Model U-121

Thank you for choosing to spread the cost of your piano. Your plan is set out below.

- Cash price: $4,560.00
- Number of payments: 36
- Monthly payment: $135.00
- Total of payments: $4,860.00

The first payment is taken on the 1st of the month after delivery. You can pay off the balance early at any time with no charge.
```

## How it was fixed

Thirty-six payments of $132.50 come to $4,770.00, but the plan says $4,860.00.
The total is right for payments of $135.00, so the monthly figure is the one left over from an earlier draft.
A customer comparing the plan with the cash price of $4,560.00 reads the total to see what spreading the cost really adds; if the monthly figure is wrong, the first direct debit will not be what they agreed to.

The fix writes the monthly payment that the total and the number of payments give.
If the total was the wrong figure instead, correct the total, so that all three agree.

## Settings

A total that does not add up is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  installment-total-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

The rule compares the number of payments times the regular payment with the total of payments, when each is stated once; a first or final payment stated apart is added as written.
Each regular payment may be rounded by half its last written digit.
A plan with a deposit, a balloon or a deferred payment, an amount marked "about", and two plans side by side are not compared.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain installment-total-mismatch --genre business/proposal

  A total of payments that is not the payments added up   (installment-total-mismatch)

  When a loan or installment plan says "48 monthly payments of $537.50; total of payments $25,800", readers trust the total without multiplying. It goes wrong when the plan is redone with another rate or term and the payment or the total is left as it was. When the number of payments, the regular payment and the total of payments are each stated once, the number times the payment is compared with the total; a first or final payment stated apart is added as written (first + payment × the rest + final). Without labels, the payments of one sentence ("47 payments of $550.53 and 1 payment of $550.71") are added up. Each regular payment may be rounded by half its last written digit. When a school trip or camp notice lists numbered instalments as table rows or list items ("1st payment: £150", "Final payment: $60") and states the cost in the same section ("The trip costs £300 per student"), the instalments are added up and compared with the cost.

  How to fix: Check which of the number of payments, the payment and the total is right, and correct the others. If a first or final payment absorbs the rounding, state its amount.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax installment-total-mismatch --why "reason"
```

[All samples](README.md)
