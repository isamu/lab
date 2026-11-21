<!-- chaff-sample
rule: vague-link-text
genre: business/email
file: email.md
-->

# Link text that does not say where it goes (`vague-link-text`)

**Where it helps:** emails, newsletters, intranet pages, help pages. Any text with links.

## Original

```markdown chaff-before
Subject: Benefits enrolment opens on Monday

Dear all,

Enrolment for next year's health and pension benefits opens on Monday, November 30, and closes on December 11.
To compare the plans, click [here](https://intranet.example.com/benefits/plans).
To enrol, go [here](https://intranet.example.com/benefits/enrol).

Best regards,
People team
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email email.md

email.md   business/email · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    [here](https://intranet.example.com/benefits/plans)

  ⚠  Link text that does not say where it goes

     The link text "here" does not say where it goes
     Link text such as "click here" or "read more" says nothing about where the link goes, so the reader has to reread the sentence around it. A screen reader can list the links on their own, and then hears "here, here, here" with no way to tell them apart (WCAG 2.4.4, link purpose). Only link text that is wholly a word from the lexicon (here, click here, read more, こちら) is reported; text that names the target ("the pricing page") is not.

     → Make the name of the target the link text ("click [here](…) for pricing" → "see the [pricing page](…)").

     Relax this rule:  npx chaffjs relax vague-link-text


─── line 7 ───────────────────────────────────────────────────

    [here](https://intranet.example.com/benefits/enrol)

  ⚠  Link text that does not say where it goes

     The link text "here" does not say where it goes
     Link text such as "click here" or "read more" says nothing about where the link goes, so the reader has to reread the sentence around it. A screen reader can list the links on their own, and then hears "here, here, here" with no way to tell them apart (WCAG 2.4.4, link purpose). Only link text that is wholly a word from the lexicon (here, click here, read more, こちら) is reported; text that names the target ("the pricing page") is not.

     → Make the name of the target the link text ("click [here](…) for pricing" → "see the [pricing page](…)").

     Relax this rule:  npx chaffjs relax vague-link-text


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Benefits enrolment opens on Monday

Dear all,

Enrolment for next year's health and pension benefits opens on Monday, November 30, and closes on December 11.
You can compare the plans on the [benefits plans page](https://intranet.example.com/benefits/plans) and enrol on the [enrolment form](https://intranet.example.com/benefits/enrol).

Best regards,
People team
```

## How it was fixed

Both links say "here".
A reader scanning the email sees two blue "here"s and has to read each sentence to learn which is which; a screen reader that lists the links reads "here, here".
On a phone, one mistap opens the enrolment form instead of the plans.

The fix makes each link say where it goes.
Link text that names its target, even with "here" in it, is not reported.

## Settings

Link text that says nothing is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your house style uses "here" links on purpose, relax it:

```yaml chaff-settings
rules:
  vague-link-text: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain vague-link-text --genre business/email

  Link text that does not say where it goes   (vague-link-text)

  Link text such as "click here" or "read more" says nothing about where the link goes, so the reader has to reread the sentence around it. A screen reader can list the links on their own, and then hears "here, here, here" with no way to tell them apart (WCAG 2.4.4, link purpose). Only link text that is wholly a word from the lexicon (here, click here, read more, こちら) is reported; text that names the target ("the pricing page") is not.

  How to fix: Make the name of the target the link text ("click [here](…) for pricing" → "see the [pricing page](…)").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax vague-link-text --why "reason"
```

[All samples](README.md)
