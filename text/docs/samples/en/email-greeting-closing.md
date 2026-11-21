<!-- chaff-sample
rule: email-greeting-closing
genre: business/email
file: email.md
-->

# Email without a greeting or a closing (`email-greeting-closing`)

**Where it helps:** work emails and letters, especially ones to a group or to someone outside the team.

## Original

```markdown chaff-before
Subject: Room change for Thursday's workshop

The workshop on Thursday has moved from Room 4 to Room 7 on the second floor.
The start time is still 10:00.

Please bring the printed agenda.

Dana Price
Facilities
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email email.md

email.md   business/email · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    The workshop on Thursday has moved from Room 4 to Room 7 on the second floor.

  ·  Email without a greeting or a closing

     The email does not open with a greeting
     A work email is expected to open with a greeting and end with a closing. Without the greeting it reads as a bare demand; without the closing it looks cut off. Both go missing when a draft is pasted in or the body is copied from an earlier email. chaff points out a body whose first lines hold no greeting ("Dear", "Hi", "Hello") or whose last lines, the name and contact lines included, hold no closing ("Best regards", "Sincerely", "Thanks"). The words come from a lexicon.

     → Open with a greeting such as "Dear Ms Lee," and end with a closing such as "Best regards," before your name.

     Relax this rule:  npx chaffjs relax email-greeting-closing


─── line 9 ───────────────────────────────────────────────────

    Facilities

  ·  Email without a greeting or a closing

     The email does not end with a closing
     A work email is expected to open with a greeting and end with a closing. Without the greeting it reads as a bare demand; without the closing it looks cut off. Both go missing when a draft is pasted in or the body is copied from an earlier email. chaff points out a body whose first lines hold no greeting ("Dear", "Hi", "Hello") or whose last lines, the name and contact lines included, hold no closing ("Best regards", "Sincerely", "Thanks"). The words come from a lexicon.

     → Open with a greeting such as "Dear Ms Lee," and end with a closing such as "Best regards," before your name.

     Relax this rule:  npx chaffjs relax email-greeting-closing


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Room change for Thursday's workshop

Dear workshop attendees,

The workshop on Thursday has moved from Room 4 to Room 7 on the second floor.
The start time is still 10:00.

Please bring the printed agenda.

Best regards,
Dana Price
Facilities
```

## How it was fixed

The email starts with the news and ends with the sender's name.
It reads like a notice pinned to a wall: correct, but abrupt, and to a reader outside the team a little cold.
This often happens when the body is pasted in from a chat message.

The fix adds a greeting before the first line and a closing before the name.
Nothing in the message itself changed.

## Settings

A missing greeting or closing is a note at the default level and a warning at `strict`.

`relaxed` keeps it a note. If your team writes short internal emails without a greeting on purpose, turn it off:

```yaml chaff-settings
rules:
  email-greeting-closing: off
```

It runs only for the email and letter genre (`business/email`).

```text chaff-explain
$ npx chaffjs explain email-greeting-closing --genre business/email

  Email without a greeting or a closing   (email-greeting-closing)

  A work email is expected to open with a greeting and end with a closing. Without the greeting it reads as a bare demand; without the closing it looks cut off. Both go missing when a draft is pasted in or the body is copied from an earlier email. chaff points out a body whose first lines hold no greeting ("Dear", "Hi", "Hello") or whose last lines, the name and contact lines included, hold no closing ("Best regards", "Sincerely", "Thanks"). The words come from a lexicon.

  How to fix: Open with a greeting such as "Dear Ms Lee," and end with a closing such as "Best regards," before your name.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax email-greeting-closing --why "reason"
```

[All samples](README.md)
