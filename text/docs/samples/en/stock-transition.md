<!-- chaff-sample
rule: stock-transition
genre: business/report
file: report.md
-->

# Too many stock transitions (`stock-transition`)

**Where it helps:** quarterly reports, project updates, white papers, blog posts.

## Original

```markdown chaff-before
# Customer support report, third quarter

In the third quarter we answered 4,820 tickets, up from 4,100 in the second quarter.
Most of the rise came in August, when the new billing page went live.

The average first reply took 3 hours and 40 minutes, against 5 hours in the second quarter.
Moreover, the share of tickets closed with a single reply rose from 38% to 46%.
Additionally, we moved the evening shift one hour later, so customers on the west coast now reach a person until 8 pm their time.

Billing questions were the largest group, at 1,350 tickets.
Furthermore, about 600 of them asked the same thing: why an invoice showed two charges in the month of an upgrade.
We wrote a help article on upgrade charges in September, and in the last two weeks of the quarter those tickets fell by half.

Customer satisfaction stayed at 4.4 out of 5.
Notably, the lowest scores came from tickets that were handed between two agents.
In the fourth quarter we will try keeping each ticket with one agent from the first reply to the last, and report the result in January.
We will also add a short survey to tickets that stay open longer than three days, to find out what customers were waiting for.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report report.md

report.md   business/report · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    Moreover, the share of tickets closed with a single reply rose from 38% to 46%.

  ·  Too many stock transitions

     "Moreover" and other stock transitions open 19 sentences per 1000 words (limit 6)
     Opening with "Moreover" or "Additionally" lets a sentence skip saying how it follows from the last. Piled up, the text reads as a list with glue, a habit well known in generated text.

     → Delete the transition and reread. If the link matters, say what it is.

     Relax this rule:  npx chaffjs relax stock-transition


─── line 8 ───────────────────────────────────────────────────

    Additionally, we moved the evening shift one hour later, so customers on the west coast now reach a person until 8 pm th…

  ·  Too many stock transitions

     "Additionally" and other stock transitions open 19 sentences per 1000 words (limit 6)
     Opening with "Moreover" or "Additionally" lets a sentence skip saying how it follows from the last. Piled up, the text reads as a list with glue, a habit well known in generated text.

     → Delete the transition and reread. If the link matters, say what it is.

     Relax this rule:  npx chaffjs relax stock-transition


─── line 11 ──────────────────────────────────────────────────

    Furthermore, about 600 of them asked the same thing: why an invoice showed two charges in the month of an upgrade.

  ·  Too many stock transitions

     "Furthermore" and other stock transitions open 19 sentences per 1000 words (limit 6)
     Opening with "Moreover" or "Additionally" lets a sentence skip saying how it follows from the last. Piled up, the text reads as a list with glue, a habit well known in generated text.

     → Delete the transition and reread. If the link matters, say what it is.

     Relax this rule:  npx chaffjs relax stock-transition


─── line 15 ──────────────────────────────────────────────────

    Notably, the lowest scores came from tickets that were handed between two agents.

  ·  Too many stock transitions

     "Notably" and other stock transitions open 19 sentences per 1000 words (limit 6)
     Opening with "Moreover" or "Additionally" lets a sentence skip saying how it follows from the last. Piled up, the text reads as a list with glue, a habit well known in generated text.

     → Delete the transition and reread. If the link matters, say what it is.

     Relax this rule:  npx chaffjs relax stock-transition


────────────────────────────────────────────────────────────

  4 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Customer support report, third quarter

In the third quarter we answered 4,820 tickets, up from 4,100 in the second quarter.
Most of the rise came in August, when the new billing page went live.

The average first reply took 3 hours and 40 minutes, against 5 hours in the second quarter.
Faster replies did not mean more back and forth: the share of tickets closed with a single reply rose from 38% to 46%.
We also moved the evening shift one hour later, so customers on the west coast now reach a person until 8 pm their time.

Billing questions were the largest group, at 1,350 tickets.
About 600 of them asked the same thing: why an invoice showed two charges in the month of an upgrade.
We wrote a help article on upgrade charges in September, and in the last two weeks of the quarter those tickets fell by half.

Customer satisfaction stayed at 4.4 out of 5.
The lowest scores came from tickets that were handed between two agents.
In the fourth quarter we will try keeping each ticket with one agent from the first reply to the last, and report the result in January.
We will also add a short survey to tickets that stay open longer than three days, to find out what customers were waiting for.
```

## How it was fixed

"Moreover", "Additionally", "Furthermore" and "Notably" open four sentences of a short report.
Each lets a sentence skip saying how it follows from the one before, and the report reads as a list of facts with glue between them.

The fix deletes each transition and rereads.
Two links mattered, so they are written out: faster replies did not cost more back and forth, and the evening shift is something the team also did ("We also moved").
The other two sentences stand on their own without any transition.
Words that carry the argument, such as "However" and "Therefore", are not counted.

## Settings

The rule counts sentences that open with a stock transition, per 1000 words. In English it reports above six per 1000 words; `strict` above four and `relaxed` above ten:

```yaml chaff-settings
rules:
  stock-transition: relaxed
```

A transition inside a sentence and "In addition to …" are not counted. Short documents are not measured, and the rule does not run on legal, documentation, academic, literature or speech genres. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score report.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain stock-transition --genre business/report

  Too many stock transitions   (stock-transition)

  Opening with "Moreover" or "Additionally" lets a sentence skip saying how it follows from the last. Piled up, the text reads as a list with glue, a habit well known in generated text.

  How to fix: Delete the transition and reread. If the link matters, say what it is.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 4 sentences per 1000 words opening with a stock transition
  → normal   up to 6 sentences per 1000 words opening with a stock transition
    relaxed  up to 10 sentences per 1000 words opening with a stock transition
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax stock-transition --why "reason"
```

[All samples](README.md)
