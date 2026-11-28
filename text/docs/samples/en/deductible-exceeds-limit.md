<!-- chaff-sample
rule: deductible-exceeds-limit
genre: docs/manual
file: dental-cover.md
-->

# A deductible larger than the most paid (`deductible-exceeds-limit`)

**Where it helps:** insurance summaries, benefit guides, policy wording. Any page that gives an excess or a deductible and a limit for the same benefit.

## Original

```markdown chaff-before
# Dental cover: what you can claim

Your plan pays towards check-ups, fillings and emergency visits at any registered dentist.

## Check-ups

The check-up excess is $80 a visit, and the most we pay for a visit is $50.
You can claim for two check-ups a year.

## Emergency visits

The emergency excess is $40 a claim, and the most we pay for a claim is $300.

Send your claim with the dentist's receipt within 90 days of the visit.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual dental-cover.md

dental-cover.md   docs/manual · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    $80 a visit, and the most we pay for a visit is $50.

  ⚠  A deductible larger than the most paid

     The excess of $80 is more than the most paid, $50: this benefit would never pay out
     When a summary says "The excess is $80 a visit, and the most we pay for a visit is $50", the benefit reads as one that never pays. It happens when the excess or the limit is changed and the other is not, or when a figure is copied from another benefit. One sentence holding one deductible word (excess, deductible) and one limit word (the most we pay, maximum, limit, up to), each with exactly one amount of money right after it, is read as one benefit and the two amounts are compared, in the same currency and scale. What each amount is stated for is read too (a visit, a claim, a single item, a day). The same basis is compared, and so is a limit with no basis (the most paid for the whole benefit). An excess per claim is compared with a limit per item: a claim for one item meets the whole excess and is paid at most one item's limit. An excess with no basis is read as one per claim. Bases that do not nest, such as a day and a claim, are not compared. One currency written two ways ($ and US$) is one currency. Which words name which basis is in the language package's lexicon deductible-basis.

     → Check which of the deductible and the limit is right and correct the other.

     Relax this rule:  npx chaffjs relax deductible-exceeds-limit


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Dental cover: what you can claim

Your plan pays towards check-ups, fillings and emergency visits at any registered dentist.

## Check-ups

The check-up excess is $20 a visit, and the most we pay for a visit is $50.
You can claim for two check-ups a year.

## Emergency visits

The emergency excess is $40 a claim, and the most we pay for a claim is $300.

Send your claim with the dentist's receipt within 90 days of the visit.
```

## How it was fixed

With an excess of $80 and at most $50 paid for a visit, a check-up claim would never pay anything.
The $80 belongs to another plan's emergency cover; it was pasted into the check-up line when the summary was put together.
A member reading this concludes that check-ups are not covered, and an insurer that publishes it has a complaint waiting.

The fix gives the check-up excess its real figure, $20.
The emergency line was already right: $40 is less than the $300 limit, and the rule says nothing about it.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  deductible-exceeds-limit: relaxed
```

One sentence with one excess or deductible and one limit, each with one amount, is read as one benefit.
What each amount is for (a visit, a claim, a single item, a day) is read too, and only bases that nest are compared.
A deductible equal to the limit, a range, "about", and amounts in different sentences or currencies are left alone.

```text chaff-explain
$ npx chaffjs explain deductible-exceeds-limit --genre docs/manual

  A deductible larger than the most paid   (deductible-exceeds-limit)

  When a summary says "The excess is $80 a visit, and the most we pay for a visit is $50", the benefit reads as one that never pays. It happens when the excess or the limit is changed and the other is not, or when a figure is copied from another benefit. One sentence holding one deductible word (excess, deductible) and one limit word (the most we pay, maximum, limit, up to), each with exactly one amount of money right after it, is read as one benefit and the two amounts are compared, in the same currency and scale. What each amount is stated for is read too (a visit, a claim, a single item, a day). The same basis is compared, and so is a limit with no basis (the most paid for the whole benefit). An excess per claim is compared with a limit per item: a claim for one item meets the whole excess and is paid at most one item's limit. An excess with no basis is read as one per claim. Bases that do not nest, such as a day and a claim, are not compared. One currency written two ways ($ and US$) is one currency. Which words name which basis is in the language package's lexicon deductible-basis.

  How to fix: Check which of the deductible and the limit is right and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax deductible-exceeds-limit --why "reason"
```

[All samples](README.md)
