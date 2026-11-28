<!-- chaff-sample
rule: rent-multiple-mismatch
genre: business/email
file: move-in-costs.md
-->

# A deposit that is not the stated months of rent (`rent-multiple-mismatch`)

**Where it helps:** listings, letters to tenants, lease summaries. Any document that gives a deposit as months of rent.

## Original

```markdown chaff-before
Subject: Move-in costs for Flat 3, 14 Elm Court

Dear Mr Hart,

Thank you for confirming that you will take the flat. Here is what is due before you collect the keys on July 1.

| Item | Amount |
| --- | --- |
| Rent | $1,850 |
| Deposit | 2 months ($3,600) |
| Key cutting | $40 |

The deposit is held in a protected scheme and returned within ten days after you move out.

Kind regards,
Dana Price
Elm Court Lettings
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email move-in-costs.md

move-in-costs.md   business/email · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    | Deposit | 2 months ($3,600) |

  ⚠  A deposit that is not the stated months of rent

     $3,600 is not 2 months of the rent ($1,850)
     When a listing says "Deposit: 2 months ($3,200)", readers prepare the amount without working it out. It goes wrong when the rent is changed and the deposit line is not, or a line is copied from another unit. When a deposit, key money or guarantee states one number of months and one amount, the amount is compared with that many months of the rent stated before it; with several listings on one page, each deposit is compared with the rent just before it. When a service charge or maintenance fee is stated, the months may be of the rent alone or of the rent and the fee, since listings use both and seldom say which. A rent given as a range ("$1,600 to $1,700") accepts any amount in that range of months.

     → Check which of the rent, the months and the amount is right, and correct the others. If the months are of the rent with a fee or with tax, say so.

     Relax this rule:  npx chaffjs relax rent-multiple-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Move-in costs for Flat 3, 14 Elm Court

Dear Mr Hart,

Thank you for confirming that you will take the flat. Here is what is due before you collect the keys on July 1.

| Item | Amount |
| --- | --- |
| Rent | $1,850 |
| Deposit | 2 months ($3,700) |
| Key cutting | $40 |

The deposit is held in a protected scheme and returned within ten days after you move out.

Kind regards,
Dana Price
Elm Court Lettings
```

## How it was fixed

The deposit is "2 months ($3,600)", but the rent is $1,850, and two months of it is $3,700.
The tenant prepares the amount on the page without working it out, and the shortfall turns up at the key handover.
It happens when the rent changes and the deposit line does not, or the line is copied from another flat.

The fix corrects the deposit to $3,700.
If the deposit is meant to be months of rent with a fee or with tax, say so, and it is not compared as rent alone.

## Settings

A deposit that is not the stated months of rent is a warning at the default level, an error at `strict` and a note at `relaxed`.

If your deposits are worked out on another basis, relax it:

```yaml chaff-settings
rules:
  rent-multiple-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain rent-multiple-mismatch --genre business/email

  A deposit that is not the stated months of rent   (rent-multiple-mismatch)

  When a listing says "Deposit: 2 months ($3,200)", readers prepare the amount without working it out. It goes wrong when the rent is changed and the deposit line is not, or a line is copied from another unit. When a deposit, key money or guarantee states one number of months and one amount, the amount is compared with that many months of the rent stated before it; with several listings on one page, each deposit is compared with the rent just before it. When a service charge or maintenance fee is stated, the months may be of the rent alone or of the rent and the fee, since listings use both and seldom say which. A rent given as a range ("$1,600 to $1,700") accepts any amount in that range of months.

  How to fix: Check which of the rent, the months and the amount is right, and correct the others. If the months are of the rent with a fee or with tax, say so.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax rent-multiple-mismatch --why "reason"
```

[All samples](README.md)
