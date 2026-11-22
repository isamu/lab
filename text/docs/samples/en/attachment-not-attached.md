<!-- chaff-sample
rule: attachment-not-attached
genre: business/email
file: sent.md
-->

# Attachment mentioned but not shown (`attachment-not-attached`)

**Where it helps:** sent emails and letters. Anywhere "please find attached" or "enclosed" promises a file.

## Original

```markdown chaff-before
From: Laura Bennett <laura@example.com>
To: Facilities team <facilities@example.com>
Date: Mon, 12 Oct 2026 09:14:00 +0100
Subject: Quote for the new meeting-room chairs

Hi all,

Please find attached the quote from the furniture supplier for the twelve meeting-room chairs. It includes delivery and the removal of the old chairs.

Could you look it over and tell me by Thursday whether we should go ahead?

Thanks,
Laura
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email sent.md

sent.md   business/email · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    Please find attached the quote from the furniture supplier for the twelve meetin

  ⚠  Attachment mentioned but not shown

     An attachment is mentioned, but no attachment line or file name is shown
     Writing "please find attached" and forgetting the attachment is one of the most common mistakes in work email. The recipient has to ask again, and the exchange takes another round. chaff points out a text that mentions an attachment ("attached", "enclosed") when the document shows none: no attachment field ("Attachment:", "Encl.:"), no file name ("quote.pdf"), and no mailing-list note about a removed attachment. A draft is not checked: its files are attached when sending, so the text never shows them. Only a message as sent or kept, with a From: or Date: header, or a mailing-list archive, is checked.

     → Check that the file is attached. If it is, list it before the signature, as in "Attachment: quote.pdf".

     Relax this rule:  npx chaffjs relax attachment-not-attached


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
From: Laura Bennett <laura@example.com>
To: Facilities team <facilities@example.com>
Date: Mon, 12 Oct 2026 09:14:00 +0100
Subject: Quote for the new meeting-room chairs

Hi all,

Please find attached the quote from the furniture supplier for the twelve meeting-room chairs. It includes delivery and the removal of the old chairs.

Could you look it over and tell me by Thursday whether we should go ahead?

Attachment: chairs-quote.pdf

Thanks,
Laura
```

## How it was fixed

The email says the quote is attached, but nothing in the message shows a file: no attachment line, no file name.
It is the commonest slip in work email, and it costs a round trip: the team writes back to ask for the quote, and the Thursday decision slips a day.

The fix attaches the file and lists it before the signature, "Attachment: chairs-quote.pdf".
Naming the file also tells the reader what to look for, which helps when a thread collects several versions of a quote.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  attachment-not-attached: strict
```

Only a message as sent or kept is checked, one with a From: or Date: header, or a mailing-list archive.
A draft is not checked: its files are attached when it is sent, so the text never shows them.
Phrases that say nothing is attached ("no attachment"), the word used for something else ("attached to the wall"), and mentions inside a quoted reply are not counted.
Only the email and letter genre runs this rule.

```text chaff-explain
$ npx chaffjs explain attachment-not-attached --genre business/email

  Attachment mentioned but not shown   (attachment-not-attached)

  Writing "please find attached" and forgetting the attachment is one of the most common mistakes in work email. The recipient has to ask again, and the exchange takes another round. chaff points out a text that mentions an attachment ("attached", "enclosed") when the document shows none: no attachment field ("Attachment:", "Encl.:"), no file name ("quote.pdf"), and no mailing-list note about a removed attachment. A draft is not checked: its files are attached when sending, so the text never shows them. Only a message as sent or kept, with a From: or Date: header, or a mailing-list archive, is checked.

  How to fix: Check that the file is attached. If it is, list it before the signature, as in "Attachment: quote.pdf".

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax attachment-not-attached --why "reason"
```

[All samples](README.md)
