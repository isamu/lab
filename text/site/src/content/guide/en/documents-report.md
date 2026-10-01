# Business reports

A business report says what happened, and who does what next.
chaff finds, by machine, the writing habits that get in the way of that.
The genre is `business/report`. White papers and internal documents are checked under the same genre.

## What usually goes wrong

A report blurs most when its writer would rather not commit.

| Habit | Example |
| --- | --- |
| An opening that fits any document | "In today's fast-paced world, the enquiries we receive..." |
| Stacked hedges | "it could perhaps be argued that our support team may need to..." |
| A passive that never says who acts | "Updating the FAQ page is being considered." |
| A summary that only repeats | "As described above, ... We will continue to strive for improvement." |

The reader cannot tell what was decided, or whom to ask.

## What chaff checks, and what it does not

These are the main rules for this genre.

| Rule | What it finds | When it runs |
| --- | --- | --- |
| `padded-intro` | An opening that fits any document | Always |
| `max-sentence-length` | A sentence that runs too long | Always |
| `excessive-hedging` | Hedges stacked together | With `--experimental` |
| `agentless-passive` | A passive that never says who did it | With `--experimental` |
| `empty-conclusion` | A conclusion with nothing in it | When an AI reads it, with `npx chaffjs test` |

`--experimental` also runs the rules that are still experimental.
Those rules are still being checked for false alarms. In chaff 0.17.0, the two above are among them.

Some things are left out on purpose.

- chaff never rewrites the text. Fixing is the writer's job.
- It does not check that a number is true. Whether there really were 412 enquiries is for the writer to confirm.
- Whether a conclusion says anything is not decided by machine alone. It needs the meaning, so it goes to an AI.

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The report below was saved as `enquiries.md`.

```markdown
# Report on customer enquiries in September

## Background

In today's fast-paced world, the enquiries we receive from customers are becoming more and more varied, and it could perhaps be argued that our support team may need to keep up with that change.

## September

We received 412 enquiries in September, up from 356 in August. **In particular**, enquiries about billing rose **sharply**; most came from customers who had moved to the new price plan and could not read their invoice, so many of them took a long time to answer.

The first reply took 6.2 hours on average, over our target of 4 hours.

## What we are doing

Updating the FAQ page for billing enquiries is being considered. Adding staff is also being discussed.

## Summary

As described above, enquiries rose in September and the first reply took longer than our target. We will continue to strive for improvement going forward.
```

In the folder that holds the document, type:

```bash
npx chaffjs enquiries.md --genre business/report    check enquiries.md as a report
```

```
$ npx chaffjs enquiries.md --genre business/report

enquiries.md   business/report · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    In today's fast-paced world, the enquiries we receive from customers are becoming more and more varied, and it could per…

  ⚠  Sentence too long

     This sentence runs 34 words (limit 25)
     In a long sentence the reader loses the subject before reaching the verb.

     → Split it in two at the conjunction.

     Relax this rule:  npx chaff relax max-sentence-length


─── line 5 ───────────────────────────────────────────────────

    In today's fast-paced world, the enquiries we receive from customers are becoming more and more varied, and it could per…

  ⚠  Padded opening

     "in today's fast-paced world" is an opening that fits any article
     An opening that fits any article gives the reader no reason to continue.

     → Start from a concrete situation, or from the claim only this piece makes.

     Relax this rule:  npx chaff relax padded-intro


─── line 9 ───────────────────────────────────────────────────

    In particular , enquiries about billing rose sharply ; most came from customers who had moved to the new price plan and …

  ⚠  Sentence too long

     This sentence runs 37 words (limit 25)
     In a long sentence the reader loses the subject before reaching the verb.

     → Split it in two at the conjunction.

     Relax this rule:  npx chaff relax max-sentence-length


────────────────────────────────────────────────────────────

  3 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.

  51 rules did not run:
      adverb-overuse (still experimental)
      agentless-passive (still experimental)
      agreement-slip (still experimental)
      ai-generated-composite (still experimental)
      ai-tell (still experimental)
      announced-count-mismatch (still experimental)
      announcing-opener (still experimental)
      assistant-residue (still experimental)
      colon-lead-in (still experimental)
      contraction-consistency (still experimental)
      contrast-framing (still experimental)
      cushion-phrase-density (still experimental)
      dangling-figure-reference (still experimental)
      dangling-reference (still experimental)
      date-order (still experimental)
      date-range-reversed (still experimental)
      date-weekday-mismatch (still experimental)
      double-keigo (not a rule for en)
      doubled-word (still experimental)
      duplicate-definition (still experimental)
      emoji-density (still experimental)
      empty-conclusion (it reads meaning; npx chaff test runs it)
      excessive-hedging (still experimental)
      expletive-construction (still experimental)
      hiragana-fukushi (not a rule for en)
      internal-jargon (still experimental)
      latin-spacing (not a rule for en)
      max-kanji-continuous (not a rule for en)
      no-doubled-joshi (not a rule for en)
      no-em-dash (still experimental)
      no-mixed-desumasu (not a rule for en)
      no-nakaguro-parallel (not a rule for en)
      numbering-gap (still experimental)
      oxford-comma-consistency (still experimental)
      percent-sum-mismatch (still experimental)
      preferred-term (still experimental)
      proper-noun-density (still experimental)
      repeated-conjunction (still experimental)
      required-sections (still experimental)
      risk-disclosure (it reads meaning; npx chaff test runs it)
      sasete-itadaku (not a rule for en)
      sentence-initial-conjunction-run (still experimental)
      stock-transition (still experimental)
      stray-space (not a rule for en)
      taigen-dome-in-prose (not a rule for en)
      title-case-consistency (still experimental)
      total-mismatch (still experimental)
      undefined-acronym (still experimental)
      unfilled-placeholder (still experimental)
      unqualified-superlative (still experimental)
      unsourced-number (it reads meaning; npx chaff test runs it)
```

There are three findings.
Under each line number, chaff shows the start of the sentence it is about.

| Line | Finding | What it means | How to fix the text |
| --- | --- | --- | --- |
| 5 | Sentence too long | 34 words, over the limit of 25 | Split it. Say what changed in one sentence and what the team does in the next |
| 5 | Padded opening | "In today's fast-paced world" could open any report | Start from what happened in September |
| 9 | Sentence too long | 37 words, over the limit of 25 | Split at the semicolon and at "so" |

## Reading the "did not run" list

At the end, the screen lists the rules it did not use this time, each with its reason.
That way "no findings" is never mistaken for "checked everything and found nothing". There are three reasons.

| Reason | What it means |
| --- | --- |
| still experimental | The rule is still being checked for false alarms. `--experimental` turns it on |
| not a rule for en | The rule is for Japanese documents only |
| it reads meaning; npx chaff test runs it | A machine alone cannot decide it. It runs when an AI reads the passage, with `npx chaffjs test` |

## Running the experimental rules too

With `--experimental`, chaff also looks for hedges and passives.
Here `--compact` prints each finding on two lines: the line and column, then the rule's name.

```
$ npx chaffjs enquiries.md --genre business/report --experimental --compact

enquiries.md   business/report · English   genre from --genre

  5:129   warning This sentence is passive ("argued") but never says who did it
                  agentless-passive
  5:112   warning This sentence stacks 3 hedges ("could, perhaps, may")
                  excessive-hedging
  5:1     warning This sentence runs 34 words (limit 25)
                  max-sentence-length
  5:1     warning "in today's fast-paced world" is an opening that fits any article
                  padded-intro
  9:66    warning This sentence runs 37 words (limit 25)
                  max-sentence-length
  15:54   warning This sentence is passive ("considered") but never says who did it
                  agentless-passive
  15:93   warning This sentence is passive ("discussed") but never says who did it
                  agentless-passive

7 findings, 13 rules not run
```

The four new findings, in plain words:

| Line | Finding | What it means | How to fix the text |
| --- | --- | --- | --- |
| 5 | Passive with no actor | "it could be argued": argued by whom? | Say who thinks so, or just say it |
| 5 | Too much hedging | "could", "perhaps" and "may" in one sentence | Say it outright. If you cannot, say what you would need to know first |
| 15 | Passive with no actor | "is being considered": by whom? | "The support team will add ..." |
| 15 | Passive with no actor | "is being discussed": by whom? | "The head of support will decide ..." |

## Checks that read meaning go to an AI

The "Summary" section only repeats what came before.
That takes reading the meaning to decide, so chaff hands it to an AI with `npx chaffjs test`.
With `--dry-run`, you can see what would be sent without sending anything.

```bash
npx chaffjs test enquiries.md --genre business/report --dry-run    show what would go to the AI (sends nothing)
```

The first part of the screen is the same machine check as above. After it comes:

```
enquiries.md   sends 2 passages out of 8 sentences (the API was not called)

      1 to send  Empty conclusion  (narrowed by machine)
      1 to send  No risk disclosed  (narrowed by machine)
      0 to send  Number without a source  (narrowed by machine)

  The text sent for the first one:

    As described above, enquiries rose in September and the first reply took longer than our target. We will continue to strive for improvement going forward.


────────────────────────────────────────────────────────────

  2 passages in all would be sent. With --dry-run the API was not called.
  Sent to: anthropic / claude-opus-5 (no credentials)
```

Only the two passages the machine narrowed down are sent, never the whole document.
To have an AI actually read them, you need an API key from the AI company.
Anthropic is the default, and `ai_backend` in `chaff.yaml` switches to OpenAI.
Where to put the key is in the [README](https://github.com/isamu/lab/tree/main/text#readme).
Without an AI, every machine check still runs.

## Not typing the genre every time

Without `--genre`, chaff reads the document as a technical article (`blog/tech`).
A report is hard to tell from other kinds by its look, so no line suggests a genre for it.
Set the genre once for the folder where your reports live:

```bash
npx chaffjs init --genre business/report    create chaff.yaml here, with the genre in it
```

After saying it created `chaff.yaml` (the settings file) and `.gitignore`, it shows:

```
The genre is business/report. If that is wrong, change genre in chaff.yaml.
  List: npx chaff genres

Next:
  npx chaff .            check every Markdown file here
```

From then on, `npx chaffjs enquiries.md` in this folder checks the file as a report.

## Silencing one spot on purpose

Sometimes nobody has yet decided which team will update the page.
Then put this line just above the paragraph to silence the passive findings there:

```markdown
<!-- stet: agentless-passive — which team updates the page is not decided yet -->
Updating the FAQ page for billing enquiries is being considered. Adding staff is also being discussed.
```

`stet` marks a spot whose finding is silenced. Write the reason after `—`.
It is a Markdown comment, so nobody opening the document sees it.
Run it again and the two passive findings on line 15 are gone, and the first line counts what was silenced.

```
$ npx chaffjs enquiries.md --genre business/report --experimental --compact

enquiries.md   business/report · English   genre from --genre   2 stet

  5:129   warning This sentence is passive ("argued") but never says who did it
                  agentless-passive
  5:112   warning This sentence stacks 3 hedges ("could, perhaps, may")
                  excessive-hedging
  5:1     warning This sentence runs 34 words (limit 25)
                  max-sentence-length
  5:1     warning "in today's fast-paced world" is an opening that fits any article
                  padded-intro
  9:66    warning This sentence runs 37 words (limit 25)
                  max-sentence-length

5 findings, 13 rules not run
```

## Changing a rule for the whole team

When it is not one spot but how your team works, relax the rule instead.
Say your team's reports always open the Background section with a set phrase:

```bash
npx chaffjs relax padded-intro --why "our Background sections open with a set phrase"
```

This adds the rule to `chaff.yaml`, with the reason, the date and who typed it:

```yaml
  # Padded opening
  # An opening that fits any article gives the reader no reason to continue.
  padded-intro: relaxed # 2026-09-30 our Background sections open with a set phrase / isamu
```

Run it again and the "In today's fast-paced world" opening is no longer flagged.
The reason stays in the file, so whoever comes later can see why it was relaxed.

## After fixing

The report now opens with what happened, drops the hedges, and says who does what and when.
The summary became what the next report will show.

```markdown
# Report on customer enquiries in September

## In short

Enquiries rose in September, and the first reply took longer than our 4-hour target. Most of the rise was customers asking how to read the invoice for the new price plan.

## September

We received 412 enquiries in September, up from 356 in August. The rise was in billing enquiries. Most came from customers who had moved to the new price plan and could not read their invoice.

The first reply took 6.2 hours on average, over our target of 4 hours.

## What we are doing

The support team will add a guide to reading the invoice to the FAQ page during October. The head of support will decide in November whether to add staff, once the October figures are in.

## What the next report will show

Whether the first reply in October was back within the 4-hour target.
```

```
$ npx chaffjs enquiries-fixed.md --genre business/report --experimental

enquiries-fixed.md   business/report · English   genre from --genre

────────────────────────────────────────────────────────────

  No findings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.

  13 rules did not run:
      double-keigo (not a rule for en)
      empty-conclusion (it reads meaning; npx chaff test runs it)
      hiragana-fukushi (not a rule for en)
      latin-spacing (not a rule for en)
      max-kanji-continuous (not a rule for en)
      no-doubled-joshi (not a rule for en)
      no-mixed-desumasu (not a rule for en)
      no-nakaguro-parallel (not a rule for en)
      risk-disclosure (it reads meaning; npx chaff test runs it)
      sasete-itadaku (not a rule for en)
      stray-space (not a rule for en)
      taigen-dome-in-prose (not a rule for en)
      unsourced-number (it reads meaning; npx chaff test runs it)
```

No findings, experimental rules included.
The three checks that read meaning run only when an AI reads the passages.

## What to read next

- How to read the screen, and the three ways to respond to a finding, are in [Getting started](./getting-started).
- To fit rule strength to your team, read [Configuration](./configuration).
- Every rule is explained in the [rule reference](../../rules/).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
