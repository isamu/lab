<!-- chaff-sample
rule: email-subject-length
genre: business/email
file: email.md
-->

# Subject line empty or too long (`email-subject-length`)

**Where it helps:** work emails, especially requests that need a reply.

## Original

```markdown chaff-before
Subject: Question about the invoice you sent last week for the October cleaning work and the extra window visit

Dear accounts team,

Invoice 4471 lists two window visits in October. Our records show one.
Could you check it and send a corrected copy by Friday, November 27?

Best regards,
Sam Ortiz
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email email.md

email.md   business/email · English   genre from --genre

─── line 1 ───────────────────────────────────────────────────

    Subject: Question about the invoice you sent last week for the October cleaning

  ⚠  Subject line empty or too long

     The subject has 102 characters (up to 70)
     Recipients decide from the subject whether to open a message and when. An empty subject says nothing and looks like spam; a long one is cut off in the inbox list before its key words. Only an email with a "Subject:" line is checked, and its value is counted in characters. The "Re:" and "Fwd:" a mail program adds are not counted.

     → Put only the request and a distinguishing word (a date, a project) in the subject, and move the explanation into the body.

     Relax this rule:  npx chaffjs relax email-subject-length


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Invoice 4471: one window visit, not two

Dear accounts team,

Invoice 4471 lists two window visits in October. Our records show one.
Could you check it and send a corrected copy by Friday, November 27?

Best regards,
Sam Ortiz
```

## How it was fixed

The subject has 102 characters, against a limit of 70. In an inbox list it is cut off after "the October cleaning work", and the point, a wrong invoice, is lost.
The reader cannot tell from the list whether this needs action.

The fix puts the invoice number and the question in the subject, and leaves the explanation to the body.
A subject that names a number or a date is also easier to find later.
The "Re:" and "Fwd:" a mail program adds are not counted.

## Settings

The levels are character limits for the subject: `strict` allows 50, the default 70, `relaxed` 90.

```yaml chaff-settings
rules:
  email-subject-length: relaxed
```

To stop checking it, write `off` instead of `relaxed`. It runs only for the email and letter genre (`business/email`).

```text chaff-explain
$ npx chaffjs explain email-subject-length --genre business/email

  Subject line empty or too long   (email-subject-length)

  Recipients decide from the subject whether to open a message and when. An empty subject says nothing and looks like spam; a long one is cut off in the inbox list before its key words. Only an email with a "Subject:" line is checked, and its value is counted in characters. The "Re:" and "Fwd:" a mail program adds are not counted.

  How to fix: Put only the request and a distinguishing word (a date, a project) in the subject, and move the explanation into the body.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 50 characters in the subject
  → normal   up to 70 characters in the subject
    relaxed  up to 90 characters in the subject
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax email-subject-length --why "reason"
```

[All samples](README.md)
