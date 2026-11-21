<!-- chaff-sample
rule: email-stock-courtesy
genre: business/email
file: email.md
-->

# Stock email courtesies piled up (`email-stock-courtesy`)

**Where it helps:** reminders, requests, follow-ups. Short work emails where the request should be the first thing the reader sees.

## Original

```markdown chaff-before
Subject: Invoice 2291 for the October workshop

Hi Dana,

I hope this email finds you well.
I'm writing about invoice 2291 for the October workshop.
It was due on 15 November, and our records show it is still open.
Could you let me know by Friday when we can expect payment?
I apologize for any inconvenience this may cause.
Please don't hesitate to contact me if anything is unclear.

Best regards,
Sam
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email email.md

email.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    I hope this email finds you well.

  ·  Stock email courtesies piled up

     "hope this email finds you well" and other stock courtesies in 3 sentences (2 needed)
     "I hope this email finds you well", "I apologize for any inconvenience" and "Please don't hesitate" are each ordinary politeness. Two or three in one short email crowd out the request, and the email reads like a generated draft.

     → Keep the one courtesy you mean most. Replace the others with the request itself or a specific line (a date, what the reader should do).

     Relax this rule:  npx chaffjs relax email-stock-courtesy


─── line 9 ───────────────────────────────────────────────────

    I apologize for any inconvenience this may cause.

  ·  Stock email courtesies piled up

     "apologize for any inconvenience" and other stock courtesies in 3 sentences (2 needed)
     "I hope this email finds you well", "I apologize for any inconvenience" and "Please don't hesitate" are each ordinary politeness. Two or three in one short email crowd out the request, and the email reads like a generated draft.

     → Keep the one courtesy you mean most. Replace the others with the request itself or a specific line (a date, what the reader should do).

     Relax this rule:  npx chaffjs relax email-stock-courtesy


─── line 10 ──────────────────────────────────────────────────

    Please don't hesitate to contact me if anything is unclear.

  ·  Stock email courtesies piled up

     "please don't hesitate" and other stock courtesies in 3 sentences (2 needed)
     "I hope this email finds you well", "I apologize for any inconvenience" and "Please don't hesitate" are each ordinary politeness. Two or three in one short email crowd out the request, and the email reads like a generated draft.

     → Keep the one courtesy you mean most. Replace the others with the request itself or a specific line (a date, what the reader should do).

     Relax this rule:  npx chaffjs relax email-stock-courtesy


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Invoice 2291 for the October workshop

Hi Dana,

Invoice 2291 for the October workshop was due on 15 November.
Our records show it is still open.
Could you let me know by Friday when we can expect payment?
If it has already gone out, the payment date is enough for me to match it.

Thanks,
Sam
```

## How it was fixed

The email has one job: to ask when invoice 2291 will be paid.
Around that request sit three courtesies ("I hope this email finds you well", "I apologize for any inconvenience", "please don't hesitate to contact me"), and the reader has to find the question among them.
Apologising for a reminder about an unpaid invoice also sends a mixed message.

The corrected email opens with the invoice and the date, asks the question, and adds one useful line instead of the courtesies: what Dana can send if it has already been paid.
It is shorter, and it is still polite.

## Settings

The rule reports once two sentences of an email hold a stock courtesy; `relaxed` waits for three:

```yaml chaff-settings
rules:
  email-stock-courtesy: relaxed
```

It runs on emails (`business/email`); the other genres turn it off. A single courtesy is not reported. "Reach out" and "if you have any questions" are not counted, since human reports and notices use them as much.

```text chaff-explain
$ npx chaffjs explain email-stock-courtesy --genre business/email

  Stock email courtesies piled up   (email-stock-courtesy)

  "I hope this email finds you well", "I apologize for any inconvenience" and "Please don't hesitate" are each ordinary politeness. Two or three in one short email crowd out the request, and the email reads like a generated draft.

  How to fix: Keep the one courtesy you mean most. Replace the others with the request itself or a specific line (a date, what the reader should do).

  Levels:
    strict   reported once 2 sentences hold a stock courtesy
  → normal   reported once 2 sentences hold a stock courtesy
    relaxed  reported once 3 sentences hold a stock courtesy
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax email-stock-courtesy --why "reason"
```

[All samples](README.md)
