<!-- chaff-sample
rule: cushion-phrase-density
genre: business/email
file: invoice-email.md
-->

# Too many softeners (`cushion-phrase-density`)

**Where it helps:** emails, requests, reminders. Anywhere you ask someone for something and worry about sounding pushy.

## Original

```markdown chaff-before
Subject: Invoice for the September workshop

Hi Dana,

Sorry to bother you, but I just wanted to check on the invoice for the September workshop.
If you don't mind, could you look at whether it was paid?
I hate to ask again, but our finance team needs it closed this month.

Thanks,
Chris
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email invoice-email.md

invoice-email.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    Sorry to bother you, but I just wanted to check on the invoice for the September workshop.

  ·  Too many softeners

     "sorry to bother" and other softeners: 58 per 1000 words (limit 5)
     One softener is courtesy. Several push the point further away, and the reader has to hunt for it.

     → Keep the first one. Lead with the request after that.

     Relax this rule:  npx chaffjs relax cushion-phrase-density


─── line 5 ───────────────────────────────────────────────────

    Sorry to bother you, but I just wanted to check on the invoice for the September workshop.

  ·  Too many softeners

     "just wanted to" and other softeners: 58 per 1000 words (limit 5)
     One softener is courtesy. Several push the point further away, and the reader has to hunt for it.

     → Keep the first one. Lead with the request after that.

     Relax this rule:  npx chaffjs relax cushion-phrase-density


─── line 6 ───────────────────────────────────────────────────

    If you don't mind, could you look at whether it was paid?

  ·  Too many softeners

     "if you don't mind" and other softeners: 58 per 1000 words (limit 5)
     One softener is courtesy. Several push the point further away, and the reader has to hunt for it.

     → Keep the first one. Lead with the request after that.

     Relax this rule:  npx chaffjs relax cushion-phrase-density


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Invoice for the September workshop

Hi Dana,

Sorry to bother you. Could you check whether the invoice for the September workshop has been paid?
Our finance team needs to close it by 30 October, so a reply by Friday would help.

Thanks,
Chris
```

## How it was fixed

Each softener on its own is polite. Three in the first two sentences push the request to the back: Dana has to read past "sorry to bother you", "just wanted to" and "if you don't mind" to find out that a question is being asked at all, and "I hate to ask again" follows.

The fix keeps the first softener, so the email stays warm, and then states the request plainly.
It also adds what the softeners were hiding: when finance needs the answer.
The email is shorter, and no less polite.

## Settings

The rule counts softeners per 1000 words.
A short email is measured as if it were as long as a short letter, so at `normal` the third softener in an email is the first one reported; one alone is never reported.

```yaml chaff-settings
rules:
  cushion-phrase-density: relaxed
```

`strict` allows up to two per 1000 words, `normal` five and `relaxed` ten.
It runs on business documents.
It does not run on legal text, manuals, papers, literature or transcripts, where the register is part of the form.

```text chaff-explain
$ npx chaffjs explain cushion-phrase-density --genre business/email

  Too many softeners   (cushion-phrase-density)

  One softener is courtesy. Several push the point further away, and the reader has to hunt for it.

  How to fix: Keep the first one. Lead with the request after that.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 2 softeners per 1000 words
  → normal   up to 5 softeners per 1000 words
    relaxed  up to 10 softeners per 1000 words
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax cushion-phrase-density --why "reason"
```

[All samples](README.md)
