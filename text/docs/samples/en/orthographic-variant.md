<!-- chaff-sample
rule: orthographic-variant
genre: docs/faq
file: faq.md
-->

# One word spelled two ways (`orthographic-variant`)

**Where it helps:** help pages, FAQs, manuals. Any page that several people have edited over the years.

## Original

```markdown chaff-before
# Questions about your account

## How do I change my email address?

Open Settings, choose Profile and type the new address. We send a link to the new email to confirm it.

## I did not get the confirmation email. What now?

Check your spam folder first. If it is not there, ask us to send the email again from the sign-in page.

## Can I have two accounts?

No. Each account needs its own e-mail address, so we can send the receipts to the right person.

## How do I stop the marketing emails?

Use the link at the bottom of any of our emails, or turn them off under Settings.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/faq faq.md

faq.md   docs/faq · English   genre from --genre

─── line 13 ──────────────────────────────────────────────────

    Each account needs its own e-mail address, so we can send the receipts to the right person.

  ·  One word spelled two ways

     "e-mail" here, where the document usually writes "email" (1 of 5)
     Writing one word two ways in one document (e-mail and email, GitHub and Github) makes search treat them as different words and leaves the reader wondering whether two things are meant. chaff does not decide which way is right and keeps no list of words; it groups the document's own words, by reading in Japanese and by spelling without hyphens and case in English, and points at whichever way the document uses less. The case of the first letter is left out, since a sentence or a title gives it (Email, email), and so are words in capitals only, a name in capitals with an ending (SENDs) and the letters of an acronym picked out (CLImatology next to CLIPER). It says nothing when the minority is more than a third, since the document then uses both on purpose.

     → Match the way the rest of the document writes it. If the team has decided, list it under prefer in chaff.yaml, and preferred-term checks that direction from then on.

     Relax this rule:  npx chaffjs relax orthographic-variant


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Questions about your account

## How do I change my email address?

Open Settings, choose Profile and type the new address. We send a link to the new email to confirm it.

## I did not get the confirmation email. What now?

Check your spam folder first. If it is not there, ask us to send the email again from the sign-in page.

## Can I have two accounts?

No. Each account needs its own email address, so we can send the receipts to the right person.

## How do I stop the marketing emails?

Use the link at the bottom of any of our emails, or turn them off under Settings.
```

## How it was fixed

The page writes "email" everywhere except one answer, which writes "e-mail".
A customer searching the help pages for "email address" will not find that answer, and the hyphen makes the answer look as if it came from an older page.

The fix writes "email" there too.
chaff keeps no list of words: it groups the page's own words by their spelling without hyphens and case, and points at the way the page uses less.

## Settings

The rarer spelling is reported while it is at most a third of the word's uses (34% at `normal`, 49% at `strict`, 20% at `relaxed`).
A capital at the start of a word ("Email" at the start of a sentence) is not a spelling, and words in capitals only are left out.

If the team has decided on a spelling, list it under `prefer` (the form to avoid, then the form to use), and `preferred-term` checks that direction in every document:

```yaml chaff-settings
prefer:
  e-mail: email
```

To stop this rule:

```yaml chaff-settings
rules:
  orthographic-variant: off
```

It is off for literature.

```text chaff-explain
$ npx chaffjs explain orthographic-variant --genre docs/faq

  One word spelled two ways   (orthographic-variant)

  Writing one word two ways in one document (e-mail and email, GitHub and Github) makes search treat them as different words and leaves the reader wondering whether two things are meant. chaff does not decide which way is right and keeps no list of words; it groups the document's own words, by reading in Japanese and by spelling without hyphens and case in English, and points at whichever way the document uses less. The case of the first letter is left out, since a sentence or a title gives it (Email, email), and so are words in capitals only, a name in capitals with an ending (SENDs) and the letters of an acronym picked out (CLImatology next to CLIPER). It says nothing when the minority is more than a third, since the document then uses both on purpose.

  How to fix: Match the way the rest of the document writes it. If the team has decided, list it under prefer in chaff.yaml, and preferred-term checks that direction from then on.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when the minority spelling is 49% of the word's uses or less
  → normal   reported when the minority spelling is 34% of the word's uses or less
    relaxed  reported when the minority spelling is 20% of the word's uses or less
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax orthographic-variant --why "reason"
```

[All samples](README.md)
