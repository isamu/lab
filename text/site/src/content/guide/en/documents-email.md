# Business email

A business email asks the reader for one thing, and gets an answer.
chaff finds by machine the softeners that pile up when you try to be polite, and the blanks you forgot to fill before sending.
The genre is `business/email`. Letters are checked under the same genre.

## What usually goes wrong

The harder an email tries to be polite, the deeper the request sinks into it.

| What goes wrong | Example |
| --- | --- |
| A sentence too long to follow | "I just wanted to reach out because I was wondering if it might perhaps be possible…" |
| Hedges stacked in one sentence | "might perhaps be possible" |
| A weekday that is wrong | "Friday, October 10, 2026" falls on a Saturday |
| A blank left in | The template's "[Your Name]" was never filled in |

The last one cannot be taken back once it is sent.

## What chaff checks, and what it does not

These are the main rules for this genre.

| Rule | What it finds | When it runs |
| --- | --- | --- |
| `max-sentence-length` | A sentence that runs too long (18 words for this genre) | Always |
| `excessive-hedging` | Hedges stacked until nobody is saying anything | With `--experimental` |
| `cushion-phrase-density` | Softeners ("just wanted to", "sorry to bother") too dense for the length | With `--experimental` |
| `date-weekday-mismatch` | A date whose weekday disagrees with the calendar | With `--experimental` |
| `unfilled-placeholder` | A template blank such as "[Your Name]" | With `--experimental` |
| `risk-disclosure` | A text that gives only the upside and never what to watch for | When an AI reads it, with `npx chaffjs test` |

What it does not do is decided too.

- It does not check names or addresses. Whether "Ms Yamada" is right is for the sender to check.
- It does not check the weekday of a date written without a year, since the year is unknown.
- It does not check whether the attachment is there. chaff reads only the text.
- It does not decide whether the tone suits the reader. It marks where hedges pile up.

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The email was pasted into a text editor and saved as `email.md`.

```markdown
Subject: Meeting to discuss the website redesign

Dear Ms Yamada,

I hope this email finds you well. Thank you again for taking the time to meet with us last week.

I just wanted to reach out because I was wondering if it might perhaps be possible for us to find some time to go through the redesign proposal with you and your team in a little more detail, if that would not be too much trouble.

Sorry to bother you, but would any of the following times work for you?

- Tuesday, October 6, 2026, at 2 pm
- Thursday, October 8, 2026, at 10 am
- Friday, October 10, 2026, at 4 pm

I've attached the slides from our last meeting. If you have any questions, please contact [Your Name] at any time.

Please don't hesitate to let me know if there is anything else I can do. I hope this helps!

Best regards,
Sasaki
```

Run without a genre, chaff sees "Subject:" on the first line and suggests the email genre.

```
$ npx chaffjs email.md --compact

email.md   blog/tech · English   genre from the default
   Looks like: Email and letter. Try --genre business/email

  7:1     warning This sentence runs 46 words (limit 25)
                  max-sentence-length
  17:74   warning Closes with "hope this helps"
                  closing-cliche

2 findings, 97 rules not run
```

Add the genre, as suggested, and the experimental rules too.
`--compact` prints each finding on two lines.

```
$ npx chaffjs email.md --genre business/email --experimental --compact

email.md   business/email · English   genre from --genre

  5:1     info    "hope this email finds you well" and other softeners: 26 per 1000 words (limit 5)
                  cushion-phrase-density
  7:1     info    "just wanted to" and other softeners: 26 per 1000 words (limit 5)
                  cushion-phrase-density
  7:1     info    "i was wondering if" and other softeners: 26 per 1000 words (limit 5)
                  cushion-phrase-density
  7:1     warning This sentence runs 46 words (limit 18)
                  max-sentence-length
  7:58    warning This sentence stacks 2 hedges ("might, perhaps")
                  excessive-hedging
  9:1     info    "sorry to bother" and other softeners: 26 per 1000 words (limit 5)
                  cushion-phrase-density
  13:11   error   2026-10-10 is a Saturday, not a Friday
                  date-weekday-mismatch
  15:91   warning "[Your Name]" was never filled in
                  unfilled-placeholder

8 findings, 31 rules not run
```

Without `--experimental`, only the long sentence on line 7 appears.
The rest are experimental rules, still being checked for wrong findings, so they do not run by default.

## What each finding means

| Line | Finding | What it means | How to fix it |
| --- | --- | --- | --- |
| 5, 7, 9 | `cushion-phrase-density` | Four softeners in one short email; each pushes the request further back | Keep one courtesy at most, and ask plainly |
| 7 | `max-sentence-length` | One sentence of 46 words; the request comes only at the very end | Lead with the request, and split the rest off: "Could we meet to go through the redesign proposal?" |
| 7 | `excessive-hedging` | "might" and "perhaps" in one sentence | Keep one hedge at most, or ask plainly |
| 13 | `date-weekday-mismatch` | October 10, 2026 is a Saturday | Fix the weekday, or the date. The other two times are right |
| 15 | `unfilled-placeholder` | The template blank is still there | Put in the real name. Fix this one before sending, whatever else you leave |

Without a genre, chaff also flagged "I hope this helps!" as a stock closing.
That rule is not used for business documents, so it does not run under the email genre.

## Checks that read meaning go to an AI

`npx chaffjs test` can have an AI read whether the email leaves out something to watch for.
`npx chaffjs test email.md --genre business/email --dry-run` says 1 passage would be sent.
For an email that only asks for a meeting, nothing to watch for may be fine. Read the AI's answer and decide.

## A starter chaff.yaml

Put this `chaff.yaml` in the folder where you draft emails.

```yaml
genre: business/email
language: en

rules:
  excessive-hedging: normal
  cushion-phrase-density: normal
  date-weekday-mismatch: normal
  unfilled-placeholder: normal
```

With this file in place, `npx chaffjs email.md --compact` alone shows all the findings above.
It keeps on the experimental rules that help an email.

## What to read next

- How to silence one spot, and how to relax a rule, are in [Business reports](./documents-report).
- Every rule is explained in the [reference](./reference).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
