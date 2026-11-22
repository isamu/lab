<!-- chaff-sample
rule: reference-number-variant
genre: business/email
file: booking.md
-->

# Booking or reference number with two characters swapped (`reference-number-variant`)

**Where it helps:** booking confirmations, receipts, policy letters, order emails. Any document that writes the same reference number twice.

## Original

```markdown chaff-before
Subject: Your table at Sora Kitchen on Friday, June 5

Dear Ms Lee,

Thank you for booking with us. Your table for four is confirmed for Friday, June 5, 2026, at 7:30 PM.

Booking number: SK-30762

If your plans change, please call us at least a day ahead and give your booking number, SK-30726.

We look forward to seeing you.

Sora Kitchen
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email booking.md

booking.md   business/email · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    SK-30726.

  ⚠  Booking or reference number with two characters swapped

     The number SK-30726 is SK-30762 with two neighbouring characters swapped
     A confirmation or a receipt writes its booking number more than once: at the top, and again where it says how to cancel or whom to call. When one place reads MN-48251 for MN-48215, the reader cannot tell which to quote, and the wrong one finds no booking. Two neighbouring characters swapped is the commonest slip in typing a number. chaff compares the numbers written right after labels of the same kind (Booking number, Confirmation number) and reports one that is another with two neighbouring characters swapped.

     → Check which number is right and correct the other.

     Relax this rule:  npx chaffjs relax reference-number-variant


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Your table at Sora Kitchen on Friday, June 5

Dear Ms Lee,

Thank you for booking with us. Your table for four is confirmed for Friday, June 5, 2026, at 7:30 PM.

Booking number: SK-30762

If your plans change, please call us at least a day ahead and give your booking number, SK-30762.

We look forward to seeing you.

Sora Kitchen
```

## How it was fixed

The booking number is SK-30762 at the top and SK-30726 in the line about changing the booking.
The last two digits are swapped, the commonest slip in typing a number.
A guest who calls with the second number finds no booking.

The fix writes the same number in both places.
chaff compares numbers after labels of the same kind (booking number, confirmation number, policy number) and reports one that is another with two neighbouring characters swapped.
Numbers of different kinds, such as a booking number and an order number, are never compared.

## Settings

A number with two characters swapped is a warning at the default level, an error at `strict` and still a warning at `relaxed`.

To stop checking it, turn it off:

```yaml chaff-settings
rules:
  reference-number-variant: off
```

```text chaff-explain
$ npx chaffjs explain reference-number-variant --genre business/email

  Booking or reference number with two characters swapped   (reference-number-variant)

  A confirmation or a receipt writes its booking number more than once: at the top, and again where it says how to cancel or whom to call. When one place reads MN-48251 for MN-48215, the reader cannot tell which to quote, and the wrong one finds no booking. Two neighbouring characters swapped is the commonest slip in typing a number. chaff compares the numbers written right after labels of the same kind (Booking number, Confirmation number) and reports one that is another with two neighbouring characters swapped.

  How to fix: Check which number is right and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  warning
    off      not checked

  Options (set under options in chaff.yaml):
    listed_kinds: [item, model]   (default)
      Kinds of number a document lists many of (reference-label groups). Two labelled or tabled numbers of such a kind are never compared; only one with no label is

  Set one:  write options: { reference-number-variant: { <name>: <value> } } in chaff.yaml

  Now: normal.

  Change it:  npx chaffjs relax reference-number-variant --why "reason"
```

[All samples](README.md)
