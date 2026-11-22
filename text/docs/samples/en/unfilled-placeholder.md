<!-- chaff-sample
rule: unfilled-placeholder
genre: business/email
file: interview-invite.md
-->

# Unfilled placeholder (`unfilled-placeholder`)

**Where it helps:** emails and letters made from a template, and drafts an AI wrote with blanks to fill in.

## Original

```markdown chaff-before
Subject: Your interview with us

Dear [Name],

Thank you for applying for the role of office manager.
We would like to invite you to an interview at our office on Harbour Street.
It is on [Insert Date] and will last about an hour. Please bring a form of photo ID.

Kind regards,
Jo Lane
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email interview-invite.md

interview-invite.md   business/email · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    Dear [Name],

  ⚠  Unfilled placeholder

     "[Name]" was never filled in
     "[Your Name]", "[Insert Date]" and "[Candidate Name]" are the blanks a template or a generated draft leaves. A value that only says "TODO: …" or "TBD" is a blank too, left to fill in later, and so is an instruction line from the template left in a filled report ("OPTIONAL: General conclusions …"). This is not a matter of style: the blank was never filled. In a Japanese business document, the blank marks (〇〇) left where a name, a sum, a date, an address or a phone number belongs (〇〇様, 株式会社〇〇, 〇万円, 氏名：〇〇, 03-〇〇〇〇) are blanks too. A blank left in a table cell counts as well.

     → Fill it in. If it is meant as an example, say so ("for example, Jane Smith").

     Relax this rule:  npx chaffjs relax unfilled-placeholder


─── line 7 ───────────────────────────────────────────────────

    It is on [Insert Date] and will last about an hour.

  ⚠  Unfilled placeholder

     "[Insert Date]" was never filled in
     "[Your Name]", "[Insert Date]" and "[Candidate Name]" are the blanks a template or a generated draft leaves. A value that only says "TODO: …" or "TBD" is a blank too, left to fill in later, and so is an instruction line from the template left in a filled report ("OPTIONAL: General conclusions …"). This is not a matter of style: the blank was never filled. In a Japanese business document, the blank marks (〇〇) left where a name, a sum, a date, an address or a phone number belongs (〇〇様, 株式会社〇〇, 〇万円, 氏名：〇〇, 03-〇〇〇〇) are blanks too. A blank left in a table cell counts as well.

     → Fill it in. If it is meant as an example, say so ("for example, Jane Smith").

     Relax this rule:  npx chaffjs relax unfilled-placeholder


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Your interview with us

Dear Ms Reyes,

Thank you for applying for the role of office manager.
We would like to invite you to an interview at our office on Harbour Street.
It is on Tuesday 4 March at 10 am and will last about an hour. Please bring a form of photo ID.

Kind regards,
Jo Lane
```

## How it was fixed

"[Name]" and "[Insert Date]" are the template's blanks, and they were never filled.
Sent like this, the candidate learns two things: that they got a form letter, and that nobody read it before it went out.
They also still do not know when to come.

The fix fills in both blanks, the candidate's name and the date and time of the interview.

## Settings

Every blank is reported, from the first one.
At `normal` it is a warning; `strict` makes it an error and `relaxed` a note.

"TODO: …" and "TBD" left as a value count as blanks too.
Markdown links, checkboxes, a label followed by its value ("[Date]: 2024-04-01"), code and blanks under a heading that names a template ("## Template") are not reported.

```yaml chaff-settings
rules:
  unfilled-placeholder: relaxed
```

The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain unfilled-placeholder --genre business/email

  Unfilled placeholder   (unfilled-placeholder)

  "[Your Name]", "[Insert Date]" and "[Candidate Name]" are the blanks a template or a generated draft leaves. A value that only says "TODO: …" or "TBD" is a blank too, left to fill in later, and so is an instruction line from the template left in a filled report ("OPTIONAL: General conclusions …"). This is not a matter of style: the blank was never filled. In a Japanese business document, the blank marks (〇〇) left where a name, a sum, a date, an address or a phone number belongs (〇〇様, 株式会社〇〇, 〇万円, 氏名：〇〇, 03-〇〇〇〇) are blanks too. A blank left in a table cell counts as well.

  How to fix: Fill it in. If it is meant as an example, say so ("for example, Jane Smith").

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax unfilled-placeholder --why "reason"
```

[All samples](README.md)
