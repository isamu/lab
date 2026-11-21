<!-- chaff-sample
rule: max-sentence-length
genre: business/email
file: email.md
-->

# Sentence too long (`max-sentence-length`)

**Where it helps:** work emails, notices, instructions. Anything that asks the reader to do several things in order.

## Original

```markdown chaff-before
Subject: Office move on Friday

Hi all,

As most of you know, we are moving to the third floor this week, and because the movers need the old room empty by Thursday evening, please pack your desk into the crates that facilities will leave by the lifts on Wednesday, label each crate with your name and new desk number, and take anything you need over the weekend home with you, since the new floor will stay locked until Monday morning.

The new desk plan is pinned in the kitchen.
If your name is missing from it, tell me by Wednesday.

Thanks,
Priya
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email email.md

email.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    As most of you know, we are moving to the third floor this week, and because the movers need the old room empty by Thurs…

  ·  Sentence too long

     This sentence runs 73 words (limit 18)
     In a long sentence the reader loses the subject before reaching the verb.

     → Split it in two at the conjunction.

     Relax this rule:  npx chaffjs relax max-sentence-length


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Office move on Friday

Hi all,

We are moving to the third floor this week.
The movers need the old room empty by Thursday evening.
On Wednesday, facilities will leave crates by the lifts.
Please pack your desk into them and label each crate with your name and new desk number.
The new floor stays locked until Monday morning, so take home anything you need over the weekend.

The new desk plan is pinned in the kitchen.
If your name is missing from it, tell me by Wednesday.

Thanks,
Priya
```

## How it was fixed

The first paragraph is one sentence of 73 words.
It holds a reason, a deadline, three things to do and a warning, and the reader has to keep all of them in mind until the full stop.
Someone skimming the email on a phone sees "As most of you know" and the move, and misses that the crates must be labelled.

The fix gives each fact and each task its own sentence, in the order people will need them: when, where the crates are, what to do with them, what to take home.
"As most of you know" went too; it tells the reader nothing.

## Settings

The rule counts words in a sentence. In an email it reports a sentence over 18 words; `strict` reports one over 12 and `relaxed` one over 25.
Other genres have their own limits (see the `explain` output below): a report or a manual allows longer sentences than an email.

If your team writes longer sentences on purpose, relax the rule:

```yaml chaff-settings
rules:
  max-sentence-length: relaxed
```

The rule does not run on literature or on a verbatim transcript, where sentence length is the author's or the speaker's.

```text chaff-explain
$ npx chaffjs explain max-sentence-length --genre business/email

  Sentence too long   (max-sentence-length)

  In a long sentence the reader loses the subject before reaching the verb.

  How to fix: Split it in two at the conjunction.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 12 words in a sentence
  → normal   up to 18 words in a sentence
    relaxed  up to 25 words in a sentence
    off      not checked

  These numbers are for business/email. technical / blog / blog/essay / business / docs / legal / legal/statute / docs/glossary / academic have numbers of their own.

  Now: normal.

  Change it:  npx chaffjs relax max-sentence-length --why "reason"
```

[All samples](README.md)
