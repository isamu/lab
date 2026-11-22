<!-- chaff-sample
rule: latin-abbreviation-form
genre: docs/manual
file: library-card.md
-->

# e.g. or i.e. missing a period (`latin-abbreviation-form`)

**Where it helps:** help pages, forms, instructions. Places where "e.g." and "i.e." introduce the detail a reader needs.

## Original

```markdown chaff-before
# Renewing your library card

You can renew your card at any branch or online.
Bring one document that shows your current address, e.g a recent bill or a bank statement.

Cards last three years. If yours has run out, ie. the date on the back has passed, you can still renew it, and your loans stay on your account.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual library-card.md

library-card.md   docs/manual · English   genre from --genre

─── line 4 ───────────────────────────────────────────────────

    Bring one document that shows your current address, e.g a recent bill or a bank statement.

  ·  e.g. or i.e. missing a period

     "e.g" has some of its periods but not all
     "e.g." and "i.e." take all their periods ("e.g.") or none ("eg", as GOV.UK writes it). With only some ("e.g", "eg.") they read as a slip. The abbreviations are listed in the lexicon.

     → Write all the periods ("e.g.") or none ("eg"), as the rest of the document does.

     Relax this rule:  npx chaffjs relax latin-abbreviation-form


─── line 6 ───────────────────────────────────────────────────

    If yours has run out, ie.

  ·  e.g. or i.e. missing a period

     "ie." has some of its periods but not all
     "e.g." and "i.e." take all their periods ("e.g.") or none ("eg", as GOV.UK writes it). With only some ("e.g", "eg.") they read as a slip. The abbreviations are listed in the lexicon.

     → Write all the periods ("e.g.") or none ("eg"), as the rest of the document does.

     Relax this rule:  npx chaffjs relax latin-abbreviation-form


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Renewing your library card

You can renew your card at any branch or online.
Bring one document that shows your current address, e.g. a recent bill or a bank statement.

Cards last three years. If yours has run out, i.e. the date on the back has passed, you can still renew it, and your loans stay on your account.
```

## How it was fixed

"e.g." and "i.e." take all their periods, or none at all as some house styles write them ("eg", "ie").
With only some ("e.g", "ie.") they read as a slip, and the reader pauses at the very word that was supposed to lead into the example.

The fix writes both with all their periods, as most English documents do.
A page that writes "eg" and "ie" throughout is not reported: that is a house style, and chaff takes no side on it.

## Settings

At `strict` and `normal` the first one is reported; `relaxed` waits until there are 2.

```yaml chaff-settings
rules:
  latin-abbreviation-form: relaxed
```

The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain latin-abbreviation-form --genre docs/manual

  e.g. or i.e. missing a period   (latin-abbreviation-form)

  "e.g." and "i.e." take all their periods ("e.g.") or none ("eg", as GOV.UK writes it). With only some ("e.g", "eg.") they read as a slip. The abbreviations are listed in the lexicon.

  How to fix: Write all the periods ("e.g.") or none ("eg"), as the rest of the document does.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once there is 1
  → normal   reported once there is 1
    relaxed  reported once there are 2
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax latin-abbreviation-form --why "reason"
```

[All samples](README.md)
