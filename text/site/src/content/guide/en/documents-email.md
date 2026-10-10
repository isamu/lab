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
| `max-sentence-length` | A sentence that runs too long (18 words for this genre) | Always (info) |
| `excessive-hedging` | Hedges stacked until nobody is saying anything | Always |
| `cushion-phrase-density` | Softeners ("just wanted to", "sorry to bother") too dense for the length | Always (info) |
| `date-weekday-mismatch` | A date whose weekday disagrees with the calendar | Always |
| `unfilled-placeholder` | A template blank such as "[Your Name]" | Always |
| `risk-disclosure` | A text that gives only the upside and never what to watch for | When an AI reads it, with `npx chaffjs test` |

What it does not do is decided too.

- It does not check names or addresses. Whether "Ms Yamada" is right is for the sender to check.
- It does not check the weekday of a date when no date in the document gives a year, since the year is unknown. When one does, a date without its year is read in the year that puts it within five months of that dated date, and its weekday is checked.
- It does not check whether the attachment is there. chaff reads only the text.
- It does not decide whether the tone suits the reader. It marks where hedges pile up.

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The email was pasted into a text editor and saved as `email.md`.

```markdown file=email.md
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
`--compact` prints each finding on two lines.

```
$ npx chaffjs email.md --compact

email.md   blog/tech · English   genre from the default
   Looks like: Email and letter. Try --genre business/email

  7:1     info    This sentence runs 46 words (limit 40)
                  max-sentence-length
  7:58    warning This sentence stacks 2 hedges ("might, perhaps")
                  excessive-hedging
  13:11   error   October 10, 2026 is a Saturday, not a Friday
                  date-weekday-mismatch
  15:91   warning "[Your Name]" was never filled in
                  unfilled-placeholder
  17:74   warning Closes with "hope this helps"
                  closing-cliche

{counts}
```

Read as a tech blog, the sentence limit is a blog's, and the softeners are not counted.
Add the genre, as suggested.

```
$ npx chaffjs email.md --genre business/email --compact

email.md   business/email · English   genre from --genre

  5:1     info    "hope this email finds you well" and other softeners: 26 per 1000 words (limit 5)
                  cushion-phrase-density
  7:1     info    "just wanted to" and other softeners: 26 per 1000 words (limit 5)
                  cushion-phrase-density
  7:1     info    "i was wondering if" and other softeners: 26 per 1000 words (limit 5)
                  cushion-phrase-density
  7:1     info    This sentence runs 46 words (limit 18)
                  max-sentence-length
  7:58    warning This sentence stacks 2 hedges ("might, perhaps")
                  excessive-hedging
  9:1     info    "sorry to bother" and other softeners: 26 per 1000 words (limit 5)
                  cushion-phrase-density
  13:11   error   October 10, 2026 is a Saturday, not a Friday
                  date-weekday-mismatch
  15:1    warning An attachment is mentioned, but no attachment line or file name is shown
                  attachment-not-attached
  15:91   warning "[Your Name]" was never filled in
                  unfilled-placeholder

{counts}
```

`info` is information you may skip; it never fails a run.
These rules report on many emails people write too, so they report at that level.

## The guide that comes first

With the genre set, chaff opens the report with the genre's guide: what a good business email does, as questions to check the draft against.
Under them is a line naming the rules that matter most for this genre.
Most of the questions are ones no rule can answer, so read them before the findings.
An AI that rewrites the text works to the same lines ([Using the guide with an AI](./ai-sounding#give-the-ai-the-genres-guide)).

```
$ npx chaffjs email.md --genre business/email

Guide: Email and letter (business/email)

  Before the findings below, check the draft against these.

  - Do the subject and the first two lines give the purpose and what the reader should do?
  - Does each request have a deadline (a date, not "soon")?
  - Is everything said to be attached actually attached?
  - Are the greeting, the closing and the signature in place?

  Rules that matter most for this genre: attachment-not-attached, cushion-phrase-density, email-greeting-closing, email-subject-length, preamble-length, request-without-deadline, risk-disclosure, unsourced-number
  Change it with guide: in chaff.yaml; leave it out with --no-guide.

════════════════════════════════════════════════════════════

email.md   business/email · English   genre from --genre
…
```

A genre that was guessed from the path or the content, or left at the default, prints no guide.
A guide for the wrong kind of document would mislead.
`--compact` and `--no-guide` leave it out.
A team changes the lines with `guide:` in `chaff.yaml` ([Changing the genre's guide](./configuration#changing-the-genres-guide)).

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
```

With this file in place, `npx chaffjs email.md --compact` alone shows all the findings above,
without `--genre` each time.

## What to read next

- How to silence one spot, and how to relax a rule, are in [Business reports](./documents-report).
- Every rule is explained in the [reference](./reference).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
