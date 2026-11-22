<!-- chaff-sample
rule: phone-number-variant
genre: business/press-release
file: recall.md
-->

# Phone number with two digits swapped (`phone-number-variant`)

**Where it helps:** recall notices, flyers, event notices, websites. Any document that gives the same number in more than one place.

## Original

```markdown chaff-before
# Recall: Brightway travel kettle, model TK-200

Brightway is recalling the TK-200 travel kettle sold between March and August 2026. The base can overheat if the kettle boils dry.

Stop using the kettle and unplug it. Call us at 1-800-555-0147 for a free replacement or a full refund. You do not need a receipt.

## Contact

Recall line: 1-800-555-0174, open every day from 8 AM to 8 PM Eastern Time.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release recall.md

recall.md   business/press-release · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    1-800-555-0174, open every day from 8 AM to 8 PM Eastern Time.

  ⚠  Phone number with two digits swapped

     The phone number 1-800-555-0174 is 1-800-555-0147 with two neighbouring digits swapped
     A contact number is written more than once: at the top and the bottom, under "How to apply" and under "Contact". When one place reads 0120-123-465 for 0120-123-456, the reader cannot tell which is right and may call the wrong one. Two neighbouring digits swapped is the commonest slip in typing a number. chaff compares the numbers written after labels of the same kind (Phone, Tel, call) and reports one that is another with two neighbouring digits swapped.

     → Check which number is right and correct the other.

     Relax this rule:  npx chaffjs relax phone-number-variant


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Recall: Brightway travel kettle, model TK-200

Brightway is recalling the TK-200 travel kettle sold between March and August 2026. The base can overheat if the kettle boils dry.

Stop using the kettle and unplug it. Call us at 1-800-555-0147 for a free replacement or a full refund. You do not need a receipt.

## Contact

Recall line: 1-800-555-0147, open every day from 8 AM to 8 PM Eastern Time.
```

## How it was fixed

The notice gives the recall line twice, and the two numbers end differently: 0147 in the text, 0174 under Contact.
Two neighbouring digits swapped is the commonest slip in typing a number, and it is nearly invisible: both look like the same number at a glance.
On a recall notice it matters more than anywhere: a customer who calls the wrong number reaches a stranger or nobody, and keeps using a kettle that can overheat.

The recall line is 1-800-555-0147, so the fix corrects the number under Contact to match.
A number that appears in two places is worth checking against the source each time.

## Settings

The rule is a warning at `normal` and `relaxed`, and an error at `strict`:

```yaml chaff-settings
rules:
  phone-number-variant: strict
```

Only numbers with a label (phone, tel, call) or a desk's name (Recall line, Customer Care) before them on their line are read, and numbers of different kinds (a phone and a fax number) are never compared.
Numbers that differ in one digit (a main line and a direct line often do) and swaps of digits that are not neighbours are not reported.
A number is 9 to 13 digits, grouped by hyphens or brackets, or by spaces right after its label.
It does not run on literature, whose numbers are made up, or on speech, where a misspoken number is written as it was said.
A slip in an email or postal address is the job of `contact-variant`.

```text chaff-explain
$ npx chaffjs explain phone-number-variant --genre business/press-release

  Phone number with two digits swapped   (phone-number-variant)

  A contact number is written more than once: at the top and the bottom, under "How to apply" and under "Contact". When one place reads 0120-123-465 for 0120-123-456, the reader cannot tell which is right and may call the wrong one. Two neighbouring digits swapped is the commonest slip in typing a number. chaff compares the numbers written after labels of the same kind (Phone, Tel, call) and reports one that is another with two neighbouring digits swapped.

  How to fix: Check which number is right and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax phone-number-variant --why "reason"
```

[All samples](README.md)
