<!-- chaff-sample
rule: period-multiple-mismatch
genre: docs/manual
file: standard-plan.md
-->

# An amount that is not the stated number of payments (`period-multiple-mismatch`)

**Where it helps:** insurance premium tables, subscription price lists, fee schedules. Any page that gives an amount as a number of payments of another.

## Original

```markdown chaff-before
# Pet insurance: the Standard plan

The Standard plan pays 70% of your vet bills, up to $5,000 a year.

## Premiums for a dog aged 1 to 4

| How you pay | Premium |
| --- | --- |
| Monthly | $32 |
| Annually (12 monthly payments) | $364 |

You can switch between monthly and annual payment on your renewal date.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual standard-plan.md

standard-plan.md   docs/manual · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    | $32 | | Annually (12 monthly payments)

  ⚠  An amount that is not the stated number of payments

     $364 is not 12 × the Monthly amount ($32), though it says 12 monthly payments
     When a premium table says "Annually (12 monthly payments) $298", readers trust the figure without working it out. It goes wrong when the monthly premium is changed and the annual line is not. When a count is stated as a number of a base ("12 monthly payments", "12 times the monthly premium") with one amount beside it, the amount is compared with that many of the base stated before it ("Monthly: $24"). An annual premium is often cheaper than twelve monthly ones, so an annual amount that does not say it is twelve monthly payments is never compared.

     → Check which of the base amount, the count and the amount is right, and correct the others. If the amount has a discount or tax in it, say so.

     Relax this rule:  npx chaffjs relax period-multiple-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Pet insurance: the Standard plan

The Standard plan pays 70% of your vet bills, up to $5,000 a year.

## Premiums for a dog aged 1 to 4

| How you pay | Premium |
| --- | --- |
| Monthly | $32 |
| Annually (12 monthly payments) | $384 |

You can switch between monthly and annual payment on your renewal date.
```

## How it was fixed

The annual line says it is 12 monthly payments, and the monthly premium is $32.
Twelve times $32 is $384, not $364.
The monthly premium was probably raised and the annual line kept from the old table, so a customer who pays once a year is quoted a price the insurer will not charge.

The fix corrects the annual amount to $384.
If the annual price really is lower, as a discount for paying at once, say so ("Annually: $364, $20 less than 12 monthly payments") and do not call it 12 monthly payments.
An annual line that does not say it is a number of payments ("Annually $364") is not compared.

## Settings

An amount that is not the stated number of payments is a warning at the default level, an error at `strict` and a note at `relaxed`.

If your price lists state counts that are not meant to be multiplied, relax it:

```yaml chaff-settings
rules:
  period-multiple-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain period-multiple-mismatch --genre docs/manual

  An amount that is not the stated number of payments   (period-multiple-mismatch)

  When a premium table says "Annually (12 monthly payments) $298", readers trust the figure without working it out. It goes wrong when the monthly premium is changed and the annual line is not. When a count is stated as a number of a base ("12 monthly payments", "12 times the monthly premium") with one amount beside it, the amount is compared with that many of the base stated before it ("Monthly: $24"). An annual premium is often cheaper than twelve monthly ones, so an annual amount that does not say it is twelve monthly payments is never compared.

  How to fix: Check which of the base amount, the count and the amount is right, and correct the others. If the amount has a discount or tax in it, say so.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax period-multiple-mismatch --why "reason"
```

[All samples](README.md)
