<!-- chaff-sample
rule: no-em-dash
genre: business/press-release
file: notice.md
-->

# Too many dashes (`no-em-dash`)

**Where it helps:** announcements, press releases, reports, blog posts.

## Original

```markdown chaff-before
# New delivery slots from 1 March

From 1 March, customers in the city can choose a two-hour delivery slot — morning, midday or evening — when they place an order.
Until now, a delivery could arrive at any time between 8 am and 6 pm, and about one order in ten came back because nobody was home.

The slots are free on orders over 40 pounds.
Below that, a slot costs 2 pounds — the same as the old fee for a named day — and the open window stays free.

Drivers will see the slot on their route sheet and plan the day around it.
If a driver is running late, the customer gets a text with the new time — usually within 30 minutes — before the slot ends.

The evening slot runs from 6 pm to 8 pm and is limited to 200 orders a day while we hire more drivers.
Once it is full, the website shows the next free evening.

We will review the slots at the end of April — with the return rate as the main measure — and decide then whether to extend them to the towns around the city.
Questions from customers about slots go to the delivery team, not to the general support queue.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release notice.md

notice.md   business/press-release · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    From 1 March, customers in the city can choose a two-hour delivery slot — morning, midday or evening — when they place a…

  ·  Too many dashes

     38 dashes per 1000 words (limit 8)
     In English a dash is a legitimate tool, and a heavy hand with it is also one of the better-known marks of generated text. On its own it says little; it counts toward the composite signal. An en dash between two numbers (45–58, 10:00–10:15) marks a range and is not counted. Nor is a dash that ends a paragraph and introduces the list below it, as a colon would, or one that opens its line (an interviewer's turn marked ――, a sign-off such as — Nina, a rule drawn across the page): it sets off no words.

     → A comma or a pair of brackets usually reads better.

     Relax this rule:  npx chaffjs relax no-em-dash


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# New delivery slots from 1 March

From 1 March, customers in the city can choose a two-hour delivery slot (morning, midday or evening) when they place an order.
Until now, a delivery could arrive at any time between 8 am and 6 pm, and about one order in ten came back because nobody was home.

The slots are free on orders over 40 pounds.
Below that, a slot costs 2 pounds, the same as the old fee for a named day, and the open window stays free.

Drivers will see the slot on their route sheet and plan the day around it.
If a driver is running late, the customer gets a text with the new time before the slot ends, usually within 30 minutes.

The evening slot runs from 6 pm to 8 pm and is limited to 200 orders a day while we hire more drivers.
Once it is full, the website shows the next free evening.

At the end of April we will review the slots, with the return rate as the main measure.
We will then decide whether to extend them to the towns around the city.
Questions from customers about slots go to the delivery team, not to the general support queue.
```

## How it was fixed

In English a dash is a legitimate tool, and one or two in a notice are fine.
This notice has eight, four pairs of them, and each pair interrupts a sentence with an aside, so the reader keeps holding the main sentence open while the aside goes by.
A heavy hand with dashes is also one of the better-known marks of generated text.

The fix uses a pair of brackets for the list of slots, commas for the two short asides, and splits the last long sentence in two.
Each sentence now reads straight through.

## Settings

The rule counts dashes per 1000 words. In English it reports above eight per 1000 words; `strict` above three and `relaxed` above twenty:

```yaml chaff-settings
rules:
  no-em-dash: relaxed
```

A dash between two numbers (10:00–10:15) marks a range and is not counted, nor is a dash that opens a line (a sign-off such as — Nina). Short documents are not measured, and the rule does not run on literature. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score notice.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain no-em-dash --genre business/press-release

  Too many dashes   (no-em-dash)

  In English a dash is a legitimate tool, and a heavy hand with it is also one of the better-known marks of generated text. On its own it says little; it counts toward the composite signal. An en dash between two numbers (45–58, 10:00–10:15) marks a range and is not counted. Nor is a dash that ends a paragraph and introduces the list below it, as a colon would, or one that opens its line (an interviewer's turn marked ――, a sign-off such as — Nina, a rule drawn across the page): it sets off no words.

  How to fix: A comma or a pair of brackets usually reads better.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 3 dashes per 1000 words
  → normal   up to 8 dashes per 1000 words
    relaxed  up to 20 dashes per 1000 words
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax no-em-dash --why "reason"
```

[All samples](README.md)
